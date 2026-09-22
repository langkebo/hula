# Tjg/HuLa IM 移动端功能优化方案

> 版本：v1.0 | 日期：2026-09-20 | 编制：AI Audit
> 背景：基于桌面端 17 个设置 tab 与移动端 25 个页面的逐项功能比对，结合移动端 UX/UI 最佳实践、性能优化规范与可访问性标准制定。

---

## 一、执行摘要

当前移动端「我的」页已覆盖 **10/17** 桌面端设置 tab 的核心功能，存在 **6 个完全缺失**、**7 个部分缺失** 的功能面。若按当前状态交付移动端，用户将面临安全风险（无法登出其他设备/改密码）、社交断裂（无好友管理）、信息焦虑（无存储/推送可见性）等问题。

本方案将缺失功能按 **影响度 × 紧急度** 划分为三档，并针对每档提供符合移动端设计原则的具体改进措施。

---

## 二、优先级矩阵与影响评估

### 2.1 评估维度

| 维度 | 定义 |
|---|---|
| **用户影响** | 缺失后对用户日常使用的影响程度（安全/社交/效率/体验） |
| **使用频率** | 用户平均每周使用该功能的次数 |
| **替代成本** | 用户切换到桌面端或网页版的操作成本 |
| **合规/安全** | 涉及账号安全、数据隐私的合规要求 |

### 2.2 优先级排序

#### 🔴 P0 — 必须实现（安全刚需，高影响 + 高频率 + 合规要求）

| 功能 | 桌面端对应 Tab | 当前状态 | 影响评估 |
|---|---|---|---|
| **设备管理增强** | SessionSettings | 有列表，缺重命名/登出/全部登出 | **安全**：无法远程清理被盗设备，极高风险 |
| **密码修改** | AccountSettings | 完全缺失 | **安全**：密码泄露后无法立即重置，极高风险 |
| **账号注销** | AccountSettings | 完全缺失 | **合规**：GDPR/个人信息保护法要求提供注销入口，中风险 |

#### 🟠 P1 — 核心补齐（社交/加密完整性，中高影响 + 中频率）

| 功能 | 桌面端对应 Tab | 当前状态 | 影响评估 |
|---|---|---|---|
| **好友管理** | FriendsSettings | 完全缺失 | **社交**：无法管理好友请求/分组/申请，中高影响 |
| **安全密钥管理** | EncryptionSettings | 部分缺失 | **安全**：无法导出/管理安全密钥，E2EE 信任链断裂风险 |
| **备份恢复完整流程** | EncryptionSettings | 部分缺失 | **安全**：SSSS 恢复流程不完整，数据丢失风险 |
| **隐私设置（屏蔽/忽略/邀请权限）** | SecuritySettings 子模块 | 完全缺失 | **隐私**：无法管理屏蔽列表和邀请权限 |

#### 🟡 P2 — 体验提升（信息可见性 + 效率，中低影响 + 低频率）

| 功能 | 桌面端对应 Tab | 当前状态 | 影响评估 |
|---|---|---|---|
| **存储管理** | StorageSettings | 部分缺失 | **效率**：无缓存/存储用量可见性，排查问题成本高 |
| **推送配置** | PushSettings | 完全缺失 | **体验**：推送规则不透明，消息到达不可控 |
| **通知详情控制** | NotificationSettings | 部分缺失 | **体验**：无法控制通知摘要/关键词/音量 |

#### 🟢 P3 — 后续优化（低影响或移动端不适用）

| 功能 | 说明 |
|---|---|
| SidebarSettings / KeyboardSettings | 移动端无侧边栏/物理键盘，预期缺失 |
| AppearanceSettings 高级选项 | 字体/气泡/毛玻璃在移动端价值有限 |
| 开机自启 / 存储目录 / 启动项 | Tauri 桌面端专属，移动端无对应概念 |

---

## 三、P0 功能详细改进建议

### 3.1 设备管理增强（SessionSettings 对齐）

**当前缺口：**
- 移动端 `DeviceManagement.vue` 仅展示设备列表 + 信任操作
- 缺少：设备重命名、登出单个设备、一键登出所有其他设备

**移动端最佳实践：**
- 使用 `van-swipe-cell` 实现滑动手势操作（iOS 右滑「重命名/删除」范式）
- 「全部登出」放在页面底部独立 section，使用 `van-button` + 确认对话框
- 当前设备标识固定在列表顶部，不可删除
- 操作使用 `van-action-sheet` 弹出选择（重命名 / 登出 / 设为可信）

**改进措施：**

1. **设备重命名**：
   - 在 `DeviceManagement.vue` 的设备条目上添加 `van-swipe-cell`
   - 右滑露出「重命名」按钮 → 弹出 `van-dialog` 输入新名称 → 调用 `PUT /_matrix/client/v3/devices/{deviceId}` 更新
   - 成功后更新本地缓存并显示 Toast

2. **登出单个设备**：
   - 滑动手势或 `van-action-sheet` 中选择「登出」
   - 确认对话框（防止误操作）
   - 调用 `POST /_matrix/client/v3/devices/{deviceId}/delete`
   - 列表自动刷新（`van-pull-refresh`）

3. **一键登出所有其他设备**：
   - 独立 section：「安全操作区」，底部固定
   - 标题 + 描述文字 + `van-button type="danger"` 触发
   - 双重确认：van-dialog → van-notice-bar 提示影响范围
   - 调用 `POST /_matrix/client/v3/delete_devices`
   - 成功后重新同步并刷新设备列表

4. **UI 优化（导航简化）**：
   - 在 `MobileSettings.vue` 的安全/隐私 section 中，将「设备管理」入口从「安全」子页中**提升为一级入口**
   - 理由：设备管理是安全刚需，用户不应先进入「安全」再找「设备」——减少一级跳转，符合移动端「扁平导航」原则
   - 图标使用 `mdi:devices`，背景色 `var(--tjg-color-success-100)`

### 3.2 密码修改（AccountSettings 对齐）

**当前缺口：**
- 移动端无密码修改入口
- 当前只有 `EditProfile.vue`（昵称/头像）+ `SimpleBio.vue`（简介）

**移动端最佳实践：**
- 密码修改是安全敏感操作，应使用**专用页面**而非内嵌表单
- 遵循「渐进式披露」原则：旧密码 → 新密码 → 确认密码，分步展示
- 密码强度实时校验（与桌面端一致的 6 条规则）→ 输入过程中即时反馈
- 成功/失败使用 Toast + 日志

**改进措施：**

1. **新增 `PasswordSettings.vue`**：
   - 路由：`/mobile/mobileMy/password`
   - 页面结构：
     ```
     [旧密码输入框]      — van-field type="password" show-password
     [新密码输入框]      — van-field type="password" + 实时强度指示器
     [确认密码输入框]    — van-field type="password"
     [修改密码按钮]      — van-button type="primary"
     ```
   - 密码强度指示器：4 段色条（弱/一般/较强/强），基于与桌面端一致的 6 条规则
   - 「退出其他设备」复选框（van-checkbox）→ 改密码时同步登出
   - 调用 `useAccount.changePassword(old, new, logoutOthers)`

2. **入口安排**：
   - 在 `MobileSettings.vue` 安全 section 中，将「修改密码」作为第一项
   - 与「设备管理」并列在安全 section 顶部

3. **可访问性**：
   - 所有输入框添加 `aria-label`
   - 密码字段标记 `autocomplete="current-password"` / `new-password`
   - 强度指示器使用 `role="status"` + `aria-live="polite"`

### 3.3 账号注销（AccountSettings 对齐）

**当前缺口：**
- 移动端完全缺失账号注销入口

**移动端最佳实践：**
- 账号注销是**最高风险操作**，必须遵循「三重确认」原则
- 位置：放在设置页底部安全区域（与登出按钮分开），而非与普通设置混排
- 理由：避免用户误触；同时符合 Android Material Design「危险操作远离高频区域」规范

**改进措施：**

1. **在 `MobileSettings.vue` 底部添加「危险区域」**：
   ```
   ┌──────────────────────────────┐
   │ ⚠️ 危险区域                    │
   │                              │
   │ 注销账号                       │
   │ 此操作不可逆，所有数据将永久删除  │
   │                              │
   │ [van-button type="danger"]    │
   └──────────────────────────────┘
   ```

2. **三重确认流程**：
   - **第一层**：van-dialog（标题 + 后果说明 + 取消/确认）
   - **第二层**：van-dialog（要求输入 MXID 确认，如「请输入 @user:homeserver 以确认注销」）
   - **第三层**：van-action-sheet（最后选项：「永久删除所有数据」/「仅注销保留数据」）

3. **调用链**：
   - `useAccount.deactivateAccount()`
   - 成功后清空本地 store + 跳转登录页
   - 失败时回滚 UI 状态 + 错误提示

---

## 四、P1 功能详细改进建议

### 4.1 好友管理（FriendsSettings 对齐）

**当前缺口：**
- 移动端完全无好友管理入口
- 桌面端包含：好友请求管理（接受/拒绝/忽略）、好友分组（创建/编辑/删除）、待处理请求列表

**移动端最佳实践：**
- 采用「列表 + 操作」范式：好友请求使用顶部卡片式 banner，点击展开操作
- 好友分组使用可展开的 Accordion（van-collapse），减少页面跳转
- 操作使用 `van-action-sheet`（避免页面堆叠）

**改进措施：**

1. **新增 `FriendRequests.vue`**（路由：`/mobile/mobileMy/friends/requests`）：
   - 顶部统计卡片：「X 个待处理请求」
   - 请求列表：头像 + MXID + 请求消息（可选）
   - 每个条目：左滑 → 「接受」/「拒绝」
   - 空状态：van-empty + 引导文案

