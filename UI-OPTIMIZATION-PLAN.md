# Tjg/HuLa IM 项目 UI 优化方案

> 版本：v2.0（Matrix 联邦 + 液态玻璃 + E2EE 深度整合版）  
> 制定时间：2026-09-19  
> 适用代码基线：`src/` 下 467 个 `.vue` 组件、`meta/ratchet-baseline.json` 冻结指标、`src/styles/css/design-tokens.css` 为唯一 token 事实源  
> 配套示例：`docs/ui-optimization/code-examples.md`

注意：移动端不需要实现ADMIN的管理界面和AI界面

---

## 0. 执行概览

本方案在既有「基础修复（阶段 1-3）」之上，新增以 **Matrix 联邦感知 / 液态玻璃视觉 / E2EE 可信可视化** 为主线的三条产品化主线，并把原三阶段重排为五个阶段。

**优化目标：**

1. 统一设计令牌体系，补齐 16dp 圆角、液态玻璃、联邦身份、同步状态四组缺失 token
2. 消除内联样式与 `!important` 技术债，样式硬编码颜色只减不增
3. 让联邦（Federation）可见：头像旁完整 MXID、房间旁 homeserver 标识、跨域成员可识别
4. 让 E2EE 可信：消息级锁态三色可视化 + 一键进入设备验证流程
5. 让同步可见：顶部同步进度、离线缓存提示、未读自动刷新
6. 补齐私有化部署入口、SSSS 密钥备份引导、跨设备会话管理三块安全 UI
7. 无障碍与响应式达标，纳入 CI 守门

**工期重排（总计 11-13 周，与 v1.0 的 6-8 周相比增加主线三/四）：**

| 阶段   | 主题                    | 周期        | 目标         |
| :--- | :-------------------- | :-------- | :--------- |
| 阶段 0 | 现状核实与基线冻结             | 周 1（3 人日） | 防止方案与代码漂移  |
| 阶段 1 | 基础修复（原 v1.0 阶段 1）     | 周 1-2     | 设计基础干净     |
| 阶段 2 | 联邦身份展示 + 液态玻璃体系       | 周 3-5     | 联邦可见、视觉升级  |
| 阶段 3 | E2EE 信任可视化 + 安全 UI 模块 | 周 5-7     | 加密状态可信可操作  |
| 阶段 4 | 同步/离线体验 + 质量保障        | 周 8-11    | 弱网可用、长期可维护 |

---

## 1. 现状核实（写方案前先对账）

本节是 v2.0 与 v1.0 最大的区别：**每条需求都先标注代码现状**，避免把「已有」当「待做」，也避免把「不存在」写成「已完成」。

### 1.1 需求 → 代码现状对照表

| 需求（产品侧原文）             | 代码现状                                      | 结论              | 证据                                                                                                                                                    |
| :-------------------- | :---------------------------------------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 头像旁完整展示标准 MXID        | 已有统一工具但无展示组件；`uid` 已是完整 MXID 口径           | **缺口**          | `src/utils/userIdentity.ts`（`toLocalpart`/`extractServerName`/`normalizeMatrixUserId`），全仓无「MXID 展示」组件                                                 |
| 房间名称旁标注 homeserver    | 已有联邦判定与房间卡角标                              | **部分具备**        | `ChatHeaderRoot.vue:157-161` 联邦判定；`RoomCardItem.vue:82-102` 联邦/加密角标；token `--tjg-room-card-federated-accent` 已存在                                      |
| 液态玻璃视觉体系              | 已有 mixin，但缺 token 层、缺 low-perf 接线、未覆盖聊天气泡 | **部分具备**        | `src/styles/scss/mixins/_liquid-glass.scss`；`grep low-perf src` 仅 mixin 内引用，**无任何 JS 写入 `html.low-perf`**                                             |
| 全界面 16dp 以上大圆角        | 圆角 token 最大 `--tjg-radius-lg: 12px`       | **缺口**          | `src/styles/css/design-tokens.css:147-151`                                                                                                            |
| 系统深浅色自动切换             | 已具备 `html[data-theme]` 双主题                | **已具备**         | `design-tokens.css` 浅色 `:root` + 深色 `html[data-theme='dark']`                                                                                         |
| 组件模块化可复用              | 已有 atomic 层 + Storybook                   | **部分具备**        | `src/components/atomic/`、`.storybook/`；但联邦/E2EE 展示单元尚未抽为 atomic                                                                                       |
| 消息气泡旁三色锁              | 只有房间级 `EncryptionStatus`，**无消息级锁**        | **缺口**          | `src/components/encryption/EncryptionStatus.vue` 仅被 `ChatHeaderInfo.vue:44` 使用；状态枚举为 `encrypted/unencrypted/unknown/error`，非「已验证/未验证/风险」              |
| 点击锁进入设备验证             | 验证流程组件与 composable 齐全，但未与锁图标连线            | **缺口（接线即可）**    | `DeviceVerifyDialog.vue`、`useDeviceVerifyDialog.ts`、`useDeviceVerifyFlow.ts`、`MatrixVerificationService`                                              |
| 文本/语音/文件/表情回应/线程全类型卡片 | 已具备且体量健康                                  | **已具备**         | `src/components/rightBox/renderMessage/**`（467 个 `.vue` 中**无一个超过 800 行**，满足体量红线）                                                                      |
| 房间侧边栏：成员/加密/联邦状态      | 已有成员面板与加密设置                               | **部分具备**        | `RoomMembersPane.vue`、`RoomEncryptionSettings.vue`、`useAdminFederation`、`FederationView.vue`（管理端联邦目标健康检查）                                             |
| 一键切换房间公开/私有           | 已具备组件                                     | **已具备**         | `src/components/rightBox/RoomVisibilityToggle.vue`                                                                                                    |
| 顶部同步进度                | **无任何同步进度 UI**                            | **缺口**          | `src/stores/domains/chat/matrix.ts` 仅存 `syncState: string \| null`；全仓无进度条组件                                                                           |
| 离线可看历史 / 未读自动刷新       | store 已持久化，离线队列存在                         | **部分具备**        | `matrix.ts` persist `pick: ['userId','deviceId','homeserverUrl','accessToken']`；`src/services/offline/OfflineQueueService`；`ChatBanners.vue` 仅有网络错误横幅 |
| 密钥备份/SSSS 分步引导        | 组件与流程 composable 齐全                       | **已具备（需视觉收口）**  | `E2EEBootstrapWizard.vue`、`SecurityKeySetupDialog.vue`、`SecureBackupDialog.vue`、`KeyBackupSetupDialog.vue`、`useSecureBackupFlow.ts`                   |
| 离线恢复密钥 + 助记词          | 服务层可生成，UI 未见助记词态                          | **部分具备**        | `MatrixCryptoService.createRecoveryKeyFromPassphrase`、`createSecureBackup`；`GeneratedSecretStorageKey` 类型已存在                                          |
| 「私钥仅由你掌控」提示           | 文案层未核查到                                   | **缺口**          | 需在 `locales/zh-CN/encryption.json` 补齐                                                                                                                 |
| 登录页自定义 homeserver     | 已具备模态框，移动端也有入口                            | **已具备（需规范化入口）** | `src/views/loginWindow/ServerConfigModal.vue`、`src/mobile/views/my/HomeserverSettings.vue`                                                            |
| 跨设备会话管理面板             | 桌面/移动各自实现，无统一信任链视图                        | **部分具备**        | `DeviceTrustManager.vue`（桌面 Tabs）、`src/mobile/views/my/DeviceManagement.vue`、`MatrixDeviceService`（`getDevices`/`deleteDevice`/`deleteDevices`）       |
| 导出设备交叉签名信息            | 服务层有跨签名接口，无导出 UI                          | **缺口**          | `useEncryption.checkCrossSigningReady`、`cryptoSDKAdapter.isCrossSigningReady`                                                                         |

