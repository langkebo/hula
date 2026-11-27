use crate::error::CommonError;
use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

// 应用程序设置结构体
#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct Settings {
    pub database: DatabaseSettings,
    pub backend: BackendSettings,
    pub youdao: Option<Youdao>,
    pub tencent: Option<Tencent>,
    pub minio: Option<MinioSettings>,
    pub ice_server: Option<IceServer>,
}

// 数据库配置设置
#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct DatabaseSettings {
    pub sqlite_file: String,
}

// 后端服务配置设置
#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct BackendSettings {
    pub base_url: String,
    pub ws_url: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct Youdao {
    pub app_key: String,
    pub app_secret: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct IceServer {
    pub urls: Vec<String>,
    pub username: String,
    pub credential: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct Tencent {
    pub api_key: String,
    pub secret_id: String,
    pub map_key: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct MinioSettings {
    pub endpoint: String,
    pub bucket: String,
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
    pub download_domain: String,
}

// 应用程序运行环境枚举
#[derive(Debug)]
pub enum Environment {
    Local,
    Production,
}

/// Windows 文件名中非法、且可能影响路径层级的字符。
///
/// `:` 是 Matrix 用户 ID 的必需部分（`@localpart:domain`），但在 Windows 上非法 ⇒
/// `db_@test1:matrix.test.sqlite` 在 Windows 建库直接失败（桌面端含 windows 目标）。
/// 同时含路径分隔符，避免异常 uid 影响目录层级（路径穿越）。
const ILLEGAL_FILENAME_CHARS: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

/// 把 uid 归一化为**跨平台合法**的文件名片段：非法字符与控制字符 → `_`。
///
/// 额外的两处 Windows 语义（不是所有非法字符都由 `ILLEGAL_FILENAME_CHARS` 覆盖）：
/// - 尾随 `.` / 空格会被 Win32 静默剥离 ⇒ 会与「写进去的名字」不一致，故去掉；
/// - 保留设备名（CON/PRN/AUX/NUL/COM1…）不可作文件名 —— Matrix ID 必以 `@` 开头，
///   不会命中，故不额外处理（保留了 `@`，也就不会误伤合法 uid）。
pub(crate) fn sanitize_uid_for_filename(uid: &str) -> String {
    let sanitized: String = uid
        .chars()
        .map(|ch| {
            if ILLEGAL_FILENAME_CHARS.contains(&ch) || ch.is_control() {
                '_'
            } else {
                ch
            }
        })
        .collect();

    let trimmed = sanitized.trim_end_matches(['.', ' ']);
    if trimmed.is_empty() {
        // 全被剥掉（如 uid 全是点/空格）⇒ 退回占位，避免退化成 "db_.sqlite" 之外的异常名
        "_".to_string()
    } else {
        trimmed.to_string()
    }
}

/// 桌面开发环境的数据库子目录名（相对 `app_data_dir`）。
///
/// 开发构建与正式安装包的 identifier 相同（`com.tjg.pc`）⇒ `app_data_dir` 也相同，
/// 直接共用会让 dev 构建读写真实用户的本地消息库；而放在源码目录（旧实现
/// `CARGO_MANIFEST_DIR`）又会让 `db_@user:host.sqlite` 散落在仓库里。
const DEV_DATABASE_SUBDIR: &str = "dev";

/// 选择数据库目录（纯函数，便于测试）。
fn select_database_dir(app_data_dir: PathBuf, is_desktop_dev: bool) -> PathBuf {
    if is_desktop_dev {
        app_data_dir.join(DEV_DATABASE_SUBDIR)
    } else {
        app_data_dir
    }
}

/// 解析数据库所在目录（桌面 dev 用 `app_data_dir/dev/`，其余用 `app_data_dir`）。
///
/// 抽成独立函数是为了让「切库 / 迁库」能复用同一套目录规则：路径解析分散到两处时，
/// 一旦某一处漏改就会在「迁移写 A 目录、连接读 B 目录」这种地方静默丢数据。
fn database_dir(app_handle: &AppHandle) -> Result<PathBuf, CommonError> {
    let app_data_dir = match app_handle.path().app_data_dir() {
        Ok(dir) => dir,
        Err(e) => {
            let error_msg = format!("Failed to get app_data_dir: {}", e);
            tracing::error!("{}", error_msg);
            return Err(CommonError::RequestError(error_msg));
        }
    };

    let dir = select_database_dir(app_data_dir, cfg!(debug_assertions) && cfg!(desktop));
    if let Err(create_err) = std::fs::create_dir_all(&dir) {
        tracing::warn!("Failed to create database dir {:?}: {}", dir, create_err);
    }
    Ok(dir)
}

impl DatabaseSettings {
    /// 解析某用户的数据库文件绝对路径（含历史文件名的一次性改名迁移）。
    ///
    /// 供「切库 / 迁库」这类需要**在打开连接之前**拿到路径的调用方使用；
    /// `connection_string` 也走同一套目录与文件名规则，避免两处推导不一致。
    pub fn user_db_path(
        &self,
        app_handle: &AppHandle,
        uid: Option<&str>,
    ) -> Result<PathBuf, CommonError> {
        let dir = database_dir(app_handle)?;
        Ok(dir.join(Self::resolve_db_filename(&dir, uid)))
    }

    /// 根据用户ID生成数据库文件名
    /// 如果提供了用户ID，则生成 `db_{uid}.sqlite` 格式的文件名
    /// 否则使用默认的 `db.sqlite`
    ///
    /// uid 会先经 [`sanitize_uid_for_filename`] 归一化，使文件名在各平台合法。
    fn get_db_filename(uid: Option<&str>) -> String {
        match uid {
            Some(id) if !id.is_empty() => format!("db_{}.sqlite", sanitize_uid_for_filename(id)),
            _ => "db.sqlite".to_string(),
        }
    }

    /// **历史**（未归一化）文件名 `db_{raw_uid}.sqlite`；仅在归一化确实改变了名字时才返回。
    ///
    /// 用于一次性迁移：既有安装（macOS/Linux）里数据库就叫 `db_@u:host.sqlite`，
    /// 若改名后直接新建，本地消息缓存会被**静默丢弃**（服务端回填有限）。
    fn get_legacy_db_filename(uid: Option<&str>) -> Option<String> {
        match uid {
            Some(id) if !id.is_empty() => {
                let legacy = format!("db_{}.sqlite", id);
                (legacy != Self::get_db_filename(uid)).then_some(legacy)
            }
            _ => None,
        }
    }

    /// 解析实际使用的数据库文件名（含一次性迁移），目录为 `dir`。
    ///
    /// 迁移语义：
    /// - 旧文件不存在 / 新文件已存在 ⇒ 直接用归一化名（幂等，不重复迁移）；
    /// - 旧文件存在且新文件不存在 ⇒ `rename`；**失败时保留旧名**并告警 ——
    ///   宁可文件名不归一，也不能因迁移失败而丢失本地数据。
    fn resolve_db_filename(dir: &Path, uid: Option<&str>) -> String {
        let current = Self::get_db_filename(uid);
        let Some(legacy) = Self::get_legacy_db_filename(uid) else {
            return current;
        };

        let legacy_path = dir.join(&legacy);
        let current_path = dir.join(&current);
        if !legacy_path.exists() || current_path.exists() {
            return current;
        }

        match std::fs::rename(&legacy_path, &current_path) {
            Ok(()) => {
                info!(
                    "Migrated legacy database filename to cross-platform safe name: {} -> {}",
                    legacy, current
                );
                current
            }
            Err(err) => {
                tracing::warn!(
                    "Failed to migrate legacy database filename {} -> {}: {}. Continuing with the legacy name (functionality unaffected).",
                    legacy,
                    current,
                    err
                );
                legacy
            }
        }
    }

    /// 解析本次运行使用的数据库文件路径（不建立连接）。
    ///
    /// 目录确定后才会解析文件名，因此若本机存在历史（含 `:` 等非法字符）数据库文件，
    /// 这里会顺带完成 `resolve_db_filename` 的一次性改名迁移。
    pub fn database_path(
        &self,
        app_handle: &AppHandle,
        uid: Option<&str>,
    ) -> Result<PathBuf, CommonError> {
        let db_dir = database_dir(app_handle)?;
        let db_filename = Self::resolve_db_filename(&db_dir, uid);
        info!("Database filename: {}", db_filename);
        Ok(db_dir.join(db_filename))
    }

    /// 创建数据库连接
    /// 根据不同的运行环境（桌面开发、移动端、桌面生产）选择合适的数据库路径
    /// 并配置数据库连接选项，返回数据库连接实例
    ///
    /// # 参数
    /// * `app_handle` - Tauri应用句柄，用于获取应用路径
    /// * `uid` - 可选的用户ID，用于生成用户专属的数据库文件
    ///
    /// # 返回值
    /// * `Ok(DatabaseConnection)` - 成功时返回数据库连接
    /// * `Err(CommonError)` - 失败时返回错误信息
    pub async fn connection_string(
        &self,
        app_handle: &AppHandle,
        uid: Option<&str>,
    ) -> Result<DatabaseConnection, CommonError> {
        // 数据库路径配置：先确定目录，再在其中解析文件名（含一次性迁移，见 `resolve_db_filename`）。
        let db_path = self.database_path(app_handle, uid)?;
        info!("Database path: {:?}", db_path);

        if db_path.exists() {
            match probe_db_header(&db_path) {
                DbHeaderVerdict::Sqlite => {}
                DbHeaderVerdict::NotSqlite => {
                    // 文件可能承载用户本地消息：只备份，绝不删除（C-03）。
                    // 备份失败时让启动失败并保留原文件，避免静默新建空库把数据「洗掉」。
                    let backup = backup_unusable_database(&db_path).map_err(|backup_err| {
                        anyhow::anyhow!(
                            "database file is not SQLite and cannot be backed up ({}): {:?}. Refusing to delete it, please inspect the file manually.",
                            backup_err,
                            db_path
                        )
                    })?;
                    warn!(
                        "database file header is not SQLite, backed up to {:?} (a new database will be created)",
                        backup
                    );
                }
                DbHeaderVerdict::Unknown => warn!(
                    "failed to read database file header, treated as unknown and kept the file as-is (not considered corrupted): {:?}",
                    db_path
                ),
            }
        }

        match Database::connect(sqlite_connect_options(&db_path)).await {
            Ok(db) => Ok(db),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("file is not a database") || msg.contains("code: 26") {
                    // 页级损坏：先备份再重建，禁止直接删除（C-03）。
                    let backup = backup_unusable_database(&db_path).map_err(|backup_err| {
                        anyhow::anyhow!(
                            "database is corrupted but cannot be backed up ({}): {:?}. Refusing to delete it. Original error: {}",
                            backup_err,
                            db_path,
                            msg
                        )
                    })?;
                    warn!(
                        "database connection failed with a corruption error ({}), backed up to {:?} and recreating",
                        msg, backup
                    );
                    let db = Database::connect(sqlite_connect_options(&db_path))
                        .await
                        .map_err(|e| anyhow::anyhow!("Database connection failed: {}", e))?;
                    Ok(db)
                } else {
                    Err(anyhow::anyhow!("Database connection failed: {}", e).into())
                }
            }
        }
    }
}

/// 统一的 SQLite 连接参数，避免「备份重建」分支与主分支配置漂移。
fn sqlite_connect_options(db_path: &Path) -> ConnectOptions {
    let mut opt = ConnectOptions::new(format!("sqlite:{}?mode=rwc", db_path.display()));
    opt.max_connections(20) // 降低最大连接数，避免资源浪费
        .min_connections(2) // 降低最小连接数
        .connect_timeout(Duration::from_secs(30)) // 增加连接超时时间
        .acquire_timeout(Duration::from_secs(30)) // 增加获取连接超时时间
        .idle_timeout(Duration::from_secs(600)) // 10分钟空闲超时
        .max_lifetime(Duration::from_secs(1800)) // 30分钟连接生命周期，避免频繁重建
        // 启用 SQL 日志记录，但只在 debug 模式下
        .sqlx_logging(cfg!(debug_assertions))
        .sqlx_logging_level(tracing::log::LevelFilter::Info);
    opt
}

/// 备份损坏/非 SQLite 的数据库文件，返回备份路径。
///
/// 本地数据库承载用户消息，任何「损坏即删除」都会造成不可恢复的数据丢失（C-03）。
/// 备份名带时间戳并保留原文件名，同名冲突时追加序号；主文件与 `-wal`/`-shm`/`-journal`
/// 一并移动，避免残留日志被下一次连接误读。
fn backup_unusable_database(db_path: &Path) -> std::io::Result<PathBuf> {
    let file_name = db_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "database".to_string());
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default();

    let mut backup = db_path.with_file_name(format!("{file_name}.corrupted-{stamp}"));
    let mut suffix = 1;
    while backup.exists() {
        backup = db_path.with_file_name(format!("{file_name}.corrupted-{stamp}-{suffix}"));
        suffix += 1;
    }
    std::fs::rename(db_path, &backup)?;

    for sidecar in ["-wal", "-shm", "-journal"] {
        let source = PathBuf::from(format!("{}{sidecar}", db_path.to_string_lossy()));
        if source.exists() {
            let target = PathBuf::from(format!("{}{sidecar}", backup.to_string_lossy()));
            if let Err(rename_err) = std::fs::rename(&source, &target) {
                warn!(
                    "failed to move sqlite sidecar {:?} to {:?}: {}",
                    source, target, rename_err
                );
            }
        }
    }

    Ok(backup)
}

/// 迁移前数据库快照：checkpoint WAL 后复制主库文件，返回快照路径（C-02）。
///
/// WAL 模式下主库文件可能缺少尚未落盘的事务，直接复制得到的不是一致快照；
/// 先执行 `PRAGMA wal_checkpoint(TRUNCATE)` 把日志并回主库再复制。
/// 快照失败一律视为致命错误：宁可中止启动，也不要在没有回滚退路时执行迁移。
pub async fn create_pre_migration_snapshot(
    db: &DatabaseConnection,
    db_path: &Path,
) -> Result<PathBuf, CommonError> {
    db.execute_unprepared("PRAGMA wal_checkpoint(TRUNCATE)")
        .await
        .map_err(|e| anyhow::anyhow!("failed to checkpoint WAL before migration: {}", e))?;

    let file_name = db_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "database".to_string());
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default();

    let mut snapshot = db_path.with_file_name(format!("{file_name}.pre-migration-{stamp}"));
    let mut suffix = 1;
    while snapshot.exists() {
        snapshot = db_path.with_file_name(format!("{file_name}.pre-migration-{stamp}-{suffix}"));
        suffix += 1;
    }

    std::fs::copy(db_path, &snapshot).map_err(|e| {
        anyhow::anyhow!(
            "failed to snapshot database before migration ({}): {:?}",
            e,
            db_path
        )
    })?;

    Ok(snapshot)
}