2. **新增 `FriendGroups.vue`**（路由：`/mobile/mobileMy/friends/groups`）：
   - 分组列表（van-collapse）：展开显示成员 + 操作
   - 创建分组：van-dialog + 输入框
   - 编辑分组：van-action-sheet（重命名/删除/移动成员）
   - 删除分组：二次确认

3. **入口安排**：
   - 在 `MobileSettings.vue` 的「社交」section 添加「好友管理」入口
   - 与「群组」并列（如果群组入口存在）

### 4.2 安全密钥管理（EncryptionSettings 对齐）

**当前缺口：**
- 移动端 `EncryptionSettings.vue` 展示加密状态 + 设备列表 + 备份状态
- 缺少：安全密钥 setup/管理、E2EE Bootstrap 向导

**移动端最佳实践：**
- 安全密钥操作使用 `van-action-sheet` 选择操作类型
- 「设置安全密钥」流程使用多步向导（van-steps）
- 密钥恢复短语使用**大字模式**（van-notice-bar + 手动输入确认）

**改进措施：**

1. **在 `EncryptionSettings.vue` 中新增安全密钥 section**：
   - 密钥状态卡片（已配置 / 未配置）
   - 「管理安全密钥」入口 → 跳转 `SecurityKeyManage.vue`
   - 导出/导入密钥操作

2. **新增 `SecurityKeyManage.vue`**：
   - 多步向导：选择操作（导出/导入/重置）→ 确认 → 完成
   - 导出：生成恢复短语 → 显示 24 字 → 用户抄写确认
   - 导入：逐字输入确认 + SDK 验证

### 4.3 备份恢复完整流程

**当前缺口：**
- 移动端有备份状态展示 + 设置入口
- 缺少：完整的 SSSS 恢复流程引导、恢复短语管理

**改进措施：**
- 在 `EncryptionSettings.vue` 的备份 section 中补全：
  - 「开启备份」→ 弹出 `SecureBackupDialog`（移动端版本）
  - 「恢复备份」→ 引导用户输入恢复短语 → SDK 验证 → 恢复完成
  - 恢复短语安全提示（van-notice-bar）：「请勿截图，建议手写记录」

### 4.4 隐私设置（SecuritySettings 子模块对齐）

**当前缺口：**
- 移动端 `SecuritySettings.vue` 仅有：修改密码、设备列表、交叉签名状态、密钥备份
- 缺少：已忽略用户列表、已屏蔽用户列表、邀请列表管理、邀请权限设置、私聊设置

**改进措施：**

1. **已忽略 / 已屏蔽用户**（van-collapse + 列表）：
   - 两个 tab：「已忽略」/「已屏蔽」
   - 每个用户条目：头像 + MXID + 操作（取消忽略/取消屏蔽）
   - 空状态提示

2. **邀请权限设置**（van-radio-group）：
   - 三档：所有人 / 仅联系人 /  nobody
   - 调用 `matrixClientService.setAccountData('m.room_directoryvisibility', ...)`

3. **私聊设置**（van-cell-group）：
   - 「允许来自非联系人的私聊」开关
   - 「加密私聊默认开启」开关

---

## 五、P2 功能详细改进建议

### 5.1 存储管理

**当前缺口：**
- 移动端 `Files.vue` 是文件管理器，非存储统计页
- 缺少：SDK 缓存统计、浏览器存储用量、一键清理

**移动端最佳实践：**
- 使用「卡片式统计」展示存储数据（大数字 + 百分比条）
- 清理操作使用 `van-dialog` 确认 + `van-progress` 进度条

**改进措施：**

1. **新增 `StorageSettings.vue`**：
   - 存储概览卡片：缓存大小 / 媒体文件大小 / 数据库大小
   - 分类统计：消息缓存 / 媒体缓存 / 密钥缓存
   - 「清理缓存」按钮 → 确认对话框 → 进度条 → Toast 结果
   - 「清理媒体」按钮 → 确认 → 选择性清理（已读房间媒体 / 全部）

### 5.2 推送配置

**当前缺口：**
- 移动端无推送设置页
- 推送规则/设备完全不可见

**改进措施：**

1. **新增 `PushSettings.vue`**：
   - 推送总开关（van-switch）
   - 推送规则（按房间/按关键词/按类型）
   - 推送设备列表（当前设备的推送 key + 状态）

### 5.3 通知详情控制

**当前缺口：**
- 移动端 `NotificationSettings.vue` 仅覆盖：全局开关 + 声音 + 房间级别
- 缺少：通知内容摘要开关、关键词高亮、通知优先级

**改进措施：**
- 在现有 `NotificationSettings.vue` 中补充：
  - 「通知显示内容摘要」开关
  - 「关键词高亮」开关
  - 「通知优先级」（高/中/低）下拉选择

---

## 六、移动端设计原则落地检查清单

### 6.1 简化导航流程

| 原则 | 当前问题 | 改进措施 |
|---|---|---|
| 扁平化（≤3 级跳转） | 安全 → 设备 需 2 级 | 设备管理提升为一级入口 |
| 底部 Tab 优先 | 设置页使用栈式导航 | 保持栈式（移动端惯例），但缩短路径 |
| 搜索可见性 | 移动端设置页无搜索 | 顶部添加搜索框（van-search） |
| 面包屑/返回 | 子页需明确返回路径 | HeaderBar 统一带返回按钮 |

### 6.2 减少用户输入

| 原则 | 当前问题 | 改进措施 |
|---|---|---|
| 减少键盘输入 | 密码修改需手动输入旧密码 | 保留（安全必要），但新密码提供实时强度反馈 |
| 减少确认步骤 | 账号注销需 3 步确认 | 保留（安全必要），但合并前两步 |
| 智能默认值 | 通知偏好无默认推荐 | 基于使用习惯自动推荐「仅提及」模式 |
| 一键操作 | 登出设备需逐条操作 | 提供「一键登出所有其他设备」 |

### 6.3 适配多屏幕尺寸

| 原则 | 当前措施 | 改进措施 |
|---|---|---|
| 断点适配 | 使用 van-cell-group inset | 统一 inset 间距（12px），小屏时减至 8px |
| 安全区 | AutoFixHeightPage 处理 | 所有底部固定按钮需 `env(safe-area-inset-bottom)` |
| 字体缩放 | 使用 vw 单位 | 改用 `--tjg-font-size-*` token，支持系统字体缩放 |
| 横屏适配 | 无横屏专项 | 关键页面（设备列表/好友列表）横屏时切换为两列 |

### 6.4 性能优化规范

| 原则 | 当前措施 | 改进措施 |
|---|---|---|
| 列表虚拟化 | van-list（已实现） | 保持，设备 > 50 时开启虚拟滚动 |
| 图片懒加载 | 无专项处理 | 头像使用 `lazy` 属性 + placeholder |
| 骨架屏 | AutoFixHeightPage 有 Skeleton | 新增页面统一使用 Skeleton 占位 |
| 性能分级 | low-perf 降级 | 低端设备关闭毛玻璃、减少动画 |

### 6.5 可访问性标准

| 原则 | 当前措施 | 改进措施 |
|---|---|---|
| 语义化标签 | 部分使用 role | 统一为交互元素添加 `aria-label` |
| 焦点管理 | 无专项处理 | 对话框打开时焦点锁定、关闭时焦点回归 |
| 色彩对比 | 未检查 | 所有文本/图标确保 ≥ 4.5:1 对比度 |
| 操作反馈 | Toast + Dialog | 所有操作提供即时反馈（加载/成功/失败） |

---

## 七、实现步骤与时间线

### Phase 1（Week 1-2）：P0 安全刚需

| 任务 | 预计工时 | 依赖 | 验收标准 |
|---|---|---|---|
| 设备管理增强（重命名/登出/全部登出） | 2 天 | `matrixDeviceService` | 滑动手势重命名 + 登出确认 + 一键全部登出 |
| 密码修改页面 | 1 天 | `useAccount.changePassword` | 三步表单 + 强度校验 + 成功 Toast |
| 账号注销（三重确认） | 1.5 天 | `useAccount.deactivateAccount` | 三层确认流程 + 注销后跳转 |
| 安全 section 入口重组 | 0.5 天 | — | 设备管理/密码修改为一入口 |

**里程碑 1**：移动端安全能力与桌面端持平

### Phase 2（Week 3-4）：P1 核心补齐

| 任务 | 预计工时 | 依赖 | 验收标准 |
|---|---|---|---|
| 好友请求管理页面 | 2 天 | `matrixFriendsService` | 请求列表 + 滑动手势操作 |
| 好友分组管理页面 | 1.5 天 | `matrixFriendsService` | 分组列表 + 展开/折叠 + CRUD |
| 安全密钥管理页面 | 2 天 | `matrixEncryptionService` | 多步向导 + 恢复短语展示 |
| 备份恢复完整流程 | 1.5 天 | `matrixKeyBackupService` | 开启/恢复/状态展示 |
| 隐私设置补齐 | 1 天 | `matrixClientService` | 忽略/屏蔽列表 + 邀请权限 |

**里程碑 2**：移动端加密/社交/隐私完整性达标

### Phase 3（Week 5）：P2 体验提升

| 任务 | 预计工时 | 依赖 | 验收标准 |
|---|---|---|---|
| 存储管理页面 | 1.5 天 | `matrixStore` + `navigator.storage` | 存储统计 + 一键清理 |
| 推送配置页面 | 1 天 | `matrixPushService` | 推送规则 + 设备管理 |
| 通知详情控制 | 0.5 天 | `settingStore` | 摘要开关 + 关键词 + 音量 |

**里程碑 3**：移动端信息可见性达到桌面端水平

### Phase 4（Week 6）：全局优化

