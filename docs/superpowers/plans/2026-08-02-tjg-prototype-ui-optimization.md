# TJG 原型 UI 优化实现计划（v2.0 完善版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据 TJG-prototype.html 高保真原型设计和 UI界面需求文档.md v2.0，优化 HuLa 项目主界面（三栏布局、会话列表、聊天区域、消息气泡、输入框、右侧信息面板、登录窗口）的 UI 视觉效果和交互体验，保留现有品牌色（#13987f）和背景图片系统。

**Architecture:** 采用 CSS 变量驱动 + UnoCSS 工具类 + 组件级 SCSS 覆盖的三层样式架构。优先复用现有 `design-tokens.css` 变量体系，对原型中新增的视觉细节（圆角、阴影、边框、渐变背景）通过新增语义化 token 或组件级样式实现。保持 Vue 3 Composition API 组件结构不变，仅修改模板 class 绑定和样式。

**Tech Stack:** Vue 3, TypeScript, UnoCSS, SCSS, Naive UI, Pinia

## Global Constraints

- 品牌主色保持 `#13987f`（`--hula-brand` / `--hula-color-primary-500`），不可更改
- 暗色主题背景图系统（`--right-theme-bg-color` 渐变）必须保留
- 所有新增 CSS 变量必须同时提供 `:root`（浅色）和 `html[data-theme='dark']` 两套值
- 使用 UnoCSS bracket 语法消费 token：`bg-[--center-bg-color]`、`text-[--hula-text-primary]`
- 组件修改遵循现有目录结构，不新建目录
- 每次修改后运行 `pnpm check` 和 `vue-tsc --noEmit` 确保无类型/格式错误
- 禁止修改 matrix-js-sdk 代码
- 保持响应式断点行为（shrink 模式、移动端适配）不变
- **左侧导航栏背景色**：`--hula-surface-sidebar` 暗色值为 `#3e6564`（teal 色），对应需求文档 §1.3.2
- **中间栏背景色**：`--center-bg-color` 暗色值为 `#1b1b1b`，对应需求文档 §1.3.7
- **右侧栏背景**：`--right-bg-color` 暗色值为 `#161616`，渐变背景 `--right-theme-bg-color` 保留
- **会话列表选中态**：teal 渐变卡片 `linear-gradient(135deg, #4ecdc4 0%, #3db8a8 100%)`，对应需求文档 §1.3.4
- **消息气泡不对称圆角**：接收消息 `12px 12px 12px 4px`，发送消息 `12px 12px 4px 12px`，对应需求文档 §3.2.2
- **输入框 placeholder**："善言一句暖人心，恶语一句伤人心"，对应需求文档 §1.3.5
- **登录窗口动画渐变背景**：TJG 标志性动画，对应原型 auth-window 和 §3.1.1

---

## File Structure

| 文件 | 职责 |
|------|------|
| `src/styles/css/design-tokens.css` | 新增/覆盖 CSS 变量（圆角、阴影、边框、渐变、表面色） |
| `src/styles/scss/global/variable.scss` | 新增 SCSS mixin 和全局动画（msgIn、typing、authBgMove） |
| `src/layout/index.vue` | 主容器布局微调（背景、圆角、阴影、overflow-hidden） |
| `src/layout/left/index.vue` | 左侧导航栏优化（宽度 64px、teal 背景、头像、激活态左侧指示条） |
| `src/layout/left/style.scss` | 左侧栏样式覆盖（原型 nav-bar 风格、在线状态点） |
| `src/layout/left/components/LeftAvatar.vue` | 头像组件添加在线状态指示点 |
| `src/layout/center/index.vue` | 中间栏优化（白色背景、圆角、边框、阴影） |
| `src/components/workbench/ListWorkbenchShell.vue` | 列表外壳优化（头部标题、搜索框、操作按钮） |
| `src/components/workbench/MessageSessionToolbar.vue` | 会话工具栏优化（搜索框背景 `--hula-surface-search-dark`） |
| `src/components/workbench/HulaRoomListItem.vue` | 会话列表项优化（原型 room-item 风格、选中态左侧指示条） |
| `src/layout/right/index.vue` | 右侧栏优化（暗色背景、边框、拖拽手柄、渐变背景保留） |
| `src/views/homeWindow/message/index.vue` | 消息列表页面容器优化 |
| `src/views/loginWindow/Login.vue` | 登录窗口背景优化（原型 auth-window 渐变动画） |
| `src/styles/scss/login.scss` | 登录页样式覆盖（动画渐变背景） |
| `src/components/chat/` | 消息气泡、输入框组件（需先定位实际路径） |

