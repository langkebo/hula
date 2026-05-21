use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const OPENCLAW_DOCS_URL: &str = "https://docs.openclaw.ai/install";
const OPENCLAW_INSTALL_SCRIPT_URL: &str = "https://openclaw.ai/install-cli.sh";
const OPENCLAW_INSTALL_WINDOWS_URL: &str = "https://openclaw.ai/install.ps1";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawInstallStatus {
    pub platform: String,
    pub state: String,
    pub is_installed: bool,
    pub can_auto_install: bool,
    pub executable_path: Option<String>,
    pub version: Option<String>,
    pub docs_url: String,
    pub manual_install_command: Option<String>,
    pub manual_install_steps: Vec<String>,
    pub recommended_next_commands: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawInstallResult {
    pub success: bool,
    pub already_installed: bool,
    pub platform: String,
    pub command_display: String,
    pub logs: Vec<String>,
    pub status: OpenClawInstallStatus,
}

#[tauri::command]
pub async fn detect_openclaw_installation() -> Result<OpenClawInstallStatus, String> {
    Ok(build_install_status())
}

#[tauri::command]
pub async fn install_openclaw() -> Result<OpenClawInstallResult, String> {
    let current_status = build_install_status();
    let command_display = install_command_display(current_status.platform.as_str());

    if current_status.is_installed {
        return Ok(OpenClawInstallResult {
            success: true,
            already_installed: true,
            platform: current_status.platform.clone(),
            command_display,
            logs: vec!["OpenClaw CLI is already available, skipping installation.".to_string()],
            status: current_status,
        });
    }

    if !current_status.can_auto_install {
        return Ok(OpenClawInstallResult {
            success: false,
            already_installed: false,
            platform: current_status.platform.clone(),
            command_display,
            logs: vec!["Automatic installation is not supported on the current platform.".to_string()],
            status: current_status,
        });
    }

    let output = match current_status.platform.as_str() {
        "macos" | "linux" => install_openclaw_unix().await?,
        "windows" => install_openclaw_windows().await?,
        _ => {
            return Ok(OpenClawInstallResult {
                success: false,
                already_installed: false,
                platform: current_status.platform.clone(),
                command_display,
                logs: vec!["Unsupported platform for OpenClaw installation.".to_string()],
                status: current_status,
            });
        }
    };

    let logs = collect_output_lines(&output);
    let refreshed_status = build_install_status();

    Ok(OpenClawInstallResult {
        success: output.status.success() && refreshed_status.is_installed,
        already_installed: false,
        platform: refreshed_status.platform.clone(),
        command_display,
        logs,
        status: refreshed_status,
    })
}

fn build_install_status() -> OpenClawInstallStatus {
    let platform = current_platform();
    let (executable_path, version) = detect_openclaw_cli(platform.as_str());
    let is_installed = executable_path.is_some();

    OpenClawInstallStatus {
        platform: platform.clone(),
        state: match platform.as_str() {
            "macos" | "linux" | "windows" => {
                if is_installed {
                    "installed".to_string()
                } else {
                    "not_installed".to_string()
                }
            }
            _ => "unsupported".to_string(),
        },
        is_installed,
        can_auto_install: matches!(platform.as_str(), "macos" | "linux" | "windows"),
        executable_path,
        version,
        docs_url: OPENCLAW_DOCS_URL.to_string(),
        manual_install_command: manual_install_command(platform.as_str()),
        manual_install_steps: manual_install_steps(platform.as_str()),
        recommended_next_commands: recommended_next_commands(platform.as_str()),
        notes: install_notes(platform.as_str()),
    }
}

fn current_platform() -> String {
    match env::consts::OS {
        "macos" => "macos",
        "windows" => "windows",
        "linux" => "linux",
        _ => "unsupported",
    }
    .to_string()
}

fn detect_openclaw_cli(platform: &str) -> (Option<String>, Option<String>) {
    for candidate in executable_candidates(platform) {
        if let Some(version) = read_openclaw_version(candidate.as_path()) {
            return (Some(candidate.to_string_lossy().to_string()), Some(version));
        }
    }

    for command_name in executable_fallback_commands(platform) {
        if let Some(version) = read_openclaw_version_from_command(command_name) {
            return (Some(command_name.to_string()), Some(version));
        }
    }

    (None, None)
}

fn executable_candidates(platform: &str) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let Some(home_dir) = resolve_home_dir() else {
        return candidates;
    };

    match platform {
        "macos" | "linux" => {
            candidates.push(home_dir.join(".openclaw").join("bin").join("openclaw"));
            candidates.push(home_dir.join(".local").join("bin").join("openclaw"));
        }
        "windows" => {
            candidates.push(
                home_dir
                    .join(".local")
                    .join("bin")
                    .join("openclaw.cmd"),
            );
            candidates.push(
                home_dir
                    .join("AppData")
                    .join("Roaming")
                    .join("npm")
                    .join("openclaw.cmd"),
            );
        }
        _ => {}
    }

    candidates
}