| 任务 | 预计工时 | 验收标准 |
|---|---|---|
| 搜索框集成到设置页 | 0.5 天 | van-search + 过滤功能 |
| 可访问性审计 | 1 天 | axe-core 扫全部移动端页面，0 严重错误 |
| 横屏适配 | 1 天 | 关键页面横屏双列 |
| 性能分级接线 | 0.5 天 | low-perf 降级生效 |
| 端到端测试 | 1 天 | 关键路径全绿 |

---

## 八、设计 Token 与组件复用建议

### 8.1 设计 Token 复用

移动端已有 `--tjg-color-*` 系列 token，P0-P1 功能开发**应统一复用**，不引入新的硬编码颜色。推荐复用映射：

| 功能语义 | 推荐 Token | 当前移动端使用情况 |
|---|---|---|
| 安全/危险操作 | `--tjg-color-danger-500` | ✅ 已有（登出按钮） |
| 成功/已验证 | `--tjg-color-success-500` | ✅ 已有（设备验证标签） |
| 信息/链接 | `--tjg-color-info-500` | ✅ 已有 |
| 警告/注意 | `--tjg-color-warning-500` | ✅ 已有（备份提示） |
| 主操作 | `--tjg-color-primary-500` | ✅ 已有 |
| 面板背景 | `--tjg-surface-panel` | ✅ 已有 |
| 分隔线 | `--tjg-border-layout-divider` | ✅ 已有 |

### 8.2 组件复用

| 桌面端组件 | 移动端适配策略 | 说明 |
|---|---|---|
| `FederationBadge.vue` | 直接复用 | 已接入移动端 HeaderBar |
| `MessageLockBadge.vue` | 直接复用 | 已在消息渲染中 |
| `useMessageTrust.ts` | 直接复用 | 已在移动端加密页引用 |
| `SecureBackupDialog.vue` | 需移动端重写 | van-dialog 替代 n-dialog |
| `AvatarCropper.vue` | 需移动端适配 | 触屏手势裁剪 |
| `MobileDeviceTrustManager.vue` | 已有 | 已创建但未集成到安全页 |

### 8.3 移动端导航结构建议

```
移动端「我的」页（index.vue）
├── 个人信息区（PersonalInfo）
├── 快捷入口九宫格（MobileQuickActions）
├── 昵称编辑
├── 安全/隐私 section
│   ├── 修改密码 ★ P0
│   ├── 设备管理 ★ P0
│   └── 安全密钥管理 ★ P1
├── 社交 section ★ P1
│   ├── 好友请求
│   └── 好友分组
├── 加密 section
│   └── 加密设置（已有）
├── 偏好 section
│   ├── 主题切换
│   ├── 通知设置
│   └── 发送偏好
├── 高级 section
│   ├── 实验室
│   ├── 通知设置（增强）★ P2
│   └── 存储管理 ★ P2
├── 帮助与反馈
├── 关于
├── 退出登录
└── 危险区域 ★ P0
    └── 注销账号
```

---

## 九、风险与约束

### 9.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| SDK 接口不完整（设备操作/密码修改） | 中 | 高 | 先验证 API 可用性，不可用则降级为提示 |
| 移动端 Tauri 文件系统限制 | 中 | 中 | 存储清理需走 Tauri dialog API |
| 性能分级降级导致视觉差异 | 低 | 中 | 提供「恢复效果」按钮 |

### 9.2 合规约束

| 约束 | 说明 | 应对 |
|---|---|---|
| 个人信息保护法（PIPL） | 账号注销必须在 15 个工作日内完成 | 对接后端注销 API，确保数据删除 |
| GDPR | 数据导出/删除权利 | 在注销流程中提供数据导出选项 |
| Matrix 规范 | E2EE 密钥操作必须遵循 Matrix spec | 使用 SDK 标准 API，不自行实现加密 |

### 9.3 设计约束

| 约束 | 说明 | 应对 |
|---|---|---|
| Vant UI 组件库 | 非原生移动端组件，有性能开销 | 虚拟列表 + 懒加载 + 按需引入 |
| 小屏适配 | 320px 宽度设备 | inset 间距自适应、字体使用 vw/token |
| 横屏场景 | 聊天 + 设置分屏 | 设置页支持独立横屏布局 |

---

## 十、验收标准总表

### 10.1 功能验收

| 功能 | 验收标准 | 测试方式 |
|---|---|---|
| 设备管理增强 | 重命名/登出/全部登出功能完整可用 | 手动测试 + API mock |
| 密码修改 | 旧密码校验 + 新密码强度 + 确认密码 + 成功反馈 | 单元测试 + 手动 |
| 账号注销 | 三重确认流程 + 注销后数据清除 | 手动测试 |
| 好友管理 | 请求接受/拒绝 + 分组 CRUD | 单元测试 + 手动 |
| 安全密钥 | 向导流程 + 恢复短语展示 | 单元测试 |
| 备份恢复 | 开启/恢复/状态展示 | 单元测试 + 手动 |
| 隐私设置 | 忽略/屏蔽列表 + 邀请权限 | 单元测试 |
| 存储管理 | 统计展示 + 清理功能 | 手动测试 |
| 推送配置 | 规则配置 + 设备管理 | 手动测试 |
| 通知详情 | 摘要/关键词/音量控制 | 手动测试 |

### 10.2 性能验收

| 指标 | 目标 | 测量方式 |
|---|---|---|
| 设置页首屏渲染 | < 300ms | Performance API |
| 列表滚动帧率 | > 55fps | FPS 检测 |
| 内存占用 | < 50MB | Android Profiler |
| 低端设备降级 | 毛玻璃/动画关闭 | manual |

### 10.3 可访问性验收

| 标准 | 目标 | 检测方式 |
|---|---|---|
| axe-core 严重错误 | 0 | e2e/a11y-baseline |
| 色彩对比度 | ≥ 4.5:1 | axe-color-contrast |
| 焦点可见性 | 所有交互元素 | manual |
| 屏幕阅读器 | 关键页面可用 | TalkBack/VoiceOver |

---

## 十一、附录：当前移动端功能覆盖矩阵

```
功能面                    │ 桌面端 │ 移动端 │ 差距等级
─────────────────────────────────────────────────────
账号管理（头像/昵称）     │   ✅   │   ✅   │ 已对齐
账号管理（密码修改）      │   ✅   │   ❌   │ P0 缺失
账号管理（三因素/邮箱）   │   ✅   │   ❌   │ P1 缺失
账号管理（账号注销）      │   ✅   │   ❌   │ P0 缺失
账号管理（扩展资料）      │   ✅   │   ❌   │ P1 缺失
设备管理（列表）          │   ✅   │   ✅   │ 已对齐
设备管理（重命名/登出）   │   ✅   │   ❌   │ P0 缺失
设备管理（全部登出）      │   ✅   │   ❌   │ P0 缺失
好友管理（请求）          │   ✅   │   ❌   │ P1 缺失
好友管理（分组）          │   ✅   │   ❌   │ P1 缺失
好友管理（申请列表）      │   ✅   │   ❌   │ P1 缺失
外观（主题）              │   ✅   │   ✅   │ 已对齐
外观（字体/效果）         │   ✅   │   ❌   │ P3 低优
通知（全局开关/声音）     │   ✅   │   ✅   │ 已对齐
通知（内容摘要/关键词）   │   ✅   │   ❌   │ P2 缺失
偏好（语言）              │   ✅   │   ✅   │ 已对齐
偏好（自启/存储目录）     │   ✅   │   ❌   │ P3 低优
偏好（发送偏好）          │   ✅   │   ✅   │ 已对齐
加密（状态展示）          │   ✅   │   ✅   │ 已对齐
加密（安全密钥）          │   ✅   │   ❌   │ P1 缺失
加密（备份恢复）          │   ✅   │   ⚠️   │ P1 部分缺失
加密（E2EE Bootstrap）    │   ✅   │   ❌   │ P1 缺失
安全（隐私设置）          │   ✅   │   ❌   │ P1 缺失
安全（屏蔽/忽略列表）     │   ✅   │   ❌   │ P1 缺失
安全（邀请权限）          │   ✅   │   ❌   │ P1 缺失
存储（SDK/浏览器/清理）   │   ✅   │   ❌   │ P2 缺失
推送（设备/规则）         │   ✅   │   ❌   │ P2 缺失
侧边栏设置               │   ✅   │   N/A  │ 移动端不适用
快捷键                   │   ✅   │   N/A  │ 移动端不适用
实验室                    │   ✅   │   ✅   │ 已对齐
 moderation                │   ✅   │   ✅   │ 已对齐
阅后即焚                  │   ✅   │   ✅   │ 已对齐
帮助与关于                │   ✅   │   ✅   │ 已对齐
```

---

## 十二、执行记录

分支：`feature/mobile-optimization`。以下每条都注明「做了什么」与「依据什么判断」，
经核实已实现或不适用于移动端的项目一并列出，不静默跳过。

### 12.1 P0

| 项 | 结论 | 依据 |
| --- | --- | --- |
| 设备管理增强（重命名 / 逐条登出 / 一键登出其他设备） | 已实现 | 提交 `f75839d8`。原先 `DeviceManagement.vue` 只有一个非法的多语句内联 `@click`，Vue 编译期即失败——vue-tsc 不检查模板，因此 12 个既有测试从未真正执行过。 |
| 密码修改页 | 已实现 | 同上。新增 `PasswordSettings.vue` + `utils/passwordStrength.ts`（6 条规则、强度分级、i18n key 映射）。 |
| 账号注销（三重确认） | 部分保留差异 | `SecuritySettings.vue` 已有注销入口与单次确认。方案要求三重确认，但该操作不可逆且已有二次确认 + 文案警告；提高确认次数属于产品取舍，未擅自改动。 |
| 安全 section 入口重组 | 已实现 | 设备管理、密码修改、已忽略用户、邀请权限、安全密钥均已可从安全/隐私页直达。 |

### 12.2 P1

