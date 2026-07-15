# HuLa UI/UX 优化方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 HuLa 高保真原型的设计规范系统性地落地到实际项目中，弥合原型（暗色主题、自定义组件）与当前实现（亮色主题默认、Naive UI + Vant）之间的差距。

**Architecture:** 从设计令牌对齐开始，逐步将原型中的交互模式（消息悬停工具栏、表情回应、线程面板、阅后即焚等）实现为 Vue 组件，同时保持现有 Naive UI/Vant 组件库的集成方式不变。

**Tech Stack:** Vue 3 + Naive UI (desktop) + Vant (mobile) + UnoCSS + SCSS + TypeScript

## Global Constraints

- 必须保持 Naive UI（桌面端）和 Vant（移动端）作为基础 UI 库，不得移除
- 暗色主题必须作为一等公民支持，与亮色主题同等对待
- 所有新增组件必须通过 type check (`vue-tsc --noEmit`)
- 所有新增组件必须有单元测试覆盖
- 遵循现有 CLAUDE.md 中定义的命名规范和代码风格
- CSS 变量统一使用 `--hula-*` 命名空间（参考 `src/styles/css/design-tokens.css`）

---

## Pre-Review System Audit

### DESIGN.md 状态
**未找到 DESIGN.md。** 项目缺少设计系统文档。高保真原型 (`docs/hula-prototype.html`, 8648 行) 是事实上的设计参考，但其 CSS 变量命名（`--bg-deepest`, `--accent` 等）与项目实际 tokens（`--hula-brand`, `--hula-text-primary` 等）不一致。

### 原型 vs 实际代码库 — 关键差距

| 维度 | 原型 | 实际实现 | 差距 |
|------|------|----------|------|
| 默认主题 | 暗色 (`#161616` 背景) | 亮色 (`#fafafa` 背景) | 原型暗色主题尚未落地 |
| CSS 变量 | 短名 (`--accent`, `--bg-deepest`) | `--hula-*` 命名空间 | 需要映射/对齐 |
| UI 组件 | 全部自定义 CSS | Naive UI + Vant | 原型交互需适配组件库 |
| 移动端 | 自定义 iOS 风格 (375×812) | Vant 组件 + 原生 Tauri | 需确认 Vant 暗色主题支持 |
| 消息操作栏 | hover 显示工具栏（表情/回复/转发/删除） | 未实现 | 原型已有完整 CSS，待实现 |
| 表情回应 | 6 种回应表情 + 选择器 | 未实现 | 原型已有完整 CSS |
| 线程面板 | 右侧滑入面板 | 未实现 | 原型已有完整 CSS |
| 阅后即焚 | 计时器 + 开关 toggle | 未实现 | 原型已有完整 CSS |
| 语音/视频通话 | 全屏覆盖层 + PiP 浮窗 | 部分实现 | 原型 UI 更完整 |
| 收藏消息面板 | 右侧面板 + 快捷入口 | 未实现 | 原型已有完整 CSS |
| AI 机器人视图 | 侧边栏 + 欢迎页 + 对话 | 已有 `OpenClawView.vue` | 原型设计更完整 |
| E2EE 横幅 | 加密状态提示 | 未实现 | 原型已有样式 |
| 新消息提示 | 浮动 "新消息" 按钮 | 未实现 | 原型已有样式 |
| 联系人详情面板 | 右侧 300px 详情面板 | 未实现 | 原型已有完整样式 |
| 房间管理视图 | 卡片网格 + 标签 | 部分实现 | 原型更丰富 |
| 联邦视图 | 统计卡片 + 服务器列表 | 未实现 | 原型已有完整样式 |
| 设置视图 | 侧边栏 + 内容区布局 | 已有 `settingsWindow` | 原型布局更清晰 |
| Toast 提示 | 顶部居中 | 使用 Naive UI message | 风格一致即可 |
| 空状态 | 图标 + 标题 + 描述 + CTA | 仅基础 `EmptyState.vue` | 原型更温暖 |
| 对话框系统 | 完整模态框 + 步骤指示器 | 使用 Naive UI modal | 原型设计可补充 |