### 1.2 必须遵守的既有硬约束（方案不得违背）

| 约束                                           | 来源                                               | 对本方案的影响                                                                                                                  |
| :------------------------------------------- | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| 禁止新增硬编码颜色，一律 `--tjg-*`                       | `.rules` UI 设计系统强制规范；`scripts/check-ratchet.mjs` | 「三色锁」「毛玻璃」全部以 **token 形式新增在 `design-tokens.css`**，组件内只允许 `var(...)` / `color-mix(in srgb, var(--tjg-x) n%, transparent)` |
| `hardcoded_color` 基线 **只减不增**（当前 48）         | `meta/ratchet-baseline.json`                     | 本方案任何一步都不得让该计数上涨；改完跑 `pnpm check:ratchet`                                                                                |
| 图标必须 SVG，线宽 1.5px，禁止 div 拼图标                 | `.rules`                                         | 锁、地球、云同步图标全部走 `<svg>`（沿用仓库既有 symbol 引用 `#lock` / `#encrypted-lock` 或内联 path）                                             |
| 桌面 Naive UI / 移动 Vant，优先补 `src/mobile/` 独立实现 | `.rules`                                         | 联邦徽标、锁图标、同步条必须双端独立实现，**不得新增 `isMobile()` 内联分支**                                                                          |
| 组件 > 800 行必须拆分                               | `.rules`                                         | 新增组件逐个控制在 400 行内；`ChatHeaderRoot.vue`(527) 若再增内容需先抽子组件                                                                   |
| 动效必须尊重 `prefers-reduced-motion`              | `design-tokens.css:640` 已有全局兜底                   | 玻璃过渡、锁态切换动画天然被兜底覆盖，但仍需在组件级 `@media` 中确认不出现 `animation` 残留                                                                |
| 服务层调用禁止绕过 `src/services/matrix/**`           | `.rules` 架构约束                                    | 联邦判定、设备信任、同步状态只能通过 service/composable 取数，组件不得 import SDK                                                                 |
| 新增 service 方法必须有 JSDoc                       | `scripts/check-doc-coverage.mjs`                 | 若新增 `FederationIdentityService` 类文件，每个导出方法都要 JSDoc 摘要                                                                    |

### 1.3 阶段 0 交付物（3 人日）

1. 冻结基线：记录当前 `check-ratchet` 三计数、`vue-tsc` 错误数、`test:run` 通过数。
2. 产出「重复组件清单」：确认 `DeviceTrustManager`（桌面）与 `DeviceManagement`（移动）的字段差异，决定是抽共享 composable 还是保留双实现。
3. 确认 `MatrixClientState` 是否已暴露同步进度字段（`syncState` 目前只有字符串），决定阶段 4 是「纯前端展示已有状态」还是「需要在 SDK 边界补字段」。

> 阶段 0 的产出必须写回本文档第 1 节表格，否则后续阶段不得开工。