| 项 | 结论 | 依据 |
| --- | --- | --- |
| 好友请求管理 | 经核实已实现，跳过 | `AddFriends` / `ConfirmAddFriend` / `FriendInfo` / `StartFriendsChat` 均已存在，非缺口。 |
| 好友分组管理 | 已实现 | 提交 `85ef2723`。新增 `FriendGroups.vue`，`van-collapse` 懒加载成员 + 分组 CRUD。 |
| 邀请列表管理 | 经核实已实现，跳过 | 移动端已有申请列表与好友请求流程。 |
| 安全密钥管理 | 已实现 | 提交 `f715ff21`。新增 `MobileSecurityKeySetup.vue`（`van-steps` 向导）。 |
| 备份恢复完整流程 | 经核实已实现，跳过 | `MobileKeyBackupDialog.vue` 已覆盖开启/恢复；`CryptoKeyBackupAdapter` 的 `restoreFromBackup` 走 SSSS 引导 + `restoreKeyBackup`。 |
| 隐私设置：已忽略用户 | 已实现 | 提交 `654365a1`。原先是**死链**：入口存在但路由未注册、视图不存在，点击无任何反应。 |
| 隐私设置：已屏蔽用户 | 跳过（无实际后端支撑） | 桌面 `BlockedUsersSection.vue` 的「已屏蔽」只写入 `localStorage['tjg-blocked-users']`，不写任何 Matrix account data，也没有任何读取方——是一个自洽的空壳。移动端复制它只会复制一个不生效的开关。真正的屏蔽语义由 `m.ignored_user_list`（即已忽略用户）承担，该列表已在两端落地。 |
| 隐私设置：邀请权限 | 已实现 | 见 12.3。 |
| 隐私设置：私聊设置 | 跳过（无法诚实接线） | 方案只给了两个开关名，未给任何持久化字段。全仓检索无 `canDirect` / `dm_policy` / 非联系人私聊策略的实现或读取点，也无可控的「私聊默认加密」配置（`MatrixDirectMessageService.getOrCreateDmRoom` 的 `encrypted` 由调用方传入）。接入一个无人读取的开关会制造新的空壳，因此不做，待后端/SDK 明确契约后再补。 |

### 12.3 P2

| 项 | 结论 | 依据 |
| --- | --- | --- |
| 5.1 存储管理 | 已实现 | 提交 `0bbf7890`。`MobileStorageSettings.vue`：`matrixWorkerHost.getStats()` + `navigator.storage.estimate()` + `clearStores()`。注意 `StoreStats` 没有 `size` 字段，实际字段是 `totalEntries` / `memoryUsageBytes` / `hits` / `misses` / `evictions` / `hitRate`。 |
| 5.2 推送配置 | 已实现 | 提交 `c80be93d` + 后续入口提交。新增 `MobilePushSettings.vue`（总开关 / 按 kind 分组规则 / 推送设备列表）与 `pushSettingsPresentation` 纯逻辑模块。**pushkey 是推送凭证，界面必须在掩码后展示**，掩码边界由单测固定。 |
| 5.3 通知详情控制 | 已实现 | 提交 `18c34e03`。新增 `notificationDisplayPreferences` 模块：内容摘要开关 + 关键词高亮 + 优先级。优先级不是被存起来的死值，而是可见度裁定——`high` 突破内容摘要开关、`low` 强制折叠、`medium` 遵循开关；正文隐藏时不参与关键词匹配，避免通过高亮标记泄漏内容。`MatrixNotificationService.buildNotificationDisplay()` 是桌面通知发送路径（`messageMutations`）消费的唯一展示决策入口；旧 `showNotification()` 二次发送路径已删除。 |

### 12.4 邀请权限的模型差异（重要）

方案 4.4 写的是「所有人 / 仅联系人 / nobody」三档，**代码实际是名单模型**：
`im.hula.invite_blocklist` account data 上的 `allow_all` / `blocklist` / `allowlist`，
桌面 `InvitePermissionPanel.vue` 已按此实现。执行时以代码为准，理由：

1. 同一个 account data 上并存两套模式定义必然分叉；
2. 「仅联系人」需要「联系人」的服务端权威定义，当前只有本地好友列表，判定不一致会变成安全口子。

本次同时把判定逻辑从 `useInvitePermissionFilter` 抽出为 `invitePermissionPolicy`：
原先该 composable 直接依赖 `MatrixClient`，判定结果无法在无客户端场景复用与测试，
且全仓**只有它自己的测试引用过它**（`InvitePermissionPanel.vue` 只 import 了类型），
即过滤逻辑从未被调用过。抽出后移动端与桌面可共用同一份判定。

### 12.5 遗留与已知限制

> 本节记录于第五轮，**其中三条均已解决**；为保留决策轨迹不删除原文，
> 逐条标注现状，最新状态见 12.8 节。

1. ~~**邀请权限尚未接入自动拒绝**~~ —— **已解决**（提交 `e4352eba`）。
   原先确实没有任何调用方执行判定并 `leave(roomId)`。现已补齐唯一强制点：
   `App.vue` 在连接就绪后 `start()` + `syncContacts()`，`InvitePolicyEnforcer`
   监听 `Room.member`，命中策略即拒邀，并提供 60 秒撤回窗口。
   当时判断"产品语义需要确认后再做"是对的——本次确实按确认后的语义实现
   （自动拒邀 + 可撤回提示）。
2. ~~**`useMessageTrust.ts` 仍把所有加密消息判为 `verified`**~~ —— **已解决**。
   当前实现只在**确有已验证设备**时返回 `verified`
   （`refreshTrustLevel` 中 `devices.some(d => d.verified)`），
   无设备、无 senderId、查询失败均返回 `unverified`。
   其中确实存在的 `trustDescription` 硬编码中文问题也已修复（改为 i18n key）。
3. ~~**工作区 23 个 `.vue` 被写坏**~~ —— **已解决**（提交 `ed815c5c`）。
   查明真相后与原判断不同：它们不是随机损坏，而是并行会话正在做
   `style` 内联属性 → UnoCSS 工具类的批量改写，只是没写完。已保留改写意图、
   只修语法，并**只提交了我自己改动的 5 个文件**；其余文件里我的修复随对方改动一并存在。

### 12.5.1 一个当时没发现、后来才暴露的隐患

第 1 条补救时暴露出更深的问题，值得单独记录：

`MatrixFriendService.isFriend()` 在查询失败时 `catch` 并**返回 `false`**，
与"确认不是好友"不可区分。如果「仅允许联系人私聊」直接用这个布尔值，
后端抖动或离线一次，用户就会在那个窗口里把**所有好友的邀请都拒掉**。

因此实现改成三态 `ContactState`（`contact` / `stranger` / `unknown`），
只有确凿的 `stranger` 才拒，`unknown` 一律放行（fail-open，见 12.8 节）。


### 12.6 第五轮补充（2026-09-21）

| 项 | 结论 | 依据 |
| --- | --- | --- |
| 账号注销三重确认 | 已实现 | 提交 `109b642a`。原先只有**单次**确认对话框。新增 `MobileDeactivateAccount.vue`：后果说明 + 显式勾选 → 输入完整 MXID 校验 → 最终确认对话框（含 erase 选项、防重复提交）。会话拿不到 MXID 时判定为不匹配，不提供「无可比对即放行」的路径。 |
| `useMessageTrust` 假 verified | 经核实已修复 | 当前实现已返回安全默认值 `unverified`，源码内有「旧实现恒回 'verified'，造成假安全信号——已修复」的注释。无需改动。 |
| `useMessageTrust` 文案硬编码 | 已修复 | 源码内确有硬编码中文，绕过 vue-i18n（英文界面下锁徽章 title 显示中文）。改为返回 `trustDescriptionKey`，由调用方 `t()` 渲染；所用 key `chat.encryption.*_title` 已存在。 |

12.5 节第 2 条（`useMessageTrust` 恒判 verified）**已不成立**，第 3 条（文案硬编码）已修复；
第 1 条（邀请权限自动拒绝）已于提交 `e4352eba` 接入，见 12.5 节修订说明。

### 12.7 门禁现状与一个必须知道的风险

**门禁结果（第五轮结束时，分支 `feature/mobile-optimization` 上）：**

| 门禁 | 结果 |
| --- | --- |
| `pnpm vue-tsc --noEmit` | 0 错误 |
| `pnpm test:run` | 8816/8816 测试通过 |
| `check-i18n` | 通过 |
| `check-i18n-refs` | 通过（273 / 基线 280） |
| `check-ratchet` | 6/6 通过 |
| `check:sdk-boundary` | 通过（205 / 基线 187，无回归） |
| `quality:no-raw-fetch` | 通过 |

**`pnpm test:run` 仍有 14 个测试文件报错（0 test），根因不在本分支的提交里。**
用真实 Vite 构建逐个 SFC 编译后定位到：工作区里 **23 个 `.vue` 文件被写坏了**，
形式统一为属性名重复拼接，例如

```
class="text-12px class="border-[1px] ...""
```

这种写法让 `@vue/compiler-sfc` 直接抛
`Attribute name cannot contain U+0022 ("), U+0027 (')`。

关键事实：

1. 这 23 个文件在 `HEAD`（含本分支全部提交）**都是干净的**——上面逐个用
   `git show HEAD:<file>` 核对过，0 个在 HEAD 就已损坏。损坏纯粹来自
   **未提交的工作区改动**（并行会话正在编辑同一工作区）。
2. 因此 14 个测试文件的失败**与本次移动端优化无关**，`vue-tsc` 也看不见
   （它不检查模板属性语法），只有真正编译模板时才会暴露。
3. 这也是为什么本轮额外用 Vite 构建做了一次实证编译检查：单元测试把 Vant
   全部 stub 掉、`vue-tsc` 不查模板，两者都发现不了这类错误。

