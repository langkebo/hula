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

**阶段 2：联邦身份展示** - ⚠️ 组件层完成，**接入层未开工**（`MxidText` 零调用、`UserIdentity`/`RoomHomeserverLabel` 未创建、`low-perf` 接线缺失，见文末清单 B 段）
- ✅ MxidText.vue 已创建并导出
- ✅ FederationBadge.vue 已创建并集成到 RoomCard.vue、RoomPreviewDialog.vue
- ✅ MessageLockBadge.vue 已创建（E2EE 三态徽章）
- ✅ 液态玻璃 mixin 扩展（新增 panel/subtle 变体）
- ✅ 液态玻璃落地 4 处：SettingsSidebar（panel）、SearchPane（16px/0.9/1.5）、SingleDetails（hero）、GroupDetails（hero）
- ✅ 消息渲染组件集成 MessageLockBadge（renderMessage/index.vue）
- ✅ render-message.scss 补充锁徽章定位样式（.msg-lock-badge--left / .msg-lock-badge--right）

**阶段 3：E2EE 可视化** - ✅ 完成 100%
- ✅ MessageLockBadge.vue 已创建
- ✅ useMessageTrust.ts composable 已创建
- ✅ 消息渲染组件集成 MessageLockBadge
- ✅ 锁徽章定位样式（左/右两侧对齐）
- ✅ 锁态映射收敛到 composable（新增 `LockBadgeLevel`，组件不再内联判断）
- ✅ `useMessageTrust` 入参升级为 `MaybeRefOrGetter<boolean>`，修复 `props` 变化时信任等级残留

**阶段 4：同步/离线体验** - ⚠️ 状态条骨架完成，**离线能力未接线**（离线常驻条 / 未读刷新 / 横幅去重 / 离线缓存均未开工，见文末清单 D 段）
- ✅ SyncStatusBar.vue 已创建并集成到 ChatMain.vue
- ✅ i18n 翻译键（connection.*）
- ✅ matrix store `reconnect()` 方法
- ✅ 移动端 SyncStatusBar 覆盖（**正文要求的 `MobileSyncStatusBar.vue` 独立实现未落地**，但 `MobileChatMain.vue` 复用桌面 `ChatMain.vue`，功能上两端已共享同一实例；详见文末清单 D 段）

**已完成任务：**
1. ✅ 消息气泡集成 MessageLockBadge（renderMessage/index.vue）
2. ✅ ChatMain.vue 集成 SyncStatusBar（已添加 matrixStore.connectionState 和 reconnect 事件）
3. ✅ 补充 i18n 翻译键（locales/zh-CN/chat.json + locales/en/chat.json，connection.* + encryption.*）
4. ✅ SyncStatusBar 测试用例（11 个测试全部通过）
5. ✅ MessageType 接口添加 encrypted 字段
6. ✅ matrix store 添加 reconnect() 方法
7. ✅ render-message.scss 锁徽章定位样式（.msg-lock-badge--left / .msg-lock-badge--right）
8. ✅ MessageLockBadge 集成契约测试（10 个用例，含变异验证）
9. ✅ `useMessageTrust` 新增 `lockBadgeLevel`，修正 `:trust-level` 类型不兼容（`plain` 不属于徽章三态）
10. ✅ `useMessageTrust` 响应式化（`MaybeRefOrGetter`），修复消息切换时信任等级残留
11. ✅ 液态玻璃性能降级补齐：SearchPane 补 `liquid-glass-fallback`，SingleDetails 改用 `liquid-glass-panel`
12. ✅ GroupDetails 补齐玻璃 hero 卡（消除死导入 + 与 SingleDetails 视觉规格对齐）
13. ✅ 新增 3 个契约测试文件（liquid-glass 降级 / GroupDetails hero 规格 / renderMessage 绑定），共 25 个用例
14. ✅ **修复 MessageLockBadge 三态配色完全失效**：配色写在 `__icon` 的复合选择器（`.msg-lock-badge__icon.msg-lock-badge--verified`）上，而 `--verified` 在根 span、`__icon` 在 svg，两个类永不共存 → 绿/灰/红三态**渲染成同一种颜色**。改为根元素修饰类 + svg `currentColor` 继承
15. ✅ **修复外环定位逃逸**：`.msg-lock-badge--ring::after` 使用 `position: absolute`，但根元素无定位上下文 → 外环会逃逸到最近定位祖先（消息气泡/视口）。根元素补 `position: relative`
16. ✅ 新增 `MessageLockBadge.styles.test.ts`（10 用例）：用 sass 真实编译样式块 + 挂载真实 DOM，校验**选择器可达性**——能捕获「class 断言通过但配色静默失效」这类纸面测试盲区
17. ✅ 修正 `MessageLockBadge.stories.ts` 的 `PlainMessage`：原先传 `'plain' as never`（类型逃逸），三态 `v-else-if` 全不匹配 → 渲染出**无图标的空徽章**；改用组件真实支持的 `unverified`
18. ✅ **修复 SyncStatusBar 的「声明了却没实现」**：`autoHideTimer` 声明后从未被赋值、`onUnmounted` 清理它，但注释承诺的「CONNECTED 延迟 2 秒自动隐藏」从未生效 → 连上后「已连接」横幅**永久驻留**。已实现自动收起（含卸载清理、状态变化重置）
19. ✅ **修复 SyncStatusBar 重试无防重复**：`isRetrying` 恒为 `false`，`@click` 直接 `emit('retry')`。改为 `handleRetry` 加锁 + 状态离开 ERROR 解锁 + 8s 保护超时兜底
20. ✅ 移除 SyncStatusBar 的死事件 `update:isVisible`（声明后从未 emit，且全仓无消费方）
21. ✅ SyncStatusBar 测试 11 → 18 用例，新增自动收起（fake timers）、重试加锁、保护超时解锁；并修正一处**名实不符**的用例名（原「should emit update:isVisible」实际只断言 prop 控制显隐）
22. ⚠️ **测试假绿教训**：重试加锁用例最初用 `await trigger('click')` 连点三次 —— 第一次点击后 `:disabled` 已渲染，后续点击是被 **DOM 的 disabled** 拦下的，删除组件内守卫用例仍绿（变异验证未捕获）。改为同一 tick 内直接 `dispatchEvent`（disabled 尚未渲染）后，删守卫即 3 次触发 → 用例转红

**当前状态验证：**
- vue-tsc --noEmit: 类型检查通过（0 错误）✅
- pnpm check:ratchet: hardcoded_color 31, matrix_prefix_hardcoded 68, ts_expect_error 3（基线不变）✅
- Biome check: 改动文件 clean ✅
- 受影响测试套件：42 文件 / 360 用例全绿 ✅
- 全仓扫描「BEM 元素类 + 修饰类复合选择器」反模式：仅 MessageLockBadge 一处，未扩散 ✅
- atomic 组件：8 个（MxidText, FederationBadge, MessageLockBadge, useMessageTrust, 等）
- Storybook stories: 3 个（MxidText, FederationBadge, MessageLockBadge）
- 液态玻璃落地：SettingsSidebar、SearchPane、SingleDetails、GroupDetails（每视图 ≤3 面板级元素）
- 测试文件：9 个（FederationBadge, MessageLockBadge, MessageLockBadge.styles, useMessageTrust, SyncStatusBar, renderMessage/index, liquid-glass, GroupDetailsHero 等）

**下一步待办（已核实前提）：**
- [x] ~~移动端 SyncStatusBar 复用~~ —— **前提有误，实际已覆盖**：全仓只有一个 `ChatMain.vue`（`components/rightBox/chatBox/`），`MobileChatMain.vue` 第 36 行渲染的就是它，桌面/移动共用同一实例，组件级集成自动覆盖两端
- [x] ~~SSSS 备份引导页~~ —— **前提过期，实际已实现**：桌面 `settingsWindow/tabs/SecuritySettings.vue` 已接 `SecureBackupDialog` + `SecurityKeySetupDialog`，移动端 `SecuritySettings.vue` 已接 `MobileSecureBackupDialog`，另有 `E2EEOnboardingDialog`
- [ ] 设备会话面板 —— **前提有误**：`useDeviceSessionPanel` 在仓库中不存在。若确需该能力，应基于已有的 `mobile/views/my/DeviceManagement.vue` 与 `services/matrix/user/MatrixDeviceService.ts` 抽取桌面端组件，而非接入一个不存在的 composable
- [ ] 视觉验收（唯一的真待办）：GroupDetails hero 卡与顶部间距 30px→8px、MessageLockBadge 三态配色、SyncStatusBar 自动收起，均属渲染行为变更，需实际跑起来确认
- [ ] 清理遗留：`src/styles/scss/global/variable.scss.bak`（未被 git 跟踪的旧备份）
- [ ] 可选：`render-message.scss` 被 3 个 scoped 块 `@use`（`renderMessage/index.vue`、robot `Chat.vue`、`MobileChatMain.vue`），其中的 `.msg-lock-badge--left/--right` 会被 emit 成全局规则并重复 3 份。无功能危害，但可考虑移入组件自身 scoped 块
- [ ] 可选：`useMessageTrust.trustLevel` 目前对已加密消息恒定返回 `'verified'`（见 composable 内注释「简化版」）。`unverified` / `risk` 分支尚未接入真实设备验证状态，因此徽章的灰锁/红锁当前为**不可达状态**

**本次未复核项（诚实声明）：**
- 无浏览器渲染环境，hero 卡与玻璃效果的实际像素表现未做视觉回归，仅做了源码契约与几何一致性校验
- `Details.test.ts` 仍无群聊（GROUP）分支覆盖，GroupDetails 的运行时行为未做挂载测试

---

### 2026-09-20 未完成任务清单（逐条实测取证）

