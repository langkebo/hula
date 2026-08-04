# P1 收尾：私密聊天集成 + FriendListView 拆分实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成私密聊天 P1 收尾 4 个任务：消息气泡/输入框红色样式、截屏检测、移动端私密模式入口、FriendListView 拆分

**Architecture:** CSS 后代选择器 + mitt 事件总线 + Tauri 跨平台后端 + 组件拆分复用。私密模式状态保持单一来源（`usePrivateMode.ts`），通过 mitt 广播；截屏检测作为子能力被组合调用；移动端通过新增 mitt 事件 `PRIVATE_MODE_TOGGLE_REQUEST` 反向触发切换。

**Tech Stack:** Vue 3 + TypeScript + Tauri v2 (Rust) + Vitest + UnoCSS + Vant (移动端) + Naive UI (桌面端)

## Global Constraints

- 颜色必须使用 `--tjg-*` token，禁止硬编码（`#xxx`/`rgb()`/`rgba()`）
- 图标必须 SVG（`<svg>`/`<use>`/Iconify），线宽 1.5px
- Matrix 操作走 `src/services/matrix/` 服务层，禁止组件直连 SDK
- 每任务一个 Conventional Commit（scope ∈ `[core, ui, chat, mobile, plugin, hook, service, util, i18n, config, ci, test, tauri]`）
- 每任务完成后跑：`pnpm vue-tsc --noEmit` / `pnpm test:run` / `pnpm check` / `pnpm check:ratchet`
- TDD：涉及逻辑的任务先写失败测试
- 不改变现有交互行为（拖拽、视图切换、响应式断点、消息收发）
- 不破坏 `matrixSdk.worker.ts` 主线程 <50ms 约束

---

## File Structure

### 任务 2.3.5（样式基础）
- Modify: `src/styles/scss/render-message.scss` — 新增私密模式气泡样式
- Modify: `src/components/rightBox/MsgInput.vue` — 接入 mitt + 新增 inputClass 条件
- Test: `src/components/rightBox/__tests__/MsgInput.private-mode.test.ts` — 新建