**合并前必须注意**：如果并行会话把这 23 个文件原样提交，主分支会变成无法构建的状态。
本分支自身的提交不含这些问题。

### 12.8 私聊隐私：从"默认放开"改为"默认仅联系人"

**决策**：「仅允许联系人私聊」现在是**默认值**（`DEFAULT_INVITE_POLICY.allowStrangers = false`）。

理由：私聊是陌生人触达用户最直接的通道，默认放开等于默认接受任意人建立加密会话。
默认收紧、由用户显式放开，是更合理的安全基线。

**迁移安全性**：该默认值只在「从未保存过策略」时生效（`loadInvitePolicy` 的兜底分支）。
已有本地策略的用户保留自己的选择，不会被静默改写——这是刻意的，
否则升级会静默改变所有人的行为。

**一个必须解决的前提**：默认收紧只有在"联系人判定可靠"时才安全。
排查中发现 `MatrixFriendService.isFriend()` **查询失败时返回 `false`**，
与"确认不是好友"不可区分。若直接采用：

- 后端抖动 / 离线 / 好友接口失败 → `false` → 被当作陌生人 → **好友的邀请被自动拒掉**

因此新增三态判定，这是本次最关键的一处设计：

| 状态 | 含义 | 对「仅允许联系人」的效果 |
| --- | --- | --- |
| `contact` | 已确认是联系人 | 放行 |
| `stranger` | 已确认不是联系人 | **拒绝** |
| `unknown` | 无法确认（查询失败 / id 缺失 / 未注入解析器） | **放行（fail-open）** |

配套机制：

- `contactStateResolver`：三态解析 + 5 分钟 TTL 缓存 + 并发去重（一次邀请会触发多条
  `m.room.member` 事件）；`unknown` **不写缓存**，保留后续确认机会。
- 启动时用好友列表 `seed()` 预热，省掉逐个查询；失败不影响启动。
- 仅在 `allow_all && allowStrangers === false` 时才发起联系人查询——
  名单模式下用不上，不该为一个必然被拒的邀请多打一次请求。
- `policy.contacts` **不再参与判定**（静态快照在查询失败时是空的，会退化成
  "谁都不认识"），仅保留作展示字段。

**fail-open 的取舍**：宁可漏放一个陌生人的邀请，也不误拒好友的邀请。
误拒好友的代价（丢失会话、且用户无从察觉）高于漏放一个可被手动拒绝的邀请。

fail-open 守卫必须**限定在 `mode === 'allow_all'`**。第一版实现漏了这个前提，
而强制点只在 allow_all 下查联系人，于是 blocklist / allowlist 因为拿不到
`contactState` 被守卫一并拦掉——**用户拉黑的人反而能进房间**。
已补两条回归测试（"无 contactState 时名单模式仍须拒绝"）并修正条件。

覆盖该设计的测试（`invitePolicyDecision` / `invitePolicyEnforcer`）：
`unknown` 与"未注入解析器"都必须放行；blocklist 模式必须不查联系人。

### 12.9 桌面端与移动端统一邀请策略（提交 60b562f4）

12.8 节末尾提到"桌面端仍写旧的 im.hula.invite_blocklist，两端不一致"。统一时发现
桌面端的问题比"不一致"更严重：

**桌面 `InvitePermissionPanel.vue` 是个纯装饰组件。**
`SecuritySettings.vue` 以 `<InvitePermissionPanel />` 挂载——不传 props、不接事件，
而面板自身没有状态、没有服务调用，emit 也没人监听。于是三档模式点了没反应、
名单加了不落库。它的 10 个测试断言的是"emit 了事件"，所以一直绿着，
恰好掩盖了"事件无人接收"——这类"自洽 stub"在本项目已出现多次。

**`useInvitePermissionFilter` 是一份平行实现。**
自带一套 `allow_all/blocklist/allowlist` 与 `shouldRejectInvite`，写旧 key。
全仓只有它自己的测试引用过它，过滤逻辑从未被调用。两份实现并存会让
"哪份说了算"永久含糊，因此直接删除，而不是留着当兼容层。

统一后的结构：

| 关注点 | 唯一实现 |
| --- | --- |
| 策略读写 | `matrixAccountService.getInvitePolicy / setInvitePolicy`（`im.hula.invite_policy`） |
| 判定 | `invitePolicyDecision.decideInviteAction` + `contactStateResolver` 三态 |
| 强制 | `invitePolicyEnforcer`（`App.vue` 接线，两端共用） |
| 移动端 UI | `MobileInvitePermission.vue` |
| 桌面端 UI | `InvitePermissionPanel.vue`（自包含，同一套 API） |

桌面端同时补齐了两个开关（允许非联系人私聊、新私聊默认加密），并在测试中
固定了一条容易踩的规则：**显式传入的初值优先于 account data**。
否则挂载后策略会被账号数据覆盖，传入的 `mode` 静默失效——与"面板点了没反应"
属于同一类问题，只是换了形式。实现时先写出了这个回归用例（红了才修）。

## 十三、桌面设置死配置治理（分支 `feat/settings-wiring`，Task 0-15）

本节记录一次专项治理的结论。起因：桌面设置窗口（`src/views/settingsWindow`）里
大量开关"点了没反应"——写进去的 `localStorage` key 没有任何运行时消费方。
治理从基线提交 `e157675a` 到代码收尾提交 `7df690ab`，共 15 个任务
（本节的提交在其后）。

**验收判据是行为测试，不是死配置数量。** 数量只能证明"没有新增"，
不能证明"开关真的生效"；后者由各任务先红后绿的真实路径测试负责
（完整过程见进度账本 `.superpowers/sdd/2026-09-21-desktop-settings-wiring/progress.md`）。

### 13.1 审计方法

三步：

1. **枚举写入**：只扫 `src/views/settingsWindow/**/*.vue`，抓 `localStorage.setItem`。
   两种形式都要认：字面量 `setItem('tjg-xxx', ...)`，以及同文件
   `const NAME = 'tjg-xxx'` 后再 `setItem(NAME, ...)`。第一版只认字面量，
   漏了 3 个别名写入键（`tjg-sidebar-settings`、`tjg-burn-after-read-settings`、
   `tjg-friend-settings`），评审发现后补齐（提交 `a090dc2b`）。解析不到字面量就跳过，不猜。
2. **判定消费方**：一个 key 算"有消费方"，当且仅当在设置窗口**之外**、且不属于
   `__tests__`、且**不是另一个设置界面**的 `.ts`/`.vue` 里出现该 key 的带引号字面量。
   用带引号精确匹配，避免 `--tjg-font-size-*` 这类 CSS token 干扰。
3. **数量 ratchet**：死配置数量只减不增；基线缺失或结构不合法时直接失败，
   绝不静默退化为 exit 0 空转。

**判据改过一次，而且是改严。** 初版把"另一个设置界面回读"也算消费方，
于是 `tjg-debug-mode` / `tjg-lab-features` / `tjg-show-performance` 这类
"只有设置 UI 读写、零运行时消费方"的 key 被判成 live。整分支评审（`991479e5`）
核实后，提交 `d3668363` 改为"另一个设置界面不算消费方"，基线从 22 重测为 **34**。
这条修正很重要：它把一次"看起来已经完成"的审计打回原形。

**审计方法本身的边界**（必须写在前面，否则会误读后面的数字）：
审计只测"写入的 key 有没有被别处引用"，**不测读取是否真的改变行为**。
Task 2/3 发现的"开关存了、也读了，但发送路径上没有守卫"这类缺陷，
对审计和守门都是盲区——它只能靠行为测试暴露。

### 13.2 实测死配置数：25 → 28 → 25 → 22 → 34 → 25 → 22 → 19 → 16 → 15 → 10 → 9 → 1

每个数字都来自当时 `node scripts/check-settings-wiring.mjs` 的实测输出，
可逐版复核（`scripts/settings-wiring-baseline.json` 的提交历史保留了每一版的
`deadKeyNames`）：

| 阶段 | 提交 | 实测 | 本次消失的 key |
| --- | --- | --- | --- |
| Task 0 首测 | `ee7d199b` | 25 | （首测；判据只认字面量写入，是低估） |
| Task 0 修判据 | `a090dc2b` | 28 | 无；补 3 个别名写入键后重测，**28 才是起点诚实值** |
| Task 1 | `fb5bc2b3` | 25 | `tjg-send-receipts`、`tjg-show-typing`、`tjg-show-online`（键名错位，统一到 store） |
| Task 4 | `f68f01cf` | 22 | `tjg-desktop-notification`、`tjg-show-content`、`tjg-show-sender`（键名错位，并入展示偏好） |
| 评审后重基线 | `d3668363` | 34 | 无；判据改严（另一个设置界面不算消费方），22 → 34 |
| Task 6 | `5aa92acc` | 25 | 9 个通知 key：3 个接线后不再死（线程提及、关键词开关、关键词列表），6 个无可挂分发点按 YAGNI 删 UI 与 key |
| Task 7 | `7014c6d6` | 22 | `tjg-push-dnd`、`tjg-push-dnd-start`、`tjg-push-dnd-end`（收归服务单一表示） |
| Task 8 | `c5c3688c` | 19 | `tjg-blocked-users`、`tjg-invite-blocklist`、`tjg-invite-allowlist`（并入 `im.hula.invite_policy`） |
| Task 9 | `c3954669` / `19752cbe` / `0fddf185` | 16 | `tjg-sidebar-settings`（整个侧边栏面板，1 个 blob 覆盖 11 字段）、`tjg-burn-after-read-settings`、`tjg-friend-settings` |
| Task 10 | `6346db0c` | 15 | `tjg-font-size`（落地为 `--tjg-font-scale`） |
| Task 11 | `c9385982` | 10 | `tjg-bubble-style`、`tjg-debug-mode`、`tjg-lab-features`、`tjg-show-performance`、`tjg-enable-devtools`（气泡落地 + 删整个桌面 Labs tab） |
| Task 12 | `8cb2c4ee` | 9 | `tjg-backup-enabled`（开关改读 `encryptionStore.backupEnabled` 真实状态） |
| Task 13 | `bd51d097` | 1 | 8 个音视频 key 并入 `mediaDevicePreferences` |
| 收尾 | `7df690ab` | 1 | 无；只剩 `tjg-mjolnir-ban-lists` |

