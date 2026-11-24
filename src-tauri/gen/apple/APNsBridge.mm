//
//  APNsBridge.mm
//  向 tao 在运行时创建的 ObjC 类 "AppDelegate" 注入 APNs 回调。
//
//  背景：本项目没有 Swift/ObjC 源码层面的 AppDelegate（tao 通过 objc2 在运行时注册），
//        因此不能通过子类/extension 挂回调，只能 class_addMethod。
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

    // 转成十六进制字符串，便于直接贴进 APNs 测试工具 / 后端配置
    const unsigned char *bytes = deviceToken.bytes;
    NSMutableString *token = [NSMutableString stringWithCapacity:deviceToken.length * 2];
    for (NSUInteger i = 0; i < deviceToken.length; i++) {
        [token appendFormat:@"%02x", bytes[i]];
    }
    NSLog(@"[TjgAPNs] registered, token = %@", token);

    // TODO: 若需要把 token 传给 Rust 侧，注册一个 C 回调函数指针，在此调用。
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
    //   1. 工程无 aps-environment entitlement
    //   2. 用户拒网 / 无网
    //   3. 模拟器（模拟器不支持真实 APNs）
    NSLog(@"[TjgAPNs] registration failed: %@", error);
}

#pragma mark - 注入

static BOOL TjgInstallAPNsHooksOnce(void) {
    // 每次都用 NSClassFromString 拿，避免缓存过期的 Class 引用。
    Class appDelegateClass = NSClassFromString(@"AppDelegate");
    if (appDelegateClass == Nil) {
        return NO;
    }

    SEL didRegister = @selector(application:didRegisterForRemoteNotificationsWithDeviceToken:);
    SEL didFail = @selector(application:didFailToRegisterForRemoteNotificationsWithError:);

    // 只在类不响应时注入。若将来 tao 或业务层自己实现了，则不覆盖（保留其实现）。
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

// AppDelegate 要等 UIApplicationMain 内部创建，因此需要重试。
// 50 × 100ms = 5s，足够覆盖冷启动。
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

#pragma mark - 对外入口

void tjg_install_apns_hooks(void) {
    // 立即试一次；失败则重试。
    // 注意：调用方可能在 UIApplicationMain 之前调用，此时 AppDelegate 尚不存在，
    //       所以立即失败是正常的，重试负责接住。
    if (TjgInstallAPNsHooksOnce()) {
        return;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
        TjgInstallAPNsHooksWithRetry(0);
    });
}