---

## Task 1: 设计 Token 体系扩展

**Files:**
- Modify: `src/styles/css/design-tokens.css`（新增/修改变量段）
- Modify: `src/styles/scss/global/variable.scss`（新增动画 keyframes）

**Interfaces:**
- Consumes: 现有 `--hula-*` token 体系
- Produces: 新增/修正 `--hula-surface-sidebar: #3e6564` (dark), `--hula-surface-search-dark: #282828`, `--hula-shadow-panel`, `--hula-border-layout-divider: #000000` (dark), 消息进入动画 `msgIn`, 打字动画 `typing`, 登录背景动画 `authBgMove`

- [ ] **Step 1: 修正 design-tokens.css 暗色主题段表面色**

在 `html[data-theme='dark']` 段找到 `--hula-surface-sidebar` 并修正为 `#3e6564`：

```css
html[data-theme='dark'] {
  /* ... 现有变量 ... */

  /* === TJG 原型修正：左侧导航栏 teal 背景 === */
  --hula-surface-sidebar: #3e6564;
  --hula-surface-panel: #1b1b1b;        /* 中间栏背景 */
  --hula-surface-list: #2b2d31;
  --hula-surface-panel-muted: #262626;
  --hula-surface-subtle: #303030;
  --hula-surface-elevated: #303030;
  --hula-surface-search: #383a40;
  --hula-surface-search-dark: #282828;   /* 搜索框背景 */
  --hula-surface-deepest: #161616;        /* 右侧栏背景 */
  --hula-surface-dark-mid: #1b1b1b;
  --hula-surface-dark-hover: #323232;
  --hula-surface-popover: #303030;

  /* === TJG 原型新增 Token === */
  --hula-radius-xl: 16px;
  --hula-radius-2xl: 20px;
  --hula-shadow-panel: 0 4px 24px rgba(0, 0, 0, 0.4);
  --hula-shadow-bubble: 0 1px 2px rgba(0, 0, 0, 0.2);
  --hula-border-layout-divider: #000000;
  --hula-accent-dim: #10806a;
  --hula-accent-soft: rgba(19, 152, 127, 0.15);
  --hula-accent-active: rgba(19, 152, 127, 0.6);

  /* === 会话选中态渐变 === */
  --hula-surface-session-active: linear-gradient(135deg, #4ecdc4 0%, #3db8a8 100%);
  --hula-surface-session-active-shadow: 0 2px 10px rgba(61, 184, 168, 0.25);
}
```

- [ ] **Step 2: 修正 :root 浅色主题段表面色**

