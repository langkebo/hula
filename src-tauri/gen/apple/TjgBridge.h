//
//  TjgBridge.h
//  原生 <-> Rust 的唯一桥接头。
//  所有 .mm 与 Rust 侧（bindgen 或手写 extern）引用同一份，签名变化时编译期即可发现。
//

#pragma once

#include <stdint.h>

#if defined(__cplusplus)
#define TJG_EXTERN_C_BEGIN extern "C" {
#define TJG_EXTERN_C_END }
#else
#define TJG_EXTERN_C_BEGIN
#define TJG_EXTERN_C_END
#endif

// Release 下 -dead_strip 可能剥掉未被引用的符号，显式标可见性，
// 避免 Rust 侧链接失败或 dlsym 拿到 NULL。
#ifndef TJG_EXPORT
#define TJG_EXPORT __attribute__((visibility("default")))
#endif

TJG_EXTERN_C_BEGIN

/// 显示原生启动图蒙层。可从任意线程调用，内部切到主线程。
TJG_EXPORT void tjg_show_splashscreen(void);

/// 隐藏原生启动图蒙层（0.35s 淡出）。可从任意线程调用。
TJG_EXPORT void tjg_hide_splashscreen(void);

/// 设置应用角标（夹在 0...99）。高频调用会被合并，只写最后一次。可从任意线程调用。
TJG_EXPORT void tjg_set_application_badge(int32_t count);

/// 申请角标授权。注意：本函数不再自动注册 APNs，需要推送时请另行调用
/// tjg_register_for_remote_notifications()。
TJG_EXPORT void tjg_request_badge_authorization(void);

/// 注册 APNs。需要工程开启 Push Notifications 能力（aps-environment entitlement），
/// 否则会静默失败，只能从 AppDelegate 的 didFailToRegister... 观察到。
TJG_EXPORT void tjg_register_for_remote_notifications(void);

/// 去掉键盘上方快捷键栏（iPad）。只需在启动时调用一次。
TJG_EXPORT void tjg_disable_keyboard_accessory(void);

/// 向 tao 在运行时创建的 "AppDelegate" ObjC 类注入 APNs 回调。
/// 必须在 UIApplicationMain 之前发起（内部会重试等待 class 就绪，最多 5s）。
/// 若将来 tao 自己实现了回调，本函数不会覆盖。
TJG_EXPORT void tjg_install_apns_hooks(void);

TJG_EXTERN_C_END