impl Environment {
    /// 将Environment枚举转换为字符串
    /// 用于文件名和路径构建
    ///
    /// # 返回值
    /// * `&'static str` - 对应的环境字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Environment::Local => "local",
            Environment::Production => "production",
        }
    }
}

impl TryFrom<String> for Environment {
    type Error = String;

    /// 从字符串解析Environment枚举
    /// 支持大小写不敏感的解析
    ///
    /// # 参数
    /// * `s` - 要解析的字符串
    ///
    /// # 返回值
    /// * `Ok(Environment)` - 解析成功时返回环境枚举
    /// * `Err(String)` - 解析失败时返回错误信息
    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "local" => Ok(Self::Local),
            "production" => Ok(Self::Production),
            other => Err(format!(
                "{} is not a supported environment. Use either `local` or `production`.",
                other
            )),
        }
    }
}

/// 获取应用程序配置
/// 根据APP_ENVIRONMENT环境变量确定运行环境，按优先级加载配置：
/// 1. 桌面开发环境：文件系统配置文件
/// 2. 其他环境：资源目录配置文件
/// 3. 回退：编译时嵌入的配置文件
///
/// # 参数
/// * `app_handle` - Tauri应用句柄
///
/// # 返回值
/// * `Ok(Settings)` - 成功时返回配置设置
/// * `Err(config::ConfigError)` - 失败时返回配置错误
pub fn get_configuration(app_handle: &AppHandle) -> Result<Settings, config::ConfigError> {
    #[cfg(not(target_os = "android"))]
    {
        let is_desktop_dev = cfg!(debug_assertions) && cfg!(desktop);

        let config_path_buf = get_config_path_buf(app_handle, is_desktop_dev)?;

        let settings = config::Config::builder()
            .add_source(config::File::from(config_path_buf.0))
            .add_source(config::File::from(config_path_buf.1))
            .add_source(
                config::Environment::with_prefix("APP")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?;

        settings.try_deserialize::<Settings>()
    }

    #[cfg(target_os = "android")]
    {
        let _ = app_handle;
        // 读取 base.yaml 内容
        let base_content = std::str::from_utf8(include_bytes!("../configuration/base.yaml"))
            .map_err(|e| config::ConfigError::Message(e.to_string()))?;

        // 构建 base 配置对象
        let base_config = config::Config::builder()
            .add_source(config::File::from_str(
                base_content,
                config::FileFormat::Yaml,
            ))
            .build()?;

        // 获取 active_config 字段
        let active_config = base_config.get_string("active_config").map_err(|_| {
            config::ConfigError::Message(
                "Missing or invalid 'active_config' in base.yaml".to_string(),
            )
        })?;

        // 校验 active_config 合法性
        if active_config != "local" && active_config != "production" {
            return Err(config::ConfigError::Message(
                "Only \"local\" or \"production\" can be specified in active_config".to_string(),
            ));
        }

        // 加载对应的配置文件内容
        let config_file_bytes: &[u8] = match active_config.as_str() {
            "local" => include_bytes!("../configuration/local.yaml").as_ref(),
            "production" => include_bytes!("../configuration/production.yaml").as_ref(),
            _ => return Err(config::ConfigError::Message("Invalid active_config".into())), // 这里可以支持更多的环境配置
        };

        let active_content = std::str::from_utf8(config_file_bytes)
            .map_err(|e| config::ConfigError::Message(e.to_string()))?;

        // 构建最终配置对象
        config::Config::builder()
            .add_source(config::File::from_str(
                base_content,
                config::FileFormat::Yaml,
            ))
            .add_source(config::File::from_str(
                active_content,
                config::FileFormat::Yaml,
            ))
            .add_source(
                config::Environment::with_prefix("APP")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?
            .try_deserialize::<Settings>()
    }
}

/// 解析桌面开发环境（debug 构建）的 configuration 目录。
///
/// 常规开发流程 `pnpm td` 的工作目录是 `src-tauri`，配置就在 `./configuration`。
/// 但 debug 包经 LaunchServices（`open` / Finder）启动时工作目录是 `/`，直接拼接会得到
/// `/configuration/base.yaml` 而启动失败。因此按以下顺序回退：
/// 1. 当前工作目录下的 `configuration`（存在 base.yaml 时）
/// 2. 可执行文件所在 .app 的 `Contents/Resources/configuration`
/// 3. 编译期已知的 `CARGO_MANIFEST_DIR/configuration`
/// 4. 仍无匹配时返回当前目录路径，交由调用方报出原始错误
#[cfg(not(target_os = "android"))]
fn resolve_dev_config_dir() -> Result<PathBuf, config::ConfigError> {
    let cwd = std::env::current_dir()
        .map_err(|e| config::ConfigError::Message(format!("Failed to get current dir: {}", e)))?;
    let exe = std::env::current_exe().ok();

    Ok(resolve_dev_config_dir_with(
        &cwd,
        exe.as_deref(),
        Path::new(env!("CARGO_MANIFEST_DIR")),
    ))
}

/// `resolve_dev_config_dir` 的纯路径版本，便于回归测试覆盖 LaunchServices 启动场景。
fn resolve_dev_config_dir_with(cwd: &Path, exe: Option<&Path>, manifest_dir: &Path) -> PathBuf {
    let cwd_dir = cwd.join("configuration");
    if cwd_dir.join("base.yaml").is_file() {
        return cwd_dir;
    }

    if let Some(bundle_dir) = exe.and_then(|exe| {
        exe.parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("Resources").join("configuration"))
    }) {
        if bundle_dir.join("base.yaml").is_file() {
            return bundle_dir;
        }
    }

    let manifest_config_dir = manifest_dir.join("configuration");
    if manifest_config_dir.join("base.yaml").is_file() {
        return manifest_config_dir;
    }

    cwd_dir
}

#[cfg(all(test, not(target_os = "android")))]
mod dev_config_dir_tests {
    use super::*;

    fn temp_dir(suffix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tjg-dev-config-{suffix}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn write_base_yaml(config_dir: &Path) {
        std::fs::create_dir_all(config_dir).expect("create configuration dir");
        std::fs::write(config_dir.join("base.yaml"), "active_config: local\n")
            .expect("write base.yaml");
    }

    #[test]
    fn prefers_working_directory_configuration() {
        let root = temp_dir("cwd");
        write_base_yaml(&root.join("configuration"));

        assert_eq!(
            resolve_dev_config_dir_with(&root, None, Path::new("/nonexistent")),
            root.join("configuration")
        );
    }

    /// 回归锁（P-01）：debug 包经 LaunchServices 启动时 cwd 为 `/`，
    /// 必须回退到 .app 内嵌的 Contents/Resources/configuration。
    #[test]
    fn falls_back_to_bundle_resources_when_cwd_is_root() {
        let root = temp_dir("bundle");
        let exe = root
            .join("Tjg.app")
            .join("Contents")
            .join("MacOS")
            .join("tjg");
        write_base_yaml(
            &root
                .join("Tjg.app")
                .join("Contents")
                .join("Resources")
                .join("configuration"),
        );

        assert_eq!(
            resolve_dev_config_dir_with(Path::new("/"), Some(&exe), Path::new("/nonexistent")),
            root.join("Tjg.app")
                .join("Contents")
                .join("Resources")
                .join("configuration")
        );
    }

    #[test]
    fn falls_back_to_manifest_configuration() {
        let root = temp_dir("manifest");
        write_base_yaml(&root.join("configuration"));

        assert_eq!(
            resolve_dev_config_dir_with(Path::new("/nonexistent"), None, &root),
            root.join("configuration")
        );
    }

    #[test]
    fn returns_cwd_path_when_no_configuration_found() {
        let root = temp_dir("empty");

        assert_eq!(
            resolve_dev_config_dir_with(&root, None, &root.join("missing")),
            root.join("configuration")
        );
    }
}

#[cfg(not(target_os = "android"))]
fn get_config_path_buf(
    app_handle: &AppHandle,
    is_desktop_dev: bool,
) -> Result<(PathBuf, PathBuf), config::ConfigError> {
    let dir = if is_desktop_dev {
        resolve_dev_config_dir()?
    } else {
        // 优先用 Tauri 的 resource_dir（经 LaunchServices 启动时指向 .app/Contents/Resources）。
        // 但直接运行 .app 内二进制（无 NSBundle 上下文）时，resource_dir() 会返回
        // Err(unknown path)，导致 "Failed to load configuration"。此时回退到可执行文件
        // 所在目录的上级 /Resources，即 .../Contents/Resources，保证生产包在任何启动方式
        // 下都能找到 configuration。
        let resource_dir = app_handle
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())
            .or_else(|err| {
                std::env::current_exe()
                    .ok()
                    .and_then(|exe| {
                        exe.parent()
                            .and_then(|p| p.parent())
                            .map(|p| p.join("Resources"))
                    })
                    .filter(|p| p.exists())
                    .ok_or(err)
            })
            .map_err(|e| config::ConfigError::NotFound(format!("resource not find: {}", e)))?;
        resource_dir.join("configuration")
    };

    let base_path = dir.join("base.yaml");

    #[cfg(not(target_os = "android"))]
    let base_config = config::Config::builder()
        .add_source(config::File::from(base_path.clone()))
        .build()?;

    #[cfg(target_os = "android")]
    let base_config = {
        let content = std::str::from_utf8(include_bytes!("../configuration/base.yaml"))
            .map_err(|e| config::ConfigError::Message(e.to_string()))?;

        config::Config::builder()
            .add_source(config::File::from_str(content, config::FileFormat::Yaml))
            .build()?
    };

    let active_config = base_config.get_string("active_config")?;
    println!("active_config: {:?}", active_config);
    let active_config_path_buf = dir.clone().join(active_config);
    Ok((base_path, active_config_path_buf))
}

/// 数据库文件头判定结果。
///
/// ⚠️ **三态而不是 bool**：读失败 ≠ 文件损坏。
///
/// 历史实现是：
/// ```ignore
/// let mut header = [0u8; 16];
/// let _ = f.read(&mut header);          // 读失败被吞掉
/// header != *b"SQLite format 3\0"       // header 仍是全零 ⇒ 判为「非 SQLite」
/// ```
/// 于是一次瞬时 IO 错误（或短读）就会把**用户真实的数据库**改名成 `.corrupted`，
/// rename 再失败就 `remove_file` 删掉，然后静默建一个空库 —— 本地数据全丢且无提示。
#[derive(Debug, PartialEq, Eq)]
enum DbHeaderVerdict {
    /// 文件头是合法的 SQLite 魔数
    Sqlite,
    /// 读到了完整的 16 字节，但不是 SQLite 魔数（确实不是数据库）
    NotSqlite,
    /// 打不开、读不满 16 字节、IO 错误 —— **不判定**，保持原文件
    Unknown,
}

const SQLITE_HEADER: &[u8; 16] = b"SQLite format 3\0";

/// 探测数据库文件头。任何读取异常都返回 `Unknown`，绝不在读不到的情况下判定损坏。
fn probe_db_header(path: &Path) -> DbHeaderVerdict {
    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return DbHeaderVerdict::Unknown,
    };
    let mut header = [0u8; 16];
    match file.read_exact(&mut header) {
        Ok(()) => {
            if &header == SQLITE_HEADER {
                DbHeaderVerdict::Sqlite
            } else {
                DbHeaderVerdict::NotSqlite
            }
        }
        // 短读（文件 <16 字节）与 IO 错误都走这里：不判损坏
        Err(_) => DbHeaderVerdict::Unknown,
    }
}