fn executable_fallback_commands(platform: &str) -> Vec<&'static str> {
    match platform {
        "windows" => vec!["openclaw.cmd", "openclaw"],
        _ => vec!["openclaw"],
    }
}

fn read_openclaw_version(executable_path: &Path) -> Option<String> {
    if !executable_path.exists() {
        return None;
    }

    let output = Command::new(executable_path)
        .arg("--version")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    Some(normalize_version_output(&output.stdout))
}

fn read_openclaw_version_from_command(command_name: &str) -> Option<String> {
    let output = Command::new(command_name)
        .arg("--version")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    Some(normalize_version_output(&output.stdout))
}

fn normalize_version_output(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).trim().to_string()
}

fn resolve_home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
}

fn install_command_display(platform: &str) -> String {
    match platform {
        "macos" | "linux" => {
            if let Some(home_dir) = resolve_home_dir() {
                format!(
                    "bash <downloaded install-cli.sh> --json --prefix {} --no-onboard",
                    home_dir.join(".openclaw").display()
                )
            } else {
                "bash <downloaded install-cli.sh> --json --no-onboard".to_string()
            }
        }
        "windows" => "powershell -NoProfile -ExecutionPolicy Bypass -File <downloaded install.ps1> -NoOnboard"
            .to_string(),
        _ => String::new(),
    }
}

fn manual_install_command(platform: &str) -> Option<String> {
    match platform {
        "macos" | "linux" => Some(
            "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash"
                .to_string(),
        ),
        "windows" => Some("iwr -useb https://openclaw.ai/install.ps1 | iex".to_string()),
        _ => None,
    }
}

fn manual_install_steps(platform: &str) -> Vec<String> {
    match platform {
        "macos" => vec![
            "在终端执行官方 install-cli.sh，本地前缀默认安装到 ~/.openclaw。".to_string(),
            "安装完成后执行 ~/.openclaw/bin/openclaw onboard --install-daemon 完成向导和自启动配置。".to_string(),
            "若命令不可用，检查 ~/.openclaw/bin 是否加入 PATH。".to_string(),
        ],
        "linux" => vec![
            "在终端执行官方 install-cli.sh，本地前缀默认安装到 ~/.openclaw。".to_string(),
            "安装完成后执行 ~/.openclaw/bin/openclaw onboard --install-daemon 或 ~/.openclaw/bin/openclaw gateway status。".to_string(),
            "若 shell 无法识别 openclaw，请将 ~/.openclaw/bin 或 npm 全局 bin 目录加入 PATH。".to_string(),
        ],
        "windows" => vec![
            "在 PowerShell 中执行官方 install.ps1 脚本完成安装。".to_string(),
            "Windows 官方支持原生环境，文档同时建议优先使用 WSL2 获得更稳定体验。".to_string(),
            "安装完成后执行 openclaw onboard --install-daemon，并确认 npm 全局目录已加入 PATH。".to_string(),
        ],
        _ => vec!["当前平台暂不支持自动检测，请查看 OpenClaw 官方安装文档。".to_string()],
    }
}

