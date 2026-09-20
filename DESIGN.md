# TJG (HuLa IM) Design System

> **Token 前缀说明（重要）**：本设计系统的 CSS 自定义属性前缀为 **`--tjg-`**。
> 历史文档中出现的 `--hula-*` 前缀**在当前代码库中已全部不存在**（`grep -rn "\-\-hula-" src` 命中 0 次）。
> 若你在旧文档、旧 PR 或设计稿中看到 `--hula-*`，请一律按本文档的 `--tjg-*` 对应项替换。

**权威事实源：**

| 内容 | 文件 |
|:---|:---|
| Design Token（唯一来源） | `src/styles/css/design-tokens.css` |
| 旧别名层（废弃中） | `src/styles/css/design-tokens.css` § Backward-Compatible Aliases |
| 原型设计稿 | `docs/TJG-prototype.html` |
| 界面设计说明（原型差异核对） | `docs/ui-design-spec.md` |
| 响应式断点（SCSS） | `src/styles/scss/global/responsive.scss` |
| 响应式断点（UnoCSS） | `uno.config.ts` § theme.breakpoints |
| 液态玻璃 mixin | `src/styles/scss/mixins/_liquid-glass.scss` |
| 身份/MXID 解析 | `src/utils/userIdentity.ts` |
| 守门脚本 | `scripts/check-ratchet.mjs` / `check-doc-coverage.mjs` / `check-sdk-boundary.mjs` |

**近期关键更新（2026-09-19）：**

- `--tjg-radius-xl` / `-2xl` / `-3xl` 及语义别名（`-surface` / `-panel` / `-sheet`）已写入 `design-tokens.css`
- 联邦身份、加密信任、同步状态、液态玻璃四组 token 已写入 `design-tokens.css`
- `check:ratchet` 基线从 48 降至 **31**（admin 模块部分硬编码颜色已被迁移）

---

## Design Principles

1. **Dark & Light as Equal Citizens** — 每个组件必须在两种主题下正确渲染。默认跟随系统偏好。
2. **Tokens, Not Hardcoded Values** — 所有颜色、间距、圆角、阴影引用 `src/styles/css/design-tokens.css` 中的 `--tjg-*` 变量。硬编码颜色由 `pnpm check:ratchet` 强制拦截（基线只减不增）。
3. **Naive UI (Desktop) + Vant (Mobile)** — 基础 UI 库。自定义组件是补充而非替代。
4. **Empty States Are Features** — 每个列表、面板、视图都有设计过的空态（图标 + 标题 + 描述 + CTA）。使用 `src/components/common/EmptyState.vue`。
5. **Accessibility by Default** — 键盘导航、ARIA landmarks、`prefers-reduced-motion`、移动端 ≥44px 触控目标。
6. **状态不只靠颜色传达** — 联邦、加密、同步等状态必须有文本或形状差异（`.rules` UI 规范硬要求）。
7. **图标必须是 SVG** — 禁止 div 拼图标；线宽统一 `stroke-width="1.5"`。
8. **组件体量红线** — 任何 `.vue` 超过 800 行必须拆分。

---

## Token Architecture

`design-tokens.css` 的实际结构（与早期文档描述不同，以此为准）：

```
Layer 1  --tjg-* 基础与语义 token     ← 唯一权威，新代码只允许使用这一层
         浅色定义在 :root
         深色覆盖在 html[data-theme='dark']

Layer 2  Backward-Compatible Aliases   ← 已废弃，正在清理
         形如 --text-color: var(--tjg-text-primary)
         它们指向 --tjg-*，不是独立设计层

Layer 3  组件级局部变量                  ← 组件内部私有，不跨组件复用
```

### Layer 2 别名层的真实使用情况（2026-09-19 实测）

旧文档把别名层描述为"第三层语义 token"，这是**不准确**的。实测引用数：

| 别名 | 引用数 | 状态 |
|:---|:---|:---|
| `--app-bg-color` | 0 | 死代码，可删 |
| `--center-bg-color` | 0 | 死代码，可删 |
| `--chat-left-bg` | 0 | 死代码，可删 |
| `--chat-right-bg` | 0 | 死代码，可删 |
| `--text-color` | 1 | 待迁移 |
| `--right-bg-color` | 2 | 待迁移 |
| `--left-bg-color` | 3 | 待迁移 |
| 其余（约 60 个） | 0 | 死代码，可删 |

**规则：**
- 新代码**禁止**引用 Layer 2 别名，直接使用 `--tjg-*`。
- 清理别名时必须先 `grep -rn "var(--<name>)" src` 取证零引用，逐条删除，不得批量一刀切。
- `--shadow-enabled` 不属于别名层，是**运行时开关**（见 Shadows 节），不得删除。

---

## Color System

### Brand

| Token | Value | Usage |
|:---|:---|:---|
| `--tjg-brand` | `#13987f` | 主按钮、链接、激活态、徽标 |
| `--tjg-color-primary-500` | `var(--tjg-brand)` | 语义主色（等同 brand） |
| `--tjg-color-primary-400` | `#1ab292` | Hover |
| `--tjg-color-primary-600` | `#0f7a66` | Pressed |
| `--tjg-color-primary-700` | `#0a5c4d` | 强调/深色底 |
| `--tjg-color-primary-50/100/200` | `rgba(19,152,127,.08/.1/.2)` | 浅底、选中背景 |

> 注：旧文档中的 `--hula-brand-sidebar`（`#64a29c`）**不存在**。侧边栏背景请使用 `--tjg-surface-sidebar`。

### Functional Colors

| Role | 浅色 | 深色 | Token |
|:---|:---|:---|:---|
| Success | `#52c41a` | `#73d13d` | `--tjg-color-success-500` |
| Warning | `#faad14` | `#ffa940` | `--tjg-color-warning-500` |
| Danger | `#ff4d4f` | `#ff7875` | `--tjg-color-danger-500` |
| Info | `#1890ff` | `#40a9ff` | `--tjg-color-info-500` |
| Beta | `#a789d9` | `#a789d9` | `--tjg-color-beta-500` |
| Purple | `#722ed1` | `#9254de` | `--tjg-color-purple-500` |