两个必须注意的点：

1. **25 是低估，28 才是起点。** 把 25 当基线会漏掉 3 个别名写入键。
2. **22 → 34 是上升，但那是"更诚实"。** 数字变大不等于质量变差：
   ratchet 的语义是"不许在诚实判据下新增"，不是"数字必须一路向下"。
   同理，**收尾值是 1 而不是 0，是判据使然**：`tjg-mjolnir-ban-lists` 的真实消费方是
   `src/mobile/views/my/MjolnirSettings.vue`，而守门刻意把"设置界面"排除出消费方
   （宁可多报死，也不要把死配置判活），所以它保留在基线里。按方案约定，
   完成判据是行为测试，不是把数字刷到 0。

### 13.3 五类问题与各自的修复路径

| 类别 | 症状 | 本次实例 | 选择的修复路径 |
| --- | --- | --- | --- |
| **键名错位** | 设置 UI 写的 key 与消费方读的 key 不是同一个，开关永远不生效 | 已读回执/输入中/在线状态（Task 1）；桌面通知/通知内容/发送者（Task 4） | 合并到**单一 storage 模块**（一个 key、一套 load/save），保留一次性幂等迁移清理旧 key；顺序是先接线、再删旧 |
| **零消费方** | key 被设置 UI 写、也被设置 UI 回读，运行时没有任何消费方 | 通知 9 个（Task 6）；勿扰时段 3 个（Task 7）；侧边栏/阅后即焚/好友（Task 9）；字体大小（Task 10）；气泡样式与 Labs（Task 11）；备份开关（Task 12）；音视频 8 项（Task 13） | 先找**真实消费点**：找得到就接线并补真实路径行为测试；找不到且没有可挂分发点就按 **YAGNI 删 UI 与 key**（提交信息写明依据）。**不搬迁**——把 key 搬到 store / account data 不创造消费方，属于"假完成" |
| **平行实现** | 同一概念两套实现，"哪份说了算"永久含糊 | `useInvitePermissionFilter` vs `invitePolicy`（Task 8）；侧边栏 `showIconsOnly` vs store 的 `showMode`；勿扰时段的第 4 份表示（Task 7） | 选**唯一来源**，删掉另一份，旧数据一次性迁移；不做长期兼容层 |
| **装饰组件** | 组件渲染正常、事件也 emit，但没有任何使用处监听；测试只断言 `emitted(...)`，于是长期绿着不生效 | `InvitePermissionPanel` 的三档模式与名单（12.9 节）；Task 14 删除的三个死事件 | 要么补真实 props/事件接线并把测试改为断言真实落库，要么删除；并新增 `check:component-contracts` 守住复发 |
| **无实现** | UI 存在，但运行时/后端根本没有对应能力 | 音视频设备选择与音量（接线前） | 只实现**能安全生效**的部分（音频三个布尔经 `applyConstraints`）；不能生效且无消费方的（输出设备、输入/输出音量）连同控件一起删除；设备选择如实标注"仅作用于测试/预览，应用到真实通话需要 `replaceTrack`（未实现）"，不造假接线 |

### 13.4 两个新守门

#### `check:settings-wiring`（`scripts/check-settings-wiring.mjs`）

```
node scripts/check-settings-wiring.mjs          # 校验（CI / pre-merge）
node scripts/check-settings-wiring.mjs --update # 收紧死配置基线（拒绝任何新增键名）
node scripts/check-settings-wiring.mjs --list   # 打印发现的持久化 key 与归属
```

判据在 Task 5 重写为**清单契约 + 持久层发现**（旧口径"只扫设置窗口里的写入"已被证明无法
覆盖搬进 store/util/service 的 key——Task 11/13 之后设置窗口只剩 1 个直接写入，数字绿着却
不代表开关接线）：

- 从 `src/{stores,services,utils,composables}/**` 发现持久化 key：`*_STORAGE_KEY` 常量
  （含 `private static readonly`、`X: string = 'literal'` 类型标注与 `X = StoresEnum.Y` 枚举写法）、
  `*STORAGE_KEYS` 映射的每个字面量值（**声明语法不限**：`= {`、`const X: Record<K, V> = {`、
  `satisfies` / `as const` 均可）、`defineStore(...)` 且有 `persist` 配置时的 store id、
  `localStorage` **与 `sessionStorage`** 的 `setItem` 字面量 / 同文件常量 / 对象成员，
  以及模板键族（`` `${PREFIX}${id}` `` → `<prefix>*`）。
- 发现到的 key 必须登记在 `scripts/settings-wiring-manifest.json`（`key → owner + ≥1 真实
  consumer 路径 + kind + note`，可带 `storage: local|session`），否则 FAIL；清单里
  owner/consumers 路径必须存在（删文件/改名即 FAIL），标注了 `storage` 的条目还要与实际
  写入介质一致。当前 70 个可静态求值的 key 全部登记。
- **漏报自检（阻塞）**：另用一条刻意更宽松的语法假设重扫同一批目录，宽松扫到而发现器没扫到的
  key 一律 FAIL。历史缺陷正是这里静默失效——`const STORAGE_KEYS: Record<...> = {...}` 带类型
  标注时整条不可见，守门却继续打印"无未登记 key"（2026-09-22 review Critical #1）。
- 保留死配置数量 ratchet，并**同时**校验键名集合：当前集合 ⊆ 基线集合；`--update` 也拒绝
  任何新增键名（同数量换键同样不放行）。
- 已知局限：只做静态语法发现。参数化写入（`setItem(storageKey)`）与纯变量模板键无法求值，
  只打印"无法静态判定 N 处"（当前 10 处）而不伪造 key；组件内（`src/components`）定义的 key
  不在发现范围。行/块注释里的 `setItem('…')` 已排除。消费方只校验路径存在性，"键真的被读"
  属于评审责任，正则不假装证明（2026-09-22 review Important #2 修正了两条把"只写不读"文件
  当消费方的错误登记：`tjg-session-homeserver-url`、`tjg.lastCrypto*`）。
- **只守引用，不守生效。** 判活仍是引用/清单计数，"消费方是否真在运行时消费"它判断不了。
  Task 13 是实证：8 个音视频 key 并入 `mediaDevicePreferences` 后全部被记为"已消费"，
  但其中设备选择与音量在通话路径上仍无效果；最终修复波按用户裁决（M1）删掉了
  `audioOutputId` / `inputVolume` / `outputVolume` 三个**零消费方**控件与字段，
  只留能经 `applyConstraints` 真实生效的音质布尔，以及作用于测试/预览的设备选择。
  Task 2/3 的"存了不生效"同理是它的盲区，需要行为测试补位。
- **刻意保守带来假阳性。** 死配置判据仍把设置界面排除出消费方，会把"仅被设置页消费"的 key
  报成死配置——`tjg-mjolnir-ban-lists` 即为此列，故该项收尾值为 1。
- 平行实现、装饰组件、无实现这三类它**看不见**，那是下一节的守门与行为测试的职责。

历史局限（Task 5 已解决，保留作为记录）：写入面只覆盖设置窗口导致"写入搬走即脱离视野"，
已由持久层发现 + 清单取代；`--update` 曾只拒绝抬高数量、允许同数量换键，已改为键名子集校验。
2026-09-22 review 追加修复（同一提交）：带类型标注的 `*STORAGE_KEYS` 漏报（Critical #1，已加
漏报自检）、两条不读 key 的假消费方（Important #2）、`sessionStorage` 写入不建账
（Important #3，`oidc_state` / `oidc_code_verifier` / `oidc_homeserver_url` 已登记为
`storage: session`），清单 63 → 70。

#### `check:component-contracts`（`scripts/check-component-contracts.mjs`）

```
node scripts/check-component-contracts.mjs          # 校验
node scripts/check-component-contracts.mjs --update # 收紧基线
```

判据：用 `vue/compiler-sfc` 的 `parse()` + `compileScript()` 与模板 AST 做结构化解析
（**不做字符串包含匹配**——审计脚本第一版用子串匹配时 `SpaceTree` 被 `SkeletonSpaceTree` 命中，
产生大量误报）。组件被使用、但它声明的事件在所有使用处都没绑定，就记一条；
`v-model` 归一为 `update:modelValue` / `update:arg`；事件名按 Vue 的连字符/驼峰双查找规则
归一；`__tests__` 既不算声明方也不算使用方；从未被使用的组件不计入（那是死代码问题）。
全局自动注册组件按 `src/typings/components.d.ts` 的**路径派生名**解析
（`renderMessage/index.vue` → `<RenderMessage>`），basename 表仅作 d.ts 漂移兜底。
`v-on="obj"` / `v-bind="obj"` / 动态参数 `@[name]` / `<component :is>` 一律判为不可判定并跳过
（宁可漏报，不误报）。

Task 5 收紧后的口径：

- **数量 + 键名双重 ratchet**：当前集合必须 ⊆ 基线集合，`--update` 也拒绝任何新增条目
  （同数量换条目同样不放行）。
- **新增"不可判定"即 FAIL**：解析失败 / 对象展开 / 动态参数会把组件从计数里剔除，等价于
  凭空变绿；基线用 `skippedLocations` 冻结当前 0 处，新增一律 FAIL，`--update` 也拒绝。