fn recommended_next_commands(platform: &str) -> Vec<String> {
    match platform {
        "macos" | "linux" => vec![
            "~/.openclaw/bin/openclaw --version".to_string(),
            "~/.openclaw/bin/openclaw onboard --install-daemon".to_string(),
            "~/.openclaw/bin/openclaw gateway status".to_string(),
        ],
        "windows" => vec![
            "openclaw --version".to_string(),
            "openclaw onboard --install-daemon".to_string(),
            "openclaw gateway status".to_string(),
        ],
        _ => vec![],
    }
}

fn install_notes(platform: &str) -> Vec<String> {
    match platform {
        "macos" | "linux" => vec![
            "一键安装使用官方 install-cli.sh，避免依赖系统级 Node 或管理员权限。".to_string(),
            "如果安装完成后仍无法连接，请先执行 onboard 或确认 Gateway 已启动。".to_string(),
        ],
        "windows" => vec![
            "一键安装使用官方 PowerShell 安装脚本。".to_string(),
            "如果 openclaw 仍无法识别，请检查 %APPDATA%\\npm 或用户 PATH 配置。".to_string(),
        ],
        _ => vec!["请通过官方文档手动安装 OpenClaw。".to_string()],
    }
}

async fn install_openclaw_unix() -> Result<Output, String> {
    let script = reqwest::get(OPENCLAW_INSTALL_SCRIPT_URL)
        .await
        .map_err(|error| format!("Failed to download OpenClaw installer: {error}"))?
        .text()
        .await
        .map_err(|error| format!("Failed to read OpenClaw installer: {error}"))?;

    let temp_path = env::temp_dir().join("hula-openclaw-install-cli.sh");
    fs::write(&temp_path, script).map_err(|error| format!("Failed to write installer: {error}"))?;

    let prefix = resolve_home_dir()
        .map(|dir| dir.join(".openclaw"))
        .unwrap_or_else(|| PathBuf::from("~/.openclaw"));

    let install_result = tauri::async_runtime::spawn_blocking(move || {
        Command::new("bash")
            .arg(temp_path.as_os_str())
            .args(["--json", "--no-onboard", "--prefix"])
            .arg(prefix.as_os_str())
            .env("OPENCLAW_NO_ONBOARD", "1")
            .env("OPENCLAW_NPM_LOGLEVEL", "warn")
            .output()
    })
    .await
    .map_err(|error| format!("Failed to join installer task: {error}"))?
    .map_err(|error| format!("Failed to execute OpenClaw installer: {error}"))?;

    let _ = fs::remove_file(env::temp_dir().join("hula-openclaw-install-cli.sh"));

    Ok(install_result)
}

async fn install_openclaw_windows() -> Result<Output, String> {
    let script = reqwest::get(OPENCLAW_INSTALL_WINDOWS_URL)
        .await
        .map_err(|error| format!("Failed to download OpenClaw installer: {error}"))?
        .text()
        .await
        .map_err(|error| format!("Failed to read OpenClaw installer: {error}"))?;

    let temp_path = env::temp_dir().join("hula-openclaw-install.ps1");
    fs::write(&temp_path, script).map_err(|error| format!("Failed to write installer: {error}"))?;

    let install_result = tauri::async_runtime::spawn_blocking(move || {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                temp_path.to_string_lossy().as_ref(),
                "-NoOnboard",
            ])
            .env("OPENCLAW_NO_ONBOARD", "1")
            .output()
    })
    .await
    .map_err(|error| format!("Failed to join installer task: {error}"))?
    .map_err(|error| format!("Failed to execute OpenClaw installer: {error}"))?;

    let _ = fs::remove_file(env::temp_dir().join("hula-openclaw-install.ps1"));

    Ok(install_result)
}

fn collect_output_lines(output: &Output) -> Vec<String> {
    let mut lines = String::from_utf8_lossy(&output.stdout)
        .lines()
        .chain(String::from_utf8_lossy(&output.stderr).lines())
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    if lines.is_empty() {
        lines.push(format!("Installer exited with status: {}", output.status));
    }

    const MAX_LINES: usize = 60;
    if lines.len() > MAX_LINES {
        lines = lines.split_off(lines.len() - MAX_LINES);
    }

    lines
}