### Neutral Surfaces

| Layer | Token | 浅色 | 深色 |
|:---|:---|:---|:---|
| 应用背景 | `--tjg-surface-app` | `#fafafa` | `#161616` |
| 面板/会话列表 | `--tjg-surface-panel` | `#ffffff` | `#313338` |
| 列表面板 | `--tjg-surface-list` | `#f7f7f7` | `#2b2d31` |
| 侧边栏 | `--tjg-surface-sidebar` | `#f3f3f3` | `#1e1f22` |
| 次级面板 | `--tjg-surface-panel-muted` | `#f5f5f5` | `#262626` |
| 我的气泡 | `--tjg-bubble-sent-bg` | `#0f7a66` | `#0f7a65` |
| 对方气泡 | `--tjg-bubble-received-bg` | `var(--tjg-surface-elevated)` | `#355b55` |

### 业务语义色

| 用途 | Token |
|:---|:---|
| 房间卡 — 普通群聊左边条 | `--tjg-room-card-group-accent` |
| 房间卡 — 加密群聊左边条/描边 | `--tjg-room-card-encrypted-accent` / `--tjg-room-card-encrypted-border` |
| 房间卡 — 联邦群聊左边条/描边 | `--tjg-room-card-federated-accent` / `--tjg-room-card-federated-border` |
| 未读徽标 | `--tjg-room-unread-badge-bg` |
| 搜索命中高亮 | `--tjg-mark-highlight-bg` |

### 联邦身份（Matrix Federation）

| 用途 | Token | 浅色值 | 深色值 |
|:---|:---|:---|:---|
| 本地服务器强调色 | `--tjg-federation-local-accent` | `#13987f` | `#1ab292` |
| 远端服务器强调色 | `--tjg-federation-remote-accent` | `#1890ff` | `#40a9ff` |
| 远端域名 chip 背景 | `--tjg-federation-remote-bg` | `rgba(24,144,255,0.08)` | `rgba(64,169,255,0.12)` |
| 远端域名 chip 描边 | `--tjg-federation-remote-border` | `rgba(24,144,255,0.2)` | `rgba(64,169,255,0.25)` |
| MXID 次级文字 | `--tjg-identity-mxid-color` | `#737373` | `#858585` |

**使用示例：**
```vue
<!-- 联邦域名 chip -->
<n-tag :style="{ background: 'var(--tjg-federation-remote-bg)', borderColor: 'var(--tjg-federation-remote-border)', color: 'var(--tjg-federation-remote-accent)' }" size="small">
  {{ serverDomain }}
</n-tag>
```

### 加密信任状态（E2EE）

| 状态 | Token | 浅色值 | 深色值 | 视觉含义 |
|:---|:---|:---|:---|:---|
| 已验证 | `--tjg-status-encryption-verified` | `#52c41a` | `#73d13d` | 绿锁：加密已验证，安全连接 |
| 未完全验证 | `--tjg-status-encryption-unverified` | `#faad14` | `#ffa940` | 黄锁：设备未交叉认证，但连接加密 |
| 存在风险 | `--tjg-status-encryption-risk` | `#ff4d4f` | `#ff7875` | 红锁：存在安全风险（设备丢失 / 密钥不一致） |
| 风险外环 | `--tjg-status-encryption-risk-ring` | `#ff4d4f` | `#ff7875` | 仅用于红色外环 SVG stroke，形状与颜色双重区分 |

**规则：**
- 三态必须同时使用**颜色 + SVG 形状**区分，不能仅靠颜色（满足 a11y 要求）。
- 映射函数唯一，禁止组件内联 `switch`；统一在 `src/components/encryption/EncryptionStatus.vue` 中。
- 明文房间不渲染锁，避免噪声。

### 同步状态

| 用途 | Token | 浅色值 | 深色值 |
|:---|:---|:---|:---|
| 进度条轨道背景 | `--tjg-sync-track-bg` | `var(--tjg-surface-subtle)` | `var(--tjg-surface-subtle)` |
| 进度条填充 | `--tjg-sync-fill-bg` | `#13987f` | `#1ab292` |
| 不确定进度背景 | `--tjg-sync-indeterminate-bg` | `var(--tjg-surface-subtle)` | `var(--tjg-surface-subtle)` |
| 离线提示背景 | `--tjg-sync-offline-bg` | `var(--tjg-surface-panel)` | `var(--tjg-surface-panel-muted)` |
| 离线提示文字 | `--tjg-sync-offline-text` | `#737373` | `#858585` |

**使用示例：**
```css
/* 顶部状态条 */
.sync-bar {
  background: var(--tjg-sync-offline-bg);
  color: var(--tjg-sync-offline-text);
  /* 进度条使用 --tjg-sync-track-bg / --tjg-sync-fill-bg */
}
```

**不存在的 token（不要引用）：** `--tjg-font-weight-normal`（请用浏览器默认字重）、`--tjg-space-7`、`--tjg-space-9`、`--tjg-space-10`、`--hula-*` 全部前缀。

---

## Typography

字体族（`--tjg-font-family`）：

```
'PingFang', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
```

等宽字体（`--tjg-font-family-mono`）：`'SF Mono', Monaco, 'Cascadia Code', monospace`
（MXID、房间 ID、设备 ID、指纹必须用等宽字体）。

| Token | Size | Usage |
|:---|:---|:---|
| `--tjg-font-size-xs` | 10px | 徽标、时间戳 |
| `--tjg-font-size-2xs` | 11px | 辅助文字（原型 11px） |
| `--tjg-font-size-sm` | 12px | 说明、元数据 |
| `--tjg-font-size-md` | 13px | 气泡正文（原型 13px） |
| `--tjg-font-size-base` | 14px | 正文 |
| `--tjg-font-size-2lg` | 15px | 标题（原型 15px） |
| `--tjg-font-size-lg` | 16px | 副标题、输入框 |
| `--tjg-font-size-xl` | 18px | 区块标题 |
| `--tjg-font-size-2xl` | 20px | 面板标题 |
| `--tjg-font-size-3xl` | 24px | 页面标题 |