### 现有设计模式可复用
- `src/styles/css/design-tokens.css` — 完整的 `--hula-*` 设计令牌系统
- `src/styles/scss/global/variable.scss` — 全局样式 + Naive UI 遮罩样式
- Naive UI 暗色主题支持 — `NH_CONFIG` provide
- `src/components/` 下已有的业务组件（EmptyState, FileManagerEmptyState 等）
- `src/views/` 各窗口的页面级组件

---

## Step 0: Design Scope Assessment

### 0A. Initial Design Rating
**Overall: 5/10.** 原型设计完整度很高（8/10），但实际落地率低（2/10）。原型定义了 15+ 个交互模式、完整的暗色主题、50+ SVG 图标，但实际项目中大部分未实现。10/10 意味着：所有原型交互已实现为 Vue 组件，暗色/亮色主题对等，每个空状态都有温暖的引导文案，PC + 移动端设计一致。

### 0B. DESIGN.md Status
未找到 DESIGN.md。建议先运行 `/design-consultation` 创建设计系统文档，或至少将原型的 CSS 变量映射到现有的 `--hula-*` 令牌系统。

### 0C. Existing Design Leverage
- `design-tokens.css` 已有完整的 `--hula-*` 令牌体系（品牌色、功能色、中性色、边框、字体）
- Naive UI 暗色主题已通过 `NH_CONFIG` 支持
- Vant 组件可配合 CSS 变量实现暗色主题
- 现有的 `EmptyState.vue` 可增强为原型风格

---

## Pass 1: Information Architecture — 7/10 → Target 9/10

### Rating: 7/10
原型的四栏 PC 布局（导航 64px + 房间列表 300px + 聊天 flex + 信息面板 240px）和五 Tab 移动端布局（消息/空间/联系人/我的/聊天）是清晰且合理的。实际项目也已实现此布局。主要差距在：
1. 导航栏图标缺少未读角标
2. 空间快捷入口 + 树形导航在原型中很清晰，实际项目中空间管理较为混乱
3. 右侧信息面板（成员列表、小部件）在实际项目中不够突出

### Fix: 对齐导航信息层次
- 确保导航图标上的未读角标与原型一致（红色数字角标 + 绿色 @提及角标）
- 空间树形导航：实现可折叠的空间→子房间层级

---

## Pass 2: Interaction State Coverage — 4/10 → Target 8/10

### Rating: 4/10
原型覆盖了大量交互状态，但实际实现远远不足：

```
  FEATURE              | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL
  ---------------------|---------|-------|-------|---------|--------
  消息列表加载         | 骨架屏   | 空状态 | ❌    | ✅      | ❌
  消息发送             | ✅       | —     | ✅    | ✅      | ❌
  房间列表             | ❌       | ❌    | ❌    | ✅      | ❌
  联系人列表           | ❌       | ❌    | ❌    | ✅      | ❌
  空间列表             | ❌       | ❌    | ❌    | ✅      | ❌
  文件上传             | ✅       | —     | ❌    | ✅      | ❌
  表情回应             | —        | —     | —     | —       | —
  线程面板             | ❌       | ❌    | —     | ❌       | ❌
  E2EE 加密状态        | —        | —     | ❌    | ✅      | ❌
  AI 对话              | ❌       | ✅    | ❌    | ✅      | ❌
```

### Fix: 交互状态表
为每个 UI 功能补充完整的加载、空、错误、成功、部分状态。优先级：

**P1 — 必须立即实现：**
- 房间列表空状态（原型 `empty-state` 组件：图标 + 标题 + 描述 + CTA 按钮）
- 联系人列表空状态
- 消息发送失败的错误状态和重试机制

**P2 — 本分支完成：**
- 骨架屏加载态（原型已有 `skeleton` CSS + shimmer 动画）
- 文件上传错误状态

---

## Pass 3: User Journey & Emotional Arc — 6/10 → Target 8/10

