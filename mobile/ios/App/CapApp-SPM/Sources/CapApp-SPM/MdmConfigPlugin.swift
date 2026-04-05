import Foundation
import Capacitor

/// Reads Apple Managed App Configuration (`com.apple.configuration.managed`), e.g. `serverUrl` from MDM.
@objc(MdmConfigPlugin)
public class MdmConfigPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MdmConfig"
    public let jsName = "MdmConfig"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getServerUrl", returnType: CAPPluginReturnPromise)
    ]

    @objc func getServerUrl(_ call: CAPPluginCall) {
        let managed = UserDefaults.standard.dictionary(forKey: "com.apple.configuration.managed") as? [String: Any]
        if let url = managed?["serverUrl"] as? String, !url.isEmpty {
            call.resolve(["serverUrl": url])
        } else {
            call.resolve(["serverUrl": NSNull()])
        }
    }
}