字重 token：`--tjg-font-weight-medium`(500)、`--tjg-font-weight-semibold`(600)、`--tjg-font-weight-bold`(700)。

> 注：**没有** `--tjg-font-weight-normal`(400)。常规字重直接继承浏览器默认，不要引用不存在的 token。
> 行高 token：`--tjg-line-height-tight`(1.25)、`--tjg-line-height-normal`(1.5)。

---

## Spacing

4px 基准刻度，**共 8 档（非旧文档描述的 1-10）**：

| Token | Value |
|:---|:---|
| `--tjg-space-1` | 4px |
| `--tjg-space-2` | 8px |
| `--tjg-space-3` | 12px |
| `--tjg-space-4` | 16px |
| `--tjg-space-5` | 20px |
| `--tjg-space-6` | 24px |
| `--tjg-space-8` | 32px |

> 注意：**不存在 `--tjg-space-7` 与 `--tjg-space-9/10`**。需要 40px 时使用 `--tjg-space-8` 组合或定义新 token（需评审）。

---

## Border Radius

| Token | Value | Usage |
|:---|:---|:---|
| `--tjg-radius-xs` | 4px | 小控件、tag |
| `--tjg-radius-sm` | 8px | 输入框、小按钮 |
| `--tjg-radius-md` | 10px | 卡片 |
| `--tjg-radius-lg` | 12px | 弹窗、抽屉（历史默认） |
| `--tjg-radius-xl` | 16px | **大圆角基准**（产品规格最低要求） |
| `--tjg-radius-2xl` | 20px | 大面板、Hero |
| `--tjg-radius-3xl` | 24px | 移动端底部抽屉 |
| `--tjg-radius-full` | 9999px | 头像、胶囊 |

> ✅ **已落地**：`--tjg-radius-xl` / `-2xl` / `-3xl` 及三个语义别名已写入 `design-tokens.css`（2026-09-19）。

**语义别名（业务代码优先使用）：**

| 别名 | 指向 | 适用面 |
|:---|:---|:---|
| `--tjg-radius-surface` | `--tjg-radius-xl` | 聊天气泡、卡片 |
| `--tjg-radius-panel` | `--tjg-radius-2xl` | 面板、侧栏、弹层 |
| `--tjg-radius-sheet` | `--tjg-radius-3xl` | 移动端底部抽屉 |

**规则：** 产品要求"全界面 16dp 以上大圆角"，因此**新增界面不得使用 `--tjg-radius-lg`(12px) 及以下**作为容器圆角，`xs/sm/md` 仅用于小控件。

**使用示例：**
```css
/* 聊天气泡（使用语义别名） */
.msg-bubble {
  border-radius: var(--tjg-radius-surface);  /* 16px */
}

/* 浮动面板（使用大圆角） */
.floating-panel {
  border-radius: var(--tjg-radius-panel);   /* 20px */
  background: var(--tjg-surface-panel);
  box-shadow: var(--tjg-glass-shadow);
}

/* 移动端抽屉 */
.mobile-drawer {
  border-radius: var(--tjg-radius-sheet) var(--tjg-radius-sheet) 0 0;  /* 24px */
}
```

---

## Shadows

阴影通过运行时开关 `--shadow-enabled` 控制（`1` = 显示，`0` = 隐藏），由 `src/App.vue` 按用户偏好写入 `<html>`（关闭阴影偏好时设为 `0`）。声明位置：`design-tokens.css`。

| Token | 用途 |
|:---|:---|
| `--tjg-shadow-sm` | 微阴影、浮起元素 |
| `--tjg-shadow-md` | 卡片浮起 |
| `--tjg-shadow-lg` | 大面板 |
| `--tjg-shadow-border` | 0 模糊描边式阴影 |
| `--tjg-shadow-card` / `--tjg-shadow-card-hover` | 卡片常态/悬停 |
| `--tjg-shadow-dropdown` | 下拉菜单 |
| `--tjg-shadow-top-bar` | 顶部栏 |
| `--tjg-shadow-floating-menu` | 悬浮菜单（含内描边） |

深色主题下阴影使用更高不透明度（定义在 `html[data-theme='dark']`）。

---

## Motion

| Duration | Token | Usage |
|:---|:---|:---|
| 120ms | `--tjg-motion-duration-fast` | 微交互 |
| 180ms | `--tjg-motion-duration-normal` | Hover 过渡 |
| 240ms | `--tjg-motion-duration-slow` | 面板过渡 |
| 280ms | `--tjg-motion-duration-overlay` | 弹窗、遮罩 |
| 500ms | `--tjg-motion-duration-xslow` | 强调动画 |
| 800ms | `--tjg-motion-duration-2xslow` | 长动画 |

缓动：`--tjg-motion-ease-standard` `cubic-bezier(0.2, 0, 0, 1)`、`enter` `cubic-bezier(0, 0, 0, 1)`、`exit` `cubic-bezier(0.4, 0, 1, 1)`。
按压缩放：`--tjg-motion-scale-active`(0.97)。

**`prefers-reduced-motion` 已全局兜底**（`design-tokens.css` 末尾）：所有 `animation-duration` / `transition-duration` 被压至 `0.01ms`。组件无需重复声明动画时长兜底，但**不得**用 JS 绕过该策略。

---

## Theme Switching

主题由 `src/stores/domains/settings/setting.ts` 管理：

- **Pattern**（`themePattern`）：用户偏好 — `'light'` | `'dark'` | `'os'`（跟随系统），`ThemeEnum` 定义于 `src/enums/app.ts`。
- **Content**（`themeContent`）：解析后的实际主题 — 始终为 `'light'` 或 `'dark'`。
- **切换动作：** `document.documentElement.dataset.theme = 'light' | 'dark'`（实现见 `src/stores/domains/settings/settings-helpers.ts`）。
- **Naive UI：** `<n-config-provider :theme="globalTheme">`，实现位于 `src/components/common/NaiveProvider.vue`。
- **Vant：** `<van-config-provider :theme="...">`，实现位于 `src/mobile/components/MobileLayout.vue`。
- **UnoCSS：** dark variant 基于 `[data-theme="dark"]` 选择器。