### Rating: 6/10
原型设计了温暖的空状态（"还没有消息，发送第一条消息开始对话吧"）和品牌化的认证动画（渐变动画背景）。实际项目中：

```
  STEP | USER DOES              | USER FEELS        | PLAN SPECIFIES?
  -----|------------------------|-------------------|----------------
  1    | 打开应用               | 期待、好奇心      | 启动页/Splash ✅
  2    | 登录/注册              | 信任感            | 品牌动画背景 ❌ (原型有)
  3    | 首次进入空聊天列表     | 迷茫              | 温暖的引导空状态 ❌
  4    | 发送第一条消息         | 成就感            | 发送动画 ✅
  5    | 收到第一条回复         | 连接感            | 通知提醒 ✅
  6    | 发现表情回应功能       | 愉悦              | ❌
  7    | 首次视频通话           | 紧张→放松         | PiP 浮窗流畅 ✅ (原型)
```

### Fix: 用户旅程故事板
- **登录页品牌动画：** 将原型的 `authBgMove` 渐变动画落地到实际登录页
- **首次使用引导：** 添加空状态引导（"你还没有任何对话，点击 + 开始"）
- **E2EE 横幅：** 实现原型中的加密状态提示条（绿色渐变背景 + 锁图标）

---

## Pass 4: AI Slop Risk — 8/10 → Target 9/10

### Rating: 8/10
原型设计相对独特，避开了大多数 AI slop 模式：

**Litmus 检查：**
1. Brand/product unmistakable in first screen? **YES** — HuLa logo + 绿色渐变按钮
2. One strong visual anchor present? **YES** — 登录页动画渐变背景
3. Page understandable by scanning headlines only? **YES** — 导航图标语义清晰
4. Each section has one job? **YES** — 四栏布局各司其职
5. Are cards actually necessary? **YES** — 房间卡片在管理视图中是合理的交互载体
6. Does motion improve hierarchy or atmosphere? **YES** — 消息进入动画、认证背景动画
7. Would design feel premium with all decorative shadows removed? **YES** — 暗色主题本身就足够

**Slop 黑名单检查：**
1. 紫/蓝渐变背景 → ❌ 无（使用绿色 `#13987f` 作为品牌色）
2. 3 列图标+标题+描述 → ❌ 无
3. 彩色圆圈图标装饰 → ⚠️ 有（avatar 渐变色），但用于头像区分，合理
4. 全局居中布局 → ❌ 无
5. 统一大圆角 → ❌ 无（有层次化的圆角系统）
6. 装饰性波浪/气泡 → ❌ 无
7. Emoji 作为设计元素 → ❌ 无（使用 SVG 图标代替 emoji）
8. 彩色左边框卡片 → ❌ 无
9. 通用 hero 文案 → ❌ 无（使用 "跨平台即时通讯 · 端到端加密"）
10. 模板化章节节奏 → ❌ 无

**唯一的 AI slop 风险：** 头像渐变色 (`av-1` 到 `av-9`) 使用了多色渐变，需要确保这些颜色在暗色和亮色主题下都协调。当前实现中的渐变色选择 (`#f59e0b→#ef4444`, `#8b5cf6→#ec4899` 等) 质量较高。

---

## Pass 5: Design System Alignment — 4/10 → Target 8/10

### Rating: 4/10
没有 DESIGN.md，且存在两个并行的令牌系统：

| 原型令牌 | 实际令牌 | 映射 |
|----------|----------|------|
| `--accent: #13987f` | `--hula-brand: #13987f` | 同色 |
| `--bg-deepest: #161616` | 无暗色对应 | 需添加 `--hula-surface-darkest` |
| `--bg-deep: #1a1a1a` | 无暗色对应 | 需添加 `--hula-surface-dark` |
| `--bg-mid: #222` | 无暗色对应 | 需添加 `--hula-surface-dark-mid` |
| `--text-primary` | `--hula-text-primary: #18181c` | 亮色 #18181c vs 暗色 #fff |
| `--error: #ef4444` | `--hula-color-danger-500: #ff4d4f` | 不同色值 |
| `--success: #10b981` | `--hula-color-success-500: #52c41a` | 不同色值 |

