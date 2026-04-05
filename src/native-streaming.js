import { Capacitor, registerPlugin } from '@capacitor/core';

const StreamingForeground = registerPlugin('StreamingForeground', {
  web: () => ({
    async start() {},
    async stop() {},
  }),
});

export async function startStreamingForegroundService(options = {}) {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await StreamingForeground.start({
      title: options.title || 'Camera and microphone active',
      body:
        options.body ||
        'Streaming to parent. Tap to return to the app.',
    });
  } catch {
    /* optional */
  }
}

export async function stopStreamingForegroundService() {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await StreamingForeground.stop();
  } catch {
    /* optional */
  }
}