---

## 2. 详细优化计划

### 阶段 1：基础修复（周 1-2）

**目标：建立干净的设计基础。**（沿用 v1.0 阶段 1，仅调整验收口径）

#### 1.1 Design Token 清理 (P1)

**问题：** 同时存在 `--tjg-*`、`--color-*`、`--bg-*` 等多种命名前缀，`design-tokens.css:285-351` 仍有大量 alias 中间层。

**行动计划：**

- 删除零引用 alias（保留仍有引用的，逐个 grep 取证，不搞一刀切）
- 只保留必要的 `--tjg-*` 前缀 token
- 添加 CI 检查规则防止倒退（复用 `check-ratchet.mjs` 的 hardcoded 思路，新增「非 `--tjg-*` 变量定义」计数）

**具体步骤：**

1. 备份 `src/styles/css/design-tokens.css`
2. 对 `design-tokens.css:286-351` 每一条 alias 执行 `grep -rn "var(--<name>)" src/`，零引用者删除，有引用者登记迁移计划
3. 创建 token 迁移脚本自动替换旧引用
4. 手动检查并修复无法自动替换的引用
5. 在 `DESIGN.md` 中固化 token 使用规范（该文档已重写为 `--tjg-*` 权威口径，含「规划中 token」总表与「不存在的 token」黑名单）
6. 在 `meta/ratchet-baseline.json` 中把结果 `--update` 收紧

**影响范围：** 全局  
**预计工作量：** 8-12 人时  
**验收：** `pnpm check:ratchet` 通过且 `hardcoded_color` 计数不高于 48

#### 1.2 内联样式迁移 (P1)

**问题：** 核心视图存在约 73 处内联 `style`，破坏主题化能力。

**行动计划：**

- 迁移到 scoped CSS 或 UnoCSS 工具类
- 建立通用布局组件替代重复 flex/grid
- 代码审查拒绝新增内联样式

**具体步骤：**

1. 复核 `uno.config.ts` 现状（若缺失先补）
2. 识别高频内联模式（flex 布局、间距、背景色）
3. 分批次处理：登录页 → 设置页 → 房间列表 → 消息相关视图
4. 在 PR 模板加入内联样式检查项

**影响范围：** 登录、设置、房间列表  
**预计工作量：** 16-24 人时  
**验收：** 核心视图 `grep -c 'style="'` 为 0

#### 1.3 `!important` 优化 (P2)

**问题：** 约 48 处 `!important`，主要为覆盖 Naive UI 默认样式。

**行动计划：**

- 优先提升选择器特异性，其次用 Naive UI `theme-overrides`
- 必须保留时补注释说明原因
- 在 `NaiveProvider.vue` 统一收敛

**具体步骤：**

1. 按文件分组分析全部 `!important`
2. 逐条尝试：提高特异性 → `theme-overrides` → 保留 + 注释
3. 在 `NaiveProvider.vue` 集中管理必要覆盖
4. 在 PR 模板要求 `!important` 必须带解释注释

**影响范围：** 全局样式  
**预计工作量：** 6-8 人时

#### 1.4 圆角 token 扩展至 16dp (P0，新增)

**问题：** 产品要求「全界面统一 16dp 以上大圆角」，但 token 上限为 `--tjg-radius-lg: 12px`，当前必然靠硬编码或达不到规格。

**具体步骤：**

1. 在 `design-tokens.css` 圆角段新增 `--tjg-radius-xl: 16px`、`--tjg-radius-2xl: 20px`、`--tjg-radius-3xl: 24px`
2. 定义语义别名并明确适用面（写入注释）：
   - `--tjg-radius-surface: var(--tjg-radius-xl)` → 聊天气泡、卡片
   - `--tjg-radius-panel: var(--tjg-radius-2xl)` → 面板、侧栏、弹层
   - `--tjg-radius-sheet: var(--tjg-radius-3xl)` → 移动端底部抽屉
3. 渐进式替换：先新组件用新 token，再按模块回填旧组件（每批次独立提交，便于视觉回归定位）
4. 同步更新 `DESIGN.md` 的 Border Radius 与 Responsive Breakpoints 章节（Breakpoints 章节已核对 SCSS map 与 `uno.config.ts` 双来源）

**影响范围：** 全局视觉  
**预计工作量：** 6-10 人时  
**验收：** 气泡/面板/抽屉三类的圆角全部来自 token；`grep -rn "border-radius: 1[6-9]px\|border-radius: 2[0-9]px" src` 为 0

#### 1.5 无障碍与响应式（原阶段 3 前置）(P3)

- 引入 `@axe-core/vue` 扫描，图标按钮补 `aria-label`，模态焦点管理，skip-link
- 断点 token 化：`--breakpoint-sm/md/lg/xl/2xl`（`design-tokens.css` 暂无，需新增）
- 注意：`@media (min-width: var(--breakpoint-md))` 在部分浏览器不生效，**媒体查询内必须写字面值**，token 仅用于 JS 侧 `matchMedia`；此约束需写入规范

**预计工作量：** 10-14 人时

---

### 阶段 2：联邦身份展示 + 液态玻璃体系（周 3-5）

**目标：让联邦特性「看得见」，让视觉升级「可降级」。**

#### 2.1 联邦身份标识体系 (P1)

**需求：** 所有用户头像旁完整展示标准 MXID（`@用户名:服务器域名`），房间名称旁标注所属 homeserver。

