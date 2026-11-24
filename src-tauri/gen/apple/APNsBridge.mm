//
//  APNsBridge.mm
//  向 tao 在运行时创建的 ObjC 类 "AppDelegate" 注入 APNs 回调。
//
//  背景：本项目没有 Swift/ObjC 源码层面的 AppDelegate（tao 通过 objc2 在运行时注册），
//        因此不能通过子类/extension 挂回调，只能 class_addMethod。
//
//  注意：入口 tjg_install_apns_hooks 用 extern "C" 包裹，
//        确保符号为裸名 _tjg_install_apns_hooks（不是 mangled 的 __Z22...v），
//        否则 Rust 侧 extern "C" 无法链接。
//

#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <dispatch/dispatch.h>

#import "TjgBridge.h"

#pragma mark - 回调实现

static void TjgDidRegisterForRemoteNotifications(UIApplication *app,
                                                 SEL _cmd,
                                                 NSData *deviceToken) {
    (void)app;
    (void)_cmd;

    const unsigned char *bytes = static_cast<const unsigned char *>(deviceToken.bytes);
    NSMutableString *token = [NSMutableString stringWithCapacity:deviceToken.length * 2];
    for (NSUInteger i = 0; i < deviceToken.length; i++) {
        [token appendFormat:@"%02x", bytes[i]];
    }
    NSLog(@"[TjgAPNs] registered, token = %@", token);

    // TODO: 若需要把 token 传给 Rust 侧，注册一个 C 回调，在此调用。
    //       示例：
    //           extern void tjg_on_apns_token(const char *hex);
    //           tjg_on_apns_token(token.UTF8String);
}

static void TjgDidFailToRegisterForRemoteNotifications(UIApplication *app,
                                                       SEL _cmd,
                                                       NSError *error) {
    (void)app;
    (void)_cmd;
    // 常见原因：
    //   1. 工程无 aps-environment entitlement（本仓库当前为空 <dict/>）
    //   2. 用户拒网 / 无网
    //   3. 模拟器不支持真实 APNs
    NSLog(@"[TjgAPNs] registration failed: %@", error);
}

#pragma mark - 注入

static BOOL TjgInstallAPNsHooksOnce(void) {
    // 每次都重新取，避免缓存过期的 Class 引用。
    Class appDelegateClass = NSClassFromString(@"AppDelegate");
    if (appDelegateClass == Nil) {
        return NO;
    }

    SEL didRegister = @selector(application:didRegisterForRemoteNotificationsWithDeviceToken:);
    SEL didFail     = @selector(application:didFailToRegisterForRemoteNotificationsWithError:);

    // 只在类不响应时注入。若将来 tao 或业务层自己实现了，则不覆盖。
    if (!class_getInstanceMethod(appDelegateClass, didRegister)) {
        class_addMethod(appDelegateClass,
                        didRegister,
                        (IMP)TjgDidRegisterForRemoteNotifications,
                        "v@:@@");
        NSLog(@"[TjgAPNs] injected didRegisterForRemoteNotificationsWithDeviceToken:");
    }

    if (!class_getInstanceMethod(appDelegateClass, didFail)) {
        class_addMethod(appDelegateClass,
                        didFail,
                        (IMP)TjgDidFailToRegisterForRemoteNotifications,
                        "v@:@@");
        NSLog(@"[TjgAPNs] injected didFailToRegisterForRemoteNotificationsWithError:");
    }

    return YES;
}

// 50 × 100ms = 5s，覆盖冷启动期间 AppDelegate 被创建的全过程。
static void TjgInstallAPNsHooksWithRetry(int attempt) {
    if (TjgInstallAPNsHooksOnce()) {
        return;
    }
    if (attempt >= 50) {
        NSLog(@"[TjgAPNs] 放弃：5s 内未找到 AppDelegate class");
        return;
    }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
                   dispatch_get_main_queue(), ^{
        TjgInstallAPNsHooksWithRetry(attempt + 1);
    });
}

#pragma mark - 对外入口（必须是 C 链接）

extern "C" void tjg_install_apns_hooks(void) {
    if (TjgInstallAPNsHooksOnce()) {
        return;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
        TjgInstallAPNsHooksWithRetry(0);
    });
}