```css
:root {
  /* ... 现有变量 ... */

  /* === TJG 原型修正：浅色主题表面色 === */
  --hula-surface-sidebar: #64a29c;       /* 左侧导航栏 teal */
  --hula-surface-panel: #ffffff;          /* 中间栏白色背景 */
  --hula-surface-list: #f7f7f7;
  --hula-surface-panel-muted: #f5f5f5;
  --hula-surface-subtle: #f1f1f1;
  --hula-surface-elevated: #fdfdfd;
  --hula-surface-search: #eaeaea;
  --hula-surface-search-dark: #f0f0f0;  /* 搜索框背景 */
  --hula-surface-deepest: #fafafa;       /* 应用背景 */
  --hula-surface-dark-mid: #f7f7f7;
  --hula-surface-dark-hover: #f0f0f0;
  --hula-surface-popover: #ffffff;

  /* === TJG 原型新增 Token (Light) === */
  --hula-radius-xl: 16px;
  --hula-radius-2xl: 20px;
  --hula-shadow-panel: 0 4px 24px rgba(0, 0, 0, 0.08);
  --hula-shadow-bubble: 0 1px 2px rgba(0, 0, 0, 0.06);
  --hula-border-layout-divider: #e8e8e8;
  --hula-accent-dim: #0f7a66;
  --hula-accent-soft: rgba(19, 152, 127, 0.1);
  --hula-accent-active: rgba(19, 152, 127, 0.25);

  /* === 会话选中态渐变（浅色）=== */
  --hula-surface-session-active: linear-gradient(135deg, #4ecdc4 0%, #3db8a8 100%);
  --hula-surface-session-active-shadow: 0 2px 10px rgba(78, 205, 196, 0.3);
}
```

- [ ] **Step 3: 在 variable.scss 添加全局动画**

在 `variable.scss` 的 `@keyframes linearAnimation` 之后添加：

```scss
// 消息进入动画 — 对齐 TJG 原型
@keyframes msgIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// 打字指示器动画
@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

// TJG 登录窗口动画渐变背景
@keyframes authBgMove {
  0%, 100% {
    background-size: 130vmax 130vmax, 80vmax 80vmax, 90vmax 90vmax, 110vmax 110vmax, 90vmax 90vmax;
    background-position: -80vmax -80vmax, 60vmax -30vmax, 10vmax 10vmax, -30vmax -10vmax, 50vmax 50vmax;
  }
  25% {
    background-size: 100vmax 100vmax, 90vmax 90vmax, 100vmax 100vmax, 90vmax 90vmax, 60vmax 60vmax;
    background-position: -60vmax -90vmax, 50vmax -40vmax, 0vmax -20vmax, -40vmax -20vmax, 40vmax 60vmax;
  }
  50% {
    background-size: 80vmax 80vmax, 110vmax 110vmax, 80vmax 80vmax, 60vmax 60vmax, 80vmax 80vmax;
    background-position: -50vmax -70vmax, 40vmax -30vmax, 10vmax 0vmax, 20vmax 10vmax, 30vmax 70vmax;
  }
  75% {
    background-size: 90vmax 90vmax, 90vmax 90vmax, 100vmax 100vmax, 90vmax 90vmax, 70vmax 70vmax;
    background-position: -50vmax -40vmax, 50vmax -30vmax, 20vmax 0vmax, -10vmax 10vmax, 40vmax 60vmax;
  }
}
```

- [ ] **Step 4: 验证 token 无冲突**

Run: `pnpm vue-tsc --noEmit`
Expected: 无类型错误（token 为 CSS 变量，不影响 TS）

- [ ] **Step 5: Commit**

```bash
git add src/styles/css/design-tokens.css src/styles/scss/global/variable.scss
git commit -m "feat: add TJG prototype design tokens (surface colors, radius, shadow, session active gradient)"
```

---

## Task 2: 主容器布局优化

**Files:**
- Modify: `src/layout/index.vue`

**Interfaces:**
- Consumes: `--hula-surface-deepest`, `--hula-shadow-panel`, `--hula-radius-xl`
- Produces: 主容器圆角、阴影、背景优化

- [ ] **Step 1: 修改主容器样式**

修改 `src/layout/index.vue` 第 2-5 行：

```vue
<template>
  <div
    id="layout"
    class="relative flex min-w-310px h-full overflow-hidden"
    :class="{ 'is-dragging-files': isDraggingFiles }"
    style="background: var(--hula-surface-deepest); border-radius: var(--hula-radius-xl); box-shadow: var(--hula-shadow-panel);">
```

原 `bg-[--right-bg-color]` 改为内联样式以支持多属性。

- [ ] **Step 2: 验证布局渲染**

Run: `pnpm dev`（浏览器模式，无需 Tauri）
Expected: 主容器显示圆角和阴影效果