> **重要校正：** 上文各阶段的「✅ 完成 100%」**仅指该批次已执行的具体条目**，不等于本方案第 2 章正文的验收标准全部达成。经逐条实测，正文中大量条目**未开工或未达验收线**。以下清单每项均附取证命令与实测结果，结论以源码为唯一依据。

#### A. 阶段 1 基础修复（正文验收未达标）

| 条目 | 正文验收标准 | 实测结果 | 状态 |
| :--- | :--- | :--- | :--- |
| 1.2 内联样式迁移 | 核心视图 `grep -c 'style="'` 为 0 | loginWindow 3 / settingsWindow 9 / homeWindow 1 / components/room 9（全仓 469） | ❌ 未达标 |
| 1.3 `!important` 优化 | 逐条收敛至 `NaiveProvider.vue` + 必须有解释注释 | 全仓 104 处（v1.0 审计基线约 48 处，**反而增长**） | ❌ 未达标 |
| 1.4 圆角 token 扩展 | `border-radius: 1[6-9]px\|2[0-9]px` 为 0 | 19 处硬编码残留 | ❌ 未达标 |
| 1.5 无障碍与响应式 | `@axe-core/vue` 扫描 + 断点 token 化 | axe 走 `e2e/a11y-baseline.spec.ts`（仅登录壳 + 移动消息骨架两个面）✅；`SkipLink.vue` 已存在 ✅；**`design-tokens.css` 无 `--breakpoint-*`** ❌；移动端路由尚未纳入 axe 覆盖面 ❌ | ⚠️ 部分完成 |
| 1.2/1.3 步骤 4 | PR 模板加入内联样式 / `!important` 检查项 | `.github/PULL_REQUEST_TEMPLATE.md` 仅变更类型勾选框，**无任何 UI 检查项** | ❌ 未开工 |

#### B. 阶段 2 联邦身份 + 液态玻璃（正文大面积未开工）

| 条目 | 正文要求 | 实测结果 | 状态 |
| :--- | :--- | :--- | :--- |
| 2.1 组件产物 | `UserIdentity.vue`、`RoomHomeserverLabel.vue` | **两个文件均不存在** | ❌ 未创建 |
| 2.1 `MxidText` 接线 | 会话列表 / 消息头部 / 成员面板 / 好友详情 / 移动端 | `MxidText` 全仓**仅自身文档注释**，零真实调用 | ❌ 未接线 |
| 2.1 `FederationBadge` 接线 | `ChatHeaderRoot` / `RoomMembersPane` / `FriendDetailsSections` / 移动 `HeaderBar` | 仅 `RoomCard.vue`、`RoomPreviewDialog.vue` 两处 | ❌ 未接线 |
| 2.2 `performanceTier.ts` | 新增 `src/utils/performanceTier.ts` + `main.ts` 早期写 `html.low-perf` | **文件不存在**；全仓 `low-perf` 仅出现在 CSS 选择器、测试与 mixin 注释（注释直言「占位」）→ **降级类永不被写入，降级路径实为死代码** | ❌ 未开工 |
| 2.2 玻璃接入点收口 | `layout/index.vue`、`layout/left/**`、移动 `navBar`/`tabBar`、`rightBox/**` 统一改用 mixin | 移动 `tabBar/index.vue:128` 仍写裸 `backdrop-filter: blur(12px)`；`navBar/index.vue:29` 用 `backdrop-blur-md`；另有 23 个文件共 30+ 处裸 `backdrop-filter`（`FooterToolbar`、`FileUploadProgress`、`ContextMenu`、`ContextMenuEmoji`、`TjgAssistant`、`BurnMessage`、`InfoEdit`、`variable.scss`、`chatHistory` 等） | ❌ 未达标 |
| 2.2 双兜底 | `prefers-reduced-transparency` 可验证 | 全仓**零命中**（仅 `prefers-reduced-motion` 有） | ❌ 未开工 |
| 2.2 单视图 ≤3 处 | `grep -c backdrop-filter` ≤3 | 聊天视图内 `FooterToolbar`(2) + `FileUploadProgress`(1) + `TjgAssistant`(1) + `BurnMessage`(1) + `SearchPane`(1) 等，**超标** | ❌ 未达标 |
| 2.3 组件复用体系 | 新 atomic 组件均补 `.stories.ts` + 双主题/low-perf 控件 | 新组件 stories 已有；**`SyncStatusBar` 无 stories 文件** | ⚠️ 部分完成 |

#### C. 阶段 3 E2EE 可视化（核心交互未开工）

| 条目 | 正文要求 | 实测结果 | 状态 |
| :--- | :--- | :--- | :--- |
| 3.1 锁点击交互 | 点击锁 → 打开 `DeviceVerifyDialog`，跨签名未就绪先引导 `SecurityKeySetupDialog` | `MessageLockBadge.vue` **无任何 `emit` / `@click` / `cursor`**，是纯静态展示 | ❌ 未开工 |
| 3.1 锁态真实判定 | `verified` = 设备已验证且跨签名就绪；`risk` = blocked / 解密失败 | `useMessageTrust.ts` 自注「简化版」，对已加密消息**恒定返回 `verified`** → 灰锁/红锁为不可达状态 | ❌ 未开工（灰/红态永远不出现） |
| 3.1 性能红线 | `Map` 缓存 + 单次批量 `getDevices`；禁渲染期 `await` | 未接入任何设备查询，验收用例（1000 条消息断言调用次数）未编写 | ❌ 未开工 |
| 3.2 信任声明文案 | `locales/*/encryption.json` 新增 `encryption.trust_notice.private_key_local` / `server_cannot_read` / `recovery.phrase_title` / `phrase_confirm` | **四个键全部不存在**（仅 `encryption.security_key.passphrase_confirm_label` 等同名近义键） | ❌ 未开工 |
| 3.3 私有化部署 | URL 校验 + `.well-known` 发现 + 企业预设走配置注入 | `ServerConfigModal.vue` 仅有 `isValidHttpUrl`；**无 well-known 发现、无企业预设项** | ⚠️ 部分完成 |
| 3.4 共享 composable | 新增 `src/composables/encryption/useDeviceSessionPanel.ts` | **文件不存在**；`DeviceTrustManager.vue` 与 `DeviceManagement.vue` 仍各自查设备 | ❌ 未开工 |
| 3.4 信任链总览 | 本机 → 交叉签名密钥 → 已信任设备数；未验证/block 置顶标红 | 全仓无「信任链」相关实现 | ❌ 未开工 |
| 3.4 导出交叉签名 | 导出公钥信息 JSON/文本 | 全仓无导出实现 | ❌ 未开工 |
| 3.4 注销二次确认 | 复用 `deleteDevice(id, auth)` UIA 流程 | 未核实到危险操作二次确认接入 | ⚠️ 待核 |

#### D. 阶段 4 同步/离线（骨架完成，业务逻辑未接线）

| 条目 | 正文要求 | 实测结果 | 状态 |
| :--- | :--- | :--- | :--- |
| 4.1 移动端独立组件 | `src/mobile/components/connection/MobileSyncStatusBar.vue` | **文件不存在**（因 `MobileChatMain.vue` 复用桌面 `ChatMain.vue`，功能上已覆盖，但正文要求的独立实现未落地） | ⚠️ 前提可复议 |
| 4.1 离线态常驻条 | `navigator.onLine` + `connectionState` 组合判定，离线时顶部常驻「离线模式：显示本地缓存消息」 | `SyncStatusBar` **无离线分支**；`navigator.onLine` 仅散落在各 service 的守卫里 | ❌ 未开工 |
| 4.1 未读刷新 | `CATCHUP → CONNECTED` 触发未读重算 | 全仓无该转换的未读重算钩子 | ❌ 未开工 |
| 4.1 横幅去重 | `ChatBanners.networkBannerText` 与新状态条去重，避免双横幅 | `ChatMain.vue` 同时渲染 `ChatBanners`（第 3 行）与 `SyncStatusBar`（第 21 行），**双横幅风险实际存在** | ❌ 未开工 |
| 4.1 `RECONNECTING` 退避倒计时 | 「重连中（第 N 次）」+ 倒计时 | `SyncStatusBar` 仅静态文案，无次数与倒计时 | ❌ 未开工 |
| 4.2 离线缓存与历史可读 | 4 步全套（persist 字段核查 / 历史来源定案 / 离线首屏不白屏 / mock `onLine=false` 测试） | `matrix.ts:298` persist `pick` 仍为 `['userId','deviceId','homeserverUrl','accessToken']`，**不含房间列表与消息**；`MatrixCacheManager.ts` 存在但未接离线首屏；无对应测试 | ❌ 未开工 |
| 4.3 Storybook + 视觉回归 | 新组件 stories（含 `SyncStatusBar`）；Chromatic（可选） | `SyncStatusBar` 无 stories；无 Chromatic 接入 | ⚠️ 部分完成 |

#### E. 文档内部矛盾（需修正）

- 第 606 行仍写「⏳ 移动端 SyncStatusBar 复用（未开始）」，与第 644 行「**前提有误，实际已覆盖**」自相矛盾；以 644 行为准（全仓仅一个 `ChatMain.vue`，移动端复用同一实例）。

#### F. 优先级建议

1. **P0 — 接线缺失导致能力空转**：`performanceTier.ts` 未创建 → 玻璃降级路径是死代码；`MxidText` 零调用 → 阶段 2 主目标（联邦特性「看得见」）实际未达成；锁徽章无点击 → 阶段 3 的「可操作入口」未达成。
2. **P1 — 验收线明确未达**：阶段 1 的 1.2/1.3/1.4 三项验收（内联样式 0、`!important` 收敛、硬编码圆角 0）。
3. **P2 — 离线与安全面板**：4.2 离线缓存、3.4 跨设备会话面板。

---

### 2026-09-20 第二轮执行记录（按 P0/P1/P2 优先级整改）

#### ✅ P0-1 性能分级接线（激活死代码）