#[cfg(test)]
mod database_filename_tests {
    use super::*;

    /// 回归锁：Matrix ID 里的 `:` 在 Windows 文件名中非法 ⇒ 必须被归一化。
    ///
    /// 历史实现直接 `format!("db_{}.sqlite", id)`，实测日志出现
    /// `Database filename: db_@test1:matrix.test.sqlite` —— 该名字在 macOS 可用，
    /// 但桌面端同时发布 windows 目标，届时建库会失败。
    #[test]
    fn sanitizes_colon_in_matrix_user_id() {
        assert_eq!(
            sanitize_uid_for_filename("@test1:matrix.test"),
            "@test1_matrix.test"
        );
        assert_eq!(
            DatabaseSettings::get_db_filename(Some("@test1:matrix.test")),
            "db_@test1_matrix.test.sqlite"
        );
    }

    #[test]
    fn sanitizes_windows_reserved_and_path_separators() {
        for (input, expected) in [
            ("a<b>c", "a_b_c"),
            ("a/b\\c", "a_b_c"),
            ("a|b?c*d", "a_b_c_d"),
            ("a\"b", "a_b"),
            ("@u:h/a\\b", "@u_h_a_b"),
        ] {
            assert_eq!(sanitize_uid_for_filename(input), expected, "input={input}");
        }
    }