- [ ] **Step 3: Commit**

```bash
git add src/layout/index.vue
git commit -m "feat: optimize main layout container with rounded corners and panel shadow"
```

---

## Task 3: 左侧导航栏优化

**Files:**
- Modify: `src/layout/left/index.vue`
- Modify: `src/layout/left/style.scss`
- Modify: `src/layout/left/components/LeftAvatar.vue`

**Interfaces:**
- Consumes: `--left-bg-color`, `--left-active-bg-color`, `--hula-surface-sidebar`, `--hula-surface-sidebar-hover`, `--hula-surface-sidebar-selected`, `--hula-color-primary-500`
- Produces: 64px 宽度导航栏、teal 背景、激活态左侧指示条、头像在线状态点

- [ ] **Step 1: 修改左侧栏宽度和背景**

修改 `src/layout/left/index.vue` 第 2-6 行：

```vue
<template>
  <div class="h-full flex flex-col" style="background: var(--left-bg-color)">
    <!-- macOS 标题栏占位 -->
    <div style="background: var(--left-bg-color)" class="h-30px flex-shrink-0"></div>
    <main
      :class="`left ${leftMinWidthClass} h-full p-[0_6px_40px] box-border flex-col-center select-none`"
      data-tauri-drag-region>
```

- [ ] **Step 2: 覆盖左侧栏样式以匹配原型 nav-bar**

修改 `src/layout/left/style.scss`，在 `.left` 规则后添加：

```scss
.left {
  background: var(--left-bg-color);
  border-right: 1px solid var(--hula-border-layout-divider);
}

/* 导航图标按钮 — 对齐原型 nav-icon */
.top-action,
.bottom-action {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--hula-radius-sm);
  transition: all 0.15s ease;

  &:not(.active):hover {
    background: var(--hula-surface-sidebar-hover);
    color: var(--left-text-color);
  }
}

/* 激活态左侧指示条 — 原型 nav-icon.active::before */
.top-action.active,
.bottom-action.active {
  background: var(--hula-surface-sidebar-selected);
  color: var(--left-active-icon-color);
  border-radius: var(--hula-radius-sm);

  &::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 22px;
    background: var(--hula-color-primary-500);
    border-radius: 0 3px 3px 0;
  }
}
```

- [ ] **Step 3: 修改 LeftAvatar 组件添加在线状态指示**

修改 `src/layout/left/components/LeftAvatar.vue`，在头像元素上添加在线状态点：

```vue
<div class="relative cursor-pointer">
  <n-avatar
    :size="40"
    round
    :src="avatarUrl"
    :fallback-src="fallbackSrc" />
  <!-- 在线状态指示点 — 对齐原型 nav-avatar.online::after -->
  <span
    v-if="isOnline"
    class="absolute right-[-1px] bottom-[-1px] w-11px h-11px rounded-full"
    style="background: var(--hula-status-online); border: 2px solid var(--left-bg-color);">
  </span>
</div>
```

- [ ] **Step 4: 运行格式检查**

Run: `pnpm check`
Expected: 无格式错误

- [ ] **Step 5: Commit**

```bash
git add src/layout/left/
git commit -m "feat: optimize left sidebar navigation to match TJG prototype (teal bg, active indicator, online dot)"
```

---

## Task 4: 中间栏（会话列表区域）优化

**Files:**
- Modify: `src/layout/center/index.vue`
- Modify: `src/components/workbench/ListWorkbenchShell.vue`
- Modify: `src/components/workbench/MessageSessionToolbar.vue`

**Interfaces:**
- Consumes: `--center-bg-color`, `--hula-border-layout-divider`, `--hula-surface-search-dark`
- Produces: 中间栏白色背景、圆角、边框、搜索框样式

- [ ] **Step 1: 修改中间栏容器样式**

修改 `src/layout/center/index.vue` 第 2-8 行：

