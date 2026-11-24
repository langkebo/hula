// 文件名自定义，例如 AppDelegate+APNs.swift
// 放到与 AppDelegate.swift 同目录，Xcode 会自动纳入 target

import UIKit

extension AppDelegate {

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        NSLog("[TjgAPNs] registered, token = %@", token)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // 最常见原因：没有 aps-environment entitlement / 无网络 / 模拟器
        NSLog("[TjgAPNs] registration failed: %@", error as NSError)
    }
}
