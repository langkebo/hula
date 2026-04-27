# 桌面端设置体系统一说明

## 本次目标

- 将旧版 `moreWindow/settings` 中仍然承载业务能力的设置项迁入新版 `settingsWindow` tab 体系。
- 统一桌面端 `settings` 独立窗口与主窗口内设置弹层的 UI shell，避免出现两套设置容器并存。
- 收敛桌面端主题皮肤入口，固定为单一 `simple` 皮肤，消除 `default/simple` 随机切换。

## 当前结果

### 1. 设置入口统一

- `src/router/routes/desktop.ts` 中的 `/settings` 已切换到 `src/views/settingsWindow/index.vue`。
- 旧的 `/general`、`/loginSetting`、`/manageStore`、`/privateChat` 等路径不再渲染旧页面，而是重定向到统一的 `/settings?tab=...`。
- `src/views/settingsWindow/SettingsDialog.vue` 支持 `standalone` 模式，可同时用于主窗口内弹层和独立 `settings` 窗口。

### 2. 旧设置业务迁移

- `PreferencesSettings.vue`
  - 补入自动登录设置。
  - 补入 Tauri `@tauri-apps/plugin-autostart` 的开机启动设置。
  - 补入 `useScannerStore` 的目录扫描和目录选择能力。
- `SecuritySettings.vue`
  - 将私密聊天从“仅密码设置”扩展为完整配置项。
  - 新增启用开关、隐藏会话、自动锁定、锁定超时等旧页能力。

### 3. 主题入口收敛

- `src/stores/domains/settings/setting.ts` 中桌面端皮肤统一归一为 `simple`。
- `src/App.vue` 启动时固定加载 `src/styles/scss/theme/simple.scss`，不再根据 `themes.versatile` 动态切换桌面皮肤文件。

## 状态模型变更

`secretChat` 状态新增以下字段：

- `hideSessions`
- `autoLock`
- `lockTimeout`

对应 store action 新增：

- `setAutoStartup()`
- `setSecretChatEnabled()`
- `setSecretChatHideSessions()`
- `setSecretChatAutoLock()`
- `setSecretChatLockTimeout()`

## SDK / 集成检查结果

- 本地 SDK
  - 开机启动继续使用 `@tauri-apps/plugin-autostart`，已从旧页接入新版偏好设置。
  - 目录选择继续使用 `@tauri-apps/plugin-dialog`，扫描继续复用 `useScannerStore` 与 Tauri 事件。
- 后端 / Matrix
  - `SecuritySettings.vue` 原有的 `matrixAccountService`、`matrixEncryptionService` 集成未被移除。
  - 本次改动主要补齐 UI 与本地状态层，不改动 Matrix 服务协议。

## 验证结果

已通过以下定向测试：

```bash
pnpm exec vitest run \
  src/stores/domains/settings/__tests__/setting.test.ts \
  src/views/settingsWindow/__tests__/SettingsDialog.test.ts \
  src/views/settingsWindow/tabs/__tests__/SecuritySettings.test.ts
```

结果：

- 3 个测试文件通过
- 52 个测试用例通过

## 后续建议

- 删除已不再作为入口使用的 `src/views/moreWindow/settings` 冗余实现文件。
- 为 `PreferencesSettings.vue` 新增针对开机启动和存储扫描区块的组件测试。
- 继续梳理旧设置目录下的样式和静态资源，完成最终物理清理。