```vue
<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    :class="{ 'rounded-r-8px': isShrink }"
    class="resizable select-none flex flex-col min-h-0"
    style="background: var(--center-bg-color); border-right: 1px solid var(--hula-border-layout-divider);">
```

移除原有的 `bg-[--center-bg-color] border-r-(1px solid [--hula-border-layout-divider])` UnoCSS 类，改用内联样式以支持动态主题。

- [ ] **Step 2: 优化列表外壳头部**

修改 `src/components/workbench/ListWorkbenchShell.vue`，将头部搜索区域背景改为原型风格：

```vue
<header class="px-16px pt-14px pb-10px flex items-center justify-between border-b border-[--hula-border-layout-divider]">
  <h2 class="text-16px font-semibold color-[--hula-text-primary]">{{ title }}</h2>
  <div class="flex gap-6px">
    <!-- 操作按钮使用原型 icon-btn 样式 -->
  </div>
</header>
```

- [ ] **Step 3: 优化搜索框样式**

修改 `src/components/workbench/MessageSessionToolbar.vue`，将搜索输入框背景改为原型 `--bg-search` 风格：

```vue
<div class="flex items-center gap-8px px-12px py-8px rounded-[var(--hula-radius-sm)]"
  style="background: var(--hula-surface-search-dark);">
  <svg class="size-16px color-[--hula-text-tertiary]"><use href="#search" /></svg>
  <input
    type="text"
    class="flex-1 bg-transparent border-none outline-none text-13px color-[--hula-text-primary]"
    :placeholder="t('home.search.placeholder')"
    v-model="searchKeyword" />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/layout/center/index.vue src/components/workbench/
git commit -m "feat: optimize center panel session list styling per TJG prototype (white bg, search bar)"
```

---

## Task 5: 会话列表项（Room List Item）优化

**Files:**
- Modify: `src/components/workbench/HulaRoomListItem.vue`

**Interfaces:**
- Consumes: `--hula-surface-list-hover`, `--hula-surface-list-selected`, `--hula-surface-session-active`, `--hula-surface-session-active-shadow`, `--hula-color-primary-500`
- Produces: 原型 room-item 风格（圆角、悬停、激活态左侧指示条、teal 渐变卡片）

- [ ] **Step 1: 修改会话项容器样式**

修改 `HulaRoomListItem.vue` 的 `.hula-room-list-item` 规则（约第 242 行）：

```scss
.hula-room-list-item {
  min-height: 68px; // 原型约 68px
  padding: 10px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  user-select: none;
  border-radius: var(--hula-radius-sm); // 8px
  margin: 0 8px 4px;
  border: 1px solid transparent;
  display: flex;
  gap: 10px;
  position: relative;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--hula-color-primary-500);
    outline-offset: 2px;
  }

  &:active {
    background: var(--hula-surface-list-selected);
  }
```

- [ ] **Step 2: 修改选中态为 teal 渐变卡片**

在 `&--selected` 规则中（约第 268 行）修改为原型风格的 teal 渐变卡片：

```scss
  &--selected {
    background: var(--hula-surface-session-active);
    box-shadow: var(--hula-surface-session-active-shadow);
    border: 1px solid transparent;

    // 原型 room-item.active::before — 左侧品牌色指示条（可选，渐变卡片已足够区分）
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      bottom: 10px;
      width: 3px;
      background: var(--hula-color-primary-500);
      border-radius: 0 3px 3px 0;
    }

    .hula-room-list-item__name {
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
    }

    .hula-room-list-item__time {
      color: rgba(255, 255, 255, 0.8);
    }

    .hula-room-list-item__preview {
      color: rgba(255, 255, 255, 0.7);
    }

    .hula-room-list-item__placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    .hula-room-list-item__typing {
      color: rgba(255, 255, 255, 0.9);
    }

    .n-icon {
      color: rgba(255, 255, 255, 0.7) !important;
    }
  }
```

- [ ] **Step 3: 修改头像圆角为方形圆角**

修改模板中的 `n-avatar`（约第 23-27 行），将 `round` 改为原型风格的方形圆角：