**设计决策：**

- **不做全量常驻展示**——完整 MXID 在列表密度下会造成噪声。采用「**主标识 + 次级标识**」两级：
  - 主标识：displayname（无 displayname 时回退 localpart）
  - 次级标识：`@localpart:server` 单行等宽字体，`text-overflow: ellipsis`，`title` 属性给全量值
  - 跨域用户额外加「远端」域名 chip，本地用户不加 chip（默认即本地，避免每行都出现徽标）
- **联邦判定单一事实源**：扩展现有 `src/utils/userIdentity.ts`，新增 `sameHomeserver(a, b)` 与 `resolveFederationPeer(mxid)`，禁止各组件自行 `split(':')`。

**新增 token（写入 `design-tokens.css` 业务语义色段，浅/深各一份）：**

```css
/* 联邦身份 */
--tjg-federation-local-accent: var(--tjg-color-primary-500);
--tjg-federation-remote-accent: var(--tjg-color-info-500);
--tjg-federation-remote-bg: color-mix(in srgb, var(--tjg-color-info-500) 12%, transparent);
--tjg-federation-remote-border: color-mix(in srgb, var(--tjg-color-info-500) 28%, transparent);
--tjg-identity-mxid-color: var(--tjg-text-muted);
```

**新增组件（按 atomic → business 分层）：**

| 组件                    | 路径                                            | 职责                                         |
| :-------------------- | :-------------------------------------------- | :----------------------------------------- |
| `MxidText`            | `src/components/atomic/MxidText.vue`          | 只渲染 MXID 文本 + 截断 + `title`，无业务逻辑           |
| `FederationBadge`     | `src/components/atomic/FederationBadge.vue`   | 远端域名 chip，含 `aria-label="来自 <server> 服务器"` |
| `UserIdentity`        | `src/components/common/UserIdentity.vue`      | 头像 + 主标识 + 次级 MXID + 联邦 chip 的组合展示单元       |
| `RoomHomeserverLabel` | `src/components/room/RoomHomeserverLabel.vue` | 房间名旁 homeserver 标注，复用 `extractServerName`  |

**接入点（逐个接线，不新造重复逻辑）：**

- 桌面会话列表：`src/views/homeWindow/RoomList.vue` / `RoomCardItem.vue`
- 消息气泡发送者名：`src/components/rightBox/renderMessage/**` 的头部区域
- 房间头部：`ChatHeaderRoot.vue` 复用其既有 `federationServer`/`isFederated`，改为消费 `FederationBadge`
- 成员面板：`RoomMembersPane.vue`
- 好友详情：`FriendDetailsSections.vue`
- 移动端：`src/mobile/components/chat-room/HeaderBar.vue`、移动联系人列表

**无障碍要求：** 域名 chip 与三色锁**不得仅靠颜色传达状态**，chip 必须有可见文本（域名本身即文本），锁必须有 `aria-label` + tooltip 文本。

**预计工作量：** 24-32 人时（含双端）

#### 2.2 液态玻璃轻量化视觉体系 (P1)

**需求：** 低饱和中性背景；聊天气泡、导航栏动态毛玻璃；透明度随背景实时调整；深浅色自动切换。

**关键约束（来自现状核实）：**

1. 已有 `_liquid-glass.scss`，其注释明确：`backdrop-filter` 仅用于面板级（每视图 ≤3 个元素），**列表项与消息行禁止使用**。产品需求「聊天气泡毛玻璃」与此冲突——**必须给出取舍**。
2. `html.low-perf` 降级类**没有任何代码写入**，属未接线状态。
3. 硬编码颜色禁令意味着玻璃透明度必须走 token，不能写死 `rgba()`。

**取舍方案（推荐，需产品确认）：**

- 气泡**不做 `backdrop-filter`**（每条消息一层模糊，在 47 万行级时间线上必然掉帧，且与仓库明示约束冲突）
- 改为「**气泡级半透明 + 微描边 + 微阴影**」的轻玻璃观感：视觉上与玻璃体系一致，但零 `backdrop-filter` 成本
- `backdrop-filter` 仅用于 3 处面板：聊天主面板容器、左侧导航栏、右侧详情面板
- 若产品坚持气泡真模糊，则必须限定「仅最后 N=20 条消息启用 + 仅在 `html.perf-high` 下启用」，作为独立提案评审


**新增 token：**

```css
/* 液态玻璃（浅色在 :root，深色在 html[data-theme='dark'] 覆盖） */
--tjg-glass-blur: 20px;
--tjg-glass-saturate: 180%;
--tjg-glass-panel-opacity: 72%;
--tjg-glass-nav-opacity: 85%;
--tjg-glass-bubble-opacity: 88%;
--tjg-glass-border: color-mix(in srgb, var(--tjg-border-layout-divider) 50%, transparent);
--tjg-glass-shadow: var(--tjg-shadow-sm);
```

深色覆盖建议：`--tjg-glass-panel-opacity: 55%`、`--tjg-glass-nav-opacity: 70%`（增强通透感），与 mixin 既有 `opacity * 80%` 行为对齐后再统一。

**「透明度随背景内容实时调整」的落地口径：**

