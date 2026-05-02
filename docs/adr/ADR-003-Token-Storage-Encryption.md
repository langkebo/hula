# ADR-003: Token 存储加密方案

## 1. 状态

- 提议中

## 2. 背景

- 当前问题：前端通过 Tauri 命令持久化 token，Rust 侧将 `access_token` 和 `refresh_token` 写入本地 SQLite `im_user` 表，以明文形式存放
- 触发原因：安全基线审计发现本地 `.db` 文件被恶意软件窃取后，攻击者可直接获取 `access_token` 进行会话劫持
- 业务约束：需要支持自动登录和会话恢复，token 必须在应用重启后可读取
- 技术约束：Tauri 2.x 桌面端和移动端均可访问系统安全存储 API

## 3. 决策目标

- 解决 token 明文存储在本地 SQLite 的安全风险
- 保持自动登录和会话恢复功能不受影响
- 提供跨平台（macOS/Windows/Linux/iOS/Android）一致的 token 保护方案
- 不增加启动恢复的显著延迟

## 4. 决策内容

采用分层存储策略：

- 决定 1：`access_token` 和 `refresh_token` 不再写入 SQLite 明文字段，改为通过操作系统安全存储（Keychain/Keystore/Credential Manager）保存
- 决定 2：Rust 侧新增 `secure_token_store` 模块，封装平台特定的安全存储 API，通过 Tauri Command 暴露给前端
- 决定 3：前端 `useMatrixStore` 不再持久化 `accessToken`（已在 P0-03 中移除），改为启动时通过 Tauri Command 从安全存储读取
- 决定 4：保留 SQLite 中的 `userId`、`deviceId`、`homeserverUrl` 等非敏感字段

## 5. 备选方案

### 方案 A：操作系统安全存储（推荐）

- 说明：使用 macOS Keychain、Windows Credential Manager、Linux Secret Service、iOS Keychain、Android Keystore
- 优点：系统级加密保护，与设备锁屏/生物认证联动，行业标准做法
- 缺点：各平台 API 差异需要适配，Linux 可能缺少 Secret Service 守护进程
- 不采用原因：无，此为推荐方案

### 方案 B：应用层 AES 加密后存入 SQLite

- 说明：在 Rust 侧使用 AES-256-GCM 对 token 加密后存入 SQLite，密钥派生自设备特征
- 优点：跨平台一致实现，不依赖系统服务
- 缺点：密钥派生自设备特征仍有被逆向风险，不如系统安全存储级别高
- 不采用原因：安全性低于方案 A，作为 fallback 方案

### 方案 C：仅内存存储 + 每次登录

- 说明：token 仅保存在内存中，应用重启后需要重新登录
- 优点：最安全，无持久化风险
- 缺点：严重影响用户体验，不支持自动登录
- 不采用原因：业务不可接受

## 6. 影响分析

### 正向影响

- token 不再以明文形式存在于本地数据库，显著降低会话劫持风险
- 符合安全基线要求，可通过安全审计
- 与行业最佳实践对齐

### 负向影响

- 启动恢复链路增加一次安全存储读取调用，可能增加 10-50ms 延迟
- Linux 桌面端在无 Secret Service 环境下需要 fallback 到方案 B
- 需要处理安全存储不可用时的降级逻辑

### 迁移成本

- 人力：Rust 负责人 + 前端负责人
- 时间：1-2 周
- 风险：旧版本升级后需要兼容读取 SQLite 中的明文 token 并迁移到安全存储

## 7. 实施计划

| 阶段 | 动作 | 负责人 | 验收标准 |
|---|---|---|---|
| 阶段 1 | Rust 侧实现 `secure_token_store` 模块，封装各平台安全存储 API | Rust 负责人 | 单元测试通过，各平台可读写 |
| 阶段 2 | 新增 Tauri Command `secure_get_token` / `secure_set_token` / `secure_remove_token` | Rust 负责人 | 命令可被前端调用 |
| 阶段 3 | 前端登录恢复链路改为从安全存储读取 token | 前端负责人 | 自动登录和会话恢复正常 |
| 阶段 4 | 迁移脚本：启动时检测 SQLite 中的明文 token，迁移到安全存储后清除 | Rust 负责人 | 旧用户升级后无感知迁移 |
| 阶段 5 | Linux fallback：无 Secret Service 时使用 AES 加密方案 | Rust 负责人 | Linux 无守护进程环境可正常工作 |

## 8. 测试与验证

- 单元测试：`secure_token_store` 各平台读写删除
- 集成测试：登录 → token 存储 → 应用重启 → 会话恢复
- E2E 测试：完整登录恢复流程
- 性能验证：安全存储读取延迟 < 50ms
- 安全验证：SQLite 中不再包含明文 token

## 9. 灰度与回滚

- feature flag：`feature.secureTokenStore`
- 灰度范围：先桌面端 macOS → Windows → Linux，再移动端
- 回滚条件：登录恢复失败率 > 1%，或安全存储读取超时 > 500ms
- 回滚方式：关闭 feature flag，回退到 SQLite 明文读取（兼容层保留）

## 10. 风险与未决问题

- 风险 1：Linux 桌面端无 Secret Service 守护进程时安全存储不可用
- 风险 2：系统安全存储配额限制（iOS Keychain 单项大小限制）
- 未决问题：是否需要在 token 写入安全存储前增加应用层二次加密

## 11. 关联信息

- 关联 Issue：P0-SEC-03
- 关联文档：`docs/baseline/security-baseline.md`
- 关联实施方案：`docs/hula优化实施方案.md` 第 11.5 节

## 12. 审批记录

| 角色 | 姓名 | 结论 | 日期 |
|---|---|---|---|
| 前端负责人 | 待填写 | 待填写 | 待填写 |
| Rust / Tauri 负责人 | 待填写 | 待填写 | 待填写 |
| QA | 待填写 | 待填写 | 待填写 |
| DevOps | 待填写 | 待填写 | 待填写 |