```vue
<n-avatar
  :size="42"
  :src="AvatarUtils.getAvatarUrl(avatarSrc)"
  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
  style="border-radius: var(--hula-radius-sm);" />
```

- [ ] **Step 4: 调整文字样式匹配原型**

```scss
.hula-room-list-item__name {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--hula-text-primary);
}

.hula-room-list-item__time {
  font-size: 11px;
  line-height: 18px;
  color: var(--hula-text-muted); // 使用原型 --text-muted: #707070
}

.hula-room-list-item__preview {
  font-size: 12px;
  line-height: 18px;
  color: var(--hula-text-secondary);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workbench/HulaRoomListItem.vue
git commit -m "feat: redesign room list item with teal gradient active card and TJG prototype styling"
```

---

## Task 6: 右侧聊天区域优化

**Files:**
- Modify: `src/layout/right/index.vue`

**Interfaces:**
- Consumes: `--right-bg-color`, `--right-theme-bg-color`, `--hula-border-layout-divider`
- Produces: 聊天面板暗色背景、边框、渐变背景保留

- [ ] **Step 1: 修改右侧栏容器样式**

修改 `src/layout/right/index.vue` 第 3-6 行：

```vue
<template>
  <!-- Step 2.3：视图驱动动态宽度 + 拖拽调整 + 响应式断点全屏 -->
  <main
    data-tauri-drag-region
    class="flex flex-col min-h-0 relative"
    :class="{
      'right-pane-animated': transitionEnabled,
      'flex-1 w-full': isRightPaneFullscreen || isChatFlexMode
    }"
    style="background: var(--right-bg-color); border-left: 1px solid var(--hula-border-layout-divider);"
    :style="isRightPaneFullscreen || isChatFlexMode ? undefined : { width: `${paneWidth}px`, flex: '0 0 auto' }">
```

- [ ] **Step 2: 保留主题渐变背景**

确认第 25 行的主题渐变背景代码保留：

```vue
<div
  :style="{ background: shouldShowChat ? 'var(--right-theme-bg-color)' : '' }"
  data-tauri-drag-region
  class="flex-1 flex flex-col min-h-0">
```

- [ ] **Step 3: Commit**

```bash
git add src/layout/right/index.vue
git commit -m "feat: refine right chat panel with dark background and border styling"
```

---

## Task 7: 消息气泡样式优化

**Files:**
- Modify: `src/components/chat/ChatBox.vue` 或消息气泡组件（需确认实际路径）
- Modify: `src/styles/scss/global/variable.scss`（如需添加气泡动画）

**Interfaces:**
- Consumes: `--hula-surface-panel-muted`, `--hula-surface-elevated`, `--hula-color-primary-500`, `--hula-shadow-bubble`
- Produces: 原型 msg-bubble 风格（不对称圆角、阴影、发送方品牌色背景）

- [ ] **Step 1: 定位消息气泡组件**

Run: `find src/components -name "*Bubble*" -o -name "*Message*" | head -20`
Expected: 找到消息气泡渲染组件

- [ ] **Step 2: 修改他人消息气泡样式**

在气泡组件的 SCSS 中添加（对应需求文档 §3.2.2）：

```scss
.msg-bubble-others {
  padding: 9px 13px;
  border-radius: 12px 12px 12px 4px; // 不对称圆角：接收消息
  background: var(--hula-surface-elevated);
  color: var(--hula-text-primary);
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
  box-shadow: var(--hula-shadow-bubble);
}
```

- [ ] **Step 3: 修改自己消息气泡样式**

```scss
.msg-bubble-self {
  padding: 9px 13px;
  border-radius: 12px 12px 4px 12px; // 不对称圆角：发送消息
  background: var(--hula-color-primary-500);
  color: var(--hula-text-inverse);
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
  box-shadow: var(--hula-shadow-bubble);
}
```

- [ ] **Step 4: 添加消息进入动画**