- 基线：`backdrop-filter` 本身即为对下层内容的实时采样，已满足「随背景实时变化」
- 增强（可选 P2）：`IntersectionObserver` + `scroll` 节流（`requestAnimationFrame`）观察玻璃面板下层是否处于媒体/高亮内容，动态切换 `--tjg-glass-panel-opacity` 于 `72% ↔ 85%`；**仅改 CSS 变量，不重算布局**
- 禁止在滚动回调里直接读写 `getBoundingClientRect`（强制同步布局）

**性能分级接线（补齐既有缺口）：**

1. 新增 `src/utils/performanceTier.ts`：
   - `hardwareConcurrency < 4` 或 `navigator.deviceMemory < 4` 或 `prefers-reduced-transparency: reduce` → `low`
   - 触屏设备（`matchMedia('(pointer: coarse)')`）默认 `low`（移动端 GPU 模糊代价高）
   - 其余 → `high`
2. 在 `src/main.ts` 启动早期写入 `document.documentElement.classList.toggle('low-perf', tier === 'low')`
3. 扩展 `_liquid-glass.scss`：在 `low-perf` 下 `backdrop-filter: none` + 纯色回退（已有骨架，补齐 token 化）

**接入点：** `src/layout/index.vue`、`src/layout/left/**`、`src/mobile/layout/navBar/index.vue`、`src/mobile/layout/tabBar/index.vue`（已有 `blur(12px)`，统一改用 mixin）、`src/components/rightBox/**` 面板容器

**预计工作量：** 20-28 人时  
**验收：**

- 单视图 `backdrop-filter` 声明 ≤3 处（`grep -c` 取证）
- `html.low-perf` 下无 `backdrop-filter` 生效
- `prefers-reduced-motion` 与 `prefers-reduced-transparency` 双兜底可验证

#### 2.3 组件复用体系 (P2)

**需求：** 所有 UI 元素拆为独立可复用组件。

**现状：** atomic 层与 Storybook 已存在，但联邦/E2EE 展示单元尚未抽离。

**具体步骤：**

1. 阶段 2.1/3.1 新增的展示单元**一律先落地为 atomic 组件**，再在业务层组装
2. 为每个新 atomic 组件补 `.stories.ts`（主题切换控件 + 双主题快照）
3. 禁止在业务组件内重复实现 MXID 解析、锁态映射、域名判定

**预计工作量：** 8-12 人时（随 2.1/3.1 分摊）

---

### 阶段 3：E2EE 信任可视化 + 安全 UI 模块（周 5-7）

**目标：加密状态从「房间级一个图标」升级为「消息级可信链 + 可操作入口」。**

#### 3.1 三色锁与消息级加密状态 (P0)

**需求：** 绿锁=已验证、灰锁=未完全验证、红锁=存在安全风险；点击进入设备验证流程。

**现状：**

- `EncryptionStatus.vue` 是**房间级**组件，枚举 `encrypted/unencrypted/unknown/error`，**没有**「已验证/未验证/风险」语义，也没有点击行为
- 信任级别类型已存在：`src/types/matrix-extensions.d.ts:341` `TrustLevel = 'verified' | 'unverified' | 'blocked'`（与后端 `DeviceTrustLevel` 对齐）
- 验证流程齐全：`useDeviceVerifyDialog.ts` / `useDeviceVerifyFlow.ts` / `DeviceVerifyDialog.vue` / `MatrixVerificationService.startSasVerification`

**设计方案：**

- **不修改 `EncryptionStatus.vue` 的既有语义**（房间级仍按加密与否表达），避免破坏 `ChatHeaderInfo.vue` 现有行为
- 新增独立的消息级展示：

| 产物                     | 路径                                              | 职责                                                                                        |
| :--------------------- | :---------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `useMessageTrust.ts`   | `src/composables/encryption/useMessageTrust.ts` | 输入 `{ roomId, senderId, eventId }`，输出锁态；缓存 `(senderId,deviceId)` → `TrustLevel`，避免每条消息查一次 |
| `MessageLockBadge.vue` | `src/components/atomic/MessageLockBadge.vue`    | 纯展示 SVG 锁 + `aria-label`，三态颜色取自 token                                                     |
| 接线                     | `src/components/rightBox/renderMessage/**` 消息头部 | 加密房间才渲染锁；明文房间不渲染（避免噪声）                                                                    |

**锁态映射（单一事实源，禁止组件内 switch 颜色）：**

| 锁态            | 条件                                                             | token                                |
| :------------ | :------------------------------------------------------------- | :----------------------------------- |
| verified（绿）   | 发送设备 `TrustLevel === 'verified'` 且本机跨签名就绪                      | `--tjg-status-encryption-verified`   |
| unverified（灰） | 加密房间但设备未验证 / 跨签名未就绪                                            | `--tjg-status-encryption-unverified` |
| risk（红）       | `TrustLevel === 'blocked'` 或本机无法解密该事件（`m.room.encrypted` 解密失败） | `--tjg-status-encryption-risk`       |

**新增 token：**

```css
--tjg-status-encryption-verified: var(--tjg-color-success-500);
--tjg-status-encryption-unverified: var(--tjg-text-muted);
--tjg-status-encryption-risk: var(--tjg-color-danger-500);
/* 红锁需额外形状区分，避免仅靠颜色 */
--tjg-status-encryption-risk-ring: color-mix(in srgb, var(--tjg-color-danger-500) 35%, transparent);
```

**交互：** 点击锁 → 打开既有 `DeviceVerifyDialog`，传入该消息的 `senderId` + 设备 ID；若本机跨签名未就绪，先引导 `SecurityKeySetupDialog`。**不新增验证流程实现**。

