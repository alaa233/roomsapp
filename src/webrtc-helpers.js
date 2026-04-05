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

/**
 * WebSocket URL for signaling. On Capacitor, set `window.__SIGNALING_SERVER_BASE__`
 * (e.g. `https://your-api.example.com`) via `initAppConfig()` / MDM — `location` would
 * otherwise point at the bundled origin and break WSS.
 */
export function wsUrl() {
  const base =
    typeof window !== 'undefined' && window.__SIGNALING_SERVER_BASE__;
  if (base) {
    const u = new URL(base);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${u.host}/ws`;
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

/** Screen Wake Lock — keeps the display awake while streaming (needs Permissions-Policy screen-wake-lock). */
let wakeLockSentinel = null;

export async function acquireScreenWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  if (wakeLockSentinel) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
  } catch {
    /* not visible, low battery, or policy */
  }
}

export async function releaseScreenWakeLock() {
  if (!wakeLockSentinel) return;
  try {
    await wakeLockSentinel.release();
  } catch {
    /* already released */
  }
  wakeLockSentinel = null;
}

/**
 * Permissions API for camera/microphone (Chromium; Safari support varies).
 * Returns latest known states: "granted" | "denied" | "prompt" or null if unsupported.
 */
export async function queryBrowserMediaPermissions() {
  const out = { camera: null, microphone: null };
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return out;
  }
  try {
    const c = await navigator.permissions.query({ name: 'camera' });
    out.camera = c.state;
  } catch {
    /* unsupported name */
  }
  try {
    const m = await navigator.permissions.query({ name: 'microphone' });
    out.microphone = m.state;
  } catch {
    /* unsupported name */
  }
  return out;
}

/**
 * Subscribe to Permission API changes (e.g. user revokes in browser settings).
 * Returns a no-op cleanup function if unsupported.
 */
export function watchBrowserMediaPermissions(onChange) {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return () => {};
  }
  const cleanups = [];
  const attach = async (name, key) => {
    try {
      const p = await navigator.permissions.query({ name });
      const handler = () => onChange(key, p.state);
      p.addEventListener('change', handler);
      cleanups.push(() => p.removeEventListener('change', handler));
    } catch {
      /* ignore */
    }
  };
  void attach('camera', 'camera');
  void attach('microphone', 'microphone');
  return () => {
    for (const fn of cleanups) fn();
  };
}

/**
 * Media Session: marks this page as active media playback so some browsers/OSes
 * throttle the tab less and show a media control (best effort; not full background capture).
 */
export function activateStreamingMediaSession() {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Child Monitor',
      artist: 'Streaming to parent',
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch {
    /* policy or unsupported */
  }
}

export function clearStreamingMediaSession() {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch {
    /* ignore */
  }
}
