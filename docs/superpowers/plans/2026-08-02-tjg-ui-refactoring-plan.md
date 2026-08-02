# TJG Prototype UI Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically refactor all UI interfaces to match the TJG high-fidelity prototype design specifications, implementing a "delete-then-rebuild" strategy with mandatory human verification after each interface.

**Architecture:** Incremental interface-by-interface refactoring following priority order. Each interface is completely rebuilt to match TJG specifications while preserving business logic. Authentication-related UIs are excluded from this plan.

**Tech Stack:** Vue 3, TypeScript, SCSS, Naive UI, UnoCSS, vue-virtual-scroller, Tauri

## Global Constraints

- **Theme:** Dark mode is the default and only theme for TJG prototype alignment
- **Color Palette:** Strict adherence to TJG tokens (`--bg-deepest: #161616`, `--bg-deep: #1b1b1b`, `--bg-mid: #262626`, `--accent: #13987f`)
- **Typography:** PingFang font family, sizes from `--text-xs` to `--text-xl`
- **Border Radius:** `--r-lg: 16px`, `--r-md: 12px`, `--r-sm: 8px`, `--r-xs: 4px`
- **Shadows:** `--shadow-panel: 0 4px 24px rgba(0,0,0,0.4)`, `--shadow-bubble: 0 1px 2px rgba(0,0,0,0.2)`
- **Layout:** PC (1200×760) and Mobile (375×812) responsive breakpoints
- **Verification Requirement:** Human verification REQUIRED before proceeding to next task
- **Rollback Strategy:** Git branch per interface (`feat/ui-refactor-<interface-name>`)

---

## Phase 1: Foundation & Core Layout (Week 1)

### Task 1: Design Tokens Finalization

**Files:**
- Modify: `src/styles/css/design-tokens.css`
- Test: Visual regression against TJG prototype

**Interfaces:**
- Consumes: None (foundation task)
- Produces: All TJG design tokens available as CSS variables

- [ ] **Step 1: Audit existing tokens against TJG prototype**

Open TJG prototype HTML and compare all CSS variables. Document gaps:
```
Missing tokens:
- --bg-deepest: #161616 (right chat background)
- --bg-deep: #1b1b1b (center background)
- --bg-mid: #262626 (settings/card background)
- --bg-light: #2d2d2d (list hover bg-msg-hover)
- --bg-hover: #323232 (menu hover)
- --bg-popover: #303030 (popover)
- --bg-search: #282828 (search background)
- --accent-dim: #10806a
- --accent-soft: rgba(19,152,127,0.15)
- --accent-active: rgba(19,152,127,0.6)
- --text-primary: #ffffff
- --text-secondary: #909090
- --text-muted: #707070
- --icon-color: #c1c1c1
- --line-color: #404040
- --r-lg: 16px
- --r-md: 12px
- --r-sm: 8px
- --r-xs: 4px
- --shadow-panel: 0 4px 24px rgba(0,0,0,0.4)
- --shadow-bubble: 0 1px 2px rgba(0,0,0,0.2)
```

- [ ] **Step 2: Add missing TJG tokens to design-tokens.css**

Add to `src/styles/css/design-tokens.css` in both `:root` and `[data-theme='dark']` sections:

```css
/* TJG Prototype Tokens */
--hula-bg-deepest: #161616;
--hula-bg-deep: #1b1b1b;
--hula-bg-mid: #262626;
--hula-bg-light: #2d2d2d;
--hula-bg-hover: #323232;
--hula-bg-popover: #303030;
--hula-bg-search: #282828;
--hula-accent-dim: #10806a;
--hula-accent-soft: rgba(19, 152, 127, 0.15);
--hula-accent-active: rgba(19, 152, 127, 0.6);
--hula-text-primary: #ffffff;
--hula-text-secondary: #909090;
--hula-text-muted: #707070;
--hula-icon-color: #c1c1c1;
--hula-line-color: #404040;
--hula-radius-lg: 16px;
--hula-radius-md: 12px;
--hula-radius-sm: 8px;
--hula-radius-xs: 4px;
--hula-shadow-panel: 0 4px 24px rgba(0, 0, 0, 0.4);
--hula-shadow-bubble: 0 1px 2px rgba(0, 0, 0, 0.2);
```