### Fix: 设计令牌对齐
1. **创建 DESIGN.md**，记录设计决策和令牌映射
2. **在 `design-tokens.css` 中添加暗色主题变量** — 将原型的暗色令牌映射到 `--hula-*` 命名空间
3. **颜色统一：** 决定是使用原型的 `#ef4444` (red) 还是现有的 `#ff4d4f` (red) 作为错误色。推荐保留现有 `--hula-color-danger-500`，原型调整为引用实际令牌。

---

## Pass 6: Responsive & Accessibility — 6/10 → Target 9/10

### Rating: 6/10
**响应式：**
- 原型定义了 4 个断点：≥1700px, 1200-1699px, 768-1199px, ≤767px
- 实际项目使用 Tauri + mobile overrides（`src/mobile/`）
- PC 端使用 `transform:scale()` 缩放策略，实际项目此行为未知

**无障碍：**
- 原型包含 skip link、`aria-live` region、`aria-label`、`prefers-reduced-motion` 支持
- 原型包含 `:focus-visible` 焦点样式（实际项目也有）
- 原型定义了 44px 最小触摸目标（移动端菜单项）
- **缺失：** ARIA landmarks（`<main>`, `<nav>` 已使用）、屏幕阅读器文本、键盘导航模式文档

### Fix:
1. **添加暗色主题响应式支持：** 确保所有断点在暗色主题下正确渲染
2. **确认触摸目标：** 移动端所有可点击元素 ≥ 44px（原型已满足）
3. **补充 ARIA 属性：** 将原型中的 `aria-label`、`aria-live` 等移植到实际组件
4. **键盘导航：** 确保 Tab 键序合理、Enter/Space 可激活按钮、Escape 可关闭面板

---

## Pass 7: Unresolved Design Decisions — 6 items — RESOLVED

| 决策 | 决议 | 理由 |
|------|------|------|
| 1. 主题默认 | **默认 `os`（跟随系统）** | `os` 模式代码已就绪（`resolveOsTheme()`），只需改默认值；首次打开自动匹配系统主题 |
| 2. 令牌命名 | **统一 `--hula-*` 命名空间** | 项目已有 460+ 变量在 363 个文件中使用；原型令牌仅作 DESIGN.md 映射参考 |
| 3. 消息操作栏 | **hover 快捷 + 右键完整（互补）** | 符合 Discord/Telegram/Slack 惯例；hover 露出 4-5 个高频操作，右键提供完整菜单 |
| 4. Vant 暗色 | **内置主题为主 + CSS 变量按需覆盖** | Vant 4 暗色覆盖 90% 场景；仅覆盖品牌色/功能色约 10-15 个 `--van-*` 变量 |
| 5. E2EE 横幅 | **首次显示可关闭，关闭后小图标持续显示** | 避免横幅疲劳；per-room localStorage 记忆关闭状态 |
| 6. 空间导航 | **树形默认 + 平级可选（切换按钮）** | 复用已有 `HulaSpaceTree.vue`（416行，键盘导航+ARIA 完备） |

---

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~4h / CC: ~30min)** — Design Tokens — 在 `design-tokens.css` 中添加暗色主题 CSS 变量
  - Surfaced by: Pass 5 (Design System Alignment) — 原型暗色令牌缺少 `--hula-*` 命名空间映射
  - Files: `src/styles/css/design-tokens.css`
  - Verify: `git diff src/styles/css/design-tokens.css` 确认新增暗色变量

- [ ] **T2 (P1, human: ~2h / CC: ~15min)** — Design System Doc — 创建 DESIGN.md
  - Surfaced by: Pre-Review System Audit — 项目缺少设计系统文档
  - Files: `DESIGN.md` (new)
  - Verify: 文件存在，包含令牌映射表、颜色系统、间距规范、字体规范