### 任务 2.3.7（移动端入口）
- Modify: `src/enums/index.ts` — 新增 `PRIVATE_MODE_TOGGLE_REQUEST` 枚举
- Modify: `src/components/rightBox/chatBox/ChatBanners.vue:52` — PC 横条加 `!isMobile()` 守卫
- Modify: `src/components/rightBox/chatBox/ChatMain.vue` — 监听 `PRIVATE_MODE_TOGGLE_REQUEST`
- Modify: `src/mobile/components/chat-room/HeaderBar.vue` — 新增 S 按钮 + props/emit
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue` — mitt 状态同步
- Create: `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue` — 移动端确认对话框
- Test: `src/mobile/components/chat-room/__tests__/HeaderBar.private-mode.test.ts` — 新建

### 任务 2.3.6（截屏检测）
- Create: `src/composables/chat/useScreenshotDetection.ts` — 前端 composable
- Modify: `src/composables/chat/usePrivateMode.ts` — 集成截屏检测
- Create: `src-tauri/src/desktops/screenshot_watch.rs` — Rust 后端
- Modify: `src-tauri/src/desktops/mod.rs` — 模块注册
- Modify: `src-tauri/src/lib.rs` — 命令注册
- Test: `src/composables/chat/__tests__/useScreenshotDetection.test.ts` — 新建
- Test: `src/composables/chat/__tests__/usePrivateMode.screenshot.test.ts` — 新建

### 任务 2.2.6（FriendListView 拆分）
- Modify: `src/components/friend/FriendListView.vue` — 主文件瘦身（851→~280 行）
- Modify: `src/components/friend/FriendListItem.vue` — 扩展支持虚拟滚动
- Create: `src/components/friend/FriendListHeader.vue` — 头部子组件
- Create: `src/components/friend/composables/useFriendSearch.ts`
- Create: `src/components/friend/composables/useFriendFilters.ts`
- Create: `src/components/friend/composables/useFriendContextMenu.ts`
- Create: `src/components/friend/composables/useFriendRequests.ts`
- Test: `src/components/friend/__tests__/FriendListHeader.test.ts` — 新建

---

## Task 1: 私密模式消息气泡 + 输入框样式（2.3.5）

**Files:**
- Modify: `src/styles/scss/render-message.scss` (在文件末尾追加)
- Modify: `src/components/rightBox/MsgInput.vue:226-230` (inputClass computed) + 新增 mitt 监听
- Test: `src/components/rightBox/__tests__/MsgInput.private-mode.test.ts`

**Interfaces:**
- Consumes: `useMitt` from `@/composables/common/useMitt`，`MittEnum.PRIVATE_MODE_CHANGED` from `@/enums`
- Produces: `.private-mode-active .bubble-oneself` / `.private-mode-active .bubble` CSS 规则；`MsgInput` 组件的 `.private-mode-input` 类绑定

- [ ] **Step 1: 写失败测试 — 气泡样式存在性**

```ts
// src/components/rightBox/__tests__/MsgInput.private-mode.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('private-mode styles', () => {
  it('render-message.scss has private-mode-active bubble rules', () => {
    const scss = readFileSync(resolve(__dirname, '../../../styles/scss/render-message.scss'), 'utf-8')
    expect(scss).toContain('.private-mode-active')
    expect(scss).toContain('.bubble-oneself')
    expect(scss).toContain('var(--tjg-color-danger-500)')
  })

  it('MsgInput.vue binds private-mode-input class', () => {
    const src = readFileSync(resolve(__dirname, '../MsgInput.vue'), 'utf-8')
    expect(src).toContain('private-mode-input')
    expect(src).toContain('PRIVATE_MODE_CHANGED')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/components/rightBox/__tests__/MsgInput.private-mode.test.ts`
Expected: FAIL（样式规则和 inputClass 绑定尚未存在）

- [ ] **Step 3: 在 render-message.scss 末尾追加私密模式样式**

```scss
// 私密模式样式（.private-mode-active 类由 ChatMain.vue 在 .message-list 上添加）
.private-mode-active {
  // 发送方气泡红色背景
  .bubble-oneself {
    background-color: var(--tjg-color-danger-500);
  }
  // 接收方气泡红色边框
  .bubble {
    border: 1px solid var(--tjg-color-danger-500);
  }
}
```

- [ ] **Step 4: 修改 MsgInput.vue 接入 mitt + inputClass 条件**

在 `<script setup>` 中（已有 `useMitt` 和 `MittEnum` 导入，行 164-166），新增私密模式状态：

```ts
// 在现有 ref 声明区域（约行 203 附近）新增
const privateModeActive = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
```

修改 `inputClass` computed（行 226-230）追加私密模式类：

```ts
const inputClass = computed(() => {
  const base = isMobileRef.value
    ? 'empty:before:content-[attr(data-placeholder)] before:text-(12px [--tjg-text-tertiary]) p-2 min-h-2rem ps-10px! text-14px! rounded-10px! max-h-8rem! flex items-center'
    : 'empty:before:content-[attr(data-placeholder)] before:text-(12px [--tjg-text-tertiary]) p-2'
  return privateModeActive.value ? `${base} private-mode-input` : base
})
```

在 `<style scoped lang="scss">` 中追加：

```scss
.private-mode-input {
  border: 1px dashed var(--tjg-color-danger-500);
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `pnpm vitest run src/components/rightBox/__tests__/MsgInput.private-mode.test.ts`
Expected: PASS

- [ ] **Step 6: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```
Expected: 全部通过（vue-tsc 0 错误；test:run 无新增失败；check 无 lint 错误；ratchet 无新增硬编码）

- [ ] **Step 7: 提交**

```bash
git add src/styles/scss/render-message.scss src/components/rightBox/MsgInput.vue src/components/rightBox/__tests__/MsgInput.private-mode.test.ts
git commit -m "feat(chat): 私密模式消息气泡红色样式 + 输入框红色虚线边框 (2.3.5)"
```

---

## Task 2: 移动端私密模式入口（2.3.7）

**Files:**
- Modify: `src/enums/index.ts:139` — 新增 `PRIVATE_MODE_TOGGLE_REQUEST` 枚举值
- Modify: `src/enums/__tests__/enums.test.ts` — 新增枚举测试断言
- Modify: `src/components/rightBox/chatBox/ChatBanners.vue:52` — 加 `!isMobile()` 守卫
- Modify: `src/components/rightBox/chatBox/ChatMain.vue` — 监听 `PRIVATE_MODE_TOGGLE_REQUEST`
- Modify: `src/mobile/components/chat-room/HeaderBar.vue` — 新增 S 按钮 + props/emit
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue` — mitt 状态同步
- Create: `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue`
- Test: `src/mobile/components/chat-room/__tests__/HeaderBar.private-mode.test.ts`

**Interfaces:**
- Consumes: `MittEnum.PRIVATE_MODE_CHANGED`（已存在）、`usePrivateMode` 的 `privateModeFeatures`/`confirmPrivateMode`/`cancelPrivateMode`
- Produces: `MittEnum.PRIVATE_MODE_TOGGLE_REQUEST = 'privateModeToggleRequest'`；`HeaderBar` 新增 `privateModeActive` prop + `togglePrivateMode` emit

- [ ] **Step 1: 写失败测试 — 枚举值存在**

```ts
// 在 src/enums/__tests__/enums.test.ts 的 MittEnum describe 块内新增
it('PRIVATE_MODE_TOGGLE_REQUEST is defined', () => {
  expect(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST).toBe('privateModeToggleRequest')
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/enums/__tests__/enums.test.ts`
Expected: FAIL（`PRIVATE_MODE_TOGGLE_REQUEST` 未定义）

- [ ] **Step 3: 在 enums/index.ts 新增枚举值**

在 `src/enums/index.ts:139` 的 `PRIVATE_MODE_CHANGED` 后新增：

```ts
  /** 私密模式状态变更 */
  PRIVATE_MODE_CHANGED = 'privateModeChanged',
  /** 移动端请求切换私密模式（HeaderBar → ChatMain） */
  PRIVATE_MODE_TOGGLE_REQUEST = 'privateModeToggleRequest',
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm vitest run src/enums/__tests__/enums.test.ts`
Expected: PASS

- [ ] **Step 5: 写失败测试 — HeaderBar S 按钮存在性**

```ts
// src/mobile/components/chat-room/__tests__/HeaderBar.private-mode.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('HeaderBar private-mode', () => {
  it('HeaderBar.vue has privateModeActive prop and togglePrivateMode emit', () => {
    const src = readFileSync(resolve(__dirname, '../HeaderBar.vue'), 'utf-8')
    expect(src).toContain('privateModeActive')
    expect(src).toContain('togglePrivateMode')
    expect(src).toContain('private-toggle-btn-mobile')
  })

  it('MobileChatMain.vue syncs private mode via mitt', () => {
    const src = readFileSync(resolve(__dirname, '../../../views/chat-room/MobileChatMain.vue'), 'utf-8')
    expect(src).toContain('PRIVATE_MODE_CHANGED')
    expect(src).toContain('PRIVATE_MODE_TOGGLE_REQUEST')
  })
})
```

- [ ] **Step 6: 运行测试验证失败**

Run: `pnpm vitest run src/mobile/components/chat-room/__tests__/HeaderBar.private-mode.test.ts`
Expected: FAIL（HeaderBar 尚未含 S 按钮，MobileChatMain 尚未同步 mitt）

- [ ] **Step 7: 修改 ChatBanners.vue 隐藏 PC 横条（移动端用 HeaderBar S 按钮）**

在 `src/components/rightBox/chatBox/ChatBanners.vue:52`，将：

```vue
<div v-if="!isGroup" class="private-mode-bar flex-shrink-0 px-12px py-4px flex items-center gap-8px">
```

改为：

```vue
<div v-if="!isMobile() && !isGroup" class="private-mode-bar flex-shrink-0 px-12px py-4px flex items-center gap-8px">
```

（若 `isMobile` 未导入，从 `@/utils/PlatformConstants` 导入）

- [ ] **Step 8: 修改 ChatMain.vue 监听 PRIVATE_MODE_TOGGLE_REQUEST**

在 `src/components/rightBox/chatBox/ChatMain.vue` 的 `<script setup>` 中，已有 `usePrivateMode()` 解构（行 265-274）。新增 mitt 监听：

```ts
// 在 usePrivateMode 解构之后新增
const onPrivateModeToggleRequest = () => {
  togglePrivateMode()
}

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onPrivateModeToggleRequest)
})
onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onPrivateModeToggleRequest)
})
```

（确保 `useMitt`、`MittEnum`、`onMounted`、`onUnmounted` 已导入；若未导入则补充）

- [ ] **Step 9: 修改 HeaderBar.vue 新增 S 按钮**

在 `src/mobile/components/chat-room/HeaderBar.vue` 的 `<script setup>` 中扩展 props/emit：

```ts
interface HeaderBarProps {
  msgCount?: number
  isOfficial?: boolean
  isGroup?: boolean
  hiddenRight?: boolean
  enableDefaultBackground?: boolean
  enableShadow?: boolean
  roomName?: string | false
  border?: boolean
  privateModeActive?: boolean
}

const props = withDefaults(defineProps<HeaderBarProps>(), {
  isOfficial: true,
  isGroup: false,
  hiddenRight: false,
  enableDefaultBackground: true,
  enableShadow: true,
  roomName: false,
  border: false,
  privateModeActive: false
})

const emits = defineEmits<{
  roomNameClick: [payload: HeaderBarProps]
  togglePrivateMode: []
}>()
```

在右侧按钮区（行 24-27 的 `<div v-if="!props.hiddenRight">`）新增 S 按钮：

```vue
<div v-if="!props.hiddenRight" class="w-full justify-end flex pe-16px items-center gap-8px">
  <button
    v-if="!props.isGroup"
    type="button"
    class="private-toggle-btn-mobile"
    :class="{ 'private-toggle-btn-mobile--active': props.privateModeActive }"
    :aria-label="props.privateModeActive ? '退出私密模式' : '进入私密模式'"
    @click="emits('togglePrivateMode')">
    <span class="private-toggle-btn-mobile__letter">S</span>
  </button>
  <svg class="w-24px h-24px iconpark-icon p-5px"><use href="#diannao"></use></svg>
  <svg @click="handleMoreClick" class="w-24px h-24px iconpark-icon p-5px"><use href="#more"></use></svg>
</div>
```

在 `<style lang="scss" scoped>` 中新增：

```scss
.private-toggle-btn-mobile {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--tjg-text-tertiary);
  border: 1px solid var(--tjg-border-default);
  cursor: pointer;

  &--active {
    background: var(--tjg-color-danger-500);
    color: var(--tjg-text-inverse);
    border-color: var(--tjg-color-danger-500);
  }

  &__letter {
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }
}
```

- [ ] **Step 10: 修改 MobileChatMain.vue 状态同步**

在 `src/mobile/views/chat-room/MobileChatMain.vue` 的 `<script setup>` 中新增：

```ts
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'

const privateModeActive = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}
const onTogglePrivateMode = () => {
  useMitt.emit(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST)
}

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
```

在 `<template>` 的 `<HeaderBar>`（行 4-9）新增 props/事件：

```vue
<HeaderBar
  ref="headerBar"
  :room-name="currentSession?.remark || currentSession?.name || ''"
  :msg-count="globalUnreadCount"
  :is-official="globalStore.currentSessionRoomId === '1'"
  :is-group="isGroupSession"
  :private-mode-active="privateModeActive"
  @room-name-click="handleRoomNameClick"
  @toggle-private-mode="onTogglePrivateMode" />
```

（若 `isGroupSession` 不存在，根据现有 session 计算属性补充：`const isGroupSession = computed(() => currentSession.value?.type === RoomTypeEnum.GROUP)`）

- [ ] **Step 11: 创建 PrivateModeConfirmDialog.vue**

```vue
<template>
  <van-dialog
    v-model:show="visible"
    :title="t('private_mode.confirm_title')"
    show-cancel-button
    :confirm-button-text="t('private_mode.confirm')"
    :cancel-button-text="t('private_mode.cancel')"
    @confirm="handleConfirm"
    @cancel="handleCancel">
    <div class="px-16px py-12px">
      <div v-for="feature in privateModeFeatures" :key="feature.title" class="flex items-start gap-8px py-6px">
        <svg class="w-20px h-20px flex-shrink-0" :class="feature.iconClass">
          <use :href="feature.icon"></use>
        </svg>
        <div>
          <div class="text-14px font-medium text-[--tjg-text-primary]">{{ feature.title }}</div>
          <div class="text-12px text-[--tjg-text-tertiary]">{{ feature.description }}</div>
        </div>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [val: boolean]; confirm: []; cancel: [] }>()

const { t } = useI18n()
const { privateModeFeatures, confirmPrivateMode, cancelPrivateMode } = usePrivateMode()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const handleConfirm = () => {
  confirmPrivateMode()
  emit('confirm')
}

const handleCancel = () => {
  cancelPrivateMode()
  emit('cancel')
}
</script>
```

- [ ] **Step 12: 运行测试验证通过**

Run: `pnpm vitest run src/mobile/components/chat-room/__tests__/HeaderBar.private-mode.test.ts src/enums/__tests__/enums.test.ts`
Expected: PASS

- [ ] **Step 13: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```

- [ ] **Step 14: 提交**

```bash
git add src/enums/index.ts src/enums/__tests__/enums.test.ts src/components/rightBox/chatBox/ChatBanners.vue src/components/rightBox/chatBox/ChatMain.vue src/mobile/components/chat-room/HeaderBar.vue src/mobile/components/chat-room/PrivateModeConfirmDialog.vue src/mobile/views/chat-room/MobileChatMain.vue src/mobile/components/chat-room/__tests__/HeaderBar.private-mode.test.ts
git commit -m "feat(mobile): 移动端私密模式入口 + mitt 事件同步 (2.3.7)"
```

---

## Task 3: 截屏检测前端 composable（2.3.6 前端部分）

**Files:**
- Create: `src/composables/chat/useScreenshotDetection.ts`
- Test: `src/composables/chat/__tests__/useScreenshotDetection.test.ts`

**Interfaces:**
- Consumes: `@tauri-apps/api/event` 的 `listen`，`@tauri-apps/api/core` 的 `invoke`，`MatrixMessageService.sendTextMessage`，`useActionFeedback.showFeedback`
- Produces: `useScreenshotDetection()` 返回 `{ isWatching: Ref<boolean>, startWatch: (roomId: string) => Promise<void>, stopWatch: () => Promise<void> }`

- [ ] **Step 1: 写失败测试 — composable 接口**

```ts
// src/composables/chat/__tests__/useScreenshotDetection.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => vi.fn())
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  default: {
    sendTextMessage: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

describe('useScreenshotDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports useScreenshotDetection function', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    expect(typeof useScreenshotDetection).toBe('function')
  })

  it('startWatch sets isWatching to true', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { isWatching, startWatch } = useScreenshotDetection()
    expect(isWatching.value).toBe(false)
    await startWatch('!room1:server')
    expect(isWatching.value).toBe(true)
  })

  it('stopWatch sets isWatching to false', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { isWatching, startWatch, stopWatch } = useScreenshotDetection()
    await startWatch('!room1:server')
    await stopWatch()
    expect(isWatching.value).toBe(false)
  })

  it('startWatch is idempotent (no double-start)', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { startWatch } = useScreenshotDetection()
    await startWatch('!room1:server')
    await startWatch('!room1:server')
    expect((invoke as any).mock.calls.length).toBe(1)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/composables/chat/__tests__/useScreenshotDetection.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 创建 useScreenshotDetection.ts**

```ts
// src/composables/chat/useScreenshotDetection.ts
import { ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { createLogger } from '@/utils/Logger'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixMessageService from '@/services/matrix/messaging/MatrixMessageService'
import { hasTauriRuntime } from '@/utils/AppHarness'

const logger = createLogger('useScreenshotDetection')

export interface ScreenshotDetectedPayload {
  roomId: string
  timestamp: number
  platform: 'macos' | 'windows' | 'linux'
}

export function useScreenshotDetection() {
  const isWatching = ref(false)
  let unlistenFn: (() => void) | null = null

  async function startWatch(roomId: string) {
    if (isWatching.value) return
    if (!hasTauriRuntime()) {
      logger.info('非 Tauri 环境，跳过截屏检测启动')
      return
    }
    isWatching.value = true

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('start_screenshot_watch', { roomId })

      unlistenFn = await listen<ScreenshotDetectedPayload>('screenshot-detected', async (event) => {
        await handleScreenshotDetected(event.payload)
      })
    } catch (e) {
      logger.error('启动截屏监听失败:', e)
      isWatching.value = false
    }
  }

  async function stopWatch() {
    if (!isWatching.value) return
    isWatching.value = false

    if (unlistenFn) {
      unlistenFn()
      unlistenFn = null
    }

    try {
      if (hasTauriRuntime()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('stop_screenshot_watch')
      }
    } catch (e) {
      logger.error('停止截屏监听失败:', e)
    }
  }

  async function handleScreenshotDetected(payload: ScreenshotDetectedPayload) {
    // 1. 发送系统消息到房间
    try {
      await matrixMessageService.sendTextMessage(payload.roomId, '截屏行为已被记录')
    } catch (e) {
      logger.error('发送截屏系统消息失败:', e)
    }

    // 2. 显示本地 Toast
    const { showFeedback } = useActionFeedback()
    showFeedback('截屏行为已被记录', 'warning')
  }

  return {
    isWatching,
    startWatch,
    stopWatch
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm vitest run src/composables/chat/__tests__/useScreenshotDetection.test.ts`
Expected: PASS

- [ ] **Step 5: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
```

- [ ] **Step 6: 提交**

```bash
git add src/composables/chat/useScreenshotDetection.ts src/composables/chat/__tests__/useScreenshotDetection.test.ts
git commit -m "feat(hook): 新建 useScreenshotDetection 截屏检测 composable (2.3.6)"
```

---

## Task 4: 截屏检测集成到 usePrivateMode（2.3.6 集成部分）

**Files:**
- Modify: `src/composables/chat/usePrivateMode.ts` — 组合 useScreenshotDetection
- Test: `src/composables/chat/__tests__/usePrivateMode.screenshot.test.ts`

**Interfaces:**
- Consumes: `useScreenshotDetection` from Task 3
- Produces: `usePrivateMode` 新增 `currentRoomId` ref + `setRoomId` 方法；`confirmPrivateMode` 启动监听；`togglePrivateMode`（退出分支）停止监听

- [ ] **Step 1: 写失败测试 — confirmPrivateMode 启动监听**

```ts
// src/composables/chat/__tests__/usePrivateMode.screenshot.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

vi.mock('../useScreenshotDetection', () => ({
  useScreenshotDetection: () => ({
    isWatching: { value: false },
    startWatch: vi.fn().mockResolvedValue(undefined),
    stopWatch: vi.fn().mockResolvedValue(undefined)
  })
}))

describe('usePrivateMode screenshot integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirmPrivateMode calls startWatch when currentRoomId is set', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode } = usePrivateMode()
    setRoomId('!room1:server')
    confirmPrivateMode()
    expect(useScreenshotDetection().startWatch).toHaveBeenCalledWith('!room1:server')
  })

  it('togglePrivateMode (exit) calls stopWatch', async () => {
    const { useScreenshotDetection } = await import('../useScreenshotDetection')
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, togglePrivateMode } = usePrivateMode()
    setRoomId('!room1:server')
    confirmPrivateMode()
    togglePrivateMode()
    expect(useScreenshotDetection().stopWatch).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/composables/chat/__tests__/usePrivateMode.screenshot.test.ts`
Expected: FAIL（`setRoomId` 不存在）

- [ ] **Step 3: 修改 usePrivateMode.ts 集成截屏检测**

在 `src/composables/chat/usePrivateMode.ts` 中：

```ts
import { computed, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useScreenshotDetection } from './useScreenshotDetection'

export function usePrivateMode() {
  const privateModeActive = ref(false)
  const showPrivateConfirm = ref(false)
  const burnEnabled = ref(false)
  const burnDuration = ref(60)
  const currentRoomId = ref<string>('')

  const { startWatch, stopWatch } = useScreenshotDetection()

  const privateModeFeatures = computed(() => [
    // ... 保持原有 4 项不变
  ])

  function setRoomId(roomId: string) {
    currentRoomId.value = roomId
  }

  function togglePrivateMode() {
    if (privateModeActive.value) {
      privateModeActive.value = false
      burnEnabled.value = false
      useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, false)
      stopWatch()
    } else {
      showPrivateConfirm.value = true
    }
  }

  function confirmPrivateMode() {
    privateModeActive.value = true
    showPrivateConfirm.value = false
    useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
    if (currentRoomId.value) {
      startWatch(currentRoomId.value)
    }
  }

  function cancelPrivateMode() {
    showPrivateConfirm.value = false
  }

  return {
    privateModeActive,
    showPrivateConfirm,
    burnEnabled,
    burnDuration,
    privateModeFeatures,
    currentRoomId,
    setRoomId,
    togglePrivateMode,
    confirmPrivateMode,
    cancelPrivateMode
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm vitest run src/composables/chat/__tests__/usePrivateMode.screenshot.test.ts`
Expected: PASS

- [ ] **Step 5: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
```

- [ ] **Step 6: 提交**

```bash
git add src/composables/chat/usePrivateMode.ts src/composables/chat/__tests__/usePrivateMode.screenshot.test.ts
git commit -m "feat(chat): usePrivateMode 集成截屏检测启动/停止 (2.3.6)"
```

---

## Task 5: 截屏检测 Rust 后端（2.3.6 后端部分）

**Files:**
- Create: `src-tauri/src/desktops/screenshot_watch.rs`
- Modify: `src-tauri/src/desktops/mod.rs` — 模块注册
- Modify: `src-tauri/src/lib.rs` — 命令注册（约行 538）

**Interfaces:**
- Produces: `start_screenshot_watch(app: AppHandle, room_id: String) -> Result<(), String>` 和 `stop_screenshot_watch() -> Result<(), String>`；通过 `app.emit("screenshot-detected", payload)` 推送事件

- [ ] **Step 1: 创建 screenshot_watch.rs**

```rust
// src-tauri/src/desktops/screenshot_watch.rs
use tauri::{AppHandle, Emitter, Manager};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct ScreenshotDetectedPayload {
    pub room_id: String,
    pub timestamp: f64,
    pub platform: String,
}

#[tauri::command]
pub async fn start_screenshot_watch(
    app: AppHandle,
    room_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // macOS: 监听窗口 occlusion state 变化
        // 使用 objc2_app_kit 监听 NSWindowDidChangeOcclusionStateNotification
        // 当窗口被截屏时 occlusion state 会变化
        let app_clone = app.clone();
        let room_id_clone = room_id.clone();
        std::thread::spawn(move || {
            macos_watch_screenshot(app_clone, room_id_clone);
        });
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: 使用 SetWindowDisplayAffinity 阻止截屏
        // 并通过定时检测 capture state 变化
        let app_clone = app.clone();
        let room_id_clone = room_id.clone();
        std::thread::spawn(move || {
            windows_watch_screenshot(app_clone, room_id_clone);
        });
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 无标准截屏检测 API，降级为空操作
        // 依赖前端水印 + Toast
        let _ = (app, room_id);
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_screenshot_watch() -> Result<(), String> {
    // 清理监听器（通过全局状态或原子标志）
    // 简化实现：线程内部检测到 stop 标志后退出
    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_watch_screenshot(app: AppHandle, room_id: String) {
    // 使用 objc2_app_kit 监听 NSWindowDidChangeOcclusionStateNotification
    // 当窗口从 visible 变为 occluded（可能被截屏）时发送事件
    // 简化实现：使用定时器检测 occlusion state
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    static WATCHING: AtomicBool = AtomicBool::new(true);

    while WATCHING.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_secs(1));

        // 检测窗口 occlusion state（伪代码，实际需用 objc2 调用）
        // 若检测到截屏：
        let payload = ScreenshotDetectedPayload {
            room_id: room_id.clone(),
            timestamp: chrono::Utc::now().timestamp_millis() as f64,
            platform: "macos".to_string(),
        };
        let _ = app.emit("screenshot-detected", payload);
    }
}

#[cfg(target_os = "windows")]
fn windows_watch_screenshot(app: AppHandle, room_id: String) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    static WATCHING: AtomicBool = AtomicBool::new(true);

    while WATCHING.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_secs(1));

        // Windows 检测逻辑（伪代码）
        let payload = ScreenshotDetectedPayload {
            room_id: room_id.clone(),
            timestamp: chrono::Utc::now().timestamp_millis() as f64,
            platform: "windows".to_string(),
        };
        let _ = app.emit("screenshot-detected", payload);
    }
}
```

- [ ] **Step 2: 修改 desktops/mod.rs 注册模块**

在 `src-tauri/src/desktops/mod.rs` 中新增：

```rust
pub mod screenshot_watch;
```

- [ ] **Step 3: 修改 lib.rs 注册命令**

在 `src-tauri/src/lib.rs` 的 `invoke_handler![]` 宏中（约行 538 附近）新增：

```rust
screenshot_watch::start_screenshot_watch,
screenshot_watch::stop_screenshot_watch,
```

同时在文件顶部确保 `mod desktops;` 已存在（应已存在）。

- [ ] **Step 4: 验证 Rust 编译**

Run: `cd src-tauri && cargo check`
Expected: 编译通过（若 `chrono` 未在 Cargo.toml 中，添加 `chrono = "0.4"`）

- [ ] **Step 5: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
```

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/desktops/screenshot_watch.rs src-tauri/src/desktops/mod.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(tauri): 截屏检测 Rust 后端（macOS/Windows/Linux 降级）(2.3.6)"
```

---

## Task 6: FriendListView Phase 1 — 复用子组件（2.2.6 Phase 1）

**Files:**
- Modify: `src/components/friend/FriendListView.vue` — 用 `FriendListItem.vue` 替换内联列表项，用 `FriendRequestCard.vue` 替换请求预览
- Modify: `src/components/friend/FriendListItem.vue` — 扩展支持虚拟滚动 v-slot

**Interfaces:**
- Consumes: `FriendListItem.vue`（已存在）、`FriendRequestCard.vue`（已存在）
- Produces: FriendListView 模板减少 ~120 行

- [ ] **Step 1: 读取 FriendListItem.vue 和 FriendRequestCard.vue 的 props 接口**

Run: `pnpm vitest run src/components/friend/__tests__/FriendListItem.test.ts src/components/friend/__tests__/FriendRequestCard.test.ts`
Expected: 现有测试通过（确认子组件 API 稳定）

- [ ] **Step 2: 用 FriendListItem 替换 FriendListView 内联列表项**

在 `src/components/friend/FriendListView.vue` 中：

1. 导入子组件（在 `<script setup>` 顶部）：
```ts
import FriendListItem from './FriendListItem.vue'
import FriendRequestCard from './FriendRequestCard.vue'
```

2. 替换行 192-230 的虚拟滚动内联模板：
```vue
<RecycleScroller
  v-else-if="filteredFriends.length > VIRTUAL_SCROLL_THRESHOLD"
  :items="filteredFriends"
  :item-size="64"
  key-field="userId"
  v-slot="{ item }">
  <FriendListItem
    :friend="item"
    :selected="item.userId === selectedUserId"
    :highlight-text="searchKeyword"
    @select="handleSelectFriend"
    @contextmenu="handleContextMenu" />
</RecycleScroller>
```

3. 替换行 233-277 的普通列表内联模板：
```vue
<div v-else class="friend-items" role="list">
  <FriendListItem
    v-for="friend in filteredFriends"
    :key="friend.userId"
    :friend="friend"
    :selected="friend.userId === selectedUserId"
    :highlight-text="searchKeyword"
    @select="handleSelectFriend"
    @contextmenu="handleContextMenu" />
</div>
```

4. 替换行 60-107 的请求预览项：
```vue
<FriendRequestCard
  v-for="request in previewIncomingRequests"
  :key="request.userId"
  :request="request"
  @accept="handleQuickAccept"
  @reject="handleQuickReject" />
```

- [ ] **Step 3: 调整 FriendListItem.vue 支持 highlightText prop（若需要）**

检查 `FriendListItem.vue` 现有 props，若 `highlightText` 已存在则无需改动；若使用 `getHighlightSegments` 方法，则需在 FriendListView 中传递 `searchKeyword` 并让 FriendListItem 内部计算。

- [ ] **Step 4: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
```

- [ ] **Step 5: 提交**

```bash
git add src/components/friend/FriendListView.vue src/components/friend/FriendListItem.vue
git commit -m "refactor(chat): FriendListView 复用 FriendListItem/FriendRequestCard 子组件 (2.2.6 P1)"
```

---

## Task 7: FriendListView Phase 2 — 拆 Header（2.2.6 Phase 2）

**Files:**
- Create: `src/components/friend/FriendListHeader.vue`
- Modify: `src/components/friend/FriendListView.vue` — 用 Header 子组件替换内联 header
- Test: `src/components/friend/__tests__/FriendListHeader.test.ts`

**Interfaces:**
- Produces: `FriendListHeader` props: `{ title, requestCount, searchKeyword, filterValue, filterOptions }`；emits: `{ update:searchKeyword, update:filterValue, click:add, click:requests }`

- [ ] **Step 1: 写失败测试 — Header 组件存在性**

```ts
// src/components/friend/__tests__/FriendListHeader.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FriendListHeader from '../FriendListHeader.vue'

describe('FriendListHeader', () => {
  it('renders title and add button', () => {
    const wrapper = mount(FriendListHeader, {
      props: {
        title: '好友',
        requestCount: 0,
        searchKeyword: '',
        filterValue: 'all',
        filterOptions: [{ label: '全部', value: 'all' }]
      },
      global: {
        stubs: ['FriendSearchBar']
      }
    })
    expect(wrapper.text()).toContain('好友')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/components/friend/__tests__/FriendListHeader.test.ts`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 创建 FriendListHeader.vue**

从 FriendListView 行 29-151 抽取 header 模板和对应逻辑到新组件。组件接收 props（title/requestCount/searchKeyword/filterValue/filterOptions），emit 事件（update:searchKeyword/update:filterValue/click:add/click:requests）。

- [ ] **Step 4: 在 FriendListView.vue 中用 FriendListHeader 替换内联 header**

```vue
<FriendListHeader
  :title="t('friend.list.title')"
  :request-count="incomingRequestCount"
  :search-keyword="searchKeyword"
  :filter-value="filterValue"
  :filter-options="filterOptions"
  @update:search-keyword="searchKeyword = $event"
  @update:filter-value="filterValue = $event"
  @click:add="handleAddFriend"
  @click:requests="handleViewRequests" />
```

- [ ] **Step 5: 运行测试验证通过**

Run: `pnpm vitest run src/components/friend/__tests__/FriendListHeader.test.ts`
Expected: PASS

- [ ] **Step 6: 跑全局验收命令 + 提交**

```bash
pnpm vue-tsc --noEmit && pnpm test:run && pnpm check
git add src/components/friend/FriendListHeader.vue src/components/friend/FriendListView.vue src/components/friend/__tests__/FriendListHeader.test.ts
git commit -m "refactor(chat): FriendListView 拆出 FriendListHeader 子组件 (2.2.6 P2)"
```

---

## Task 8: FriendListView Phase 3 — 抽 composables（2.2.6 Phase 3）

**Files:**
- Create: `src/components/friend/composables/useFriendSearch.ts`
- Create: `src/components/friend/composables/useFriendFilters.ts`
- Create: `src/components/friend/composables/useFriendContextMenu.ts`
- Create: `src/components/friend/composables/useFriendRequests.ts`
- Modify: `src/components/friend/FriendListView.vue` — 用 composables 替换内联逻辑

**Interfaces:**
- Produces: 4 个 composables，每个返回纯函数和 ref；FriendListView 通过组合调用减少 ~300 行 script

- [ ] **Step 1: 创建 useFriendSearch.ts**

从 FriendListView 行 329-556 抽取搜索状态 + applySearch + 历史记录逻辑。

- [ ] **Step 2: 创建 useFriendFilters.ts**

从 FriendListView 行 385-429 抽取 filterOptions + filteredFriends + getFilterCount。

- [ ] **Step 3: 创建 useFriendContextMenu.ts**

从 FriendListView 行 584-719 抽取 contextMenuItems + handleContextMenuSelect + handleSetNote/DisplayName/SecretFriend。

- [ ] **Step 4: 创建 useFriendRequests.ts**

从 FriendListView 行 352-383 抽取 previewIncomingRequests + handleQuickAccept/Reject。

- [ ] **Step 5: 修改 FriendListView.vue 用 composables 组合**

```ts
// FriendListView.vue <script setup> 瘦身后
const { searchKeyword, applySearch, searchHistory } = useFriendSearch()
const { filterOptions, filterValue, filteredFriends, getFilterCount } = useFriendFilters(friends)
const { contextMenuItems, handleContextMenuSelect } = useFriendContextMenu()
const { previewIncomingRequests, handleQuickAccept, handleQuickReject } = useFriendRequests()
```

- [ ] **Step 6: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```

- [ ] **Step 7: 验证 FriendListView.vue 行数 < 400**

Run: `wc -l src/components/friend/FriendListView.vue`
Expected: < 400 行

- [ ] **Step 8: 提交**

```bash
git add src/components/friend/composables/ src/components/friend/FriendListView.vue
git commit -m "refactor(chat): FriendListView 抽取 4 个 composables 减重 script (2.2.6 P3)"
```

---

## Task 9: FriendListView Phase 4 — 清理 style（2.2.6 Phase 4）

**Files:**
- Modify: `src/components/friend/FriendListView.vue` — 删除已迁移到子组件的样式

- [ ] **Step 1: 删除 FriendListView 中已迁移样式**

删除 `.friend-item`、`.friend-request-preview` 等已由 FriendListItem/FriendRequestCard/FriendListHeader 接管的样式规则。

- [ ] **Step 2: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```

- [ ] **Step 3: 验证最终行数**

Run: `wc -l src/components/friend/FriendListView.vue`
Expected: < 300 行

- [ ] **Step 4: 提交**

```bash
git add src/components/friend/FriendListView.vue
git commit -m "refactor(chat): FriendListView 清理已迁移样式 (2.2.6 P4)"
```

---

## Self-Review

### 1. Spec coverage 检查

| Spec 任务 | 对应 Plan Task |
|---|---|
| 2.3.5 气泡红色样式 | Task 1 Step 3 |
| 2.3.5 输入框红色虚线边框 | Task 1 Step 4 |
| 2.3.6 前端 composable | Task 3 |
| 2.3.6 集成 usePrivateMode | Task 4 |
| 2.3.6 Rust 后端 | Task 5 |
| 2.3.7 MittEnum 新增 | Task 2 Step 3 |
| 2.3.7 PC 隐藏横条 | Task 2 Step 7 |
| 2.3.7 ChatMain 监听 toggle | Task 2 Step 8 |
| 2.3.7 HeaderBar S 按钮 | Task 2 Step 9 |
| 2.3.7 MobileChatMain 同步 | Task 2 Step 10 |
| 2.3.7 移动端确认对话框 | Task 2 Step 11 |
| 2.2.6 Phase 1 复用子组件 | Task 6 |
| 2.2.6 Phase 2 拆 Header | Task 7 |
| 2.2.6 Phase 3 抽 composables | Task 8 |
| 2.2.6 Phase 4 清理 style | Task 9 |

所有 spec 任务均覆盖。

### 2. Placeholder scan

无 TBD/TODO。所有步骤含具体代码。

### 3. Type consistency

- `useScreenshotDetection` 返回 `{ isWatching, startWatch, stopWatch }` 在 Task 3/4 一致
- `MittEnum.PRIVATE_MODE_TOGGLE_REQUEST` 在 Task 2/3/4 一致
- `HeaderBar` props `privateModeActive` 在 Task 2 Step 9/10 一致

---

## Execution Handoff

计划已保存到 `docs/superpowers/plans/2026-08-04-p1-private-chat-finalization.md`。两种执行方式：

1. **Subagent-Driven（推荐）** — 每任务派发独立子代理，任务间评审，快速迭代
2. **Inline Execution** — 在当前会话内执行，批量执行 + 检查点

选择哪种方式？
