import { Capacitor } from '@capacitor/core';
import {
  acquireScreenWakeLock,
  activateStreamingMediaSession,
  canAccessUserMedia,
  clearStreamingMediaSession,
  createIceCandidateQueue,
  getRtcConfiguration,
  getUserMediaCompat,
  isMediaSecureContext,
  releaseScreenWakeLock,
  watchBrowserMediaPermissions,
  wsUrl,
} from './webrtc-helpers.js';
import { initAppConfig } from './server-config.js';
import {
  startStreamingForegroundService,
  stopStreamingForegroundService,
} from './native-streaming.js';
import {
  ensureStreamingPermissions,
  openAppSettingsNative,
} from './app-permissions.js';

await initAppConfig();

const browserHintEl = document.getElementById('browserHint');
const nativeAppHintEl = document.getElementById('nativeAppHint');
if (Capacitor.isNativePlatform() && nativeAppHintEl) {
  nativeAppHintEl.classList.remove('hidden');
  nativeAppHintEl.textContent =
    Capacitor.getPlatform() === 'android'
      ? 'In this app, the device will ask for camera, microphone, and (Android 13+) notification permission so streaming can show a status notification. Then the camera preview may ask again for the in-app player — allow both.'
      : 'In this app, the device will ask for camera and microphone in the system permission dialogs before streaming. Allow them to share with the parent.';
  if (browserHintEl) browserHintEl.classList.add('hidden');
}

const roomInput = document.getElementById('roomId');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const statusEl = document.getElementById('status');
const localPreview = document.getElementById('localPreview');
const backgroundHintEl = document.getElementById('backgroundHint');

let ws = null;
let localStream = null;
let pc = null;
let iceQueue = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function cleanup() {
  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
  }
  iceQueue = null;
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  localPreview.srcObject = null;
  if (ws) {
    ws.onopen = ws.onclose = ws.onmessage = ws.onerror = null;
    ws.close();
    ws = null;
  }
  btnStart.disabled = false;
  btnStop.disabled = true;
  if (btnOpenSettings) btnOpenSettings.classList.add('hidden');
  if (backgroundHintEl) backgroundHintEl.classList.add('hidden');
  unwatchBrowserPermissions();
  unwatchBrowserPermissions = () => {};
  clearStreamingMediaSession();
  releaseScreenWakeLock();
  void stopStreamingForegroundService();
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function ensurePeerConnection() {
  if (pc) return pc;
  pc = new RTCPeerConnection(getRtcConfiguration());
  iceQueue = createIceCandidateQueue(pc);

  pc.onicecandidate = (ev) => {
    if (ev.candidate) send({ type: 'ice', candidate: ev.candidate.toJSON() });
  };

  pc.onconnectionstatechange = () => {
    setStatus(`Connection: ${pc.connectionState}`);
  };

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  return pc;
}

async function runNegotiation() {
  const conn = await ensurePeerConnection();
  const offer = await conn.createOffer();
  await conn.setLocalDescription(offer);
  send({ type: 'offer', sdp: offer.sdp });
}

function formatGetUserMediaError(e) {
  const name = e && e.name;
  const msg = (e && e.message) || String(e);
  if (name === 'NotAllowedError' || /not allowed/i.test(msg)) {
    if (Capacitor.isNativePlatform()) {
      return (
        'Camera or microphone was blocked for this app. Tap Open Settings, enable Camera and Microphone for this app, then try Start sharing again.'
      );
    }
    return (
      'Camera/mic blocked. On iPhone: use Safari (not in-app browsers), tap Allow if asked. ' +
      'Settings → Safari → scroll to Camera/Microphone for websites. Turn off Private Browsing and try again.'
    );
  }
  return `Could not access camera/mic: ${msg}`;
}