- **白名单活性告警**：`ACCEPTED_PATTERNS` 条目在组件被删除、事件不再声明、或已不再压制
  任何事件时会在运行时告警，防止白名单腐化成"永久赦免"。
- **Windows 反斜杠归一化**：`collectVueFiles` / `resolveImport` / `relative` 统一转 POSIX，
  白名单与基线在 Windows 上不再整体失配。
- 剩余局限：`<component :is>` 动态挂载仍不识别（按"从未使用"漏报）；事件判据是"所有使用处
  的并集"，无法表达"一处监听、另一处断线"（`renderMessage/index::jump2Reply` 在历史窗口的
  逐使用处缺口见 13.6 补充）。
- **基线已从 32 降为 0。** 原先 32 条中：3 条接线、12 条删除死声明、1 条检测器误报消失、
  5 条设计上可选进入 `ACCEPTED_PATTERNS`、11 条产品行为断线登记进 13.6 并在白名单里以
  `followUp` 挂账（每次运行打印 `todo`）。历史分类见 `task-14-report.md` 的 C-real。

### 13.5 收尾门禁（Task 15 实测；守门相关行由 Task 5 更新）

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| `npx vue-tsc --noEmit` | 0 错误，exit 0 | |
| `npx vitest run` | 796/796 文件、9199/9199 用例通过；exit 1 | 唯一的非零来源是 3 个**既有** crypto unhandled rejection（`CryptoSDKAdapter` / `CryptoKeyBackupAdapter` 报 `CryptoApi 不可用`）。本分支未触碰 `src/services/matrix/crypto/`；单独跑这两个文件（74/74 用例通过）同样复现 exit 1 |
| `check:settings-wiring` | OK 持久化 key 清单 70/70、死配置 1（基线 1） | Task 5 改为"清单 + 持久层发现"（2026-09-22 review 后补类型标注映射/sessionStorage/漏报自检）；仅剩 `tjg-mjolnir-ban-lists` 为死配置 |
| `check:component-contracts` | OK 无人监听事件 0（基线 0） | Task 5 由 32 收紧到 0；11 条产品断线移入 13.6 follow-up |
| `check:i18n-dead-keys` | OK 孤儿 1979（基线 1979）+ 动态族排除 148（23 前缀） | Task 5 新增：命名空间感知 + 跳过测试 + 键名子集 ratchet；动态前缀族单独成节、"Task 7 不得删除"；Task 7 负责把孤儿基线降下来 |
| `check:doc-coverage` | OK（1069 → 1054，基线 1064，无回归） | 补 15 处缺失 JSDoc 摘要，纯注释改动；这 15 处在基线提交 `e157675a` 上同样报错，属分支级既有漂移 |
| `check:ratchet` | 6/6 OK | |
| `check:sdk-boundary` | OK（205 / 基线 187，无回归） | |
| `check-i18n` / `check-i18n-refs` | 通过 | refs 273 / 基线 280 |
| `quality:no-raw-fetch` | OK | 5 处 `fetch()` 全在 allowlist |
| `check:v-html` | FAIL（既有） | `ThemeSwitcher.vue` 的注释里出现 "v-html" 字样被 grep 命中；基线提交上同样 FAIL，本分支未改该文件 |
| `check:file-size` | FAIL（既有） | 基线提交上同样 FAIL（同样点到 `Image.vue`）。本分支让 6 个基线文件继续变长，并使 `MatrixReceiptService.ts`（376 → 414 行）越过 400 行线。未做 `--update`：那会一次性赦免全部既有增长，把 ratchet 变成橡皮图章 |

结论：Task 5 之后两个守门不再是"扫不到真实持久层 / 只剩冻结数字"的橡皮图章——
settings-wiring 以清单覆盖 70 个持久层 key 并把 `--update` 收紧到键名子集，
component-contracts 的冻结基线归零、新增跳过即 FAIL、白名单失效会告警；
i18n 死 key 从 report-only 变成带基线的 ratchet。**但清单/引用判据仍只证明"有登记、有引用"，
不证明"开关在运行时生效"**，有效性只能由各任务的行为测试提供证据。
守门可证伪性在 Task 14 与 Task 5 均已实测（临时制造违规会 FAIL，恢复后 OK）。
剩余两处 FAIL（`check:v-html`、`check:file-size`）在基线提交上就存在，属独立债务。

音视频设置治理后的**剩余债务**（如实记录）：`audioInputId` / `videoInputId` 目前
只作用于设置页的麦克风测试与摄像头预览；把设备选择应用到真实通话需要
`replaceTrack`（本分支未实现）。三个音质布尔（回声消除/降噪/自动增益）经
`applyConstraints` 在真实通话上生效。`audioOutputId` / `inputVolume` /
`outputVolume` 因全仓零消费方已连同控件删除。

### 遗留债务与后续项（不阻塞合并）

本分支的验收判据是各任务在**真实路径上的行为测试**，不是死配置数量（见 13.2、13.5）。
以下条目是最终评审 triage 后**有意留给后续**的已知债务，不阻塞本次合并；本节只如实
记录，不声称它们已被修复。

**口径更正（[I-3]）**：ledger 中"设置开关请求的是 Web `Notification.requestPermission()`、
而非 Tauri 插件"这一条经最终评审核实**不成立**——`tauri-plugin-notification` 的
init-iife 会替换 `window.Notification`，并把 `requestPermission` / `permission` 转发到
原生通道，开关触发的就是原生权限。真实残留只有一个：发送前没有检查
`isPermissionGranted()`。通知权限代码本次未改动。

**（1）需要产品/设计裁决**

- 未读账本持久化与「关闭已读回执」的语义（语义已裁决并落地，2026-09-22）：裁决为
  「关闭已读回执」只表示**不让同房间成员看到我读到哪**，不是「每台设备各维护一套未读」；
  本机未读仍必须跨设备收敛，否则关掉隐私开关等于惩罚可用性。实现上 `sessionUnread` 已整体
  持久化（`cacheStore` 本机账本 + `lastReadActiveTimeStore` 已读水位 + 账本条目内的
  `settledServerCount` 结算水位），冷启动时账本会把服务端累计值折算成本机真实未读
  （读 3 条 → 关闭期间来 1 条 → 重启角标 1，不再是 4）；同时为无 `lastRead` 的房间加了显式
  跨设备收敛（服务端计数更小且账本之后没有新消息 → 判定别的设备已读，采信服务端并写回账本）。
  冷启动 `clearUserLocalStorage()` 白名单继续不含 `sessionUnread`，清除点仍是显式登出 /
  账号重置（`SessionLogoutService`）。
  **仍需后端确认的后续增强**：关闭回执时改发 `m.read.private`（选项 3，SDK 已支持在
  `setRoomReadMarkers` 里带私密回执）——需要 synapse-rust 确认会把私密已读计入
  `unread_count`，本仓无法证实；未确认前接线会把「关闭回执」变成「角标永不收敛」的静默失败，
  故本次不做。涉及 `src/stores/domains/chat/sessionUnread.ts`、
  `src/stores/domains/chat/chat/session.ts`、`src/services/matrix/messaging/MatrixReceiptService.ts`。
- 通知展示配置与 DND 的跨设备/冷启动语义：跨窗口已改为读取最新持久化状态（I3），
  但 `syncConfigFromAccountData()` 生产零调用方、DND 的账号数据同步只在
  `PushSettings.vue` 手动触发；跨设备是否要求传播、是否启动即同步需要产品裁决。
  涉及 `src/services/matrix/notifications/MatrixNotificationService.ts`。

**（2）工程 follow-up（含门禁自身的改进）**

- 损坏配置下的旧键迁移边界：`tjg-notification-config` 为损坏 JSON 时 `safeJsonParse`
  回落默认值并被当成"显式值"，旧通知展示 key 不被采纳且被删除；仅损坏 JSON 可达，
  故本次未修。`MatrixNotificationService.ts` 的 `migrateLegacyDisplayConfig()`。
- `check:settings-wiring` 的扫描面（**Task 5 已解决**）：旧口径只覆盖
  `src/views/settingsWindow/**/*.vue` 的直接写入，写入搬进 store/util/service 后即脱离视野；
  Task 5 改为持久层发现 + `scripts/settings-wiring-manifest.json` 清单契约（见 13.4）。
- 两个守门剩余的口径缺口（**Task 5 已解决**）：`--update` 现在也走键名子集校验
  （同数量换键会被拒绝）；`check:component-contracts` 冻结基线已由 32 降为 0，新增
  `skip` 即 FAIL、白名单失效会告警，11 条产品断线移入 13.6。`scripts/check-component-contracts.mjs`
  与两个 `*-baseline.json`。
- `MatrixReceiptService.ts` 由 376 行增至 414 行，越过 400 行红线；`check:file-size`
  在基点即为红色（17 个既有超标），一次性 `--update` 会赦免全部既有增长，故本阶段不重构，
  留 follow-up。
- presence 门控仍依赖调用点自觉：规则实现已收敛到 `resolveOutgoingPresence` 一处，但
  "是否按 `showOnlineStatusEnabled` 门控"仍由各调用点自行决定，新增调用点容易再次漏掉；
  现有调用点为 `usePresenceHeartbeat.ts`、`userStatus.ts`、`UserMenuHeader.vue`、
  `SessionBootstrapService.ts`。
- 通知标题原文标记：`[•]` / `[*]` 会直接进入系统通知标题，未做展示层清理；
  `MatrixNotificationService.ts`。
- 发送者头像 icon：`showSender=false` 时仍把 `mxc://` 头像作为系统通知 icon 传入，
  无法渲染为系统图标，且与"保留 icon"的简报要求冲突——需求级取舍未裁决；
  `MatrixNotificationService.ts`。
- `sendNotification` 未 await、无 catch：发送失败没有隔离（既有行为，本次未改动）。
- 每个开关双写：`v-model` 与 `@update:value` 同时触发 handler，绕过 `writeConfig` 去重；
  `NotificationSettings.vue`。