- **新增 `src/utils/performanceTier.ts`**：判级规则 = 粗指针（触屏）/ `prefers-reduced-transparency: reduce` / `hardwareConcurrency < 4` / `deviceMemory < 4` 任一命中即为 `low`。**核心数与内存不可用时不降级**（Safari/Firefox 无 `deviceMemory`，缺失 ≠ 低性能）。
- **`src/main.ts` 在模块体早期（早于 `createApp`）调用 `applyPerformanceTier()`**，幂等写入 `<html>.low-perf`。
- 清理 `_liquid-glass.scss` 中的死占位 `@media (max-width: 1px) {}`，注释改为指向真实实现。
- **连带影响（正向）**：`SyncStatusBar.vue` 的 `:global(html.low-perf)` 规则此前永不生效，现已真正启用。
- 新增 `src/utils/__tests__/performanceTier.test.ts`（16 用例）。**其中 3 条为接线契约测试**：`main.ts` 必须含真实调用行（行首匹配，注释不算）、调用必须早于 `createApp`、`_liquid-glass.scss` 必须消费 `html.low-perf` 且类名与常量一致。
- 验收对应：阶段 2.2「`html.low-perf` 下无 `backdrop-filter` 生效」「`prefers-reduced-transparency` 双兜底可验证」——**降级路径从死代码变为可达**。

#### ✅ P0-2 MxidText 真实接线 + 联邦判定单一事实源

- **`MxidText` 此前零真实调用**（全仓仅自身文档注释），且自身违反方案 2.1 的硬约束——组件内自行实现 `extractLocalpart` / `extractServerName`（后者还是**死函数**）。现改为消费 `@/utils/userIdentity`，删除两处本地解析。
- **`FriendDetailsSections.vue` 同样违规**：自写 `parseServerName`（`indexOf(':')`），现改用 `extractServerName`。
- **`utils/userIdentity.ts` 补齐方案 2.1 要求但此前不存在的联邦判定 API**：
  - `sameHomeserver(a, b)` —— MXID 与纯 server name 可混用，房间 ID（`!:opaque:server`）亦可；统一小写 + trim
  - `resolveFederationPeer(mxid, localServer)` → `{ server, isRemote }`；**无法判定时按本地处理**，避免本机信息未就绪的瞬间把所有联系人误标为「联邦用户」
- **真实接入点**：`FriendDetailsSections` 联邦信息区
  - 新增「Matrix ID」行，用 `<MxidText show-full is-mono>` 展示完整 MXID（含 `title` 全量值）——阶段 2「让联邦特性看得见」的可见入口
  - 手写的 `.single-details__federation-badge--ok/--warn` 内联徽章**替换为既有 `FederationBadge` 组件**，删除 3 条随之失效的本地样式规则
- 新增 i18n 键 `friend.detail.matrix_id`（zh-CN / en）
- ⚠️ **遗留**：`src/typings/i18n.d.ts` 是 `scripts/generate-i18n-types.mjs` 从 `locales/zh-CN/*.json` 生成的产物，本次新增键后它**相对工作树已陈旧**。未重新生成的原因：该脚本整树生成，会一并写入**并行会话正在改的 `encryption.json` 键**，造成跨会话污染。已确认 `pnpm check:i18n`（en/zh-CN 键对齐）通过、无 CI 校验该产物新鲜度、且 `I18nKeys` 不约束 `t()`（vue-tsc 0 错误）——故留待两侧 locale 改动都落地后统一执行 `pnpm gen:i18n`。
- 测试：`MxidText.test.ts`（8 用例，含「解析结果与 `toLocalpart` 逐例一致」的 SSoT 守卫）、`FriendDetailsSections.test.ts` 8 → 12 用例（MxidText 接线、FederationBadge local/远端语义、本机域名未就绪兜底）、`userIdentity.test.ts` 16 → 31 用例

#### ⏸ P0-3 锁徽章点击（**受阻，需决策**）→ 已于第三轮完成，见文末「第三轮执行记录」

实测确认既有验证对话框**不具备**方案 3.1 要求的能力：

- `DeviceVerifyDialog` 的 props 为 `{ show, deviceId, deviceName, inboundRequest, initialMode }` —— **没有目标用户**；`useDeviceVerifyDialog.resetState()` 中 `targetUserId = 当前会话 userId`（即自己）。
- 即该对话框只能验证**自己账号的其它设备**；「点击消息锁 → 验证该消息发送者的设备」需要扩展 props 才能支持，属 E2EE 验证面的改动。
- 另：锁徽章当前也拿不到发送者 **deviceId**（`useMessageTrust` 只消费 `hasEncryption`，没有设备维度信息）。

#### 验证（本轮）

- `vue-tsc --noEmit`：0 错误
- `pnpm check:ratchet`：hardcoded_color 31 / matrix_prefix_hardcoded 68 / ts_expect_error 3 —— 基线不变
- Biome：改动文件 clean
- 受影响测试：**75 文件 / 850 用例全绿**
- 新增守卫逐条变异验证：（1）注释掉 `main.ts` 接线 → 2 条契约用例转红；（2）`_liquid-glass.scss` 改类名 → 契约用例 + 既有 liquid-glass 用例转红；（3）`FriendDetailsSections` 反转 `:is-local` → 3 条语义用例转红；（4）去掉 MxidText 的 `show-full` → 完整 MXID 用例转红；（5）`normalizeHomeserver` 去掉小写归一 → 大小写用例转红；（6）`MxidText` 改用朴素 `slice(1)` 解析 → 4 条用例转红（含 SSoT 一致性）

---

### 2026-09-20 第三轮执行记录

#### ✅ P0-3 锁徽章 → 设备验证（扩展对话框 + 接线）

**问题本质**：既有 `DeviceVerifyDialog` 只能验证「自己账号的其它设备」——`useDeviceVerifyDialog.resetState()` 把 `targetUserId` 固定成当前会话用户，且 `targetDeviceId` 会兜底成**本机 deviceId**。于是「验证消息发送方设备」在数据层就无从表达：即使硬塞 `deviceId`，也会拼出 `(对方 userId, 我的 deviceId)` 这种 SDK 侧不存在的事务。

**改动**：

1. **对话框支持目标用户**（`useDeviceVerifyDialog.ts` + `DeviceVerifyDialog.vue` + `DeviceVerifyIntroStep.vue`）
   - 新增 `userId?: string` prop：**缺省 = 验证本机其它设备（保持历史语义）；指定 = 验证该用户的设备**
   - 跨用户时经 `matrixDeviceService.getUserDevices()`（`keys/query`）拉设备列表，`DeviceVerifyIntroStep` 新增设备选择器（`n-select`）。**不能用 `GET /devices`** —— 该端点无 `{user_id}` 路径段，只能查自己，会把他人设备列表查成空
   - **新增不变量：跨用户时 `targetDeviceId` 不得回退本机 deviceId**（留空，等用户选择）
   - 恰好一台设备时自动选中；多台且未选时 `startVerification()` 被阻断并提示 `select_device_required`（此前会发起 `deviceId=''` 的空请求）
   - 设备守卫只在 `hasLocalDeviceContext()` 为真时生效，避免掩盖「crypto 未就绪」这类更根本的错误
2. **新增单例启动器 `src/composables/encryption/useDeviceVerifyLauncher.ts`**
   - 模块级 `ref`（非 pinia）：`visible` / `target` / `open()` / `close()` / 测试用 `reset()`
   - `close()` **同时清空 target**，避免下次打开残留上一条消息的 userId
3. **锁徽章交互态**（`MessageLockBadge.vue`）
   - 非交互渲染 `<span>`（与历史完全一致）；`interactive` 渲染 `<button type="button">`，新增 `verify` 事件
   - 新增 `ariaLabel` prop，可访问名称回退链 `ariaLabel → title → 状态文案`（避免渲染出无名称 button）
   - `&--interactive` **刻意不声明 `color`**：它与 `--verified/--unverified/--risk` 同特异度，声明了会遮蔽三态配色
4. **接线**（`renderMessage/index.vue` + `ChatMain.vue`）
   - `renderMessage` 传 `:interactive="canVerifySender"` + `@verify="handleVerifySender"`；`canVerifySender = 已加密 && !isMe && !!senderUid`（自己的消息没有可验证对端）
   - `ChatMain.vue` 作为**单例挂载点**（桌面/移动共用唯一实例）渲染一份 `DeviceVerifyDialog`（`defineAsyncComponent` 按需加载）。**不挂在 `renderMessage`** —— 那会按消息条数实例化 N 个对话框
5. **修掉同族缺陷：`DeviceTrustManager` 跨用户验证漏传 userId**
   - 「未验证设备」「已屏蔽设备」两个 tab 的条目可能属于**其他用户**，但 `handleVerifyDevice()` 只传 `device-id`/`device-name` → 对话框把 `targetUserId` 解析成自己，发出 `(自己, 对方 deviceId)` 的无效事务。现补传 `verifyTargetUserId = device.userId`
6. **新增 i18n 键**：`setting.encryption.device_verify_dialog.{verify_user_label, select_device_label, select_device_placeholder, select_device_required, no_device_available}`、`message_container.verify_sender_device`（zh-CN / en 双语）

#### ❗ 第三轮新发现（P0 级）：i18n 键路径错配导致对话框整体渲染原始 key

排查 P0-3 时顺带实测出**独立缺陷**：