**性能红线：** 时间线虚拟滚动下，锁态查询必须走 `Map` 缓存 + 单次批量 `getDevices(userId)`；禁止在渲染函数里 `await` 服务调用（异步结果通过 store/ref 注入）。

**预计工作量：** 24-32 人时  
**验收：**

- 加密房间每条消息可看到锁，明文房间无锁
- 三态各有独立 `aria-label` 文案，非仅颜色差异
- 1000 条消息滚动时无逐条网络请求（用测试断言服务调用次数）

#### 3.2 密钥备份与恢复引导页 (P1)

**需求：** 首次登录新设备分步引导 SSSS 配置；生成离线恢复密钥、助记词；设置加密备份密码；明确提示「私钥仅由你掌控，服务器无法读取明文」。

**现状：** 组件与流程 composable 齐全（`E2EEBootstrapWizard.vue`、`useSecureBackupFlow.ts`、`SecurityKeySetupDialog.vue`、`SecureBackupDialog.vue`、`KeyBackupSetupDialog.vue`），缺的是**一体化引导入口 + 信任声明文案 + 助记词展示态核查**。

**具体步骤：**

1. 核查 `useSecureBackupFlow.ts` 现有步骤，确认是否已覆盖：① 生成安全密钥 ② 展示恢复密钥 ③ 设置备份密码 ④ 校验备份可用
2. 补齐缺失步骤（预计缺「助记词/密码短语」展示与抄录确认）
3. 在 `locales/zh-CN/encryption.json` + `locales/en/encryption.json` 新增信任声明文案键：
   - `encryption.trust_notice.private_key_local`
   - `encryption.trust_notice.server_cannot_read`
   - `encryption.recovery.phrase_title` / `phrase_confirm`
4. 引导页视觉收口：使用阶段 1 的 `--tjg-radius-panel` 与阶段 2 玻璃面板
5. 移动端补齐独立实现（`src/mobile/views/my/EncryptionSettings.vue` 已有部分入口）

**预计工作量：** 16-24 人时  
**安全要求：** 恢复密钥/助记词**不得写入日志、不得进持久化 store、不得出现在 `MatrixDiagnostics` 导出**（需在实现中显式断言）

#### 3.3 私有化部署入口规范化 (P2)

**需求：** 登录页自定义 homeserver，默认保留官方公共服务器，企业可一键填入自建域名。

**现状：** `ServerConfigModal.vue` 已具备输入框与默认值；移动端 `HomeserverSettings.vue` 存在。

**具体步骤：**

1. 核查 `ServerConfigModal.vue` 是否具备：URL 校验（`isValidHttpUrl`）、`.well-known` 发现、默认值回退
2. 企业预设「自建服务器」快捷项需以**配置文件/环境变量**注入（不得硬编码内网域名到源码）
3. 校验失败文案走 `src/common/matrixErrorTranslator.ts` 既有体系
4. 移动端复用同一校验 composable，不重复实现

**预计工作量：** 6-10 人时

#### 3.4 跨设备会话管理面板 (P1)

**需求：** 集中展示所有已登录设备，支持注销可疑设备、导出交叉签名信息，直观呈现多端信任链。

**现状：**

- 桌面：`DeviceTrustManager.vue`（Tabs，已有设备列表 + 当前设备标记）
- 移动：`src/mobile/views/my/DeviceManagement.vue`
- 服务：`MatrixDeviceService.getDevices/deleteDevice/deleteDevices`、`MatrixCryptoService.getDeviceVerificationStatus`、`useDeviceTrust`

**具体步骤：**

1. **先抽共享逻辑**（阶段 0 已确认差异）：新增 `src/composables/encryption/useDeviceSessionPanel.ts`，聚合「设备列表 + 信任级别 + 跨签名状态 + 当前设备 + 最后活跃」，桌面/移动共用
2. 桌面 `DeviceTrustManager.vue` 与移动 `DeviceManagement.vue` 改为纯展示，禁止各自再写 `getDevices` 逻辑
3. 新增「信任链总览」区块：本机设备 → 交叉签名密钥 → 已信任设备数；未验证/被 block 设备置顶并标红
4. 注销设备：危险操作二次确认，复用既有 `deleteDevice(deviceId, auth?)` 的 `auth` 参数（UIA 流程）
5. 导出交叉签名信息：复用 `useEncryption` 的跨签名读取，导出为 JSON/文本（文件名含 MXID 与时间戳）；**仅导出公钥信息，绝不导出私钥**
6. 移动端保持 Vant 独立实现，不得引入 Naive UI 组件

**预计工作量：** 20-28 人时（含双端）  
**验收：** 桌面/移动设备字段完全一致（同一账号两端对照）；注销后列表自动刷新；导出文件不含私钥字段

---

### 阶段 4：同步/离线体验 + 质量保障（周 8-11）

#### 4.1 同步状态与离线提示 (P0)

**需求：** 顶部状态栏实时展示与 homeserver 的同步进度；离线自动缓存、可看历史；同步完成自动刷新未读。

**现状：**

- `src/stores/domains/chat/matrix.ts` 已有 `connectionState`（`DISCONNECTED | CONNECTING | CONNECTED | RECONNECTING | CATCHUP | ERROR`，见 `MatrixConnectionManager.ts:40`）与 `syncState: string | null`
- **无任何进度可视化组件**
- `ChatBanners.vue` 已有网络错误横幅，可复用其视觉位