### 给新组件加暗色支持

```vue
<template>
  <!-- 优先：语义 token -->
  <div class="my-component bg-[--tjg-surface-panel] text-[--tjg-text-primary]">
    <!-- 次选：UnoCSS dark: variant（颜色仍须是 token） -->
    <div class="bg-[--tjg-surface-app] dark:bg-[--tjg-surface-panel]">
      <!-- 禁止：dark:bg-[#1b1b1b] 这类硬编码 -->
    </div>
  </div>
</template>
```

**规则：**
- 优先引用既有语义 token；**不要**写 `dark:bg-[#1b1b1b]` 这类字面量（会被 `check:ratchet` 拦截）。
- 仅当某个颜色在 **3 个以上组件**复用时，才新增 token。浅色写在 `:root`，深色写在 `html[data-theme='dark']`。

---

## Composition Patterns

### 用户身份展示（Matrix 联邦）

所有需要展示用户的地方，使用统一的两级标识结构，禁止自行解析 MXID。

```
[头像]  主标识（displayname，回退 localpart）  [远端域名 chip]
        @localpart:server  ← 等宽字体、单行截断、title 给全量值
```

规则：

- **主标识**：`displayname` → 回退 `toLocalpart(mxid)`。
- **次级标识**：完整 MXID，`--tjg-font-family-mono`，超出用 `text-overflow: ellipsis`，`title` 属性给全量值。
- **联邦 chip**：仅当 `isFederated` 为真时渲染（本地用户不加 chip，避免列表噪声）。
- 窄容器（`@container (max-width: 220px)`）下隐藏 chip，保留主标识。
- **所有 MXID / 域名解析必须经 `src/utils/userIdentity.ts`**（`toLocalpart` / `extractServerName` / `normalizeMatrixUserId` / `sameHomeserver` / `resolveFederationPeer` / `resolveDmIdentityKey`）。
- chip 必须有可见文本（域名本身即文本），并带 `aria-label`。

### 房间联邦标识

- 房间 server name 与本地 homeserver 不一致即视为联邦房间。
- 判据来源：`extractServerName(roomId)` 与 `extractServerName(currentUserId)` 比较（既有实现见 `ChatHeaderRoot.vue`）。
- 视觉：房间名旁展示远端域名标签；房间卡使用 `--tjg-room-card-federated-accent` 左边条。

### 消息加密锁（三色）

- 锁态由 `TrustLevel`（`verified` | `unverified` | `blocked`）映射而来，映射函数**必须唯一**，禁止组件内联 `switch` 颜色。
- 三态使用**不同 SVG 形状**（闭合锁 / 开口锁 / 锁+感叹号），并结合颜色与外环，满足"不只靠颜色传达状态"。
- 三态各有独立 `aria-label` 与 tooltip 文案。
- **明文房间不渲染锁**，避免噪声。
- 点击锁 → 打开既有 `DeviceVerifyDialog`，不新增验证流程实现。
- 性能：时间线场景必须按 `(userId, deviceId)` 缓存信任级别，禁止逐消息发起请求。

### 加密状态横幅（房间级）

- **首次进入加密房间：** E2EE 横幅（锁图标 + 说明 + 可关闭），组件 `src/components/chat/E2EEBanner.vue`。
- **关闭后：** 聊天头部展示小锁图标，tooltip 说明端到端加密。
- **未加密房间：** 不展示任何指示。
- 房间级状态枚举为 `encrypted` | `unencrypted` | `unknown` | `error`，组件 `src/components/encryption/EncryptionStatus.vue`。

### 同步与离线状态

- 顶部状态条展示与 homeserver 的连接/同步状态，状态事实源为 `ConnectionState`：
  `DISCONNECTED` | `CONNECTING` | `CONNECTED` | `RECONNECTING` | `CATCHUP` | `ERROR`（定义于 `src/services/matrix/MatrixConnectionManager.ts`）。
- `CONNECTED` 为正常态，不展示状态条；其余状态展示，`ERROR` 附重试入口。
- 离线（`navigator.onLine === false`）时展示"离线模式：显示本地缓存消息"，使用 `--tjg-sync-offline-*` token：
  - 背景：`var(--tjg-sync-offline-bg)`（浅色 `var(--tjg-surface-panel)` / 深色 `var(--tjg-surface-panel-muted)`）
  - 文字：`var(--tjg-sync-offline-text)`（浅色 `#737373` / 深色 `#858585`）
- **注意：** 旧文档与 `.rules` 中提到的 `SYNCING` / `SYNCED` 状态在当前代码中**不存在**；如需补齐属 SDK 边界变更，需单独立项。

### 液态玻璃（Liquid Glass）

- `backdrop-filter` **仅用于面板级元素**，每个视图最多 3 处（既有 mixin 注释中的性能约束）。
- **禁止**用于列表项与消息行。聊天气泡使用"半透明 + 微描边 + 微阴影"的轻玻璃观感。
- 使用 mixin：`@use '@/styles/scss/mixins/liquid-glass' as *;` 然后 `@include liquid-glass;`（面板）或 `@include liquid-glass-subtle;`（气泡）。
- 必须同时 `@include liquid-glass-fallback;`：`html.low-perf` 下关闭模糊并回退纯色。
- `html.low-perf` 由性能分级工具在启动时写入（低核心数 / 低内存 / 触屏 / 用户要求减少透明度）。
- **Token 驱动的透明度**（2026-09-19 已写入 `design-tokens.css`）：

| Token | 默认值（浅色） | 默认值（深色） | 用途 |
|:---|:---|:---|:---|
| `--tjg-glass-blur` | `20px` | `20px` | `backdrop-filter: blur()` 半径 |
| `--tjg-glass-saturate` | `1.8` | `1.8` | `saturate()` 倍数 |
| `--tjg-glass-panel-opacity` | `0.85` | `0.8` | 面板级背景不透明度 |
| `--tjg-glass-nav-opacity` | `0.85` | `0.8` | 导航级背景不透明度 |
| `--tjg-glass-bubble-opacity` | `0.7` | `0.65` | 气泡级背景不透明度 |
| `--tjg-glass-border` | `1px solid rgba(255,255,255,0.06)` | `1px solid rgba(255,255,255,0.08)` | 玻璃描边 |
| `--tjg-glass-shadow` | `0 8px 32px rgba(0,0,0,0.12)` | `0 8px 32px rgba(0,0,0,0.24)` | 浮动阴影 |