- `locales/{zh-CN,en}/setting.json` 中该子树的真实路径是 **`setting.encryption.device_verify_dialog.*`**（嵌套在 `encryption` 分组下，与 `verify_success` / `fingerprint_hint` 同级），但全仓 **84 处 / 10 个文件**写成 `setting.device_verify_dialog.*`，`src` 中**零处**使用正确路径。
- 后果：`t()` 命中不到键 → 直接回显 key 字符串。即**整个设备验证对话框（标题、步骤条、每个按钮、每个提示）显示的都是 `setting.device_verify_dialog.xxx`**。
- **为什么长期没人发现**：所有相关组件测试都在 `vi.mock('vue-i18n')` 里**照着源码的错键写 `t` 映射表**，源码与测试桩共用同一个错误路径 → 永远自洽全绿。这是「纸面测试」的变体：**断言对象是自造的桩，而非真实语言包**。
- 已修复：84 处统一改为正确路径；并顺带补上 `EncryptionSettings.vue` 中两处真实缺失键 `device_trust_label` / `device_trust_desc`（新守卫测试直接抓出来的）。
- **同族问题的量级（实测）**：生产代码中 `t('字面量')` 有 **564 个 key 在 `locales/zh-CN` 无法解析**，分布在 **80 个文件**；按命名空间：`encryption` 138 / `setting` 78 / `widget` 69 / `room` 65 / `moderation` 43 / `message` 29 / `home` 25 …；其中 `call.json`、`widget.json`、`memoryMonitor.json`、`private_mode.json`、`e2ee.json` 等**命名空间文件根本不存在**。`scripts/check-i18n.mjs` 只校验 zh-CN 与 en 的**键集合对齐**，**不校验源码引用**，所以漏网。
- **建议（未实施，需单独立项）**：把「源码 `t('字面量')` 键必须能在真实语言包解析」做成仓级门禁（可复用本次的解析逻辑：**文件名即命名空间且首段需剥掉**）。本次已在设备验证范围内落地该守卫，全仓铺开需先清 564 个存量。

#### 测试与验证（第三轮）

新增测试：
- `src/composables/encryption/__tests__/useDeviceVerifyLauncher.test.ts`（5 用例）
- `src/components/encryption/__tests__/DeviceVerifyDialog.crossUser.test.ts`（8 用例）
- `src/components/encryption/__tests__/deviceVerifyFlow.contract.test.ts`（13 用例，含 i18n 键可达性守卫）
- `src/components/atomic/__tests__/MessageLockBadge.test.ts` 10 → 16 用例（交互态 + 单根结构回归）

门禁：`vue-tsc --noEmit` 0 错误；`check:ratchet` 三项基线不变；`check:i18n` 通过；Biome clean；变更波及测试全绿。

**变异验证：14 组全部有效**（改坏源码 → 对应用例转红 → 还原后逐字节一致）：

| # | 变异 | 结果 |
|---|---|---|
| M1 | 跨用户时把 `targetDeviceId` 回退成本机 deviceId | 4 用例红 |
| M2 | 去掉「未选设备」阻断守卫 | 1 用例红 |
| M3 | 去掉单设备自动选中 | 1 用例红 |
| M4 | 跨用户不拉设备列表 | 3 用例红 |
| M5 | `userId` prop 不传入 `targetUserId` | 6 用例红 |
| M6 | i18n 键路径回退成旧错误前缀 | 2 用例红 |
| M7 | `DeviceTrustManager` 移除 `:user-id` 绑定 | 1 用例红 |
| M8 | `handleVerifyDevice` 不写 `device.userId` | 1 用例红 |
| M9 | `renderMessage` 移除 `@verify` | 1 用例红 |
| M10 | `canVerifySender` 去掉 `!isMe` | 1 用例红 |
| M11 | `ChatMain` 移除对话框单例挂载 | 1 用例红 |
| M12 | 徽章非交互态也派发 `verify` | 1 用例红 |
| M13 | 徽章交互态不渲染 `<button>` | 1 用例红 |
| M14 | 模板顶部加 HTML 注释（制造多根片段） | 8 用例红 |

#### ⚠️ 第三轮附带发现（已修）

`MessageLockBadge.vue` 在加交互态时一度把说明性 **HTML 注释写在 `<template>` 顶部**，导致组件退化为**多根片段**（注释本身算一个根节点）：`wrapper.element` 落到外层容器，`classes()/attributes()` 全部失空（而 `exists()` / `find()` 仍正常）。已移除该注释（说明移入 `<script>` 头注释），并补「单根结构回归守卫」用例 + 变异验证 M14。

---

### 2026-09-20 第四轮执行记录（P1：阶段 1 三项验收线）

#### ✅ 1.4 硬编码大圆角清零

- 实测 **20 处** 16–29px 字面量（含移动端登录页内联 `border-radius: 24px 42px 4px 24px`）。
- **映射规则**：容器 / 卡片 / 气泡 → 语义别名 `--tjg-radius-surface`(`=xl`) / `-panel`(`=2xl`) / `-sheet`(`=3xl`)。这三个别名此前**全仓零调用**（定义了没人用，又一个「token 死代码」）；控件 / 输入框 → 原子刻度 `--tjg-radius-xl` / `-2xl`（同值，零视觉变化）。
- **唯一真实视觉微调**是两处离刻度值向最近刻度收敛：语音气泡 18→16（`-surface`）、RTC 浮层 18→20（`-panel`）。本环境无浏览器，**未做像素级验收**。
- 移动端登录页 tab 指示条：内联 style 移入 `.tab-indicator`（`4px`→`--tjg-radius-xs`；造型用的 `42px` 属离刻度装饰值，保留字面量）。
- **验收正则过窄导致漏网**：正文口径写的是 `border-radius: 1[6-9]px|2[0-9]px`，**漏掉 `border-top-left-radius` 这类长写**——实测另有 **6 处** 20px（`FriendInfo` / `friends/index` / `PersonalInfo` 的移动端抽屉顶角）。已一并 token 化，并把门禁正则改为 `-radius:` 以覆盖长写。
- 结果：`hardcoded_radius = **0**`（ratchet 永久冻结）。

#### ✅ 1.2 核心视图内联样式清零

- 实测 **19 处**（loginWindow 2 / settingsWindow 8 / homeWindow 1 / components/room 8）。
- 迁移方式以 **UnoCSS 工具类**为主（`max-w-200px` / `w-130px` / `hidden` / `flex-1` / `my-8px` / `w-full` / `grid-cols-3` / `max-h-*` / `bg-[--var]`）；无对应简写类的两处落到 scoped 规则（`.room-card-grid__body` 的 auto-fill 栅格、`.tab-indicator`）。
- **顺带发现两处「假动态」内联样式**：
  - `PublicRoomDiscovery.vue` 的 `:style="gridStyle"` —— `gridStyle` 其实是**常量对象**（注释写「响应式 minmax 网格」，但该对象没有任何响应性）→ 迁入 `.room-list`。
  - `ManualLoginForm.vue` 的 `:style` 三项全是静态值 → 转工具类（`border-1 border-solid border-[--login-dropdown-border]`）。
- 剩余 1 处动态 `:style` 是 `VoiceVideoSettings` 的音频电平条（`width: ${audioLevel}%`），属真动态值，**保留**。
- 结果：核心视图静态 `style="` = **0**；顺带清理消息/弹层组件 6 处，全仓 ratchet 口径 **285**（冻结）。

#### ⚠️ 1.3 `!important` 收敛（大幅下降，但**未达**「仅剩 NaiveProvider.vue」）

实测 **116 处**（含死备份 `variable.scss.bak` 的 5 处；`NaiveProvider.vue` 实测 **0 处**）。分三步处置：

1. **可判定冗余的直接删除（−15）**
   - 删死备份 `src/styles/scss/global/variable.scss.bak`（git-ignored 草稿，长期与正式文件双轨）
   - 清理 `-moz-` / `-ms-` / `-khtml-user-select` **失效厂商前缀**（`render-message.scss` / `chatHistory` / `multiMsgWindow` / `useContextMenu`）
   - `File.vue` 的 `cursor` / `user-select`：元素自声明必胜父级继承值，`!important` 冗余
   - `CaptchaVerify.vue` 的 `cursor`：全仓**不存在任何 `cursor + !important` 的竞争规则**
   - `LinkPreview.vue` 的 `-webkit-line-clamp`
   - `PushRuleEditor.vue` / `InvitePermissionPanel.vue` 的 n-list-item padding：scoped 属性 + 类名特异性已高于 naive-ui 的 `.n-list-item`
2. **内联 `!important` 归零（−4，同时把 6 个内联 style 转 scoped 类）**
   - `Text.vue`(2) / `Emoji.vue` / `Image.vue` / `InfoPopover.vue` / `MobileSessionHeader.vue`
   - 其中 `InfoPopover` / `MobileSessionHeader` 的内联 `font-family` 是**死声明**：被全局 `* { font-family: ... !important }`（`variable.scss`）压掉，**从未生效**，一并删除
   - `Text.vue` 提及 token 的 `user-select` 保留 `!important`（需抵消上下文菜单注入的 `.no-select{... !important}`），但改为 scoped 类以便承载解释注释
3. **保留项逐处补解释注释（35 处）**
   - `@media (prefers-reduced-motion: reduce)` 区块内 **20 处豁免**（媒体查询本身即理由）
   - 其余每处都在**前 8 行内**写明理由（覆盖 naive-ui / Vant 内部样式、抵消 `.no-select`、抵消 `@use` 进来的 non-scoped 规则等）

结果：116 → **91**（ratchet 冻结）。**未清零的原因**：剩余 91 处里 20 处属 a11y 合规保留，其余集中在「登录/消息按钮渐变覆盖两套 UI 库」「naive-ui 主题变量覆盖」「库内部结构穿透」。**逐条移除必须用真实浏览器做层叠回归**，本环境无法验证 → 按「可判定冗余才删」的原则收敛，其余用注释固化。**这一项按正文口径仍属未完全达标。**

#### ✅ 门禁与防倒退（正文 1.2/1.3 步骤 4）

- `scripts/check-ratchet.mjs` 新增三个计数器，并给计数器引入 `extensions` 维度以覆盖 `.scss/.css/.mdx`：
  `hardcoded_radius`(**0**) / `inline_style`(**285**) / `important_css`(**91**)；原有三项基线不变（68 / 31 / 3）。
