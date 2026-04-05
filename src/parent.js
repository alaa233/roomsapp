import {
  createIceCandidateQueue,
  getRtcConfiguration,
  wsUrl,
} from './webrtc-helpers.js';

const roomInput = document.getElementById('roomId');
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');
const statusEl = document.getElementById('status');
const remoteVideo = document.getElementById('remoteVideo');
const remoteControls = document.getElementById('remoteControls');
const btnChildMic = document.getElementById('btnChildMic');
const btnChildCam = document.getElementById('btnChildCam');

let ws = null;
let pc = null;
let iceQueue = null;
let childMicOn = true;
let childCamOn = true;

function setStatus(text) {
  statusEl.textContent = text;
}

function setRemoteMediaControlsVisible(show) {
  if (remoteControls) remoteControls.classList.toggle('hidden', !show);
}

function updateChildMediaButtons() {
  if (btnChildMic) {
    btnChildMic.textContent = childMicOn
      ? 'Turn off child mic'
      : 'Turn on child mic';
  }
  if (btnChildCam) {
    btnChildCam.textContent = childCamOn
      ? 'Turn off child cam'
      : 'Turn on child cam';
  }
}

function setChildMediaButtonsEnabled(enabled) {
  if (btnChildMic) btnChildMic.disabled = !enabled;
  if (btnChildCam) btnChildCam.disabled = !enabled;
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
  remoteVideo.srcObject = null;
  if (ws) {
    ws.onopen = ws.onclose = ws.onmessage = ws.onerror = null;
    ws.close();
    ws = null;
  }
  btnConnect.disabled = false;
  btnDisconnect.disabled = true;
  childMicOn = true;
  childCamOn = true;
  updateChildMediaButtons();
  setChildMediaButtonsEnabled(false);
  setRemoteMediaControlsVisible(false);
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function ensurePeerConnection() {
  if (pc) return pc;
  pc = new RTCPeerConnection(getRtcConfiguration());
  iceQueue = createIceCandidateQueue(pc);

  pc.ontrack = (ev) => {
    const [stream] = ev.streams;
    remoteVideo.srcObject = stream || new MediaStream([ev.track]);
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) send({ type: 'ice', candidate: ev.candidate.toJSON() });
  };

  pc.onconnectionstatechange = () => {
    setStatus(`Connection: ${pc.connectionState}`);
  };

  return pc;
}

async function handleOffer(sdp) {
  const conn = ensurePeerConnection();
  await conn.setRemoteDescription({ type: 'offer', sdp });
  iceQueue.setRemoteDescriptionApplied();
  const answer = await conn.createAnswer();
  await conn.setLocalDescription(answer);
  send({ type: 'answer', sdp: answer.sdp });
}

function onSignalMessage(msg) {
  if (msg.type === 'peer-joined') {
    setStatus('Peer joined. Waiting for offer…');
    return;
  }
  if (msg.type === 'peer-left') {
    setStatus('Child disconnected.');
    if (pc) {
      pc.close();
      pc = null;
      iceQueue = null;
    }
    remoteVideo.srcObject = null;
    return;
  }
  if (msg.type === 'offer' && msg.sdp) {
    handleOffer(msg.sdp).catch((e) => setStatus(String(e.message || e)));
    return;
  }
  if (msg.type === 'ice' && msg.candidate && pc && iceQueue) {
    iceQueue.add(new RTCIceCandidate(msg.candidate));
  }
}

btnConnect.addEventListener('click', () => {
  const roomId = roomInput.value.trim();
  if (!roomId) {
    setStatus('Enter a room ID.');
    return;
  }

  btnConnect.disabled = true;
  setStatus('Connecting to signaling…');

  ws = new WebSocket(wsUrl());

  ws.onopen = () => {
    send({ type: 'join', roomId });
    setStatus('Joined room. Waiting for child stream…');
    btnDisconnect.disabled = false;
    childMicOn = true;
    childCamOn = true;
    updateChildMediaButtons();
    setChildMediaButtonsEnabled(true);
    setRemoteMediaControlsVisible(true);
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
});

btnDisconnect.addEventListener('click', () => {
  setStatus('Disconnected.');
  cleanup();
});

btnChildMic?.addEventListener('click', () => {
  childMicOn = !childMicOn;
  updateChildMediaButtons();
  send({ type: 'child-audio', enabled: childMicOn });
});

btnChildCam?.addEventListener('click', () => {
  childCamOn = !childCamOn;
  updateChildMediaButtons();
  send({ type: 'child-video', enabled: childCamOn });
});