- `backdrop-filter` 的模糊效果由 `var(--tjg-glass-blur)` 和 `var(--tjg-glass-saturate)` 控制，动态修改只允许调整这些变量。
- 使用 mixin 时，`--tjg-glass-*-opacity` 通过 `color-mix(in srgb, var(--tjg-surface-panel) #{$opacity * 100%}, transparent)` 实现混合。

### Empty States

使用 `src/components/common/EmptyState.vue`：图标（SVG）+ 标题 + 描述 + 可选 CTA。**永远不要**展示空白列表。
Admin 场景：过滤后无结果用 `variant="subtle"`，首次使用面板用 `variant="welcome"`。

### Loading Skeletons

- 列表初次加载：`src/components/common/SkeletonList.vue`
- 单块内容：`src/components/common/SkeletonBase.vue`（如 `<SkeletonBase variant="text" width="60%" />`）

### Message Actions

- **Desktop：** 悬停消息气泡显示操作栏（表情回应、回复、转发、复制、删除）。右键打开完整上下文菜单（含子菜单）。
- **Mobile：** 长按（700ms）在网格模式触发上下文菜单。

### Space Navigation

- **默认：** 递归树组件 `src/components/space/SpaceTree.vue`（`role="tree"` / `treeitem`、`aria-expanded`、`aria-level`，支持键盘导航）。
- **工作台变体：** `src/components/workbench/TjgSpaceTree.vue`（按需拉取子节点，含加载与空态）。
- **骨架态：** `src/components/common/SkeletonSpaceTree.vue`。
- **备选：** 扁平列表切换，适合浅层级。

---

## Responsive Breakpoints

**统一断点（SCSS 与 UnoCSS 已对齐，但两者各自维护，改动需同步）：**

| 名称 | 值 | SCSS | UnoCSS |
|:---|:---|:---|:---|
| sm | 576px | `respond-to('sm')` | `sm:` |
| md | 768px | `respond-to('md')` | `md:` |
| lg | 992px | `respond-to('lg')` | `lg:` |
| xl | 1200px | `respond-to('xl')` | `xl:` |
| 2xl | 1400px | `respond-to('2xl')` | `2xl:` |

**布局策略：**

| 视口 | 布局 |
|:---|:---|
| ≥1200px | 完整三栏（导航 + 列表面板 + 内容区），详情面板可浮出 |
| 992-1199px | 三栏收紧 |
| 768-991px | 两栏（导航 + 内容区，列表作为浮层） |
| ≤767px | 移动端布局（Vant 组件，单栏） |

**重要约束：** 断点目前**没有 CSS 变量 token**，只存在于 SCSS map 与 UnoCSS 配置。由于 `@media (min-width: var(--x))` 在部分浏览器不生效，**媒体查询条件内必须写字面值**，不得引用 CSS 变量。

**平台策略：** 桌面/移动优先各自独立实现（`src/` vs `src/mobile/`）。`isMobile()` 内联分支只允许出现在临界候补组件，禁止新增。

---

## Accessibility Checklist

- 所有可交互元素具备 `:focus-visible` 轮廓
- 键盘导航：Tab 遍历、Enter/Space 激活、Escape 关闭面板/弹窗
- ARIA：纯图标按钮必须有 `aria-label`；动态内容用 `aria-live="polite"`；自定义控件补 `role`
- **状态类信息（联邦 / 加密 / 同步 / 在线）不得仅用颜色表达**
- 移动端触控目标 ≥ 44px
- 尊重 `prefers-reduced-motion`（全局兜底已存在）
- 键盘用户提供 skip-link 跳过导航
- 装饰性 SVG 加 `aria-hidden="true"`；语义性 SVG 用 `aria-label`

---

## Naive UI Theme Overrides

`src/components/common/NaiveProvider.vue` 为 15+ 个 Naive UI 组件类型提供主题覆盖。品牌色在其中以字面量形式书写（Naive UI 内部使用 `seemly/rgba()`，无法消费 CSS 变量）。

新增覆盖时：

- 共享值加到 `commonTheme`
- 主题相关差异加到 `darkThemeOverrides` / `lightThemeOverrides`
- 该文件内的颜色字面量属于**既有豁免**，不要在别处复制这种做法

---

## Vant CSS Variable Overrides

Vant 暗色通过 `<van-config-provider theme="dark">` 激活。品牌色覆盖使用 `--van-*` 变量：

```css
--van-dialog-confirm-button-text-color: var(--tjg-color-primary-500);
```

优先使用 Vant 内置暗色主题，仅在品牌一致性需要时补充 `--van-*` 覆盖。

---

## Admin UI Design Patterns

Admin 面板（`/admin`）暴露 synapse-rust 管理能力。所有 admin 视图遵循以下约定。

### Layout

- **Desktop：** 左侧栏（`src/views/admin/AdminLayout.vue`）+ 内容区。侧栏分组：Overview / User Management / Room Management / Federation / Messaging / Security / System。
- **Mobile：** 单栏 + 抽屉导航。
- **数据表：** Naive UI `<n-data-table>`，服务端分页（默认 `pageSize=20`）、可排序列、表格上方搜索过滤。
- **详情：** `<n-modal>` 或 `<n-drawer>`。当详情包含多个 Tab 或子操作时优先 Drawer。

### Status Indicators

| State | Component | Token |
|:---|:---|:---|
| Healthy/Active | `<n-tag type="success">` | `--tjg-color-success-500` |
| Warning | `<n-tag type="warning">` | `--tjg-color-warning-500` |
| Error/Blocked | `<n-tag type="error">` | `--tjg-color-danger-500` |
| Unknown/Offline | `<n-tag type="default">` | `--tjg-text-tertiary` |