    #[test]
    fn strips_windows_trailing_dot_and_space() {
        assert_eq!(sanitize_uid_for_filename("@u:host. "), "@u_host");
        assert_eq!(sanitize_uid_for_filename("   "), "_");
    }

    #[test]
    fn replaces_control_characters() {
        assert_eq!(sanitize_uid_for_filename("a\u{0}b\nc\td"), "a_b_c_d");
    }

    #[test]
    fn only_path_illegal_characters_are_replaced() {
        // 只替换非法字符，其余字符原样保留（不引入额外的编码/转义）
        assert_eq!(
            sanitize_uid_for_filename("@alice:example.org"),
            "@alice_example.org"
        );
        assert_eq!(DatabaseSettings::get_db_filename(None), "db.sqlite");
        assert_eq!(DatabaseSettings::get_db_filename(Some("")), "db.sqlite");
        // 本地 part 无冒号（如 uid 只是 "@alice"）时，名字保持不变
        assert_eq!(
            DatabaseSettings::get_db_filename(Some("@alice")),
            "db_@alice.sqlite"
        );
    }

    #[test]
    fn legacy_name_only_reported_when_normalization_changes_it() {
        assert_eq!(
            DatabaseSettings::get_legacy_db_filename(Some("@test1:matrix.test")).as_deref(),
            Some("db_@test1:matrix.test.sqlite")
        );
        // 无需归一化 ⇒ 无「历史名」，不会被误判为待迁移
        assert_eq!(
            DatabaseSettings::get_legacy_db_filename(Some("@alice")),
            None
        );
        assert_eq!(DatabaseSettings::get_legacy_db_filename(None), None);
    }