- 新增契约测试 `src/styles/__tests__/design-baseline.test.ts`（**14 用例**）：
  - 1.4：零容忍计数 + **悬空 token 守卫**（`var(--tjg-radius-*)` 必须在 `design-tokens.css` 有定义）+ 三个语义别名必须仍被真实引用
  - 1.2：四个核心视图目录为 0 + 全仓不超基线
  - 1.3：注释政策 + 总量 + **禁模板内联 `style` 携带 `!important`**
  - 配套：`.gitignore` 必须忽略 `*.bak`；`design-tokens.css` 必须定义三个语义别名
- `.github/PULL_REQUEST_TEMPLATE.md` 新增「UI 约束自检」四项。
- **变异验证 12/12 有效**（改坏源码 → 对应用例转红 → 还原后逐字节一致）：
  M1 简写 16px｜M2 长写 20px｜M3 核心视图内联 style｜M4 新增无注释 `!important`｜M4c 删除既有解释注释（**计数不变、仅政策测试红**，证明政策守卫不是被总量守卫掩盖）｜M5 语义别名调用点全部消失｜M6 悬空 token｜M7 `.gitignore` 去掉 `*.bak`｜M8 内联 style 重新带 `!important`｜M9/M10/M11 ratchet 侧圆角 / 内联 / `!important` 三类增长。

#### 本轮踩到的两个坑（高价值，值得记）

1. **契约测试里用正则在循环中 `exec` 必须带 `g` 标志**。`REDUCED_MOTION` 漏写 `g` 时 `lastIndex` 永不前进 → **死循环** → 进程被 OOM 杀掉。外部表现是 **`exit 137` + 零输出**，极易误判成「测试环境坏了」。
2. **计数正则跨行会误抓**。`border-radius:[^;]*` 里的 `[^;]*` 能跨行匹配：`style="border-radius: 8px"`（无分号）会一路吃到后面某个 `16px`，产生幽灵违规。收紧为 `[^;"}\n]*`，并加 `(?<![\d.])` 防止命中「`216px` 里的 `16px`」；正则已用 9 条正反样例自测。

#### 遗留

- `!important` 91 处未清零（需浏览器层叠回归；其中 20 处属 reduced-motion 合规保留）。
- 离刻度圆角仍在：`12px`(多处) / `14px`(4) / `9px` / `3px` / `2px` / `1px` / `36px`(`AvatarCropper` 方形预览) / `50px`(`.float-box`) / `999px`。`DESIGN.md` 只规定「12px 及以下不得用于**新增**界面容器」，故未纳入本轮验收口径。
- 全仓仍有 285 处内联 style（本轮只要求核心视图清零）。

---

## 第五轮执行记录（2026-09-20）：P1 收尾核验 + 一处自伤缺陷 + 归属取证

第四轮结束时只做完「改 + 自测」，两项收尾尚未取结果：后台 `vue-tsc --noEmit`、以及受影响测试面的完整复跑。本轮把它们跑完，并因此**揪出一个 P1 自己引入的模板缺陷**。

### 1. `vue-tsc --noEmit` 结果：与 P1 零交集

```text
src/services/matrix/crypto/CryptoSecurityAdapter.ts(81,23): error TS2339: Property 'getCrossSigningKeyId' does not exist on type 'CryptoApi'.
src/services/matrix/crypto/CryptoSecurityAdapter.ts(85,27): error TS2339: Property 'getCrossSigningKeyId' does not exist on type 'CryptoApi'.
```

两个错误**全在并行 E2EE 会话的文件**里（`CryptoSecurityAdapter.ts` 为未暂存修改，同目录还有未跟踪的 `CryptoSecurityAdapter.crossSigning.test.ts`），**P1 改动 0 错误**。这正是第四轮 24 文件提交被卡住的同一个根因，等并行会话落地后再重跑提交。

### 2. 测试面复跑：35 failed → 逐项归属

```text
Test Files  5 failed | 133 passed (138)
Tests       35 failed | 997 passed (1032)
```

35 个失败**不是同源的**，本轮把它们拆成「本轮自伤」与「既有失败」两类。

#### ✅ 本轮自伤 2 项（已修）

1. **`RoomDetailStats.vue` 模板出现重复 `class` 属性**（`SyntaxError: Duplicate attribute`）
   - 现象：SFC 编译失败 → `RoomDetailStats.test.ts` 整个文件退化成 **`(0 test)`**，组件彻底无法挂载。
   - 根因：1.2 迁移把 `style="grid-template-columns: repeat(3, 1fr)"` 换成 UnoCSS 类时，**写成了第二个 `class` 属性**（而不是并进已有 class）：
     `class="room-detail-stats grid gap-[--tjg-space-2]" data-testid="stat-grid" role="list" class="grid-cols-3"`
   - 修复：合并为单属性 `class="room-detail-stats grid gap-[--tjg-space-2] grid-cols-3"`（`grid-cols-3` = `repeat(3, minmax(0, 1fr))`，与 HEAD 的 `repeat(3, 1fr)` 语义等价）。
   - **关键教训**：`vue-tsc --noEmit` **不校验模板属性唯一性**，对这类缺陷完全失明。这次能暴露纯属「该组件恰好有测试」的运气——没有测试的组件会静默带着编译错误留在仓库里。
2. **`PublicRoomDiscovery.test.ts` 断言失配**
   - 现象：`expected '' to contain 'minmax(240px, 1fr)'`。
   - 根因：原用例断言的是**内联** `style.gridTemplateColumns`，而第四轮已把该网格声明从常量对象迁进 scoped `.room-list`。
   - 修复：改写为两段契约——**DOM 侧**「元素不再挂内联网格」（`style.gridTemplateColumns === ''`）+ **源码侧**「scoped 规则仍声明 `repeat(auto-fill, minmax(240px, 1fr))`」（`node:fs` 读 SFC + 正则取 `.room-list` 规则体）。
   - 路径解析用仓库既有惯例 `resolve(__dirname, '..', 'X.vue')`；**不要用 `fileURLToPath(new URL(..., import.meta.url))`**——happy-dom 环境下 `import.meta.url` 是 http URL，会抛 `TypeError: The URL must be of scheme file`。
   - **变异验证 2/2 有效**：M1 删掉 scoped 里的 `grid-template-columns` → 红；M2 把内联 `style` 加回 → 红。

#### ⚠️ 既有失败 4 项（**非本轮引入**，已实证）

**取证方法**：`git worktree add --detach /tmp/tjg-head HEAD` 拉一份 HEAD 干净副本，再把 `node_modules` 软链过去（**源码 = HEAD，运行环境与工作区逐字节相同**），跑同样 4 个文件 → **同样失败**。此方案不触碰工作区，避免了 `git stash` 会打断并行会话的风险。

| # | 文件 | 实测报错 | 根因判定 |
| - | ---- | -------- | -------- |
| 1 | `RoomCard.test.ts`（1） | `[data-testid="room-federation-badge"]` 不存在 | ~~**疑似真实功能缺口**：`RoomCard.vue` 内**根本不含 `federation` 字样**，从未渲染该徽章 → 属「测试先行的规格没落地」。且配套的「isFederated=false 时不显示」那条因**恒不显示而假绿**~~ **⬅ 第六轮已证伪并修复**：实为 Bash `grep` 假阴性导致的误判，组件确有该徽章，根因是**测试 testid 与组件命名不一致** |
| 2 | `ChatMain.test.ts`（29，全挂） | `[🍍] getActivePinia() was called but there was no active Pinia` @ `ChatMain.vue:218 useMatrixStore()` | 测试基建缺口：`useMatrixStore` 在 **HEAD 就存在**（171/202 行），而 `ChatMain.test.ts` **全程未装 Pinia**（`shallowMount` 缺 `global.plugins: [createPinia()]`） |
| 3 | `ChatHeaderRoot.test.ts`（4，全挂） | `[naive/use-dialog]: No outer <n-dialog-provider /> founded` @ `ChatHeaderRoot.vue:148` | 测试基建缺口：缺 provider（或 `useDialog` stub） |
| 4 | `ScreenshotRoot.test.ts`（2 个 unhandled rejection） | `TypeError: Cannot read properties of undefined (reading 'catch')` @ `useTauriListener.ts:25` | 测试基建缺口：非 Tauri 环境拿到 undefined 的 listener promise |

这四个文件的**源码与测试文件本轮、上一轮均未改动**（`git status` 无记录；`RoomCard.vue` / `ChatHeaderRoot.vue` / `ScreenshotRoot.vue` / `useTauriListener.ts` 四者全部处于 clean 状态）。

### 3. 新增门禁：模板属性卫生（补 `vue-tsc` 盲区）

既然 `vue-tsc` 看不见重复属性、而这次差点让一个编译错误组件留在仓库里，就在 `design-baseline.test.ts` 追加 `describe('模板属性卫生（vue-tsc 盲区）')`（**+2 用例，共 16**）：

- 扫描全仓 `.vue` 模板，禁止**重复的静态** `class` / `style` 属性。
- 用负向后顾 `(?<![:\w-])` 排除两类噪声：**合法的 `:class` + `class` 组合**（Vue 会合并，全仓现有 4 处）、以及 `data-class` 这类带 `-` 前缀者。已确认这 4 处正当组合**不误报**。
- 模板切片对嵌套 `<template #slot>` 安全：`/<template>[\s\S]*<\/template>/` 用贪婪匹配吃到**最后一个** `</template>`。
- **变异验证有效**：把重复 `class` 重新注入 `RoomDetailStats.vue` → 用例转红并**准确点名违规文件**。
- 另加自检 `expect(VUE_TEMPLATES.length).toBeGreaterThan(50)`，防止收集器失效后守卫静默空转。

### 4. 门禁复核