### Confirmation Dialogs

破坏性操作（停用用户、删除房间、清除媒体、封禁 IP）必须二次确认：`<n-popconfirm>` 或专用 `<n-modal>`，确认按钮使用**明确动词**（"停用用户"/"删除房间"），禁止泛化的"确定"。

### Empty States in Admin

过滤后无结果用 `variant="subtle"`；首次使用面板用 `variant="welcome"`。

---

## Admin Route Architecture（已核对 `src/router/routes/desktop.ts`）

```
/admin                   → AdminLayout.vue          (meta.requiresAdmin)
  /dashboard             → AdminDashboard.vue
  /users                 → AdminUsers.vue
  /rooms                 → AdminRooms.vue
  /spaces                → AdminSpaces.vue
  /federation            → AdminFederation.vue
  /federation-monitor    → AdminFederationMonitor.vue
  /notices               → AdminNotices.vue
  /notifications         → AdminNotifications.vue
  /registration-tokens   → AdminRegistrationTokens.vue
  /guests                → AdminGuests.vue
  /audit                 → AdminAudit.vue
  /security              → AdminSecurity.vue
  /moderation            → ModerationPanel.vue        ← 已接线
  /server-config         → AdminServerConfig.vue
  /server-logs           → AdminServerLogs.vue
  /maintenance           → AdminMaintenance.vue
  /retention             → AdminRetention.vue
  /saml                  → AdminSaml.vue
  /app-services          → AdminAppServices.vue
  /modules               → AdminModules.vue
```

**尚未创建的路由（后端能力已存在，前端无路由）：** `/media`、`/quota`、`/external-services`。

### Admin Sidebar Navigation

侧栏由 `AdminLayout.vue` 的 `navGroups` 驱动，当前已分组：

1. **Overview：** Dashboard
2. **User Management：** Users、Registration Tokens、Guests
3. **Room Management：** Rooms、Spaces
4. **Federation：** Federation、Federation Monitor
5. **Messaging：** Notices、Notifications
6. **Security：** Audit、Security、Moderation
7. **System：** Server Config、Server Logs、Maintenance、Retention、SAML、App Services、Modules

**规则：** 每个 admin 路由必须有对应侧栏项。新增路由时同步补 `admin.nav.*` 与 `admin.nav_group.*` i18n 键。

---

## Admin Component Patterns

### Admin Data Table

```vue
<n-data-table
  :columns="columns"
  :data="items"
  :loading="loading"
  :pagination="pagination"
  :row-key="rowKey"
  remote
  @update:page="handlePageChange"
  @update:sorter="handleSort" />
```

- 服务端分页必须加 `remote`
- `row-key` 设为实体唯一 ID
- 初次加载用 `<SkeletonList>`，过滤后为空用 `<n-empty>`
- 列宽：ID 列 180px、名称列 flex、状态列 100px、操作列 120px
- 操作列：图标按钮 + `<n-tooltip>`，可见操作最多 4 个，超出收进 `<n-dropdown>`

### Detail Drawer

```vue
<n-drawer v-model:show="visible" :width="480" placement="right">
  <n-drawer-content :title="entityName" closable>
    <n-tabs type="line" animated>
      <n-tab-pane name="details" tab="Details">...</n-tab-pane>
      <n-tab-pane name="sub-entity" tab="Sub-Entities">...</n-tab-pane>
    </n-tabs>
  </n-drawer-content>
</n-drawer>
```

- 详情超过一屏时用 Tab
- 首个 Tab：核心属性与快捷操作
- 后续 Tab：关联实体（成员、消息、会话等）
- Drawer 底部：主操作按钮 + 次按钮

### Stat Card Grid

```vue
<n-grid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
  <n-grid-item v-for="stat in stats" :key="stat.label">
    <n-card :bordered="false" size="small">
      <n-statistic :label="stat.label" :value="stat.value">
        <template #prefix>
          <n-icon :component="stat.icon" />
        </template>
      </n-statistic>
    </n-card>
  </n-grid-item>
</n-grid>
```

- 桌面（≥1200px）4 列、平板（768-1199px）2 列、移动端 1 列
- 每张卡：图标 + 数值 + 标签 + 可选趋势指示
- 加载中：数值替换为 `<SkeletonBase variant="text" width="60%" />`

### Confirmation Modal (Destructive Actions)

```vue
<n-modal v-model:show="confirmVisible" preset="dialog"
  title="Confirm Action"
  :positive-text="actionVerb"
  :negative-text="'Cancel'"
  @positive-click="executeAction">
  <p>{{ confirmationMessage }}</p>
  <n-input v-if="requiresReason"
    v-model:value="reason"
    type="textarea"
    :placeholder="'Reason for this action...'"
    :minlength="10" />
</n-modal>
```

- `actionVerb` 必须明确："Deactivate User"、"Delete Room"、"Purge Media"
- 破坏性操作必须要求原因字段或二次确认勾选
- 成功反馈：`<n-message type="success">`，文案包含完整操作描述

---

## Synapse-Rust Feature Coverage

本节映射 synapse-rust 后端 API 与前端 UI，确保功能对齐。

> **阅读须知：** 每小节标注了实现状态。标记为「设计规格」的部分是**待实现的目标态设计**，不是现有实现描述。

### Admin Dashboard（`/admin/dashboard`）

**后端：** `GET /_synapse/admin/v1/server_version`、`/statistics`、`/health`
**前端：** `AdminDashboard.vue` — ✅ 已实现

展示服务器统计（用户数、房间数、DAU、MAU）、健康指示器、版本信息（卡片网格）。加载时用 `SkeletonBase`。挂载时与手动点击"刷新"时更新。

### User Management（`/admin/users`）

**后端：** `AdminUserService` — CRUD、密码重置、管理员切换、停用、设备、会话、限流、影子封禁、whois、以用户身份登录、批量创建/停用、账户信息、登录失败记录
**前端：** `AdminUsers.vue`

**已实现：** 搜索、分页列表、创建用户对话框、详情弹窗（ID、显示名、状态、角色、时间戳）、管理员切换、批量停用。

