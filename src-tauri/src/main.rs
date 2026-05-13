// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dotenvy::dotenv;

#[cfg(target_os = "linux")]
use hula_app_lib::utils::linux_runtime_guard as runtime_guard;
#[cfg(target_os = "macos")]
use hula_app_lib::utils::macos_runtime_guard as runtime_guard;
#[cfg(target_os = "windows")]
use hula_app_lib::utils::win_runtime_guard as runtime_guard;

fn main() -> std::io::Result<()> {
    dotenv().ok();
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    {
        runtime_guard::apply_runtime_guards();
    }

    let args: Vec<String> = std::env::args().collect();
    let mut profile_name: Option<String> = None;
    let mut profile_dir: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--profile" => {
                if i + 1 < args.len() {
                    profile_name = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--profile-dir" => {
                if i + 1 < args.len() {
                    profile_dir = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }

    // Priority: --profile-dir > --profile > HULA_PROFILE_DIR env var > default
    let profile_path = if let Some(ref dir) = profile_dir {
        dir.clone()
    } else if let Some(ref name) = profile_name {
        let default_dir = get_default_app_data_dir();
        format!("{}-{}", default_dir, name)
    } else if let Ok(env_dir) = std::env::var("HULA_PROFILE_DIR") {
        env_dir
    } else {
        String::new()
    };

    if !profile_path.is_empty() {
        // SAFETY: Setting environment variable before any multi-threading occurs in main
        unsafe {
            std::env::set_var("HULA_PROFILE_DIR", &profile_path);
        }
        println!(
            "[PROFILE] Using profile data directory: {} (profile={:?}, dir={:?})",
            profile_path, profile_name, profile_dir
        );
    }

    hula_app_lib::run();
    Ok(())
}

fn get_default_app_data_dir() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}/Library/Application Support/com.hula.pc", home);
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return format!("{}/com.hula.pc", appdata);
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}/.local/share/com.hula.pc", home);
        }
    }
    String::new()
}