    fn temp_dir(suffix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tjg-db-filename-{suffix}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn migrates_legacy_file_to_sanitized_name() {
        let dir = temp_dir("migrate");
        let legacy = dir.join("db_@u:host.sqlite");
        std::fs::write(&legacy, b"SQLite format 3\0").expect("write legacy db");

        let resolved = DatabaseSettings::resolve_db_filename(&dir, Some("@u:host"));

        assert_eq!(resolved, "db_@u_host.sqlite");
        assert!(
            !legacy.exists(),
            "stale file must not remain after migration"
        );
        assert!(
            dir.join("db_@u_host.sqlite").exists(),
            "content must be moved to the new name"
        );
        // 迁移是「搬运」而非「复制」：数据必须在
        assert_eq!(
            std::fs::read(dir.join("db_@u_host.sqlite")).unwrap(),
            b"SQLite format 3\0"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn migration_is_idempotent_and_does_not_clobber_new_file() {
        let dir = temp_dir("idempotent");
        // 新文件已存在（如上次已迁移完）⇒ 不得再动旧文件、不得覆盖新文件
        std::fs::write(dir.join("db_@u_host.sqlite"), b"NEW").expect("write new db");
        std::fs::write(dir.join("db_@u:host.sqlite"), b"OLD").expect("write legacy db");

        let resolved = DatabaseSettings::resolve_db_filename(&dir, Some("@u:host"));

        assert_eq!(resolved, "db_@u_host.sqlite");
        assert_eq!(
            std::fs::read(dir.join("db_@u_host.sqlite")).unwrap(),
            b"NEW"
        );
        assert!(
            dir.join("db_@u:host.sqlite").exists(),
            "legacy file must not be deleted"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_legacy_file_uses_sanitized_name_directly() {
        let dir = temp_dir("fresh");
        let resolved = DatabaseSettings::resolve_db_filename(&dir, Some("@u:host"));
        assert_eq!(resolved, "db_@u_host.sqlite");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn uid_without_illegal_chars_never_migrates() {
        let dir = temp_dir("no-migration");
        let plain = dir.join("db_@alice.sqlite");
        std::fs::write(&plain, b"X").expect("write db");

        let resolved = DatabaseSettings::resolve_db_filename(&dir, Some("@alice"));

        assert_eq!(resolved, "db_@alice.sqlite");
        assert!(plain.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}

#[cfg(test)]
mod database_dir_tests {
    use super::*;

    /// 回归锁（B2）：桌面开发环境的库必须落在应用数据目录下的 `dev` 子目录。
    ///
    /// 旧实现 dev 直接用 `CARGO_MANIFEST_DIR`（`src-tauri/`）⇒ 用户本地账号、消息库
    /// 散落在源码树里（连同 `db_@user:host.sqlite` 这类文件名），随源码/备份一起外泄。
    #[test]
    fn dev_desktop_uses_isolated_dev_subdir_under_app_data() {
        let app_data = PathBuf::from("/tmp/com.tjg.pc");
        assert_eq!(
            select_database_dir(app_data.clone(), true),
            app_data.join("dev")
        );
    }

    /// 发布版与移动端行为不变：直接用 app_data_dir，不得额外多一层目录
    /// （多一层会让既有安装「找不到」自己的数据库 = 静默丢聊天记录）。
    #[test]
    fn release_and_mobile_use_app_data_dir_directly() {
        let app_data = PathBuf::from("/tmp/com.tjg.pc");
        assert_eq!(select_database_dir(app_data.clone(), false), app_data);
    }
}

#[cfg(test)]
mod db_header_tests {
    use super::*;
    use std::io::Write;

    fn temp_file(tag: &str, bytes: &[u8]) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tjg-dbheader-{tag}-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("probe.sqlite");
        let mut f = std::fs::File::create(&path).expect("create temp db");
        f.write_all(bytes).expect("write temp db");
        path
    }

    #[test]
    fn valid_sqlite_header_is_sqlite() {
        let path = temp_file("valid", b"SQLite format 3\0rest-of-page");
        assert_eq!(probe_db_header(&path), DbHeaderVerdict::Sqlite);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn sixteen_bytes_of_garbage_is_not_sqlite() {
        let path = temp_file("garbage", b"not-a-database!!");
        assert_eq!(path.metadata().unwrap().len(), 16);
        assert_eq!(probe_db_header(&path), DbHeaderVerdict::NotSqlite);
        let _ = std::fs::remove_file(&path);
    }

    /// 回归锁（判据 2：失败被静默吸收）。
    ///
    /// 旧实现 `let _ = f.read(&mut header)` 在读不满时留下全零 header，
    /// 于是把「读不完整」判成「不是 SQLite」→ 重命名/删除用户的数据库。
    /// 短读必须落到 Unknown，绝不能落到 NotSqlite。
    #[test]
    fn short_read_is_unknown_never_not_sqlite() {
        let path = temp_file("short", b"SQLi");
        assert_eq!(probe_db_header(&path), DbHeaderVerdict::Unknown);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn empty_file_is_unknown_not_corrupted() {
        let path = temp_file("empty", b"");
        assert_eq!(probe_db_header(&path), DbHeaderVerdict::Unknown);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn missing_file_is_unknown() {
        let path = std::env::temp_dir().join("tjg-dbheader-missing-does-not-exist.sqlite");
        let _ = std::fs::remove_file(&path);
        assert_eq!(probe_db_header(&path), DbHeaderVerdict::Unknown);
    }

    /// C-03 回归锁：损坏库只能被备份，绝不能被删除（数据不可恢复）。
    #[test]
    fn corrupted_database_is_backed_up_not_deleted() {
        let path = temp_file("corrupted-backup", b"not-a-database!!");
        let wal = format!("{}-wal", path.to_string_lossy());
        std::fs::write(&wal, b"wal").expect("write wal");

        let backup = backup_unusable_database(&path).expect("backup succeeds");

        assert!(!path.exists(), "original file must be moved away");
        assert!(backup.exists(), "backup file must exist");
        assert_eq!(
            std::fs::read(&backup).expect("read backup"),
            b"not-a-database!!"
        );
        assert_eq!(
            std::fs::read(format!("{}-wal", backup.to_string_lossy())).expect("read wal backup"),
            b"wal"
        );

        let _ = std::fs::remove_file(&backup);
        let _ = std::fs::remove_file(format!("{}-wal", backup.to_string_lossy()));
    }

    /// 同一时间戳重复备份时不能覆盖上一次的备份。
    #[test]
    fn repeated_backup_never_overwrites_previous_one() {
        let path = temp_file("corrupted-twice", b"first");
        let first = backup_unusable_database(&path).expect("first backup");
        std::fs::write(&path, b"second").expect("rewrite db");
        let second = backup_unusable_database(&path).expect("second backup");

        assert_ne!(first, second);
        assert_eq!(std::fs::read(&first).expect("read first"), b"first");
        assert_eq!(std::fs::read(&second).expect("read second"), b"second");

        let _ = std::fs::remove_file(&first);
        let _ = std::fs::remove_file(&second);
    }
}

#[cfg(test)]
mod pre_migration_snapshot_tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tjg-snapshot-{tag}-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        dir
    }

    async fn open_temp_db(dir: &Path) -> (DatabaseConnection, PathBuf) {
        let path = dir.join("app.sqlite");
        let mut options = ConnectOptions::new(format!("sqlite://{}?mode=rwc", path.display()));
        options.sqlx_logging(false);
        let conn = Database::connect(options).await.expect("connect temp db");
        (conn, path)
    }

    /// C-02 回归锁：迁移前快照必须落盘且内容与主库一致。
    #[tokio::test]
    async fn snapshot_copies_database_before_migration() {
        let dir = temp_dir("copy");
        let (conn, path) = open_temp_db(&dir).await;
        conn.execute_unprepared("CREATE TABLE probe (id INTEGER PRIMARY KEY)")
            .await
            .expect("create table");

        let snapshot = create_pre_migration_snapshot(&conn, &path)
            .await
            .expect("snapshot succeeds");

        assert!(snapshot.exists(), "snapshot file must exist");
        assert!(
            snapshot
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .contains(".pre-migration-"),
            "snapshot name must carry the pre-migration marker"
        );
        assert_eq!(
            std::fs::read(&path).expect("read original"),
            std::fs::read(&snapshot).expect("read snapshot")
        );

        let _ = conn.close().await;
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// C-02 回归锁：源库不可复制时必须报错，不能静默跳过快照后继续迁移。
    #[tokio::test]
    async fn snapshot_of_missing_database_fails() {
        let dir = temp_dir("missing");
        let (conn, _path) = open_temp_db(&dir).await;
        let absent = dir.join("absent.sqlite");

        let result = create_pre_migration_snapshot(&conn, &absent).await;

        assert!(result.is_err(), "missing source must surface an error");

        let _ = conn.close().await;
        let _ = std::fs::remove_dir_all(&dir);
    }
}