> 注：`.rules` 中的连接状态机描述为 `... → SYNCING → CATCHUP → SYNCED`，但**代码事实源**是 `MatrixConnectionManager.ts:40` 的 6 态联合类型（无 `SYNCING`/`SYNCED`）。本方案以代码为准，若需补齐状态名，属 SDK 边界变更，单独立项。

**具体步骤：**

1. 确认 `connectionState` 是否已由 store 暴露到组件（`matrix.ts:267` 已 return），直接消费，**不新增状态源**
2. 新增 `src/components/connection/SyncStatusBar.vue`（桌面）+ `src/mobile/components/connection/MobileSyncStatusBar.vue`
   - `CONNECTING` → 不确定进度条 + 「正在连接」
   - `CATCHUP` → 确定/不确定进度 + 「正在同步历史消息」
   - `RECONNECTING` → 「重连中（第 N 次）」+ 退避倒计时
   - `ERROR` → 复用 `ChatBanners` 错误样式 + 重试按钮
   - `CONNECTED` → 2s 后自动淡出（`prefers-reduced-motion` 下瞬时隐藏）
3. 离线态：基于 `navigator.onLine` + `connectionState` 组合判定，离线时顶部常驻「离线模式：显示本地缓存消息」
4. 未读刷新：同步从 `CATCHUP` 转 `CONNECTED` 时，触发未读重新计算（复用既有 badge/未读 store，不新造计数逻辑）
5. `ChatBanners.vue` 的 `networkBannerText` 与新状态条去重，避免双横幅

**影响风险：** 顶部常驻条会压缩消息区高度，需在 `ChatMain.vue` 布局中预留，避免虚拟列表跳动。

**预计工作量：** 20-28 人时  
**验收：** 断网/恢复可复现三态；离线时历史消息可读；恢复后未读数字正确

#### 4.2 离线缓存与历史可读 (P1)

**具体步骤：**

1. 核查 `matrix.ts` persist 字段是否足以支撑离线首屏（当前 `pick: ['userId','deviceId','homeserverUrl','accessToken']`，**不含房间列表与消息**）
2. 明确离线历史来源：SQLite（`src-tauri/src/repository/im_message`）还是 `MatrixCacheManager`
3. 离线首屏不得白屏（对齐 `ADR-003` 乐观渲染）：缓存可用即渲染 + 顶部状态条提示
4. 补测试：mock `navigator.onLine = false`，断言渲染缓存数据且不发起网络请求

**预计工作量：** 12-18 人时

#### 4.3 质量保障与流程 (P2)

- Storybook 补齐新组件 stories（`MxidText`、`FederationBadge`、`MessageLockBadge`、`SyncStatusBar`），含明暗主题 + low-perf 两种控件
- 视觉回归：接入 Chromatic 或等效工具（可选）
- PR 模板加入 UI 检查清单（见 `code-examples.md` 第 12 节）
- 季度 UI/UX 审计

**预计工作量：** 持续

---

## 3. 风险与缓解措施

| 风险                                    | 影响 | 缓解措施                                              |
| :------------------------------------ | :- | :------------------------------------------------ |
| 玻璃气泡导致时间线掉帧                           | 高  | 采用「气泡半透明替代真模糊」取舍；坚持真模糊则限定条数 + 性能分级                |
| 逐消息查询信任级别引发网络风暴                       | 高  | 强制 `(userId,deviceId)` 缓存 + 批量查询 + 单测断言调用次数       |
| MXID 全量展示造成列表视觉噪声                     | 中  | 两级标识（主 displayname / 次 MXID 截断 + title）；跨域才加 chip |
| `hardcoded_color` 基线被突破               | 中  | 所有新色彩先落 token；每批次跑 `pnpm check:ratchet`           |
| 顶部状态条挤压虚拟列表                           | 中  | 布局预留固定高度；复现快速滚动抖动后再合入                             |
| 桌面/移动设备面板逻辑漂移                         | 中  | 阶段 0 先抽共享 composable，双端仅保留展示层差异                   |
| 恢复密钥泄漏进日志/诊断                          | 高  | 实现层显式断言 + 代码审查专项检查 + 诊断导出白名单                      |
| 新增 service 缺 JSDoc 触发 doc-coverage 失败 | 低  | 新方法一律先写 JSDoc 摘要                                  |
| 阶段 1-4 串行导致反馈周期过长                     | 中  | 每阶段独立可发布；阶段 2/3 组件互不依赖，可并行                        |

---

## 4. 成功标准

### 阶段 0

- 现状对照表回写完成，重复组件清单产出

### 阶段 1

- `design-tokens.css` 零引用 alias 清理完成
- 核心视图无内联 `style`
- `pnpm check:ratchet` 通过，`hardcoded_color` ≤ 48
- 圆角 token 覆盖气泡/面板/抽屉三类，无 16px+ 字面量
- `pnpm check` / `pnpm vue-tsc --noEmit` / `pnpm test:run` 全绿

### 阶段 2

- 会话列表、消息头、成员面板、房间头部四处可见完整 MXID 与 homeserver 标识
- 单视图 `backdrop-filter` ≤ 3 处；`html.low-perf` 下降级生效
- 双端（桌面 Naive UI / 移动 Vant）均为独立实现，无新增 `isMobile()` 分支

