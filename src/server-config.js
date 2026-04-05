import { Capacitor, registerPlugin } from '@capacitor/core';

const MdmConfig = registerPlugin('MdmConfig', {
  web: () => ({
    async getServerUrl() {
      return { serverUrl: null };
    },
  }),
});

/**
 * Sets `window.__SIGNALING_SERVER_BASE__` when the app must reach a host
 * other than `location` (required for Capacitor WebView: localhost is wrong).
 * Priority: native managed config → VITE_SERVER_URL at build time → unset (web same-origin).
 */
export async function initAppConfig() {
  if (typeof window === 'undefined') return;

  let base = '';

  if (Capacitor.isNativePlatform()) {
    try {
      const { serverUrl } = await MdmConfig.getServerUrl();
      if (serverUrl && String(serverUrl).trim()) {
        base = normalizeBaseUrl(String(serverUrl).trim());
      }
    } catch {
      /* optional */
    }
  }

  if (!base && import.meta.env.VITE_SERVER_URL) {
    base = normalizeBaseUrl(String(import.meta.env.VITE_SERVER_URL).trim());
  }

  if (base) {
    window.__SIGNALING_SERVER_BASE__ = base;
  }
}

function normalizeBaseUrl(url) {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return '';
  }
}
