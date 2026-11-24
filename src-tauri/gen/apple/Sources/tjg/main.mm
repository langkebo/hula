#import <Foundation/Foundation.h>

#include "bindings/bindings.h"
#import "TjgBridge.h"

int main(int argc, char *argv[]) {
    (void)argc;
    (void)argv;

    @autoreleasepool {
        // ── 主 runloop 探针 ─────────────────────────────────────────
        // SplashScreen.mm 的重试、KeyboardAccessory.mm 的通知订阅、
        // BadgeBridge.mm 的 setBadgeCount: 全部跑在主队列上。
        // 探针通过 (Xcode 控制台可见 [TjgProbe] main runloop is serviced)
        // 即证实 tao 的 UIApplicationMain 已驱动主 runloop。
        dispatch_async(dispatch_get_main_queue(), ^{
            NSLog(@"[TjgProbe] main runloop is serviced");
        });
        // ────────────────────────────────────────────────────────────

        // 两个补丁都必须在 UIApplicationMain 之前发起：
        //   内部会 dispatch 到主队列，等 runloop 起来后安装。
        //   tjg_install_apns_hooks 会在 5s 内重试等到 AppDelegate class 就绪。
        tjg_disable_keyboard_accessory();
        tjg_install_apns_hooks();

        ffi::start_app();
    }

    // 正常情况下 start_app 内部的 UIApplicationMain 不会返回，这里只是兜底。
    return 0;
}