```scss
.msg-row {
  display: flex;
  gap: 10px;
  max-width: 75%;
  animation: msgIn 0.15s ease-out;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ src/styles/scss/global/variable.scss
git commit -m "feat: redesign message bubbles with asymmetric rounded corners and TJG prototype styling"
```

---

## Task 8: 聊天输入框优化

**Files:**
- Modify: `src/components/chat/ChatInput.vue` 或输入框组件（需确认实际路径）

**Interfaces:**
- Consumes: `--hula-surface-dark-mid`, `--hula-color-primary-500`
- Produces: 原型 input-area 风格（工具栏、圆角输入框、发送按钮、placeholder 文案）

- [ ] **Step 1: 定位输入框组件**

Run: `find src/components -name "*Input*" | grep -i chat | head -10`
Expected: 找到聊天输入框组件

- [ ] **Step 2: 修改输入区域容器**

```vue
<div class="px-18px pt-12px pb-14px flex-shrink-0"
  style="background: var(--hula-surface-dark-mid); border-top: 1px solid var(--hula-border-layout-divider);">
```

- [ ] **Step 3: 修改输入框样式**

```vue
<div class="flex gap-10px items-end"
  style="background: var(--hula-surface-panel-muted); border-radius: var(--hula-radius-sm); padding: 8px 10px; border: 1px solid transparent;"
  :class="{ 'border-color-[--hula-color-primary-500]': isFocused }">
  <textarea
    class="flex-1 bg-transparent border-none outline-none resize-none text-13px color-[--hula-text-primary]"
    style="font-family: var(--hula-font-family); line-height: 1.5; max-height: 80px; min-height: 20px;"
    v-model="inputText"
    :placeholder="t('chat.input.placeholder', '善言一句暖人心，恶语一句伤人心')"
    @focus="isFocused = true"
    @blur="isFocused = false" />
</div>
```

- [ ] **Step 4: 修改发送按钮**

```vue
<button
  class="px-16px py-7px text-13px font-medium cursor-pointer border-none"
  style="background: var(--hula-color-primary-500); color: var(--hula-text-inverse); border-radius: var(--hula-radius-sm);"
  :disabled="!inputText.trim()"
  @click="sendMessage">
  {{ t('chat.send') }}
</button>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/
git commit -m "feat: redesign chat input area with TJG prototype placeholder and styling"
```

---

## Task 9: 登录窗口背景优化

**Files:**
- Modify: `src/views/loginWindow/Login.vue`
- Modify: `src/styles/scss/login.scss`

**Interfaces:**
- Consumes: 现有登录逻辑
- Produces: 原型 auth-window 动画渐变背景（TJG 标志性设计）

- [ ] **Step 1: 添加登录窗口背景动画**

在 `src/styles/scss/login.scss` 末尾添加：

```scss
/* TJG 标志性动画渐变背景 — 登录窗口 */
.login-bg-animated {
  position: relative;
  overflow: hidden;
  border-radius: var(--hula-radius-xl);
  background-color: #0F2027;
  background-image:
    radial-gradient(closest-side, #2c5a53, rgba(44, 90, 83, 0)),
    radial-gradient(closest-side, #2a4a75, rgba(32, 58, 67, 0)),
    radial-gradient(closest-side, #5a3d5c80, rgba(44, 62, 80, 0)),
    radial-gradient(closest-side, #164A41, rgba(22, 74, 65, 0)),
    radial-gradient(closest-side, #203A43, rgba(77, 105, 110, 0));
  background-size:
    130vmax 130vmax, 80vmax 80vmax, 90vmax 90vmax,
    110vmax 110vmax, 90vmax 90vmax;
  background-position:
    -80vmax -80vmax, 60vmax -30vmax, 10vmax 10vmax,
    -30vmax -10vmax, 50vmax 50vmax;
  background-repeat: no-repeat;
  animation: authBgMove 8s linear infinite;
  box-shadow: var(--hula-shadow-panel), 0 0 0 1px rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 2: 应用背景到登录组件**

修改 `src/views/loginWindow/Login.vue`，在最外层容器添加背景类：

```vue
<n-config-provider
  :theme="naiveTheme"
  data-tauri-drag-region
  class="login-box size-full rounded-8px select-none login-bg-animated">