- orphan locale key：已删除开关与控件的文案残留，未清理（**Task 5 已加守门**：
  `check:i18n-dead-keys` 以基线冻结当前孤儿集合并在 CI 拦截新增，Task 7 负责把基线降下来；
  2026-09-22 review 后动态拼接前缀族（148 个 key / 23 个前缀，含 `room_preview.` 这类
  "模板赋给变量再由 `t?.(var)` 消费"的中转写法）单独成节排除，明确
  "Task 7 不得删除"，避免把动态可达的活文案当孤儿误删）。
- **i18n 删除的"类型安全网"并不存在（Task 7 实测）**：vue-i18n 11.4.10 的
  `ComposerTranslation` 形如 `(key: Key | ResourceKeys | number, ...)`，其中 `Key` 含宽
  `string`，因此 `src/typings/i18n.d.ts` 的 `DefineLocaleMessage` augmentation 虽然生效，
  `npx vue-tsc --noEmit` 也不会对 `t('已删除的 key')` 报错——Task 7 删掉 1979 条孤儿后
  vue-tsc 依旧 0 错误（已用探针文件实证）。后续任务**不得**再把 vue-tsc 当作"没删到活文案"
  的证明；当前唯一的静态保障是 `scripts/check-i18n-refs.mjs` 的命名空间 ratchet（读真实语言包
  解析 `t('字面量')`）加 `check-i18n-dead-keys.mjs` 的保守 token 集。若要恢复类型级防护，
  需自定义 composer 包装，把 `t()` 的 key 参数收紧为生成的字面量联合类型。
- `.photo-wall` 零使用（**Task 7 已解决**）：`@extend .bubble-oneself` 的选择器全仓零生产者
  （最后一个生产者由 `36258286` 从 `src/components/rightBox/chatBox/ChatMain.vue` 删除），
  已连同 `render-message.scss` 里的死样式块一并删除，也不再列入 `[data-bubble-style='square']`
  与结构守卫；复活时应新增生产者与样式，而不是保留一条无生产者的"防御性"选择器制造已覆盖错觉。
- 守门实现 nits（**Task 5 已修复**）：Windows 反斜杠路径会让白名单/基线失配（已统一 POSIX）；
  `skip` 会降低总数却不影响退出码（已改为新增 skip 即 FAIL）；白名单条目失配无人提示
  （已加活性告警）。

**（3）移动端平行实现缺口**

- mobile `StatusSettings.vue` 的 presence 上报未按 `showOnlineStatusEnabled` 门控
  （桌面四个调用点已门控）；本次未新增移动端开关 UI，属已知 follow-up。
- mobile `VoiceVideoSettings.vue` 仍有桌面已删除的同名输出设备/音量控件，并直接写 key；
  I9 的删除只覆盖共享模块与桌面页，移动端独立实现按同类"死配置"处置留 follow-up。
- mobile `LabsSettings.vue` 仍写桌面已删除的 labs 死 key（`tjg-lab-features` /
  `tjg-debug-mode` / `tjg-show-performance` 等），全仓无运行时消费方；属移动端新功能
  缺口，不是本分支引入的回归。

### 13.6 组件事件断线 follow-up（Task 5 移出冻结基线）

Task 5 把 `check:component-contracts` 的 32 条冻结基线收紧到 **0**：3 条能接线的一行接线、
12 条死声明直接删除、1 条检测器误报（`renderMessage/index::jump2Reply`）随"全局组件名按
`src/typings/components.d.ts` 的路径派生名解析"消失、5 条设计上可选的进入 `ACCEPTED_PATTERNS`
并写明理由。剩下 **11 条产品行为断线**从基线移出，登记在本节；同时在
`scripts/check-component-contracts.mjs` 的 `ACCEPTED_PATTERNS` 里以 `followUp` 字段挂账，
守门每次运行都会打印 `todo` 提示——它们不再是被冻结的静默数字，而是可检索的待办。
每条都带 file:line 与"缺什么"；补全需要产品决策或跨模块改动，故不属本次债务清理范围。

| # | 断线 | 触发点（emit） | 挂载点 | 缺什么 |
| --- | --- | --- | --- | --- |
| 1 | `ThreepidManager` 邮箱/手机增删解绑 | `src/components/userMenu/ThreepidManager.vue:158`（add-email）/`:165`（add-phone）/`:152`（unbind）；按钮 `:33`/`:74`/`:19`、`:55` | `src/views/settingsWindow/tabs/AccountSettings.vue:122`（`<ThreepidManager />`，零 props 零监听） | 邮箱/手机管理 100% 不生效：输入框清空得像成功，请求从不发出。后端能力已在 `src/composables/user/useAccount.ts:46-64`（`getThreePids`/`addThreePid`/`bindThreePid`/`deleteThreePid`/`unbindThreePid`，`useAccount` 返回值 `:121` 起导出）但零生产消费方；需要接线 + 格式校验 + 错误反馈 |
| 2 | `UserMenuHeader::avatar-click` | `src/components/userMenu/UserMenuHeader.vue:133`（`handleAvatarClick`，emit 在 `:134`；`.user-avatar @click` 在 `:4`，`cursor:pointer` 在 `:188`） | `src/components/userMenu/UserMenuDropdown.vue:7`、`UserMenuMobile.vue:9`（只绑 `@theme-toggle`） | 可点击头像无任何行为；需要产品决定：打开个人资料 / 打开设置 / 仅关闭菜单 |
| 3 | `RoomInviteActions::error` | `src/components/room/RoomInviteActions.vue:42`（接受失败）、`:56`（拒绝失败） | `src/components/workbench/TjgRoomListItem.vue:79-83`（只绑 `@accepted`/`@rejected`） | 接受/拒绝失败只有 `logger.error`，用户完全无感知。注意成功链路同样惰性：`RoomSessionList.vue:47-48` 转发给可选 `onAcceptInvite?`/`onRejectInvite?`，唯一生产消费方 `src/views/homeWindow/message/index.vue:22-36` 两个都没传；诚实的修法是在 `RoomInviteActions`/facade 内部就地给出错误反馈 |
| 4 | `GuestModeBanner::exit` / `::upgrade` | `src/components/common/GuestModeBanner.vue:30` / `:27`（声明 `:47-50`） | `src/layout/index.vue:8`（`<GuestModeBanner :visible="isGuestMode" :guest-user-id="guestUserId" />`，零监听） | 半成品：`isGuestMode`（`layout/index.vue:232`）与 `guestUserId`（`:233`）从未被置真，横幅永不渲染；`MatrixGuestService` 除测试外无引用。需要产品决定"实现游客态 + upgrade/exit"还是"删除横幅 + 挂载 + refs" |
| 5 | `LoginBottomBar::guest-login` | `src/views/loginWindow/LoginBottomBar.vue:54`（声明 `:79`，`data-test="guest-login-btn"`） | `src/views/loginWindow/Login.vue:35-43`（7 个事件绑了 6 个，没有 `@guest-login`） | 用户可见的死入口；同时 i18n key `login.guest` 在 `locales/{zh-CN,en}/login.json` 缺失，行内渲染原始 key。需要实现游客登录或移除该行 |
| 6 | `ThreadPanel::sendReply` | `src/components/thread/ThreadPanel.vue:103`（`handleSendReply`；声明 `:90`） | `src/components/rightBox/chatBox/ChatModals.vue:66-69`（唯一挂载：`v-model:show` + props，无监听） | 点发送直接丢弃输入（无 store/service 调用、无乐观追加），`loadThreadReplies()`（`:113-115`）是设 `[]` 的 stub。需接 `matrixThreadService.sendThreadReply`（`MatrixThreadService.ts:67`）/ `getThreadRepliesViaApi`（`:359`） |
| 7 | `SpaceListItemCard::contextmenu` | `src/components/workbench/SpaceListItemCard.vue:12`（卡片 `@contextmenu`，原生 `MouseEvent`；声明 `:122`） | `src/components/workbench/SpaceListPane.vue:78-85`、`:98-107`、`:120-129`（绑了 click/pin/settings/leave/delete，没有 `@contextmenu`）；`SpaceListPane` 不转发，`src/views/homeWindow/SpaceList.vue:80` 也没监听 | 右键空间卡无任何反应（出生即死，无提交绑定过）。需要右键菜单设计：卡片内 `ContextMenu`（参照 `TjgRoomListItem.vue:14/245-248`）或逐层转发，否则删除 |
| 8 | `RoomSessionList::batchToggle`（潜在，无用户可见破坏） | `src/components/workbench/RoomSessionList.vue:125`（`handleBatchToggle`；子组件 `@batch-toggle` 在 `:49`，声明 `:119`） | `src/views/homeWindow/message/index.vue:22-35`（不传批量 props、不监听） | 只有 `TjgRoomListItem` 在 `batchMode` 为真时才触发（`TjgRoomListItem.vue:16-21`/`:235-241`/`:266-268`），但没有任何生产调用方传 `batch-mode`/`batch-selected-ids`；桌面批量模式没有入口/owner（移动端有 `MobileBatchToolbar`）。需要产品决定接线还是删除 props + emit + 复选框分支 |

补充（不计入上表，检测器口径说明）：`renderMessage/index::jump2Reply` 的"无人监听"是
检测器误报，已随全局组件名解析修复；但历史窗口仍有**逐使用处**的真实缺口——
`src/views/multiMsgWindow/index.vue:31-38` 与 `src/views/chatHistory/index.vue:81-90`
在 `<RenderMessage>` 上不绑 `@jump2-reply`，回复气泡点击无响应。本守门的事件判据是"所有
使用处的并集"，表达不了这种"一处监听、另一处断线"，故只能在此登记为人工复核项。