function connectWebSocket(roomId) {
  setStatus('Connecting to signaling…');
  ws = new WebSocket(wsUrl());

  ws.onopen = () => {
    send({ type: 'join', roomId });
    setStatus('Joined room. Waiting for parent…');
    btnStop.disabled = false;
    void startStreamingForegroundService();
  };

  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    onSignalMessage(msg);
  };

  ws.onclose = () => {
    setStatus('Signaling disconnected.');
    cleanup();
  };

  ws.onerror = () => setStatus('Signaling error.');
}

function onSignalMessage(msg) {
  if (msg.type === 'peer-joined') {
    if (localStream) runNegotiation().catch((e) => setStatus(String(e.message || e)));
    return;
  }
  if (msg.type === 'peer-left') {
    setStatus('Parent disconnected. Waiting for them to reconnect…');
    if (pc) {
      pc.close();
      pc = null;
      iceQueue = null;
    }
    return;
  }
  if (msg.type === 'answer' && msg.sdp) {
    if (!pc) return;
    pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp }).then(() => {
      iceQueue.setRemoteDescriptionApplied();
    });
    return;
  }
  if (msg.type === 'ice' && msg.candidate && pc && iceQueue) {
    iceQueue.add(new RTCIceCandidate(msg.candidate));
    return;
  }
  if (msg.type === 'child-audio' && localStream) {
    const track = localStream.getAudioTracks()[0];
    if (track) track.enabled = !!msg.enabled;
    return;
  }
  if (msg.type === 'child-video' && localStream) {
    const track = localStream.getVideoTracks()[0];
    if (track) track.enabled = !!msg.enabled;
    return;
  }
}

btnStart.addEventListener('click', () => {
  void (async () => {
    const roomId = roomInput.value.trim();
    if (!roomId) {
      setStatus('Enter a room ID.');
      return;
    }

    if (!isMediaSecureContext()) {
      setStatus(
        'This page is not secure (often http:// on a phone or LAN IP). Open the app with HTTPS so Safari exposes the camera and microphone.',
      );
      return;
    }

    if (!canAccessUserMedia()) {
      setStatus(
        'No camera/microphone API in this browser. Use Safari or Chrome directly, or enable HTTPS.',
      );
      return;
    }

    const perm = await ensureStreamingPermissions();
    if (!perm.ok) {
      setStatus(
        'This app needs camera and microphone in Settings (and notifications on Android 13+). Tap Open Settings to allow them, then try again.',
      );
      if (btnOpenSettings) btnOpenSettings.classList.remove('hidden');
      return;
    }
    if (btnOpenSettings) btnOpenSettings.classList.add('hidden');

    btnStart.disabled = true;
    setStatus('Requesting camera and microphone…');
    void acquireScreenWakeLock();

    getUserMediaCompat({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;
      localPreview.srcObject = stream;
      activateStreamingMediaSession();
      unwatchBrowserPermissions();
      unwatchBrowserPermissions = watchBrowserMediaPermissions((key, state) => {
        if (state === 'denied' && localStream) {
          setStatus(
            `Browser ${key} permission was revoked. Stop sharing and start again after fixing site settings.`,
          );
        }
      });
      void acquireScreenWakeLock();
      return localPreview.play().catch(() => {});
    })
    .then(() => {
      connectWebSocket(roomId);
    })
    .catch((e) => {
      setStatus(formatGetUserMediaError(e));
      btnStart.disabled = false;
    });
  })();
});

if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', () => {
    void openAppSettingsNative();
  });
}

document.addEventListener('visibilitychange', () => {
  if (!localStream) return;
  if (document.visibilityState === 'hidden') {
    if (backgroundHintEl) backgroundHintEl.classList.remove('hidden');
    return;
  }
  if (backgroundHintEl) backgroundHintEl.classList.add('hidden');
  void acquireScreenWakeLock();
  if (localPreview.srcObject) localPreview.play().catch(() => {});
});

btnStop.addEventListener('click', () => {
  setStatus('Stopped.');
  cleanup();
});
