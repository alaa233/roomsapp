# Mobile child app — enterprise / MDM notes

This project includes a **Capacitor** wrapper around the **child** WebRTC page (`src/child.js`). The native shells live under [`mobile/android`](mobile/android) and [`mobile/ios`](mobile/ios).

## Legal and platform limits

Use only where you have the right to record or observe (consent, your devices, applicable law). **iOS does not support covert background camera/microphone.** Android keeps a **visible foreground notification** while the streaming service is running.

## Build and sync

From the repository root (Node 20+):

```bash
npm install
npm run build:mobile:sync
```

This runs `vite build` with [`vite.mobile.config.js`](vite.mobile.config.js) (output: [`mobile/www`](mobile/www)), then `npx cap sync`, then [`scripts/merge-ios-package-classes.mjs`](scripts/merge-ios-package-classes.mjs) so the iOS bundle’s `packageClassList` includes local SPM plugins such as **`MdmConfigPlugin`** and **`AppPermissionsPlugin`** (Capacitor’s CLI otherwise only auto-detects plugins from npm packages).

## Signaling server URL (required on real devices)

The WebView origin is **not** your API host, so WebSocket URLs must be set explicitly.

1. **Build-time (simplest):** set `VITE_SERVER_URL` in `.env` (see [`.env.example`](.env.example)), e.g. `https://your-service.onrender.com`, then run `npm run build:mobile:sync`.
2. **MDM managed configuration (runtime):**
   - **Android (Enterprise):** Restrictions key **`serverUrl`** — HTTPS origin of your Nest app (same value as `VITE_SERVER_URL`). Implemented in [`MdmConfigPlugin.java`](mobile/android/app/src/main/java/com/webrtcchildmonitor/child/MdmConfigPlugin.java) via `RestrictionsManager`.
   - **iOS:** Managed App Configuration dictionary key **`serverUrl`**. Implemented in [`MdmConfigPlugin.swift`](mobile/ios/App/CapApp-SPM/Sources/CapApp-SPM/MdmConfigPlugin.swift) via `UserDefaults` key `com.apple.configuration.managed`.

Native plugins are registered from JS in [`src/server-config.js`](src/server-config.js); [`src/webrtc-helpers.js`](src/webrtc-helpers.js) builds `wss://…/ws` from `window.__SIGNALING_SERVER_BASE__`.

## Runtime permissions (in-app)

Before WebRTC starts, the child UI calls [`ensureStreamingPermissions()`](src/app-permissions.js), which uses the native **`AppPermissions`** plugin:

- **Android:** Runtime `CAMERA`, `RECORD_AUDIO`, and on **API 33+** `POST_NOTIFICATIONS` (so the foreground-service notification can appear). Status strings match Capacitor’s permission states (`granted`, `denied`, `prompt`, `prompt-with-rationale`). If the user has denied access, the **Open Settings** button opens the app’s system settings ([`AppPermissionsPlugin.java`](mobile/android/app/src/main/java/com/webrtcchildmonitor/child/AppPermissionsPlugin.java)).
- **iOS:** `AVCaptureDevice` authorization for video and audio; `notifications` is reported as `notApplicable`. **Open Settings** uses the app settings URL ([`AppPermissionsPlugin.swift`](mobile/ios/App/CapApp-SPM/Sources/CapApp-SPM/AppPermissionsPlugin.swift)).

**MDM cannot replace** user grants for camera/microphone: devices still show system prompts on first use (or after reset). Plan onboarding accordingly.

## Android

- **Foreground service:** [`StreamingForegroundService`](mobile/android/app/src/main/java/com/webrtcchildmonitor/child/StreamingForegroundService.java) uses types **`camera|microphone`** (Android 14+). A persistent notification is shown while streaming after signaling connects.
- **Permissions:** `CAMERA`, `RECORD_AUDIO`, `FOREGROUND_SERVICE_*`, `POST_NOTIFICATIONS` are declared in [`AndroidManifest.xml`](mobile/android/app/src/main/AndroidManifest.xml).
- **Build:** Open `mobile/android` in Android Studio, install SDK/JDK, then build a release or debug APK/AAB. Distribute via **Managed Google Play** for Android Enterprise.

### Build an APK from the terminal

Prerequisites: **JDK 17+** (e.g. Temurin or Android Studio’s bundled JBR) and **Android SDK** (via Android Studio or `ANDROID_HOME`). From the repo root:

```bash
npm run android:apk
```

This runs `build:mobile:sync`, then `./gradlew assembleDebug`. Output:

- **Debug APK:** `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Unsigned **release** APK (for local testing; Play Store needs a signed AAB/APK):

```bash
npm run android:apk:release
```

Output: `mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk` (sign with your keystore for distribution).

Install a debug build on a device with USB debugging: `adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## iOS

- **Privacy strings:** [`Info.plist`](mobile/ios/App/App/Info.plist) includes `NSCameraUsageDescription` and `NSMicrophoneUsageDescription`.
- **Build:** Open `mobile/ios/App/App.xcodeproj` in Xcode, set your **team** and **signing**, then archive. Distribute with **Apple Business Manager** + MDM (in-house / managed) or **TestFlight** as appropriate.

## Kiosk / dedicated devices

MDM can enable **Single App Mode** or allowlisting so the device stays on the child app; network policies (Wi‑Fi, VPN) should allow HTTPS and WSS to your backend.

## Consent

Administrators should document notice and consent for monitored users and comply with workplace and local laws.
