/**
 * STUN (and optional TURN) for RTCPeerConnection.
 * Set VITE_TURN_URLS (comma-separated), VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL in .env for TURN.
 */

function getLegacyGetUserMedia() {
  if (typeof navigator === 'undefined') return null;
  const n = navigator;
  return (
    n.getUserMedia ||
    n.webkitGetUserMedia ||
    n.mozGetUserMedia ||
    n.msGetUserMedia ||
    null
  );
}

/** HTTPS, localhost, etc. — required for `mediaDevices` on most browsers. */
export function isMediaSecureContext() {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

export function canAccessUserMedia() {
  if (typeof navigator === 'undefined') return false;
  const md = navigator.mediaDevices;
  if (md != null && typeof md.getUserMedia === 'function') return true;
  return typeof getLegacyGetUserMedia() === 'function';
}

/**
 * Returns the getUserMedia Promise directly (not an async wrapper) so iOS Safari
 * can keep the call tied to the user tap — async click handlers can break that.
 */
export function getUserMediaCompat(constraints) {
  const md = navigator.mediaDevices;
  if (md != null && typeof md.getUserMedia === 'function') {
    return md.getUserMedia(constraints);
  }

  const legacy = getLegacyGetUserMedia();
  if (legacy != null) {
    return new Promise((resolve, reject) => {
      legacy.call(navigator, constraints, resolve, reject);
    });
  }

  if (!isMediaSecureContext()) {
    return Promise.reject(
      new Error(
        'Use HTTPS or https://localhost (not plain http:// to a network address). Safari hides camera/mic until the page is secure.',
      ),
    );
  }

  return Promise.reject(
    new Error(
      'Camera/microphone are not available here. Open in Safari or Chrome, not inside another app’s browser.',
    ),
  );
}

export function getRtcConfiguration() {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

  const turnUrls = import.meta.env.VITE_TURN_URLS;
  if (turnUrls && String(turnUrls).trim()) {
    const urls = String(turnUrls)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length) {
      const server = { urls };
      const user = import.meta.env.VITE_TURN_USERNAME;
      const credential = import.meta.env.VITE_TURN_CREDENTIAL;
      if (user) server.username = user;
      if (credential) server.credential = credential;
      iceServers.push(server);
    }
  }

  return { iceServers };
}

/** Queue ICE candidates until setRemoteDescription has been applied. */
export function createIceCandidateQueue(pc) {
  const queue = [];
  let remoteDescriptionSet = false;

  return {
    setRemoteDescriptionApplied() {
      remoteDescriptionSet = true;
      for (const candidate of queue) {
        if (candidate) pc.addIceCandidate(candidate).catch(() => {});
      }
      queue.length = 0;
    },
    add(candidate) {
      if (!candidate) return;
      if (remoteDescriptionSet) {
        pc.addIceCandidate(candidate).catch(() => {});
      } else {
        queue.push(candidate);
      }
    },
  };
}

export function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}
