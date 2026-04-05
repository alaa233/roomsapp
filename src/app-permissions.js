import { Capacitor, registerPlugin } from '@capacitor/core';

const AppPermissions = registerPlugin('AppPermissions', {
  web: () => ({
    async getStatus() {
      return {
        camera: 'granted',
        microphone: 'granted',
        notifications: 'notApplicable',
      };
    },
    async requestStreamingPermissions() {
      return {
        camera: 'granted',
        microphone: 'granted',
        notifications: 'notApplicable',
      };
    },
    async openAppSettings() {},
  }),
});

function isGranted(value) {
  return value === 'granted';
}

/**
 * On native, requests camera/microphone (and POST_NOTIFICATIONS on Android 13+) before WebRTC.
 * @returns {{ ok: true, status?: object } | { ok: false, reason: 'denied', status: object }}
 */
export async function ensureStreamingPermissions() {
  if (!Capacitor.isNativePlatform()) {
    return { ok: true };
  }

  let status = await AppPermissions.getStatus();

  const needCamera = !isGranted(status.camera);
  const needMic = !isGranted(status.microphone);
  const needNotif =
    status.notifications !== 'notApplicable' && !isGranted(status.notifications);

  if (needCamera || needMic || needNotif) {
    status = await AppPermissions.requestStreamingPermissions();
  }

  const ok =
    isGranted(status.camera) &&
    isGranted(status.microphone) &&
    (status.notifications === 'notApplicable' || isGranted(status.notifications));

  if (!ok) {
    return { ok: false, reason: 'denied', status };
  }
  return { ok: true, status };
}

export async function openAppSettingsNative() {
  if (Capacitor.isNativePlatform()) {
    await AppPermissions.openAppSettings();
  }
}
