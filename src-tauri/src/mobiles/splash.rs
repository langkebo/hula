// 启动画面（splash）控制。
//
// 平台说明（Tauri 2.11.5）：
// - iOS：调用链接的 C 函数（由 Swift/Objective-C 提供）。
// - 桌面 / Android：无原生 splash，no-op。
//
// 关于 Android 原生 splash 为什么被移除（根因分析）：
// 原实现在 Android 上调用 ndk_context::android_context() 以拿到 JNI 的
// JavaVM/Activity 句柄，再 call_method(activity, "show" / "hide")。
// 但 Tauri 2.x 的 runtime 完全不初始化 ndk_context（它用的是自己的
// mobile_entry_point + wry glue，而非 ndk-glue），因此 android_context()
// 内部 `ANDROID_CONTEXT.expect("android context was not initialized")` 会直接
// panic（SIGABRT），导致 App 在启动瞬间崩溃、永远进不去界面。
// 此外，应用层也无法访问 Tauri 内部的 run_on_android_context / RuntimeHandle
// （二者均为 pub(crate)），且生成的 MainActivity 也根本没有 show()/hide()
// 方法，所以这条原生 splash 路径在 Android 上既会崩溃、也不可能产生任何效果。
// 故 Android 端改为 no-op；如需原生 splash，应在 Kotlin 侧初始化 ndk_context
// 并为 MainActivity 实现 show()/hide()（属于额外功能，非本次崩溃修复范围）。

#[cfg(target_os = "ios")]
mod platform {
    unsafe extern "C" {
        fn tjg_show_splashscreen();
        fn tjg_hide_splashscreen();
    }

    pub fn show() {
        unsafe { tjg_show_splashscreen() };
    }

    pub fn hide() {
        unsafe { tjg_hide_splashscreen() };
    }
}

#[cfg(target_os = "android")]
mod platform {
    pub fn show() {}
    pub fn hide() {}
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod platform {
    pub fn show() {}
    pub fn hide() {}
}

pub fn show() {
    platform::show();
}

pub fn hide() {
    platform::hide();
}

/// Tauri command: 隐藏启动画面（由前端调用）
#[tauri::command]
pub fn hide_splash_screen() -> Result<(), String> {
    tracing::info!("hide_splash_screen called from frontend");
    hide();
    Ok(())
}