- `scripts/check-ratchet.mjs`：6 项全在基线 → `matrix_prefix_hardcoded 68` / `ts_expect_error 3` / `hardcoded_color 31` / `hardcoded_radius **0**` / `inline_style **285**` / `important_css **91**`。
- prettier + biome：本轮改动 3 个文件全部 clean。

### 5. 遗留（本轮新增）

- **4 项既有失败需单独决策**。其中 `RoomCard` 联邦徽章疑似**真实功能缺口**（不是测试写错），另 3 项是测试基建缺口。均不属 P1 验收线，也未被本轮改动影响。

## 第六轮执行记录（2026-09-20）：i18n 三件遗留收口 + 桩键门禁

### 1. 三件遗留的处置结果

| 遗留项 | 处置 |
| --- | --- |
| 564 个 i18n 键待清 | 第一轮修 111 处调用点（`unresolved 503 → 414`）；本轮再清 `poll.*` 3 键 → **411**，基线已收紧 |
| `i18n.d.ts` 未随新键重生成 | 已 `pnpm gen:i18n` 重生成（陈旧量 955 字符，缺 `chat.connection` 组）；新增「产物新鲜度」守护用例 |
| `useEncryption.requestUserVerification(userId)` 内部传空 deviceId | **只诊断未改动**（属并行 E2EE WIP）。SDK 层 `deviceId` 必填，`''` 必然抛 `Not a known device`；生产零调用、2 个用例还把 bug 写成期望值。建议**删除**而非修补 |

### 2. 本轮最有价值的发现：自洽桩掩盖的是**真实生产缺陷**（第三例）

建立「桩键可达性」门禁后立刻在 `RenderPollMessage` 上抓到：

- 测试桩声明 `poll.votes` / `poll.ended` / `poll.ends_at`，**组件源码用的正是同样三个键** —— 双方互证，语言表被架空；
- 真实语言表里只有 `poll.message.votes` / `poll.message.ended`，`poll.ends_at` **根本不存在** → 聊天里投票卡片直接显示三个裸键。

顺带发现**第二类缺陷**：`poll.json` 的占位符写成 Handlebars 风格 `{{count}}`，vue-i18n 只认 `{count}` → 渲染成 `{0} 人投票`。全仓仅 `poll.json` 中招（每语言 4 处），已修正。

**⚠️ 排查陷阱（已写入项目记忆）**：本轮曾用 Bash `grep` 查该组件是否调用 `t('poll.*')`，返回**空**，一度误判为「桩里的孤儿条目、无害」。换 `Grep` 工具后立刻看到组件第 29–31 行确在使用。**本仓任何「找不到」的结论必须用 `Grep` 工具复核。**

### 3. 从「修调用点」升级为「堵来源」

- 新增共享助手 `tests/i18n-messages.ts`：`createI18nMock()` 按「首段即命名空间」读**真实语言表**，解析不到就**原样返回裸 key**（不抛错、不静默兜底），让断言直接看到未翻译的键名。
- 已迁移 3 个文件：`KeyBackupRestoreDialog` / `SyncStatusBar` / `RenderPollMessage` 的测试。
- `sourceRefs.test.ts` 15 → **18 用例**，新增「桩键可达性」组：白名单外的无法解析键一律 FAIL 并点名；**白名单不得陈旧**（已能解析必须删除，防注水）；收集器自检。
- 为什么必要：`check-i18n-refs.mjs` 只扫**生产源码**，而缺陷载体在**测试桩**里 —— 只扫源码永远看不见「桩与语言表脱节」。

### 4. 顺手修掉一个 HEAD 就存在的红灯（非本轮引入）

`RoomCard.test.ts` 断言 `[data-testid="room-federation-badge"]`，而 `FederationBadge.vue` 的 testid 是 `federation-badge`（该组件自身测试、`FriendDetailsSections.test.ts` 均用后者 = 仓库主流命名）。三个相关文件 `git status` 全部无记录，即 **HEAD 状态就红**。

已改测试跟随主流命名（**未动组件**，避免影响另外 3 个依赖该 testid 的测试）→ `RoomCard.test.ts` **13/13 绿**。

> 📌 **修正上一轮结论**：第五轮判定 RoomCard 联邦徽章「疑似真实功能缺口 / `RoomCard.vue` 内根本不含 `federation` 字样」是**错的** —— 组件第 30–36 行确实渲染了 `<FederationBadge>`，第 82 行也 import 了。真相是**测试契约与实现命名不一致**。上一轮之所以误判，正是同一类 Bash `grep` 假阴性。

### 5. 验收基线（本轮实测）

| 门禁 | 结果 |
| --- | --- |
| `vue-tsc --noEmit` | **0 error**（第五轮遗留的并行 WIP 类型错误已随其落地消失） |
| 受影响测试面（11 个目录） | **88 文件 / 657 用例全绿** |
| `check-i18n.mjs`（zh/en 键对齐） | passed |
| `check-i18n-refs.mjs` | `unresolved 411（基线 411）/ fallback 7（基线 7）` |
| `check-ratchet.mjs` | 6 项全在基线 |
| `sourceRefs.test.ts` | 18/18 |
| 变异验证 | 4/4 有效（含「改造前该变异不会红」的对照，证明自洽桩已被消除） |

### 6. 遗留（本轮新增）

- **`biome check` 仍有 3 error**，**全部非本轮引入**，明确归属如下：
  - `src/types/matrix-extensions.d.ts`（format 尾随空行 + `useAdjacentOverloadSignatures`）、`src/services/matrix/crypto/__tests__/MatrixEncryptionContextService.test.ts`（`noBannedTypes`）→ 两文件 `git status` 无记录，**HEAD 即存在**；
  - `MessageLockBadge.vue`（`useShorthandFunctionType`，warning）与 crypto 目录 2 个测试文件 → **并行 WIP 修改中**；
  - `biome.json` schema 版本 2.5.6 vs CLI 2.5.12 → 仅 info。
  - 未改动上述**未修改文件**，以免与并行会话冲突；如需让 `pnpm check` 转绿，建议单独一批处理。
- `encryption.backup_restore_dialog.*` 32 键内容缺口仍在（需产品文案），白名单已登记。
- 其余 `unresolved 411` 需逐个定案（91 键属「命名空间文件不存在」）。


---

## 第七轮执行记录（2026-09-21）：全量复核 + 未完成任务清单

> **本轮性质：** 不写新功能，只做「文档结论 vs 当前 HEAD 实况」的对账。第六轮之后仓库又经历了 **inline_style 285→5 收口专项**（7 个提交 + 2 个收尾提交，已全部落库），因此前六轮的部分「未开工」结论**已经过期**，另有部分结论**经实测被证伪**。以下每条均附本轮实测命令与结果，结论以当前 HEAD（`1773ee8a`）源码为唯一依据。
>
> **基线（本轮实测）：** `vue-tsc` 0 错误 · `check-ratchet` 六项全绿（`matrix_prefix_hardcoded 68 / ts_expect_error 3 / hardcoded_color 31 / hardcoded_radius 0 / inline_style 5 / important_css 85`）· `design-baseline.test.ts` 16/16 · `check-i18n-refs` `unresolved 273（基线 280）/ fallback 7（基线 7）` · 工作区仅剩 3 项并行 WIP（`docs/重构优化方案.md`、`locales/{en,zh-CN}/menu.json`）。

### 7.1 结论校正（前六轮已过期 / 已证伪的条目）

| 前六轮结论 | 本轮实测 | 判定 |
| :--- | :--- | :--- |
| 1.2 内联样式未达标（全仓 285） | `inline_style = 5`，且 5 处全为 n-popover 组件参数并已登记具名 allowlist | ✅ **已完成**（本轮专项成果） |
| 1.3 步骤 4：PR 模板无 UI 检查项 | `.github/PULL_REQUEST_TEMPLATE.md` 已有「UI 约束自检」四项（内联 / `!important` / 圆角 token / 颜色 token） | ✅ 已完成 |
| 2.1 `UserIdentity.vue` / `RoomHomeserverLabel.vue` 未创建 | 两文件**均已存在**（`src/components/common/UserIdentity.vue`、`src/components/room/RoomHomeserverLabel.vue`） | ⚠️ 结论过期，但**零真实接入**（见 7.2） |
| 2.1 `MxidText` 零真实调用 | 已接入 `FriendDetailsSections.vue` + `UserIdentity.vue` | ✅ 已接线（仍有扩展空间） |
| 2.2 `performanceTier.ts` 不存在、`low-perf` 是死代码 | `src/utils/performanceTier.ts` 存在，`main.ts` 模块体早期调用 `applyPerformanceTier()`；`low-perf` 出现在 9 个文件 | ✅ **已修复** |
| 3.3 `ServerConfigModal` 无 well-known 发现 | 已接 `discoverAndSaveMatrixEndpoints`（`ServerConfigModal.vue:29/65`） | ✅ 结论过期（原判定按字面 `well-known` 检索，漏判） |
| 3.1 `useMessageTrust` 对加密消息恒返回 `verified` | 已接 `matrixDeviceService.getUserDevices()`；`unverified` 出现 21 次、`risk` 6 次、`effectScope` 3 次；「简化版」注释已删除 | ✅ **已修复**（灰/红态可达） |
| E. 第 606 行与 644 行自相矛盾 | 第 606 行文字已改为「功能上两端已共享同一实例」，但仍以 ⏸ 语义表述 | ⚠️ 语义残留，建议收敛（见 7.2-E） |
| 遗留 `variable.scss.bak` | 文件已不存在 | ✅ 已清理 |

### 7.2 未完成任务清单（逐条实测，当前 HEAD 为准）

#### A. 阶段 1 基础修复

