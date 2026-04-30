# Rust Workspace 拆分计划 (Phase 3+)

## 目标
- **提高编译速度**：通过拆分独立的 crate，利用 Cargo 的增量编译和缓存。
- **解耦核心逻辑**：将数据库访问 (Repository)、业务逻辑 (Core) 与 Tauri 命令层 (Commands) 分离。
- **多端共用**：方便未来可能的 CLI 或其他端的代码复用。

## 建议结构

```text
hula/
├── crates/
│   ├── hula-core/          # 核心业务逻辑、配置管理、POJO/VO
│   ├── hula-repository/    # 数据库访问层 (SeaORM)、Migration
│   ├── hula-commands/      # Tauri Invoke 命令实现
│   └── hula-utils/         # 运行时守护、平台特定工具类
├── src-tauri/              # Tauri 入口、窗口管理、托盘、各端初始化
└── Cargo.toml              # 根工作区配置
```

## 实施步骤

### 1. 建立根工作区
在项目根目录创建 `Cargo.toml`:
```toml
[workspace]
members = [
    "src-tauri",
    "crates/*",
]
resolver = "2"
```

### 2. 提取 hula-utils
将 `src-tauri/src/utils/` 中的平台守护逻辑迁移到 `crates/hula-utils`。

### 3. 提取 hula-repository
将 `src-tauri/src/repository/` 和 `migration/` 迁移。

### 4. 提取 hula-core
迁移 `pojo/`, `vo/`, `configuration.rs`, `error.rs`。

### 5. 提取 hula-commands
迁移 `command/` 文件夹。

## 风险点
- **依赖传递**：需要仔细处理 crate 间的依赖关系，避免循环依赖。
- **Tauri State 访问**：`AppHandle` 和 `State` 在不同 crate 间的传递需要统一定义。
- **编译配置同步**：`Cargo.toml` 中的 feature 需要在工作区级别统一管理。