**待实现（设计规格）：**

#### Shadow-Ban Toggle

- 位置：用户详情弹窗「状态与角色」区块
- 组件：`<n-switch>` + 标签 "Shadow Ban" + 辅助文案"该用户可发送消息，但他人不可见"
- 确认：切换前 `<n-popconfirm>` — "该用户的消息将对其他用户不可见。是否继续？"
- 视觉：被影子封禁用户在列表中获得 `<n-tag type="warning">` 徽标

#### Login-as-User

- 位置：用户详情弹窗底部，次按钮"以该用户身份登录"
- 行为：为目标用户创建临时 access token，打开新会话窗口
- 确认：`<n-modal>` 警告 — "你将以此身份登录。当前会话保持活跃。该操作将记入管理审计日志。"
- 视觉：按钮使用 `secondary` 类型 + 盾牌图标，表明特权操作

#### User Sessions (Admin View)

- 位置：用户详情弹窗新 Tab「会话」
- 组件：活跃会话表（设备 ID、最后 IP、最后活跃时间、User Agent），每行带"失效"按钮
- 批量：Tab 底部"登出全部会话"按钮

#### User Quota

- 位置：用户详情弹窗新 Tab「存储」
- 展示：已用/限额进度条（`<n-progress>`）、上传数、文件数
- 编辑：`<n-input-number>` 自定义限额（MB）+ "应用"按钮
- 视觉：进度条在 80%（warning）与 95%（danger）变色

### Room Management（`/admin/rooms`）

**后端：** `AdminRoomService` — CRUD、成员、状态、封禁/解封、删除、forward extremities、别名、版本、事件上下文、搜索、统计
**前端：** `AdminRooms.vue`

**待实现（设计规格）：**

#### Room Aliases

- 位置：房间详情弹窗新 Tab「别名」
- 展示：别名字符串列表 + 复制按钮
- 视觉：每个别名用 `<n-tag>`，等宽字体，悬停显示复制图标

#### Room Version

- 位置：房间详情弹窗头部，房间 ID 下方
- 展示：`<n-tag size="small">` + 版本号（如 "v10"）
- 视觉：低于当前版本时显示 warning tag + "可升级" tooltip

#### Room Forward Extremities

- 位置：房间详情弹窗「诊断」Tab
- 展示：forward extremities 数量 + 事件 ID 列表
- 视觉：数量 > 10 用警告色（提示潜在同步问题）

### Media Management

**后端：** `AdminMediaService` — 列表、删除、清除、隔离、缓存统计
**前端：** 目前仅 `AdminMaintenance.vue` 中的清除/清理 — ⚠️ 部分实现

**待实现（Media Browser 设计规格）：**

- 路由：`/admin/media`（新路由）
- 布局：双栏 — 左：搜索 + 可过滤媒体列表（缩略图、文件名、上传者、大小、日期）；右：选中项预览面板
- 预览面板：图片/视频预览、元数据表（MXC URI、上传时间、上传者、大小、房间）、操作按钮（删除、隔离、下载）
- 批量操作：复选框多选 + "删除所选"/"隔离所选"工具栏
- 空态：`<EmptyState icon="mdi:image-outline" title="No media found" />`
- 移动端：单栏列表，点击打开详情 sheet

### Moderation Panel（`/admin/moderation`）

**后端：** `AdminModerationService` + `AdminReportService` — 事件举报、用户举报、房间举报、resolver、内容过滤
**前端：** `ModerationPanel.vue` — ✅ **已接线到路由**，侧栏 Security 分组已包含入口

（历史文档记载的"未接线"问题已解决，保留此说明以防回退。）

**设计规格：**

- 布局：三 Tab — 「举报」「内容过滤」「用户信誉」
- 举报 Tab：表格列（举报人、被举报实体、类型、原因、时间戳、状态）。状态列用 `<n-tag>`：pending(warning)、resolved(success)、dismissed(default)。点击行打开详情抽屉（完整举报内容 + Resolve / Dismiss / Escalate 操作）
- 内容过滤 Tab：正则/glob 规则列表 + 启停开关 + "新增过滤"按钮。每条展示 pattern、类型、目标（房间/用户）、创建时间
- 用户信誉 Tab：按用户 ID 搜索，展示信誉分（0-100）、近期举报数、已执行的自动管理动作
- 确认：解决/驳回举报必须填写原因（文本域，最少 10 字符）

### Server Quota Management

**后端：** `AdminQuotaService` — 服务器配额、用户配额、上传限制、存储用量
**前端：** `useQuotaStore` 存在，**无 admin UI** — ❌ 未实现

**设计规格：**

- 路由：在 `/admin/dashboard` 增加配额卡片，或新增 `/admin/quota` 独立视图
- Dashboard 卡片：服务器存储 已用/总量（进度条）、超配额用户数、最大占用者（Top 5 表）
- 独立视图：两 Tab — 「服务器配额」（总存储、上传大小限制、文件大小限制、编辑表单）与「用户配额」（可搜索用户列表 + 已用存储、配额上限、超限状态）
- 视觉：超配额用户红色背景淡染；进度条按阈值变色

### External Services Management

**后端：** `/_synapse/admin/v1/external_services/` — TrendRadar、OpenClaw、webhook bridges
**前端：** 无 UI — ❌ 未实现

**设计规格：**

- 路由：`/admin/external-services`，或并入服务器配置
- 布局：卡片网格，每类服务一张卡（TrendRadar、OpenClaw、Webhook）。卡片展示：服务名、状态指示（已连接/未连接）、最后同步时间、快捷操作（配置、测试连接、启停开关）
- 配置弹窗：服务专属表单（API key、endpoint、webhook URL），"测试连接"按钮带 loading 与成功/失败反馈
- 状态检查：页面加载时自动检查 + 手动"刷新"按钮

### Notification Templates

**后端：** `/_synapse/admin/v1/server_notifications/templates`
**前端：** 无 UI — ❌ 未实现

**设计规格：**