```

- [ ] **Step 3: Commit**

```bash
git add src/views/loginWindow/Login.vue src/styles/scss/login.scss
git commit -m "feat: add TJG animated gradient background to login window"
```

---

## Task 10: 全局验证与收尾

**Files:**
- 所有已修改文件

**Interfaces:**
- Consumes: 全部任务产出
- Produces: 验证通过的 UI 优化成果

- [ ] **Step 1: 运行类型检查**

Run: `pnpm vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 2: 运行格式检查**

Run: `pnpm check`
Expected: 无格式错误（如有则运行 `pnpm check:write` 自动修复）

- [ ] **Step 3: 运行单元测试**

Run: `pnpm test:run`
Expected: 所有测试通过

- [ ] **Step 4: 浏览器预览验证**

Run: `pnpm dev`
Expected:
- 主容器显示圆角和阴影
- 左侧导航栏 64px 宽度，teal 背景，激活项有左侧指示条
- 中间栏白色背景，搜索框灰色背景
- 会话列表项有圆角和悬停效果，选中态显示 teal 渐变卡片
- 选中会话项有左侧品牌色指示条
- 右侧栏暗色背景，聊天区域保留渐变背景
- 消息气泡有不对称圆角（接收 12px12px12px4px，发送 12px12px4px12px）
- 输入框区域有正确的背景和边框，placeholder 显示 "善言一句暖人心，恶语一句伤人心"
- 登录窗口有动画渐变背景

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete TJG prototype UI optimization across all panels"
```

---

## Self-Review

**1. Spec coverage:**

| 需求文档条款 | 原型需求 | 对应任务 |
|---------|---------|---------|
| §1.3.2 三栏配色 | 左侧 teal `#64a29c` / 中间白色 `#ffffff` / 右侧渐变 | Task 1 (Token), Task 3 (左侧), Task 4 (中间), Task 6 (右侧) |
| §1.3.3 左侧导航栏 | 64px 宽度、激活态左侧指示条、在线状态点 | Task 3 |
| §1.3.4 中间会话列表 | 搜索框灰色背景、会话项圆角卡片、选中态 teal 渐变 | Task 4, Task 5 |
| §1.3.5 右侧聊天区 | 渐变背景、聊天头部工具栏、消息气泡、输入框 | Task 6, Task 7, Task 8 |
| §3.2.2 消息气泡 | 不对称圆角 `12px12px12px4px` / `12px12px4px12px` | Task 7 |
| §3.1.1 登录页面 | 动画渐变背景 | Task 9 |
| §2.1.4 表面色 | `--hula-surface-sidebar` / `--hula-surface-panel` / `--hula-surface-deepest` | Task 1 |
| §2.4 圆角系统 | `--hula-radius-sm` / `--hula-radius-md` / `--hula-radius-lg` / `--hula-radius-xl` | Task 1 |
| §2.5 阴影系统 | `--hula-shadow-panel` / `--hula-shadow-bubble` | Task 1 |
| §6.6 动画效果 | `msgIn` / `typing` / `authBgMove` | Task 1 |

**2. Placeholder scan:** 无 TBD/TODO/"implement later" / "add appropriate error handling" / "similar to Task N" 等占位符。

**3. Type consistency:**
- CSS 变量名在 Task 1 定义后，Task 2-10 统一使用相同名称
- 圆角统一使用 `var(--hula-radius-sm)` / `var(--hula-radius-md)` / `var(--hula-radius-lg)` / `var(--hula-radius-xl)`
- 颜色统一使用 `var(--hula-color-primary-500)` 等品牌色系
- 边框统一使用 `var(--hula-border-layout-divider)`
- 会话选中态渐变统一使用 `var(--hula-surface-session-active)`

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-02-tjg-prototype-ui-optimization.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