| 条目 | 正文验收标准 | 本轮实测 | 状态 |
| :--- | :--- | :--- | :--- |
| 1.1 Design Token 清理 | 删除零引用 alias，只保留 `--tjg-*` | `design-tokens.css` 现有 **263** 个变量定义，其中 **64** 个非 `--tjg-*` 前缀；**真实零引用（`var()` / UnoCSS `[--x]` / 裸用 全仓 0 次）= 0** | ⚠️ **无可直接删除项**——需做**传递引用分析**（仅被其它变量引用、而后者零引用）才可能有收获；本条实际收益已很低 |
| 1.2 内联样式迁移 | 核心视图 `style="` 为 0 | 全仓 **5**（全为 n-popover 参数，已裁定例外） | ✅ 完成（超出验收线） |
| 1.3 `!important` 收敛 | 收敛至 `NaiveProvider.vue` + 逐条注释 | 棘轮口径 **85**；分布：`login.scss` 26 / `chatHistory` 7 / `variable.scss` 6 / `emoticon` 6 / 其余零散 | ⚠️ 未达标（20 处属 reduced-motion 合规保留；其余需浏览器层叠回归） |
| 1.4 圆角 token 扩展 | 无 16px+ 字面量 | `hardcoded_radius = 0` | ✅ 完成 |
| 1.5 断点 token 化 | 新增 `--breakpoint-sm/md/lg/xl/2xl` | `design-tokens.css` 中 `--breakpoint-*` 定义数 = **0** | ❌ 未开工 |
| 1.5 无障碍扫描 | `@axe-core/vue` 扫描 | 依赖已在 `package.json` ✅；`SkipLink.vue` 存在 ✅；移动端路由未纳入 axe 覆盖面 | ⚠️ 部分完成 |

#### B. 阶段 2 联邦身份 + 液态玻璃

| 条目 | 正文要求 | 本轮实测 | 状态 |
| :--- | :--- | :--- | :--- |
| 2.1 `UserIdentity` 接入 | 会话列表 / 消息头 / 成员面板 / 好友详情 / 移动端 | 全仓引用 **仅 2 处，且都是自动生成的 typings** → 真实接入 **0** | ❌ **造好未接线** |
| 2.1 `RoomHomeserverLabel` 接入 | 房间名旁标注 homeserver | 同上，真实接入 **0** | ❌ **造好未接线** |
| 2.1 `FederationBadge` 接入 | `ChatHeaderRoot` / `RoomMembersPane` / `FriendDetailsSections` / 移动 `HeaderBar` | 已接 `RoomCardItem` / `RoomCard` / `RoomPreviewDialog` / `FriendDetailsSections` / `ChatHeaderInfo`；**移动端 `HeaderBar` 未接** | ⚠️ 部分完成 |
| 2.2 玻璃接入点收口 | 统一改用 mixin | 全仓裸 `backdrop-filter` / `backdrop-blur` **42 行、约 25 个文件**（`FooterOverlays` 3、`InfoEdit` 2、`FileUploadProgress` 2、`FooterToolbar` 2、移动 `tabBar` 2、`RtcCallFloatCell` 2、`variable.scss` 4…）；`@include liquid-glass` 仅 **11** 处 | ❌ 未达标 |
| 2.2 单视图 ≤3 处 | `grep -c backdrop-filter` ≤3 | 聊天视图 `chatBox/` 目录内 = **3**（刚达线）；但全视图统计仍超标 | ⚠️ 临界 |
| 2.2 `prefers-reduced-transparency` 兜底 | 可验证 | 仅存在于 `performanceTier.ts` 的 **JS `matchMedia` 判级**（经 `html.low-perf` 间接生效）；**CSS 层无对应 `@media` 兜底** | ⚠️ 间接达成 |
| 2.3 新组件 stories | 每个新 atomic 补 stories | `MxidText` ✅ / `FederationBadge` ✅ / `MessageLockBadge` ✅；**`SyncStatusBar` / `UserIdentity` / `RoomHomeserverLabel` 均缺** | ⚠️ 部分完成 |

#### C. 阶段 3 E2EE 可视化 + 安全 UI

| 条目 | 正文要求 | 本轮实测 | 状态 |
| :--- | :--- | :--- | :--- |
| 3.1 锁点击 → 设备验证 | 点击锁打开 `DeviceVerifyDialog` | `MessageLockBadge.vue` 有 `emit` / `verify` / `<button>`；`ChatMain.vue` 单例挂载 | ✅ 完成（第三轮） |
| 3.1 锁态真实判定 | verified / unverified / risk 三态可达 | `useMessageTrust.ts`（201 行）已接 `getUserDevices` + 安全默认 + `effectScope` | ✅ 完成 |
| 3.1 性能红线用例 | 1000 条消息断言设备查询次数 | 本轮未复核到对应断言用例 | ⚠️ **待核** |
| 3.2 信任声明文案 | `trust_notice.private_key_local` / `server_cannot_read` / `recovery.phrase_title` / `phrase_confirm` | zh-CN 与 en **四个键全部不存在**（`encryption.trust_notice.*` 与 `encryption.recovery.phrase_*` 无命中） | ❌ 未开工 |
| 3.3 企业预设服务器 | 以配置/环境变量注入的快捷项 | `isValidHttpUrl` ✅、well-known 发现 ✅；**企业预设项 0 命中** | ⚠️ 部分完成 |
| 3.4 共享 composable | `useDeviceSessionPanel.ts` | 文件**不存在**；桌面/移动仍各自查设备 | ❌ 未开工 |
| 3.4 信任链总览 | 本机 → 交叉签名 → 已信任设备数 | 全仓 `信任链` / `trustChain` 命中 **0** | ❌ 未开工 |
| 3.4 导出交叉签名 | 导出公钥 JSON/文本 | `exportCrossSigning` / `exportDevice` 命中 **0**（服务层有 `crossSigning` 能力 16 处，但无导出 UI） | ❌ 未开工 |

#### D. 阶段 4 同步 / 离线

| 条目 | 正文要求 | 本轮实测 | 状态 |
| :--- | :--- | :--- | :--- |
| 4.1 离线态常驻条 | `navigator.onLine` + `connectionState` 组合 | `SyncStatusBar.vue`（251 行）内 `navigator.onLine` / `offline` / `离线` 命中 **全为 0** | ❌ 未开工 |
| 4.1 未读刷新 | `CATCHUP → CONNECTED` 触发未读重算 | 全仓无该转换的未读重算钩子 | ❌ 未开工 |
| 4.1 横幅去重 | 与 `ChatBanners` 去重 | `ChatMain.vue` **同时渲染** `ChatBanners` 与 `SyncStatusBar` → 双横幅风险仍在 | ❌ 未开工 |
| 4.1 `RECONNECTING` 退避倒计时 | 「重连中（第 N 次）」+ 倒计时 | `retryCount` / `countdown` / `退避` 命中 **全为 0** | ❌ 未开工 |
| 4.1 自动收起 | CONNECTED 2s 淡出 | `autoHide` 命中 4 → 已实现 | ✅ 完成 |
| 4.2 离线缓存与历史可读 | persist 字段核查 / 离线首屏 / mock 测试 | `matrix.ts` persist `pick` 仍为 `['userId','deviceId','homeserverUrl','accessToken']`，**不含房间列表与消息**；无 mock 测试 | ❌ 未开工 |
| 4.3 视觉回归 | Chromatic 或等效 | 未接入 | ⚠️ 可选 |

#### E. 文档与门禁遗留

- **E1 文档内部语义残留**：第 606 行仍以 ⏸ 表述「移动端独立实现未落地」，与 644 行「功能上已覆盖」并存。建议把正文 4.1 的 `MobileSyncStatusBar.vue` 条目**显式注销**（复用唯一 `ChatMain.vue` 已是既定事实），消除歧义。
- **E2 `biome check` 仍 3 error**，全部 HEAD 既有 / 并行 WIP（`matrix-extensions.d.ts`、`MatrixEncryptionContextService.test.ts`、`MessageLockBadge.vue`），**非本专项引入**，建议单独一批处理。
- **E3 `encryption.backup_restore_dialog.*`**：zh-CN 与 en **均已有 32 键**（键存在），缺口在**文案内容**，需产品文案。
- **E4 i18n 基线可再收紧**：`check-i18n-refs` 已降至 `unresolved 273（基线 280）`，且输出提示 `unresolved.mobile_devices: 0（基线 7）` → 可执行 `--update` 收紧基线，防止倒退。

### 7.3 下一步优化建议（按「价值/风险比」排序）

**P0 — 组件已造好却零调用，属纯接入，价值最高、风险最低**

1. **把 `UserIdentity` / `RoomHomeserverLabel` 接进真实界面**（阶段 2 的「联邦特性看得见」目前**实际未达成**）。
   - 建议接入点：成员面板 `RoomMembersPane.vue`、好友详情 `FriendDetailsSections.vue`、移动 `HeaderBar.vue`、会话列表 `RoomCardItem.vue`。
   - 硬约束：MXID/域名解析必须走 `@/utils/userIdentity`（`toLocalpart` / `extractServerName` / `resolveFederationPeer`），`UserIdentity` 内部禁止再自解析（第二轮的 `MxidText` 就犯过这个错）。
   - 配套：给两组件补 `.stories.ts`（顺带清掉 2.3 的两项缺口）。
2. **补齐信任声明文案 4 键**（阶段 3.2）：`encryption.trust_notice.private_key_local`、`encryption.trust_notice.server_cannot_read`、`encryption.recovery.phrase_title`、`encryption.recovery.phrase_confirm`（zh-CN + en）。纯文案 + i18n，是安全合规的必答题，零架构风险。

**P1 — 棘轮验收线（本专项的自然延续）**