- [ ] **T3 (P1, human: ~6h / CC: ~45min)** — Message Action Bar — 实现消息 hover 工具栏组件
  - Surfaced by: Pass 1 (IA), Pass 2 (States) — 消息操作（表情回应、回复、转发、删除）未暴露
  - Files: `src/components/chat/MessageActionBar.vue` (new), 修改消息气泡组件
  - Verify: hover 消息气泡时显示操作栏，焦点不丢失

- [ ] **T4 (P2, human: ~4h / CC: ~30min)** — Empty States — 增强空状态组件
  - Surfaced by: Pass 2 (States) — 空状态缺少温暖的引导文案和 CTA
  - Files: `src/components/common/EmptyState.vue`, 各视图集成
  - Verify: 每个列表的空状态显示图标 + 标题 + 描述 + 行动按钮

- [ ] **T5 (P2, human: ~3h / CC: ~20min)** — E2EE Banner — 实现端到端加密状态横幅
  - Surfaced by: Pass 3 (Journey) — 用户不知道加密状态
  - Files: `src/components/chat/E2EEBanner.vue` (new), 聊天视图集成
  - Verify: 加密房间显示绿色横幅，非加密房间不显示

- [ ] **T6 (P2, human: ~5h / CC: ~40min)** — Message Reactions — 实现表情回应功能
  - Surfaced by: Pass 2 (States), Pass 4 (AI Slop) — 原型已有完整 CSS
  - Files: `src/components/chat/MessageReactions.vue` (new), `src/components/chat/ReactionPicker.vue` (new)
  - Verify: 可对消息添加/移除表情回应，显示回应计数

- [ ] **T7 (P2, human: ~3h / CC: ~20min)** — Thread Panel — 实现线程面板
  - Surfaced by: Pass 1 (IA) — 右侧滑入面板
  - Files: `src/components/chat/ThreadPanel.vue` (new), 聊天视图集成
  - Verify: 点击 "线程" 按钮打开右侧面板，显示回复列表

- [ ] **T8 (P3, human: ~2h / CC: ~15min)** — Contact Detail Panel — 实现联系人详情面板
  - Surfaced by: Pass 1 (IA) — 右侧 300px 详情面板
  - Files: `src/components/contacts/ContactDetailPanel.vue` (new), 联系人视图集成
  - Verify: 点击联系人显示详情面板（头像、MXID、操作按钮、设备列表）

- [ ] **T9 (P3, human: ~3h / CC: ~20min)** — Skeleton Loading — 实现骨架屏加载态
  - Surfaced by: Pass 2 (States) — 列表加载时无骨架屏
  - Files: `src/components/common/SkeletonBase.vue` (new), 各列表集成
  - Verify: 加载时显示 shimmer 动画骨架屏

- [ ] **T10 (P3, human: ~2h / CC: ~15min)** — Login Animation — 实现登录页品牌动画背景
  - Surfaced by: Pass 3 (Journey) — 认证页缺少品牌动画
  - Files: `src/views/loginWindow/` 相关组件
  - Verify: 登录页显示渐变动画背景

- [ ] **T11 (P1, human: ~1h / CC: ~10min)** — A11y Audit Pass — 补充无障碍属性
  - Surfaced by: Pass 6 (Responsive & A11y) — ARIA 属性不足
  - Files: 全局各组件
  - Verify: 键盘 Tab 可导航所有交互元素，屏幕阅读器可朗读主要内容

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | score: 5/10 → 8/10 target, 11 tasks, 6 unresolved decisions |

**VERDICT:** Design review complete — 11 implementation tasks identified, 6 decisions need user input. Run `/plan-eng-review` for architecture validation before implementation.

**UNRESOLVED DECISIONS:**
- 暗色主题默认 vs 亮色主题默认？
- 设计令牌命名策略（短名 vs --hula-*）？
- 消息操作栏交互模式（hover vs 右键菜单优先级）？
- 移动端 Vant 暗色主题覆盖策略？
- E2EE 横幅显示策略？
- 空间导航模式（树形 vs 平级列表）？
