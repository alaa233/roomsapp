import {
  acquireScreenWakeLock,
  canAccessUserMedia,
  createIceCandidateQueue,
  getRtcConfiguration,
  getUserMediaCompat,
  isMediaSecureContext,
  releaseScreenWakeLock,
  wsUrl,
} from './webrtc-helpers.js';
import { initAppConfig } from './server-config.js';
import {
  startStreamingForegroundService,
  stopStreamingForegroundService,
} from './native-streaming.js';

await initAppConfig();

const roomInput = document.getElementById('roomId');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const statusEl = document.getElementById('status');
const localPreview = document.getElementById('localPreview');

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

  btnStart.disabled = true;
  setStatus('Requesting camera and microphone…');
  void acquireScreenWakeLock();

  getUserMediaCompat({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;
      localPreview.srcObject = stream;
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
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !localStream) return;
  void acquireScreenWakeLock();
  if (localPreview.srcObject) localPreview.play().catch(() => {});
});

btnStop.addEventListener('click', () => {
  setStatus('Stopped.');
  cleanup();
});
