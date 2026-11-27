use tauri::{Runtime, plugin::TauriPlugin};
use tauri_plugin_log::fern::colors::{Color, ColoredLevelConfig};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

pub trait CustomInit {
    fn init_plugin(self) -> Self;
}

/// 构建平台特定的日志插件
fn build_log_plugin<R: Runtime>() -> TauriPlugin<R> {
    let builder = tauri_plugin_log::Builder::new()
        .level(tracing::log::LevelFilter::Info)
        .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
        .level_for("sqlx", tracing::log::LevelFilter::Warn)
        .level_for("sqlx::query", tracing::log::LevelFilter::Warn)
        .level_for("sea_orm", tracing::log::LevelFilter::Warn)
        // 迁移器每次启动/切库都会打 INFO（"Applying all pending migrations" 等），
        // 属于常规流程噪音，只在出现 WARN 及以上时保留。
        .level_for("sea_orm_migration", tracing::log::LevelFilter::Warn)
        .level_for("tjg_app_lib", tracing::log::LevelFilter::Debug)
        // 过滤掉无用的 tauri 内部日志
        .level_for("tauri", tracing::log::LevelFilter::Warn)
        .level_for("tauri::manager", tracing::log::LevelFilter::Warn)
        .level_for("tauri::event", tracing::log::LevelFilter::Warn)
        .level_for("tauri::plugin", tracing::log::LevelFilter::Warn)
        .level_for("tauri::ipc", tracing::log::LevelFilter::Warn)
        .level_for("tao", tracing::log::LevelFilter::Warn)
        .level_for("wry", tracing::log::LevelFilter::Warn)
        .level_for("tracing::span", tracing::log::LevelFilter::Warn)
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Webview),
            Target::new(TargetKind::LogDir {
                file_name: Some("logs".to_string()),
            }),
        ])
        // tauri-plugin-log 默认 max_file_size + RotationStrategy::KeepOne：写满即删除
        // 唯一日志文件，登录瞬间的历史日志会整段丢失。显式抬高单文件上限并保留全部
        // 历史文件（按日期重命名归档），避免排障时日志被截断。
        .max_file_size(10 * 1024 * 1024)
        .rotation_strategy(RotationStrategy::KeepAll)
        .with_colors(ColoredLevelConfig {
            error: Color::Red,
            warn: Color::Yellow,
            debug: Color::White,
            info: Color::Green,
            trace: Color::White,
        });

    // #[cfg(desktop)]
    // {
    //     builder = builder.skip_logger();
    // }

    builder.build()
}

/// 初始化公共插件（所有平台通用）
pub fn init_common_plugins<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    let builder = builder
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_mic_recorder::init());

    // 添加日志插件
    builder.plugin(build_log_plugin())
}