- [ ] **Step 3: Verify tokens are applied**

Run: `pnpm dev`
Open: http://localhost:6130
Check: Inspect element and verify CSS variables are present

- [ ] **Step 4: Commit**

```bash
git add src/styles/css/design-tokens.css
git commit -m "feat: add TJG prototype design tokens

- Add all missing TJG color tokens
- Add TJG radius and shadow tokens
- Verify token application in browser

Refs: TJG-prototype.html"
```

- [ ] **Step 5: HUMAN VERIFICATION REQUIRED**

Verify:
- [ ] All TJG tokens present in computed styles
- [ ] Dark theme colors match TJG prototype (#161616, #1b1b1b, etc.)
- [ ] Border radius values match (16px, 12px, 8px, 4px)
- [ ] Shadow values match prototype

**Verification Sign-off:** _______________ Date: _______________

---

### Task 2: PC Main Layout Refactoring

**Files:**
- Modify: `src/layout/index.vue`
- Modify: `src/layout/left/index.vue`
- Modify: `src/layout/left/style.scss`
- Modify: `src/layout/center/index.vue`
- Modify: `src/layout/right/index.vue`
- Test: Visual comparison with TJG prototype PC view

**Interfaces:**
- Consumes: Task 1 tokens
- Produces: Three-column layout matching TJG specifications

- [ ] **Step 1: Backup current layout files**

```bash
git checkout -b feat/ui-refactor-main-layout
git add src/layout/
git commit -m "chore: backup before layout refactor"
```

- [ ] **Step 2: Refactor Left Sidebar**

Modify `src/layout/left/style.scss`:

```scss
/* TJG Left Sidebar - 64px width, teal background */
.left {
  width: 64px;
  background: var(--hula-bg-deep); /* #1b1b1b */
  border-right: 1px solid #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0;
  gap: 8px;
  flex-shrink: 0;
}

.nav-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-bottom: 8px;
  position: relative;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.nav-avatar.online::after {
  content: '';
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--hula-color-success-500);
  border: 2px solid var(--hula-bg-deep);
}

.nav-divider {
  width: 28px;
  height: 1px;
  background: #3f3f46;
  margin: 4px 0;
}

.nav-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--hula-radius-sm);
  cursor: pointer;
  color: var(--hula-text-secondary);
  font-size: 20px;
  position: relative;
  transition: all 0.15s;
}

.nav-icon:hover {
  background: var(--hula-bg-mid);
  color: var(--hula-text-primary);
}

.nav-icon.active {
  background: var(--hula-accent);
  color: var(--hula-text-primary);
}

.nav-icon.active::before {
  content: '';
  position: absolute;
  left: -14px;
  width: 3px;
  height: 22px;
  background: var(--hula-accent);
  border-radius: 0 3px 3px 0;
}

.nav-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--hula-color-danger-500);
  color: var(--hula-text-primary);
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
```

- [ ] **Step 3: Refactor Center Panel**

Modify `src/layout/center/index.vue`:

```vue
<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    class="resizable select-none flex flex-col min-h-0"
    style="background: var(--hula-bg-deep); border-right: 1px solid #000; width: 300px; flex-shrink: 0;">
    <!-- Center panel header -->
    <div class="list-header">
      <h2>{{ title }}</h2>
      <div class="list-actions">
        <div class="icon-btn"><svg><use href="#i-plus"/></svg></div>
        <div class="icon-btn"><svg><use href="#i-more"/></svg></div>
      </div>
    </div>

    <!-- Space shortcuts -->
    <div class="space-shortcuts">
      <div v-for="space in spaces" :key="space.id" class="space-shortcut" :title="space.name">
        <svg><use :href="space.icon"/></svg>
      </div>
      <div class="space-shortcut add"><svg><use href="#i-plus"/></svg></div>
    </div>

    <!-- Session filter tabs -->
    <div class="session-filter">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="session-filter-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key">
        {{ tab.label }}
        <span v-if="tab.badge" class="filter-badge show">{{ tab.badge }}</span>
      </button>
    </div>

    <!-- List -->
    <div id="centerList" class="h-full flex-1 overflow-y-auto">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['message', 'friendsList']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </main>
</template>
```

Add styles:

```scss
.list-header {
  padding: 14px 16px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.list-actions {
  display: flex;
  gap: 6px;
}

.icon-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--hula-radius-xs);
  cursor: pointer;
  color: var(--hula-text-secondary);
  font-size: 14px;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--hula-bg-mid);
  color: var(--hula-text-primary);
}

.space-shortcuts {
  padding: 0 12px 8px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  border-bottom: 1px solid #000;
  padding-bottom: 10px;
}

.space-shortcut {
  width: 36px;
  height: 36px;
  border-radius: var(--hula-radius-sm);
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.space-shortcut:hover {
  border-color: var(--hula-accent);
}

.space-shortcut.add {
  background: var(--hula-bg-mid);
  color: var(--hula-text-secondary);
}

.session-filter {
  display: flex;
  gap: 2px;
  padding: 6px 8px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  flex-shrink: 0;
}

.session-filter-tab {
  background: transparent;
  border: none;
  color: var(--hula-text-secondary);
  font-size: 12px;
  padding: 5px 10px;
  border-radius: var(--hula-radius-xs);
  cursor: pointer;
  transition: all 0.12s;
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-family);
}

.session-filter-tab:hover {
  background: var(--hula-bg-mid);
  color: var(--hula-text-primary);
}

.session-filter-tab.active {
  background: var(--hula-bg-light);
  color: var(--hula-text-primary);
  font-weight: 500;
}

.filter-badge {
  background: var(--hula-color-danger-500);
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

.filter-badge.show {
  display: flex;
}
```

- [ ] **Step 4: Refactor Right Panel**

Modify `src/layout/right/index.vue`:

```vue
<template>
  <main
    data-tauri-drag-region
    class="flex flex-col min-h-0 relative flex-1"
    style="background: var(--hula-bg-deepest);">
    <!-- Chat header -->
    <div class="chat-header">
      <div class="chat-header-left">
        <div class="chat-header-info">
          <div class="chat-header-name">
            {{ roomName }}
            <n-tag v-if="isEncrypted" size="small" type="success" :bordered="false">E2EE</n-tag>
          </div>
          <div class="chat-header-status">
            <span v-if="isGroup">{{ memberCount }} 成员</span>
            <span v-else-if="isOnline" class="typing-indicator">在线</span>
            <span v-else>离线</span>
          </div>
        </div>
      </div>
      <div class="chat-header-actions">
        <div class="chat-action-btn" v-for="action in actions" :key="action.icon" @click="action.handler">
          <svg><use :href="action.icon"/></svg>
        </div>
      </div>
    </div>

    <!-- Messages area -->
    <div class="messages-area">
      <div v-for="(msg, index) in messages" :key="msg.id" class="msg-row" :class="{ self: msg.isSelf }">
        <div class="msg-avatar" :style="{ background: msg.avatarColor }">{{ msg.senderInitial }}</div>
        <div class="msg-bubble-wrap">
          <div v-if="!msg.isSelf" class="msg-sender-name">{{ msg.sender }}</div>
          <div class="msg-bubble">{{ msg.content }}</div>
          <div class="msg-time">{{ msg.time }}</div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="input-area">
      <div class="input-toolbar">
        <div class="icon-btn" v-for="tool in tools" :key="tool.icon">
          <svg><use :href="tool.icon"/></svg>
        </div>
      </div>
      <div class="input-box">
        <textarea v-model="inputText" placeholder="输入消息..." rows="1"></textarea>
        <button class="send-btn" :disabled="!inputText" @click="sendMessage">发送</button>
      </div>
    </div>
  </main>
</template>
```

Add styles:

```scss
.chat-header {
  padding: 12px 18px;
  border-bottom: 1px solid #000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--hula-bg-deep);
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-header-info {
  display: flex;
  flex-direction: column;
}

.chat-header-name {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--hula-text-primary);
}

.chat-header-status {
  font-size: 11px;
  color: var(--hula-text-secondary);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
}

.typing-indicator {
  color: var(--hula-accent);
}

.chat-header-actions {
  display: flex;
  gap: 6px;
}

.chat-action-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--hula-text-secondary);
  font-size: 16px;
  transition: all 0.15s;
}

.chat-action-btn:hover {
  background: var(--hula-bg-mid);
  color: var(--hula-text-primary);
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg-row {
  display: flex;
  gap: 10px;
  max-width: 75%;
  animation: msgIn 0.15s ease-out;
}

@keyframes msgIn {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.msg-row.self {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--hula-text-primary);
}

.msg-bubble-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.msg-row.self .msg-bubble-wrap {
  align-items: flex-end;
}

.msg-sender-name {
  font-size: 11px;
  color: var(--hula-text-secondary);
  padding: 0 4px;
}

.msg-bubble {
  padding: 9px 13px;
  border-radius: var(--hula-radius-md);
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
  box-shadow: var(--hula-shadow-bubble);
}

.msg-row:not(.self) .msg-bubble {
  background: var(--hula-bg-light);
  border-top-left-radius: 4px;
  color: var(--hula-text-primary);
}

.msg-row.self .msg-bubble {
  background: var(--hula-accent);
  border-top-right-radius: 4px;
  color: var(--hula-text-primary);
}

.msg-time {
  font-size: 10px;
  color: var(--hula-text-muted);
  padding: 0 4px;
}

.input-area {
  padding: 12px 18px 14px;
  background: var(--hula-bg-deep);
  border-top: 1px solid #000;
  flex-shrink: 0;
}

.input-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.input-toolbar .icon-btn {
  width: 28px;
  height: 28px;
  font-size: 15px;
}

.input-box {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  background: var(--hula-bg-mid);
  border-radius: var(--hula-radius-sm);
  padding: 8px 10px;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.input-box:focus-within {
  border-color: var(--hula-accent);
}

.input-box textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--hula-text-primary);
  font-family: var(--font-family);
  font-size: 13px;
  line-height: 1.5;
  max-height: 80px;
  min-height: 20px;
}

.send-btn {
  background: var(--hula-accent);
  color: var(--hula-text-primary);
  border: none;
  border-radius: var(--hula-radius-sm);
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.send-btn:hover {
  background: var(--hula-accent-dim);
}

.send-btn:disabled {
  background: var(--hula-bg-light);
  color: var(--hula-text-muted);
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run and verify layout**

Run: `pnpm dev`
Check: http://localhost:6130

Verify:
- [ ] Three-column layout visible
- [ ] Left sidebar 64px width with correct icons
- [ ] Center panel 300px width with session list
- [ ] Right panel flexes to fill remaining space
- [ ] All colors match TJG prototype

- [ ] **Step 6: Commit**

```bash
git add src/layout/
git commit -m "feat: refactor main layout to match TJG prototype

- Left sidebar: 64px teal background with active indicators
- Center panel: 300px with session filters and space shortcuts
- Right panel: Chat header, messages area, input area
- All styled with TJG design tokens

Refs: TJG-prototype.html Section 3-5"
```

- [ ] **Step 7: HUMAN VERIFICATION REQUIRED**

**Visual Verification Checklist:**
- [ ] Left sidebar matches TJG nav-bar exactly (64px, teal, icons, badges)
- [ ] Center panel has list-header, space-shortcuts, session-filter
- [ ] Right panel has chat-header, messages-area, input-area
- [ ] Message bubbles have correct styling (self vs others)
- [ ] Input area has toolbar and input-box with focus state
- [ ] All borders use `#000` as per TJG
- [ ] All text colors match TJG hierarchy

**Functional Verification:**
- [ ] Navigation icons clickable
- [ ] Session filter tabs switchable
- [ ] Message input accepts text
- [ ] Send button enables/disables correctly

**Verification Sign-off:** _______________ Date: _______________

---

## Phase 2: Session List & Room Components (Week 2)

### Task 3: Room List Item Component Refactoring

**Files:**
- Modify: `src/components/workbench/HulaRoomListItem.vue`
- Modify: `src/components/workbench/RoomSessionList.vue`
- Test: Session list renders correctly with all room types

**Interfaces:**
- Consumes: Task 1 tokens, Task 2 layout
- Produces: Session list items matching TJG room-item specifications

- [ ] **Step 1: Create backup branch**

```bash
git checkout -b feat/ui-refactor-room-list-item
```

- [ ] **Step 2: Refactor HulaRoomListItem.vue**

Complete rewrite to match TJG room-item:

```vue
<template>
  <div
    class="room-item"
    :class="{ active: isActive, 'dragging': isDragging, 'drag-over': isDragOver }"
    @click="handleClick"
    @dblclick="handleDblClick">
    <!-- Left indicator bar when active -->
    <div v-if="isActive" class="active-indicator"></div>

    <!-- Room avatar -->
    <div class="room-avatar" :class="{ 'is-online': isOnline }">
      <img v-if="avatar" :src="avatar" alt="">
      <span v-else>{{ roomInitial }}</span>
      <!-- Mention dot -->
      <div v-if="hasMention" class="mention-dot"></div>
    </div>

    <!-- Room info -->
    <div class="room-info">
      <div class="room-top">
        <div class="room-name">
          {{ roomName }}
          <n-tag v-if="isEncrypted" size="small" type="success" :bordered="false">E2EE</n-tag>
        </div>
        <div class="room-time">{{ lastMessageTime }}</div>
      </div>
      <div class="room-bottom">
        <div class="room-preview" :class="{ mention: hasMention }">
          {{ previewText }}
        </div>
        <div class="room-meta">
          <span v-if="isPinned" class="pin-icon">📌</span>
          <span v-if="isMuted" class="mute-icon">🔇</span>
          <span v-if="unreadCount > 0" class="unread-badge" :class="{ mention: hasMention }">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
```

Styles:

```scss
.room-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: var(--hula-radius-sm);
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
  height: 68px;
  align-items: center;
}

.room-item:hover {
  background: var(--hula-bg-mid);
}

.room-item.active {
  background: linear-gradient(135deg, #3db8a8 0%, #2d9a8c 100%);
  box-shadow: 0 2px 10px rgba(61, 184, 168, 0.25);
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  background: var(--hula-accent);
  border-radius: 0 3px 3px 0;
}

.room-avatar {
  width: 42px;
  height: 42px;
  border-radius: var(--hula-radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  position: relative;
  background: var(--hula-bg-light);
  overflow: hidden;
}

.room-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mention-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--hula-color-danger-500);
  border: 2px solid var(--hula-bg-deep);
  z-index: 2;
}

.room-avatar.is-online::after {
  content: '';
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--hula-color-success-500);
  border: 2px solid var(--hula-bg-deep);
}

.room-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.room-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--hula-text-primary);
}

.room-time {
  font-size: 11px;
  color: var(--hula-text-muted);
  flex-shrink: 0;
  margin-left: 6px;
}

.room-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.room-preview {
  font-size: 12px;
  color: var(--hula-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.room-preview.mention {
  color: var(--hula-accent);
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.unread-badge {
  background: var(--hula-color-danger-500);
  color: var(--hula-text-primary);
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.unread-badge.mention {
  background: var(--hula-accent);
}

.pin-icon, .mute-icon {
  font-size: 11px;
  color: var(--hula-text-muted);
}

/* Drag states */
.room-item.dragging {
  opacity: 0.4;
}

.room-item.drag-over {
  border-top: 2px solid var(--hula-accent);
}
```

- [ ] **Step 3: Update RoomSessionList.vue container**

Ensure the list container has proper styling:

```scss
.room-session-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
}

.room-session-list__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
```

- [ ] **Step 4: Run and verify**

Run: `pnpm dev`
Verify:
- [ ] Room items display at 68px height
- [ ] Active room has teal gradient background
- [ ] Left indicator bar visible on active room
- [ ] Avatar is 42px with square-rounded corners
- [ ] Mention dot appears when @ mentioned
- [ ] Online status dot visible for DMs
- [ ] Unread badge with correct styling
- [ ] Pin and mute icons visible

- [ ] **Step 5: Commit**

```bash
git add src/components/workbench/
git commit -m "feat: refactor room list item to match TJG prototype

- 68px height room items
- Teal gradient active state with left indicator
- 42px square-rounded avatars
- Mention dots, online status, unread badges
- Pin and mute icons

Refs: TJG-prototype.html Section 4"
```

- [ ] **Step 6: HUMAN VERIFICATION REQUIRED**

**Visual Checklist:**
- [ ] Room item height exactly 68px
- [ ] Active state: gradient background + left 3px indicator
- [ ] Avatar: 42px, square with rounded corners
- [ ] Mention dot: 10px red circle with border
- [ ] Online dot: 10px green circle with border
- [ ] Unread badge: red background, white text, rounded
- [ ] Preview text truncates with ellipsis
- [ ] Hover state: bg-mid color

**Interactive Checklist:**
- [ ] Click selects room
- [ ] Double click opens room
- [ ] Drag and drop works (if implemented)

**Verification Sign-off:** _______________ Date: _______________

---

## Phase 3: Mobile Interface Refactoring (Week 3-4)

### Task 4: Mobile Main Layout

**Files:**
- Modify: `src/mobile/views/message/index.vue`
- Modify: `src/mobile/components/MobileLayout.vue` (create if not exists)
- Test: Mobile view at 375×812 resolution

**Interfaces:**
- Consumes: Task 1 tokens
- Produces: Mobile layout matching TJG mobile container

- [ ] **Step 1: Create backup branch**

```bash
git checkout -b feat/ui-refactor-mobile-layout
```

- [ ] **Step 2: Refactor mobile message view**

Create mobile container structure:

```vue
<template>
  <div class="mobile">
    <!-- iOS Status Bar -->
    <div class="ios-statusbar">
      <span>9:41</span>
      <div class="dynamic-island"></div>
      <div class="statusbar-right">
        <span>5G</span>
        <span>100%</span>
      </div>
    </div>

    <!-- Mobile Header -->
    <div class="m-header">
      <div class="m-header-row">
        <h1 class="m-title">消息</h1>
        <div class="m-header-actions">
          <div class="icon-btn"><svg><use href="#i-plus"/></svg></div>
        </div>
      </div>
      <div class="m-search">
        <svg><use href="#i-search"/></svg>
        <span>搜索</span>
      </div>
    </div>

    <!-- Mobile Content -->
    <div class="m-content">
      <div
        v-for="room in rooms"
        :key="room.id"
        class="m-room-item"
        :class="{ swiped: swipedRoom === room.id }"
        @click="openRoom(room)"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd($event, room)">
        <div class="m-room-avatar" :class="{ 'is-online': room.isOnline }">
          <img v-if="room.avatar" :src="room.avatar">
          <span v-else>{{ room.initial }}</span>
        </div>
        <div class="m-room-info">
          <div class="m-room-top">
            <div class="m-room-name">
              {{ room.name }}
              <span v-if="room.isEncrypted" class="encrypted-tag">🔒</span>
            </div>
            <div class="m-room-time">{{ room.time }}</div>
          </div>
          <div class="m-room-bottom">
            <div class="m-room-preview">{{ room.preview }}</div>
          </div>
        </div>

        <!-- Swipe Actions -->
        <div class="m-room-actions">
          <div class="m-action-btn pin">置顶</div>
          <div class="m-action-btn delete">删除</div>
        </div>
      </div>
    </div>

    <!-- Mobile Tab Bar -->
    <div class="m-tabbar">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="m-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key">
        <div class="m-tab-icon">
          <svg><use :href="tab.icon"/></svg>
          <span v-if="tab.badge" class="m-tab-badge">{{ tab.badge }}</span>
        </div>
        <span>{{ tab.label }}</span>
      </div>
    </div>

    <!-- Home Indicator -->
    <div class="home-indicator"></div>
  </div>
</template>
```

Styles:

```scss
.mobile {
  width: 375px;
  height: 812px;
  background: var(--hula-bg-deepest);
  border-radius: 42px;
  overflow: hidden;
  box-shadow: var(--hula-shadow-panel), 0 0 0 11px #1a1a1a, 0 0 0 12px #2a2a2a;
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
}

.ios-statusbar {
  height: 44px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--hula-bg-deep);
  color: var(--hula-text-primary);
}

.dynamic-island {
  position: absolute;
  top: 11px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 32px;
  background: #000;
  border-radius: 18px;
  z-index: 100;
}

.m-header {
  padding: 8px 16px 10px;
  background: var(--hula-bg-deep);
  border-bottom: 1px solid #000;
  flex-shrink: 0;
}

.m-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.m-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--hula-text-primary);
}

.m-search {
  margin-top: 10px;
  background: var(--hula-bg-mid);
  border-radius: var(--hula-radius-sm);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--hula-text-muted);
}

.m-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.m-room-item {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: transform 0.2s, background 0.15s;
  position: relative;
  overflow: hidden;
}

.m-room-item:active {
  background: var(--hula-bg-mid);
}

.m-room-item.swiped {
  transform: translateX(-120px);
}

.m-room-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  transform: translateX(120px);
  transition: transform 0.2s;
}

.m-room-item.swiped .m-room-actions {
  transform: translateX(0);
}

.m-action-btn {
  width: 60px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
  font-size: 10px;
  color: #fff;
}

.m-action-btn.pin {
  background: var(--hula-color-warning-500);
}

.m-action-btn.delete {
  background: var(--hula-color-danger-500);
}

.m-room-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--hula-radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  position: relative;
  background: var(--hula-bg-light);
}

.m-room-info {
  flex: 1;
  min-width: 0;
}

.m-room-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px;
}

.m-room-name {
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--hula-text-primary);
}

.m-room-time {
  font-size: 11px;
  color: var(--hula-text-muted);
}

.m-room-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.m-room-preview {
  font-size: 13px;
  color: var(--hula-text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-tabbar {
  height: 62px;
  background: var(--hula-bg-deep);
  border-top: 1px solid #000;
  display: flex;
  flex-shrink: 0;
  padding-bottom: 10px;
}

.m-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  color: var(--hula-text-muted);
  font-size: 10px;
  position: relative;
}

.m-tab.active {
  color: var(--hula-accent);
}

.m-tab-icon {
  font-size: 20px;
  position: relative;
}

.m-tab-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  background: var(--hula-color-danger-500);
  color: var(--hula-text-primary);
  font-size: 9px;
  font-weight: 600;
  min-width: 15px;
  height: 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.home-indicator {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 130px;
  height: 4px;
  background: #fff;
  border-radius: 2px;
  opacity: 0.4;
  z-index: 50;
}
```

- [ ] **Step 3: Run mobile view**

Run: `pnpm dev`
Open: http://localhost:6130 (use mobile device emulation)

Verify:
- [ ] 375×812 container with rounded corners
- [ ] iOS status bar visible
- [ ] Dynamic island centered
- [ ] Header with search
- [ ] Room list with swipe actions
- [ ] Bottom tab bar with 5 tabs
- [ ] Home indicator at bottom

- [ ] **Step 4: Commit**

```bash
git add src/mobile/views/message/
git commit -m "feat: refactor mobile message view to match TJG prototype

- 375×812 mobile container with rounded corners
- iOS status bar and dynamic island
- Swipeable room list with actions
- Bottom tab bar with 5 tabs
- Home indicator

Refs: TJG-prototype.html Section 6"
```

- [ ] **Step 5: HUMAN VERIFICATION REQUIRED**

**Mobile Visual Checklist:**
- [ ] Container: 375×812, rounded 42px, proper shadows
- [ ] Status bar: 44px height, time, 5G, battery
- [ ] Dynamic island: 120×32px, centered, black
- [ ] Header: title + actions + search input
- [ ] Room items: 48px avatar, proper spacing
- [ ] Swipe: reveals pin/delete actions (120px)
- [ ] Tab bar: 62px height, 5 tabs, active state
- [ ] Home indicator: 130×4px, centered, white opacity 0.4

**Interactive Checklist:**
- [ ] Swipe left reveals actions
- [ ] Tap room opens chat
- [ ] Tab switching works
- [ ] Search input focusable

**Verification Sign-off:** _______________ Date: _______________

---

## Phase 4: Remaining Interface Refactoring (Week 5-8)

### Task 5: Friends List Interface

**Files:**
- Modify: `src/views/homeWindow/FriendsList.vue`
- Modify: `src/mobile/views/friends/index.vue`

**Priority:** Medium
**Complexity:** Low
**Verification:** Required

---

### Task 6: Room List Interface

**Files:**
- Modify: `src/views/homeWindow/RoomList.vue`
- Modify: `src/mobile/views/rooms/index.vue`

**Priority:** High
**Complexity:** Medium
**Verification:** Required

---

### Task 7: Space List Interface

**Files:**
- Modify: `src/views/homeWindow/SpaceList.vue`
- Modify: `src/mobile/views/space/SpaceView.vue`

**Priority:** Medium
**Complexity:** High
**Verification:** Required

---

### Task 8: Chat Room Interface

**Files:**
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue`
- Modify: `src/components/rightBox/chatBox/ChatBox.vue`

**Priority:** High
**Complexity:** High
**Verification:** Required

---

### Task 9: Settings Interfaces

**Files:**
- Modify: `src/views/settingsWindow/tabs/*.vue`
- Modify: `src/mobile/views/my/*.vue`

**Priority:** Low
**Complexity:** Medium
**Verification:** Required

---

### Task 10: Login Window

**Files:**
- Modify: `src/views/loginWindow/Login.vue`
- Modify: `src/views/loginWindow/ManualLoginForm.vue`
- Modify: `src/views/loginWindow/AutoLoginForm.vue`

**Priority:** High
**Complexity:** Medium
**Verification:** Required

---

## Verification Standards

### Visual Consistency Metrics

For each interface, verify:

1. **Color Accuracy** (±2% tolerance)
   - [ ] All backgrounds match TJG hex values
   - [ ] Text colors follow hierarchy (primary/secondary/muted)
   - [ ] Accent color #13987f used consistently

2. **Typography** (±1px tolerance)
   - [ ] Font family: PingFang or system fallback
   - [ ] Font sizes: 20px/16px/15px/14px/13px/12px/11px/10px
   - [ ] Line heights: appropriate for each size

3. **Spacing** (±2px tolerance)
   - [ ] Padding values match
   - [ ] Margin values match
   - [ ] Gap values match

4. **Border Radius** (exact match)
   - [ ] Large: 16px
   - [ ] Medium: 12px
   - [ ] Small: 8px
   - [ ] Extra small: 4px

5. **Shadows** (visual match)
   - [ ] Panel shadow: 0 4px 24px rgba(0,0,0,0.4)
   - [ ] Bubble shadow: 0 1px 2px rgba(0,0,0,0.2)

### Functional Verification

For each interface:

1. **Navigation**
   - [ ] All clickable elements respond
   - [ ] Route transitions work
   - [ ] Back navigation works

2. **Data Display**
   - [ ] Lists render correctly
   - [ ] Empty states handled
   - [ ] Loading states visible

3. **Interactions**
   - [ ] Buttons clickable
   - [ ] Inputs focusable
   - [ ] Modals open/close
   - [ ] Context menus work

4. **Responsive**
   - [ ] PC layout correct
   - [ ] Mobile layout correct
   - [ ] Breakpoints handled

### Performance Verification

- [ ] First paint < 1s
- [ ] Interactive < 3s
- [ ] Scroll smooth (60fps)
- [ ] No layout thrashing

---

## Exception Handling & Rollback

### Rollback Procedure

If verification fails:

1. **Immediate:**
   ```bash
   git checkout main
   git branch -D feat/ui-refactor-<interface-name>
   ```

2. **Investigation:**
   - Document failure reasons
   - Compare with TJG prototype
   - Identify specific mismatches

3. **Resolution Options:**
   - Fix and retry (preferred)
   - Skip interface (document technical debt)
   - Request design clarification

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Colors wrong | Wrong theme | Verify `data-theme="dark"` |
| Layout broken | CSS conflict | Check specificity, use TJG tokens |
| Icons missing | Icon font not loaded | Verify icon sprite import |
| Text overflow | No ellipsis | Add `text-overflow: ellipsis` |
| Animations janky | Too many animations | Use `transform` and `opacity` |

---

## Timeline Summary

| Week | Phase | Tasks | Deliverables |
|------|-------|-------|--------------|
| 1 | Foundation | Task 1-2 | Design tokens, Main layout |
| 2 | Session List | Task 3 | Room list items |
| 3-4 | Mobile | Task 4 | Mobile main layout |
| 5 | Friends/Rooms | Task 5-6 | Friends list, Room list |
| 6 | Spaces | Task 7 | Space list |
| 7 | Chat | Task 8 | Chat interface |
| 8 | Settings/Login | Task 9-10 | Settings, Login |

**Total Duration:** 8 weeks
**Human Verification Points:** 10 (one per task)
**Risk Buffer:** 1 week (Week 9 for fixes)

---

## Sign-off

**Plan Author:** _______________
**Date:** _______________
**Reviewer:** _______________
**Approval:** _______________

**Implementation Start:** _______________
**Expected Completion:** _______________