- 位置：`AdminNotices.vue` 新增「模板」Tab
- 展示：模板卡片列表（模板名、主题预览、正文预览）
- 编辑：点击卡片打开编辑弹窗：主题输入、正文文本域（支持 Markdown，带预览 Tab）、变量插入帮助
- 发送："使用模板发送"按钮，打开预填模板内容的发送通知对话框

### Feature Flags

**后端：** `AdminSecurityService` — feature flag CRUD
**前端：** `FeatureFlagManager.vue`，用于 `AdminMaintenance.vue` — ✅ 已实现

**设计规格：**

- 展示：卡片网格，每个 flag 一张卡（名称、描述、状态徽标、编辑/删除按钮）
- 创建/编辑：弹窗含 flag 名、描述、开关、目标（global/room/user）、值（复杂 flag 用 JSON）
- 确认：删除需确认 — "这可能影响服务器行为。是否继续？"
- 视觉：启用状态卡片有绿色左边条

### User Statistics & Data Usage

**后端：** `getUserStats()`、`getUserStatsList()`、`getRoomStats()`、`getSingleRoomStats()`
**前端：** 无专用 UI — ❌ 未实现

**设计规格：**

- 位置：Admin Dashboard 新增「分析」Tab
- 组件：折线图（DAU/MAU 趋势）、柱状图（每日消息量）、统计卡（总用户、活跃房间、已发消息）
- 过滤：日期范围选择（7d / 30d / 90d / 自定义）
- 房间统计：可搜索房间列表 + 消息数、成员数、最后活跃时间列
- 移动端：简化为单栏，图表替换为统计卡与 sparkline

## 设计组件库

### Atomic 组件（2026-09-19 新增）

以下组件已创建，位于 `src/components/atomic/`：

| 组件 | 用途 | 状态 |
|:---|:---|:---:|
| `MxidText.vue` | MXID 文本展示（截断 + title 悬浮） | ✅ 已完成 |
| `FederationBadge.vue` | 跨域服务器徽章 | ✅ 已完成 |
| `MessageLockBadge.vue` | 消息 E2EE 信任徽章（三态） | ✅ 已完成 |
| `useMessageTrust` | 消息信任计算 composable | ✅ 已完成 |

**用法示例：**

```vue
<!-- MXID 文本 -->
<MxidText :mxid="userId" :showFull="false" />

<!-- 联邦徽章 -->
<FederationBadge :is-local="isLocal" size="sm" />

<!-- 加密信任徽章 -->
<MessageLockBadge :trust-level="trustLevel" />
```

### 液态玻璃系统

**mixin 位置**：`src/styles/scss/mixins/_liquid-glass.scss`

**使用规则：**
- `backdrop-filter` 仅限面板级元素（每视图 ≤ 3 处）
- 动态模式：`@include liquid-glass;`
- 轻量模式：`@include liquid-glass-subtle;`
- 性能回退：`@include liquid-glass-fallback;` 于 `html.low-perf` 环境关闭

**CSS Token 已定义：**
- `--tjg-glass-blur: 20px`
- `--tjg-glass-saturate: 1.8`
- `--tjg-glass-panel-opacity: 0.85`
- `--tjg-glass-nav-opacity: 0.85`
- `--tjg-glass-bubble-opacity: 0.7`

---

## 设计守门命令

改动 UI 后必须运行：

```bash
pnpm check:ratchet           # 硬编码颜色计数只减不增（当前基线 31）
pnpm check:doc-coverage      # 新增 service 方法必须有 JSDoc
pnpm check:sdk-boundary      # 组件不得越层调用 SDK
pnpm quality:no-raw-fetch    # 禁止直连 fetch
pnpm vue-tsc --noEmit        # 类型检查 0 错误
pnpm test:run                # 单元测试全通过
pnpm check                   # Biome lint + i18n 检查
```

**硬性红线：**

| 项 | 限制 |
|:---|:---|
| 单个 `.vue` 文件行数 | < 800 |
| 单视图 `backdrop-filter` 声明数 | ≤ 3（仅面板级） |
| 新增硬编码颜色 | 0 |
| 新增 `isMobile()` 内联分支 | 0 |
| 图标实现方式 | 仅 SVG，线宽 1.5 |

**令牌使用检查：**

```bash
# 检查是否误用了旧别名
grep -rn "var(--[a-z]*-)" src --include="*.vue" --include="*.ts" | grep -v "--tjg-"

# 检查设计 token 使用
grep -rn "var(--tjg-)" src --include="*.vue" --include="*.scss" | wc -l
```

> **基线数据（2026-09-19）：**
> - `hardcoded_color`: 31（由 `pnpm check:ratchet` 提供，admin 模块硬编码颜色已部分清理）
> - `inline_styles`: ~500 处（login 0 处，settings 0 处，插件目录 50 处）
> - `!important`: 48 处（login.scss 的按钮覆盖为必要保留）
> - 建议：后续版本目标 `<inline_styles` < 300，通过继续迁移 UI 视图内联样式；`!important` 通过选择器特异性提升替代

> **进度更新（2026-09-19 下午）：**
> - 完成 `loginWindow` 及 `settingsWindow/tabs` 目录下所有可迁移的内联样式
> - 新增 CSS 类：`.pref-width-*-*`, `.volume-slider`, `.device-select-width`, `.modal-width-400` 等
> - 保留合理的动态/隐藏/控件约束样式：约 10 处

---

## 相关文档

| 文档 | 用途 |
|:---|:---|
| `docs/ui-design-spec.md` | 原型差异核对、尺寸与布局 |
| `UI-OPTIMIZATION-PLAN.md` | UI 优化方案（联邦/玻璃/E2EE/同步五阶段） |
| `docs/ui-optimization/code-examples.md` | 上述方案的落地示例代码 |
| `docs/sdk-e2ee-adaptation-plan-2026-09-19.md` | E2EE 契约与 SDK 边界 |
| `.rules` § 初始化与连接状态机（ADR-003） | 连接状态机与乐观渲染（**注：`.rules` 引用的 `docs/adr/ADR-003-tjg-greenfield-rewrite.md` 文件当前不存在，规则正文本身有效**） |
| `.rules` | 工程规范总纲 |