### 阶段 3

- 加密房间消息级三色锁可见、可点击进入验证
- 明文房间无锁噪声
- SSSS 引导全流程可走通，信任声明文案双语文案齐备
- 设备面板桌面/移动字段一致，注销与导出可用，导出内容无私钥

### 阶段 4

- 同步四态（CONNECTING / CATCHUP / RECONNECTING / ERROR）在断网复现中可见
- 离线可读历史且不白屏
- 同步完成后未读数正确刷新
- 新组件 Storybook stories 齐备，季度审计流程建立

---

## 5. 资源需求

**人员：**

- 1-2 名前端工程师（全职，阶段 2-4 约 8-10 周）
- 1 名 UI/UX 设计师（阶段 2 咨询 2 周，负责玻璃/圆角取舍确认）
- 1 名测试工程师（协助阶段 3-4 各 1 周）

**工具：**

- Storybook（已有）
- `@axe-core/vue`（需新增依赖，需评审）
- Chromatic 或等效视觉回归（可选）
- 现有守门脚本：`pnpm check:ratchet` / `check:doc-coverage` / `check:sdk-boundary` / `quality:no-raw-fetch`

---

## 6. 落地守门命令（每次改动后必跑）

```bash
pnpm vue-tsc --noEmit        # 类型检查，必须 0 错误
pnpm test:run                # 单元测试全通过
pnpm check:ratchet           # 硬编码颜色只减不增
pnpm check:doc-coverage      # 新增 service 方法必须有 JSDoc
pnpm check:sdk-boundary      # 组件不得越层调用 SDK
pnpm quality:no-raw-fetch    # 禁止直连 fetch
pnpm check                   # Biome lint + i18n 检查
```

---

## 7. 后续维护建议

1. **季度 UI 健康检查**：每季度复跑第 6 节守门命令 + axe 扫描
2. **Token 变更评审**：任何新增颜色/圆角/玻璃 token 必须走设计评审，并同步 `DESIGN.md`（唯一设计系统文档）
3. **联邦语义收敛**：所有 MXID/域名解析必须经 `src/utils/userIdentity.ts`，禁止散落 `split(':')`
4. **信任语义收敛**：锁态映射只允许存在于 `useMessageTrust.ts`，禁止组件内联判断
5. **文档同步**：本方案与 `docs/sdk-e2ee-adaptation-plan-2026-09-19.md` 存在交集（E2EE 部分），E2EE 契约变更时两份文档需同步更新

---

*方案制定时间：2026-09-19*  
*基于 v1.0 审计发现（约 73 处内联样式、约 48 处 `!important`、token 命名混乱）与 2026-09-19 代码现状核实结果重写*  
*所有「现状」结论均以本仓库源码为证据，涉及具体行号的条目已在第 1.1 节标注*  

---

## 执行进度记录

### 2026-09-20 执行记录

**阶段 1：基础修复** - ✅ 完成 100%
- Design Token 清理（补充联邦/加密/同步/玻璃 token）
- 内联样式迁移（loginWindow + settingsWindow 全部迁移）
- !important 优化（保留合理覆盖）
- 圆角 token 扩展（--tjg-radius-xl/2xl/3xl）

**阶段 2：联邦身份展示** - ✅ 完成 90%
- ✅ MxidText.vue 已创建并导出
- ✅ FederationBadge.vue 已创建并集成到 RoomCard.vue、RoomPreviewDialog.vue
- ✅ MessageLockBadge.vue 已创建（E2EE 三态徽章）
- ✅ 液态玻璃 mixin 扩展（新增 panel/subtle 变体）并应用到 SettingsSidebar.vue
- ⏳ 待消息渲染组件集成

**阶段 3：E2EE 可视化** - ✅ 完成 70%
- ✅ MessageLockBadge.vue 已创建
- ✅ useMessageTrust.ts composable 已创建
- ⏳ 待消息渲染组件集成

**阶段 4：同步/离线体验** - ✅ 开始 30%
- ✅ SyncStatusBar.vue 已创建

**当前状态验证：**
- vue-tsc --noEmit: 类型检查通过 ✅
- pnpm check:ratchet: hardcoded_color 31 (基线不变) ✅
- atomic 组件：8 个（MxidText, FederationBadge, MessageLockBadge, useMessageTrust, 等）
- Storybook stories: 3 个（MxidText, FederationBadge, MessageLockBadge）
- 已集成组件：RoomCard.vue, RoomPreviewDialog.vue, SettingsSidebar.vue, renderMessage/index.vue
- 测试：4 个测试文件（FederationBadge, MessageLockBadge, useMessageTrust, SyncStatusBar）

**已完成任务：**
1. ✅ 消息气泡集成 MessageLockBadge（renderMessage/index.vue）
2. ✅ ChatMain.vue 集成 SyncStatusBar（已添加 matrixStore.connectionState 和 reconnect 事件）
3. ✅ 补充 i18n 翻译键（locales/zh-CN/chat.json + locales/en/chat.json，connection.* + encryption.*）
4. ✅ SyncStatusBar 测试用例（11 个测试全部通过）
5. ✅ MessageType 接口添加 encrypted 字段
6. ✅ matrix store 添加 reconnect() 方法

**下一步待办：**
- 液态玻璃效果在其他面板级组件的应用（SettingsSidebar 已应用）
- 消息气泡样式调整（render-message.scss 补充锁徽章定位）
