import AVFoundation
import Capacitor
import UIKit

/// Runtime camera/microphone permission checks and Settings deep link for the child app.
@objc(AppPermissionsPlugin)
public class AppPermissionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppPermissions"
    public let jsName = "AppPermissions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestStreamingPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise)
    ]

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "camera": Self.avStatusString(AVCaptureDevice.authorizationStatus(for: .video)),
            "microphone": Self.avStatusString(AVCaptureDevice.authorizationStatus(for: .audio)),
            "notifications": "notApplicable"
        ])
    }

    @objc func requestStreamingPermissions(_ call: CAPPluginCall) {
        let videoStatus = AVCaptureDevice.authorizationStatus(for: .video)
        let audioStatus = AVCaptureDevice.authorizationStatus(for: .audio)

        func requestVideo(_ done: @escaping () -> Void) {
            if videoStatus == .notDetermined {
                AVCaptureDevice.requestAccess(for: .video) { _ in done() }
            } else {
                done()
            }
        }

        func requestAudio(_ done: @escaping () -> Void) {
            if audioStatus == .notDetermined {
                AVCaptureDevice.requestAccess(for: .audio) { _ in done() }
            } else {
                done()
            }
        }

        requestVideo {
            requestAudio {
                DispatchQueue.main.async {
                    self.getStatus(call)
                }
            }
        }
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:]) { _ in
                    call.resolve()
                }
            } else {
                call.reject("Cannot open settings")
            }
        }
    }

    private static func avStatusString(_ status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "granted"
        case .denied, .restricted:
            return "denied"
        case .notDetermined:
            return "prompt"
        @unknown default:
            return "prompt"
        }
    }
}