3. **`important_css 85 → 69`**：可安全下降的正好 **16 处** = 7 个 `settings-tabs/*.vue` 各自重复的 reduced-motion 块（**实测 7 文件 × 2 处 = 14**）+ `TjgSpaceTree.vue` 2 处。
   - **注意：正文此前设想的「→60」不可达**——实测可判定冗余只有 16 处，其余（`login.scss` 26、`variable.scss` 6、`form-item.scss` 4 等库覆盖链与 `.no-select` 对抗链）**必须用真实浏览器做层叠回归**才能继续下降，本环境无法验证。建议把目标修正为 **69**，并同步收紧基线。
   - 做法：把 7 个 settings-tabs 的 `.rs-tab *` reduced-motion 块抽成**共享 partial**，规则移入真正需要它的组件 scoped 块（避免 `@use` 暴露成全局规则——本仓已有此类静默泄漏先例）。
4. **补 `--breakpoint-*` token**（阶段 1.5）：在 `design-tokens.css` 新增 `--breakpoint-sm/md/lg/xl/2xl`。**务必遵守**：媒体查询内必须写字面值，token 仅用于 JS 侧 `matchMedia`（此约束已写入正文 1.5，实施时不要写成 `@media (min-width: var(--breakpoint-md))`）。
5. **玻璃接入点收口**（阶段 2.2）：42 处裸 `backdrop-filter` 统一改走 `@include liquid-glass(...)`。建议先收口**移动端 `tabBar` / `navBar`**（Vant 侧、改动面小、视觉可预期），再按目录逐批推进；每批独立提交便于视觉回归定位。

**P2 — 功能缺口（需产品/设计确认后再开工）**

6. **4.2 离线缓存**：扩 `matrix.ts` persist `pick`（房间列表 + 最近消息），定案离线历史来源（SQLite vs `MatrixCacheManager`），并补「`navigator.onLine = false` → 渲染缓存 + 不发网络请求」的测试。**前提**：需先确认 Tauri 侧 `src-tauri/src/repository/im_message` 的可用性。
7. **4.1 `SyncStatusBar` 补四项**：离线常驻条、`RECONNECTING` 退避倒计时、与 `ChatBanners` 去重（避免双横幅）、`CATCHUP → CONNECTED` 未读刷新钩子。
8. **3.4 设备会话面板**：抽 `useDeviceSessionPanel.ts` 统一取数 → 桌面 `DeviceTrustManager` / 移动 `DeviceManagement` 改为纯展示 → 再加「信任链总览」与「导出交叉签名（仅公钥）」。**注意**：移动端设备面板**仅展示**，管理写操作仅限管理后台（已入项目铁律）。
9. **收尾**：E1 文档注销 `MobileSyncStatusBar` 条目、~~E2 单独一批清 `biome` 3 error~~ → **已失效**（0 error）、~~E4 执行 `check-i18n-refs --update` 收紧基线~~ → **已执行**。

**建议的推进顺序（可并行两线）：**
- 线 A（纯接入/文案，低风险）：第 1、2 项 → 第 9 项收尾。
- 线 B（棘轮/视觉）：第 3、4、5 项。
- 线 C（功能缺口，需前置确认）：第 6、7、8 项。

---

## 第八轮执行记录（2026-09-21）：联邦身份接线落地 + 信任声明文案

承接 7.3 的 **P0 第 1、2 项**（本次全部完成），并在过程中抓到 3 个新的**方法论级**问题。

### 8.1 完成项

| # | 项 | 落地位置 | 守卫 |
|---|---|---|---|
| 1 | `UserIdentity` 接入**成员面板** | `rightBox/RoomMembersPane.vue`（在册 + 已禁言两类行） | `RoomMembersPane.test.ts` 新增 `describe('RoomMembersPane 联邦身份接线')` 5 例 |
| 2 | `UserIdentity` 接入**好友详情** | `rightBox/FriendDetailsSections.vue`（替换原「MxidText + 独立 badge 行」双块） | `FriendDetailsSections.test.ts` 断言组合单元同时带 mxid + chip 且无内嵌头像 |
| 3 | `RoomHomeserverLabel` 接入**移动 HeaderBar** | `mobile/components/chat-room/HeaderBar.vue`（新增 `roomServer` prop）+ `MobileChatMain.vue` 传 `:room-server="federationServer"` | `HeaderBar.identity.test.ts`（新建，6 例） |
| 4 | `RoomHomeserverLabel` 接入**会话列表** | `room/RoomCardItem.vue`（meta 行，`data-testid="room-card-server"`） | `RoomCardItem.test.ts` 2 例（本地域 / 远端域各一） |
| 5 | 补 2 个 stories | `common/UserIdentity.stories.ts`、`room/RoomHomeserverLabel.stories.ts`（各 5–7 例，含 AllDark） | `vue-tsc`（`src/**/*.ts` 覆盖 `.stories.ts`） |
| 6 | 信任声明 4 键 | `locales/{zh-CN,en}/encryption.json` 的 `trust_notice.private_key_local` / `server_cannot_read` / `recovery.phrase_title` / `phrase_confirm` + `src/typings/i18n.d.ts` 重生成 | `check-i18n`（键集合对齐）、`sourceRefs` 新鲜度 |

**硬约束遵守情况**：所有 MXID / 域名解析一律走 `@/utils/userIdentity`。`FriendDetailsSections.vue` 顺带**删除**了自己实现的 `isFederatedUser`（`resolveFederationPeer` 调用），联邦判定改由 `UserIdentity` 内部 `sameHomeserver` 完成，组件只提供 `localDomain` 作为对照基准 —— 消除了一处「同一语义两处实现」。

**顺带修的既有隐患**：`RoomHomeserverLabel.vue` 内 `computed` 名 `serverName` 与同名 prop **遮蔽**（可读性/真值陷阱），改名 `resolvedServerName` 并补 `data-testid`。

**变异自证（守卫类改动必做）**：
- 移除 HeaderBar 的 `<RoomHomeserverLabel>` → 5 例 FAIL；
- `:local-server="localDomain"` 置空 → 1 例 FAIL（联邦判定）；
- 移除 `FriendDetailsSections` 的 `<UserIdentity>` 块 → 3 例 FAIL；
- 同上但只置空 `:local-server` → 1 例 FAIL。
全部还原后 9/9、28/28 复绿。

### 8.2 新发现（方法论级，值得沉淀）

**F1 「自洽桩」反模式第 4 例（真实、且被守卫抓到）**
`SingleDetails.test.ts` 手写 i18n 映射表里声明 `friend.detail.federated_user` / `friend.detail.local_user`，而 `UserIdentity` 用的是 **`friend.federated_user` / `friend.local_user`**（无 `.detail`）。真实语言表**两个键都健全**（`friend.json` 的 `detail.federated_user` 与顶层 `federated_user`）—— 也就是说**生产无缺陷，是桩过期**。症状与前三例（`RenderPollMessage` / `SyncStatusBar` / `KeyBackupRestoreDialog`）完全一致：断言拿到**裸 key**。
> **判据**：手写桩的键必须逐个回真实语言表核对；只要桩里出现原型链外的键，就优先怀疑桩而非源码。已按铁律改用 `createI18nMock()` + `resolveMessage()`。

**F2 `sourceRefs.test.ts` 的 `STUB_REFS` 计数阈值是「被反模式撑起来的」**
原自检：`expect(STUB_REFS.length).toBeGreaterThan(100)`。这个数**随反模式存量上升**，而本守卫的诉求正是消除反模式 —— 本次 120 → 61，于是**「修得越对、守卫越红」**，甚至反向激励保留错键桩。这是**带刺的棘轮**：门槛设在被测对象的存量上，而不是设在机制本身。
> **修法**：改为**合成夹具自证** —— 用一段内联 fixture 钉住「找 `vi.mock('vue-i18n')` 块 → 括号配对 → 取带点键」这条链路（含 `leaked.key` 反向探针，配对写错即报警）。夹具恒定、机制恒定，反模式清零导致计数归零也不误报。
> **连带坑**：夹具写在守卫文件自身里，会被收集器当成**真实**桩键扫走（`a.b.c` / `leaked.key` 报 2 个越界）→ 收集器必须排除本文件。两处改动都做了变异自证（配对退化 / 去掉自排除，均正确 FAIL）。

**F3 i18n.d.ts 新鲜度守卫在**并行 WIP** 下会瞬态变红（非缺陷）**
守卫用**当前工作区**的 `locales/zh-CN/*.json` 计算 expected，而并行会话往 `menu.json` 加了 `manage_friend_groups` → 长度差 36 字符报警。**实测**：临时 `git checkout HEAD -- locales/zh-CN/menu.json` 后该文件 **18/18 全绿**。
> **结论**：不是缺陷。我的提交只含「HEAD 语言表 + 自己的 encryption 键」，clean checkout 下自洽（绿）。
> **规则（建议入铁律）**：并行 WIP 在场时，**禁止**为了「让门禁当场变绿」把别人的键抄进自己的 `i18n.d.ts` —— 那会让我的提交在干净检出上**反而**变红（i18n.d.ts 有键、menu.json 无键）。正确做法是保留瞬态红并留证。

### 8.3 遗留修正与待办更新

- **E2 已失效（注销）**：原文记「`biome check` 仍 3 error」。本次实测 `biome check` = **0 error / 2 info**（配置版本提示 2.5.6→2.5.12 + `MessageLockBadge.vue:118` 的 `useShorthandFunctionType` 建议：`(e: 'verify'): void` 可改写为函数类型），**全仓已无 lint error**。该项已从待办移除。
- **E4 已执行**：`check-i18n-refs --update` 已运行，基线从 `unresolved 280` 降至 **273**，`mobile_devices` 命名空间从基线表中移除（原 7 个已清零）。当前门禁：`unresolved 273 / fallback 7` 均与基线一致。
- **`important_css` 目标维持 85 → 69**（可判定冗余 16 处），正文「→60」**仍不可达**——实测可安全下降只有 16 处，其余是库覆盖链与 `.no-select` 对抗链，必须浏览器层叠回归。
- 7.3 的 P1/P2（`--breakpoint-*`、玻璃收口、离线缓存、`SyncStatusBar` 四项、设备会话面板）**全部未动**，仍是下一步主体。



