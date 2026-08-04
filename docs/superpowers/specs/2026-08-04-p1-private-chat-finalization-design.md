# P1 收尾：私密聊天集成 + FriendListView 拆分设计

> **日期**: 2026-08-04
> **依据**: docs/重构优化方案.md §8.9 P1 收尾
> **范围**: 任务 2.3.5 / 2.3.6 / 2.3.7 / 2.2.6
> **执行范式**: brainstorming → writing-plans → tdd → subagent-driven-development → verification-before-completion

---

## 1. 背景与目标

重构方案 §8.9 列出 P1 收尾 5 个任务，其中 2.2.5 Details.vue 拆分已在前序会话完成。本设计覆盖剩余 4 个任务：

| 任务 | 描述 | 完成度 |
|---|---|---|
| 2.3.5 | 消息气泡红色样式 + 输入框红色虚线边框 | ~30% |
| 2.3.6 | 截屏检测（Tauri API 监听 + 系统消息通知） | 0% |
| 2.3.7 | 移动端私密模式入口 | ~10% |
| 2.2.6 | FriendListView.vue 拆分（851 行 → <500 行/文件） | 0% |

**目标**：完成私密聊天功能的最后集成块，让"进入私密模式 → 视觉反馈 → 截屏防护 → 移动端可用"链路完整闭环；同时拆分最后一个 P1 级超大组件。

---

## 2. 现状分析

### 2.1 私密模式状态传递链（当前）

```
usePrivateMode.ts (privateModeActive ref)
    ↓ mitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true/false)
    ├─ ChatMain.vue 接收 → 传给 ChatBanners :private-mode-active
    │   └─ 给 .message-list 加 .private-mode-active 类（仅 message-row 左边框）
    └─ ChatFooter.vue 监听 mitt → 本地 privateModeActive ref
        └─ 给 <main> 加 .private-mode-footer 类（仅 footer 顶部虚线）
```

**关键问题**：
- `MsgInput.vue` 完全没接入私密模式状态（任务 2.3.5 空白点）
- `renderMessage/index.vue` 不知道当前是否私密模式（气泡本身未变红）
- `usePrivacyProtection.ts` 的 `blockScreenshot` 仅是 boolean，从未被消费（任务 2.3.6 空白点）
- 移动端 `HeaderBar.vue` 无 S 按钮（任务 2.3.7 空白点）

### 2.2 已存在但未复用的资产

| 文件 | 状态 | 说明 |
|---|---|---|
| `src/composables/chat/usePrivateMode.ts` | 已存在（67 行） | PC 端私密模式 hook，通过 mitt 通信 |
| `src/composables/usePrivacyProtection.ts` | 已存在（45 行） | 全局隐私遮罩 hook，`blockScreenshot` 未消费 |
| `src/components/common/ScreenshotWatermark.vue` | 已集成 | ChatBanners.vue:73 已使用 |
| `src/components/common/PrivateModeBanner.vue` | 已集成 | ChatBanners.vue:62 已使用 |
| `src/components/friend/FriendListItem.vue` | 已存在有测试 | **未被 FriendListView 复用**（任务 2.2.6） |
| `src/components/friend/FriendRequestCard.vue` | 已存在有测试 | **未被 FriendListView 复用**（任务 2.2.6） |

### 2.3 MittEnum 现状

`src/enums/index.ts:139` 已有 `PRIVATE_MODE_CHANGED = 'privateModeChanged'`，但缺少：
- `PRIVATE_MODE_TOGGLE_REQUEST`（移动端 HeaderBar → ChatMain 的切换请求）
- `SCREENSHOT_DETECTED`（Rust 后端 → 前端的截屏检测事件，或前端内部事件）

---

## 3. 设计方案

### 3.1 任务 2.3.5：消息气泡红色样式 + 输入框红色虚线边框

**策略**：纯 CSS 后代选择器 + mitt 状态注入（零新依赖）

#### 3.1.1 气泡红色样式

**改动点**：`src/styles/scss/render-message.scss`

当前 `.private-mode-active` 类已在 `ChatMain.vue:763` 加在 `.message-list` 上。利用 CSS 后代选择器，无需改 `renderMessage/index.vue`：

```scss
// 私密模式：发送方气泡红色背景
.private-mode-active {
  .bubble-oneself {
    background-color: var(--tjg-color-danger-500);
  }
  // 私密模式：接收方气泡红色边框
  .bubble {
    border: 1px solid var(--tjg-color-danger-500);
  }
}
```

**验收**：私密模式激活时，发送消息气泡变红，接收消息气泡红色边框。

#### 3.1.2 输入框红色虚线边框

**改动点**：`src/components/rightBox/MsgInput.vue`

当前 `MsgInput.vue` 未接入私密模式。复用 `ChatFooter.vue` 已有的 mitt 监听模式：

```ts
// MsgInput.vue 新增
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'

const privateModeActive = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}
onMounted(() => useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged))
onUnmounted(() => useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged))

const inputClass = computed(() =>
  [
    isMobileRef.value ? '...' : '...',
    privateModeActive.value ? 'private-mode-input' : ''
  ].filter(Boolean).join(' ')
)
```

```scss
// MsgInput.vue scoped style
.private-mode-input {
  border: 1px dashed var(--tjg-color-danger-500);
}
```

**验收**：私密模式激活时，输入框显示红色虚线边框。

#### 3.1.3 风险

- `!important` 已被 ChatFooter 使用（行 326），新样式避免叠加 `!important`，改用更具体的选择器层级
- 不改变现有交互行为，仅视觉反馈

---

### 3.2 任务 2.3.6：截屏检测（全平台）

**策略**：Rust 后端事件监听 + 前端 composable

#### 3.2.1 新建 `useScreenshotDetection.ts`

**文件位置**：`src/composables/chat/useScreenshotDetection.ts`

**职责**：
- 监听 Tauri `screenshot-detected` 事件（或降级为定时轮询）
- 检测到截屏时：调用 `MatrixMessageService` 发送系统消息 + `useActionFeedback` 显示 Toast
- 由 `usePrivateMode.ts` 在 `confirmPrivateMode` 时启动，退出时停止

**接口设计**：

```ts
// src/composables/chat/useScreenshotDetection.ts
import { ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import matrixMessageService from '@/services/matrix/messaging/MatrixMessageService'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

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
    isWatching.value = true

    // 调用 Tauri 命令启动后端监听
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('start_screenshot_watch', { roomId })

    // 监听后端推送的截屏事件
    unlistenFn = await listen<ScreenshotDetectedPayload>('screenshot-detected', async (event) => {
      await handleScreenshotDetected(event.payload)
    })
  }

  async function stopWatch() {
    if (!isWatching.value) return
    isWatching.value = false

    if (unlistenFn) {
      unlistenFn()
      unlistenFn = null
    }

    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('stop_screenshot_watch')
  }

  async function handleScreenshotDetected(payload: ScreenshotDetectedPayload) {
    // 1. 发送系统消息到房间
    try {
      await matrixMessageService.sendSystemMessage(
        payload.roomId,
        '截屏行为已被记录'
      )
    } catch (e) {
      console.error('发送截屏系统消息失败:', e)
    }

    // 2. 显示本地 Toast
    const feedback = useActionFeedback()
    feedback.showFeedback('截屏行为已被记录', 'warning')
  }

  return {
    isWatching,
    startWatch,
    stopWatch
  }
}
```

#### 3.2.2 集成到 `usePrivateMode.ts`

**改动点**：`src/composables/chat/usePrivateMode.ts`

在 `confirmPrivateMode` 时启动截屏监听，在 `togglePrivateMode`（退出）时停止：

```ts
// usePrivateMode.ts 修改
import { useScreenshotDetection } from './useScreenshotDetection'

export function usePrivateMode() {
  // ... 现有代码
  const { startWatch, stopWatch } = useScreenshotDetection()
  const currentRoomId = ref<string>('')

  function confirmPrivateMode() {
    privateModeActive.value = true
    showPrivateConfirm.value = false
    useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
    // 启动截屏监听
    if (currentRoomId.value) {
      startWatch(currentRoomId.value)
    }
  }

  function togglePrivateMode() {
    if (privateModeActive.value) {
      privateModeActive.value = false
      burnEnabled.value = false
      useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, false)
      // 停止截屏监听
      stopWatch()
    } else {
      showPrivateConfirm.value = true
    }
  }

  // ... 其余不变
}
```

#### 3.2.3 `usePrivateMode.ts` 的复用逻辑

**关键复用点**：
1. **状态保持单一来源**：`privateModeActive` 仍在 `usePrivateMode.ts` 内，不迁移到 store
2. **mitt 通信复用**：继续使用 `PRIVATE_MODE_CHANGED` 广播状态变更，所有消费者（ChatMain/ChatFooter/MsgInput/移动端 HeaderBar）统一监听
3. **截屏检测作为子能力**：`useScreenshotDetection` 被 `usePrivateMode` 组合调用，不暴露给外部
4. **`usePrivacyProtection.ts` 不变**：全局隐私遮罩 hook 独立于聊天私密模式，两者职责不同（前者是全局水印/遮罩，后者是单房间私密模式）

**为什么不合并两套 hook**：
- `usePrivacyProtection` 被 `src/layout/index.vue:105` 使用，控制全局 `PrivacyOverlay`
- `usePrivateMode` 被 `ChatMain.vue` 使用，控制单房间私密模式
- 合并会破坏现有测试和职责边界，违反 YAGNI

#### 3.2.4 Rust 后端实现

**新增文件**：`src-tauri/src/desktops/screenshot_watch.rs`

**跨平台策略**：

| 平台 | 实现 | 能力 |
|---|---|---|
| macOS | 监听 `NSWindowDidChangeOcclusionStateNotification`（复用已有 `objc2_app_kit` 依赖） | 检测窗口被截屏时的 occlusion state 变化 |
| Windows | `SetWindowDisplayAffinity(window, WDA_MONITOR)` 阻止截屏 + 检测 | 阻止 + 检测 |
| Linux | 无标准 API | 降级为仅水印 + Toast（不发系统消息） |

**Tauri 命令**：

```rust
// src-tauri/src/desktops/screenshot_watch.rs
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub async fn start_screenshot_watch(
    app: AppHandle,
    room_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // 监听 NSWindow occlusion state
        // 通过 app.emit("screenshot-detected", payload) 推送事件
    }
    #[cfg(target_os = "windows")]
    {
        // SetWindowDisplayAffinity + 检测
    }
    #[cfg(target_os = "linux")]
    {
        // 降级：不做主动检测，依赖前端水印
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_screenshot_watch() -> Result<(), String> {
    // 清理监听器
    Ok(())
}
```

**注册**：在 `src-tauri/src/lib.rs` 的 `invoke_handler![]` 中添加 `start_screenshot_watch` 和 `stop_screenshot_watch`。

#### 3.2.5 风险与降级

- **跨平台能力差异**：Linux 无标准截屏检测 API，降级为仅水印 + Toast（不发系统消息）
- **Tauri 事件可靠性**：若 `listen` 失败，捕获异常并降级为仅 Toast
- **测试策略**：前端 composable 用 mock `@tauri-apps/api` 测试；Rust 后端用 `#[cfg(test)]` 单元测试

---

### 3.3 任务 2.3.7：移动端私密模式入口

**策略**：mitt 事件同步（用户已确认）

#### 3.3.1 新增 MittEnum

`src/enums/index.ts` 新增：

```ts
/** 移动端请求切换私密模式（HeaderBar → ChatMain） */
PRIVATE_MODE_TOGGLE_REQUEST = 'privateModeToggleRequest',
```

#### 3.3.2 PC 端适配

**改动点**：`src/components/rightBox/chatBox/ChatBanners.vue:52`

隐藏 PC 横条版入口（移动端用 HeaderBar 的 S 按钮代替）：

```vue
<!-- 修改前 -->
<div v-if="!isGroup" class="private-mode-bar ...">

<!-- 修改后 -->
<div v-if="!isMobile() && !isGroup" class="private-mode-bar ...">
```

**改动点**：`src/components/rightBox/chatBox/ChatMain.vue`

监听 `PRIVATE_MODE_TOGGLE_REQUEST` 触发 `togglePrivateMode`：

```ts
// ChatMain.vue 新增
const onToggleRequest = () => {
  togglePrivateMode()
}
onMounted(() => useMitt.on(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onToggleRequest))
onUnmounted(() => useMitt.off(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onToggleRequest))
```

#### 3.3.3 移动端 HeaderBar 改造

**改动点**：`src/mobile/components/chat-room/HeaderBar.vue`

新增 props/emit + S 按钮（SVG，16px，激活红色）：

```vue
<script setup lang="ts">
interface HeaderBarProps {
  // ... 现有 props
  privateModeActive?: boolean
}
const props = defineProps<HeaderBarProps>()
const emit = defineEmits<{
  togglePrivateMode: []
}>()
</script>

<template>
  <!-- 在更多按钮前新增 S 按钮（仅单聊） -->
  <button
    v-if="!isGroup"
    type="button"
    class="private-toggle-btn-mobile"
    :class="{ 'private-toggle-btn-mobile--active': privateModeActive }"
    :title="privateModeActive ? '退出私密模式' : '进入私密模式'"
    @click="emit('togglePrivateMode')">
    <span class="private-toggle-btn-mobile__letter">S</span>
  </button>
</template>

<style scoped lang="scss">
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

  &--active {
    background: var(--tjg-color-danger-500);
    color: var(--tjg-text-inverse);
    border-color: var(--tjg-color-danger-500);
  }

  &__letter {
    font-size: 16px;
    font-weight: 600;
  }
}
</style>
```

#### 3.3.4 移动端 MobileChatMain 状态同步

**改动点**：`src/mobile/views/chat-room/MobileChatMain.vue`

```ts
// MobileChatMain.vue 新增
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'

const privateModeActive = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}
const onTogglePrivateMode = () => {
  // 通过 mitt 请求 ChatMain 内的 usePrivateMode 切换
  useMitt.emit(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST)
}

onMounted(() => useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged))
onUnmounted(() => useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged))
```

```vue
<template>
  <HeaderBar
    :private-mode-active="privateModeActive"
    @toggle-private-mode="onTogglePrivateMode"
  />
  <ChatMain @scroll="handleScroll" />
</template>
```

#### 3.3.5 移动端确认对话框

移动端用 `van-dialog` 替代 PC 的 `n-modal`。复用 `usePrivateMode` 的 `privateModeFeatures` 列表（4 项说明）。

**新增**：`src/mobile/components/chat-room/PrivateModeConfirmDialog.vue`

```vue
<script setup lang="ts">
import { showConfirmDialog } from 'vant'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

// 复用 usePrivateMode 的 privateModeFeatures
const { privateModeFeatures, confirmPrivateMode, cancelPrivateMode } = usePrivateMode()

watch(() => props.show, (val) => {
  if (val) {
    showConfirmDialog({
      title: '进入私密模式',
      message: privateModeFeatures.value.map(f => `${f.title}：${f.description}`).join('\n'),
      confirmButtonText: '确认进入',
      cancelButtonText: '取消'
    }).then(() => {
      confirmPrivateMode()
      emit('confirm')
    }).catch(() => {
      cancelPrivateMode()
      emit('cancel')
    })
  }
})
</script>
```

#### 3.3.6 风险

- mitt 事件是全局的，需确保 `PRIVATE_MODE_TOGGLE_REQUEST` 只在当前房间生效（通过 `currentRoomId` 校验）
- 移动端 `van-dialog` 样式需与 PC 端 `n-modal` 视觉一致

---

### 3.4 任务 2.2.6：FriendListView.vue 拆分

**策略**：4 阶段拆分（复用优先）

#### 3.4.1 Phase 1：复用已存在子组件

- 用 `FriendListItem.vue` 替换 FriendListView 行 192-277 的两段内联列表项模板（-80 行）
- 用 `FriendRequestCard.vue` 替换行 60-107 的请求预览项（-40 行）
- **适配**：`FriendListItem.vue` 现有 API 与内联版本字段不完全一致（如 `dir`、`ariaLabel`、`highlightText` vs `getHighlightSegments`），需扩展 props 或适配 wrapper

#### 3.4.2 Phase 2：拆 Header

新建 `src/components/friend/FriendListHeader.vue`，包含：
- 标题 + 添加按钮
- 请求预览入口
- 搜索栏（复用 `FriendSearchBar.vue`）
- 过滤器

通过 props/emit 与父组件通信。预计 FriendListView 减少 ~120 行。

#### 3.4.3 Phase 3：抽 composables

| Composable | 职责 | 预计减重 |
|---|---|---|
| `useFriendSearch.ts` | 搜索状态 + applySearch + 历史记录 | ~120 行 |
| `useFriendFilters.ts` | filterOptions + filteredFriends + getFilterCount | ~45 行 |
| `useFriendContextMenu.ts` | contextMenuItems + handleContextMenuSelect + handleSetNote/DisplayName/SecretFriend | ~135 行 |
| `useFriendRequests.ts` | previewIncomingRequests + handleQuickAccept/Reject | ~32 行 |

#### 3.4.4 Phase 4：清理 style

将已迁移到子组件的样式（`.friend-item`、`.friend-request-preview`）从 FriendListView 删除。预计减少 ~80 行。

#### 3.4.5 预期结果

- `FriendListView.vue` 主文件 ~250-300 行（仅布局编排 + composable 组合）
- 每个新文件 < 500 行
- `vue-tsc --noEmit` 0 错误
- 已有 `FriendListItem.test.ts` / `FriendRequestCard.test.ts` 测试通过
- 新增 `FriendListHeader.test.ts`

#### 3.4.6 风险

- RecycleScroller 的 v-slot 适配需要 `FriendListItem` 支持虚拟模式
- 上下文菜单依赖 `window.$dialog` 全局 API，抽到 composable 后需保持引用一致

---

## 4. 执行顺序

基于依赖关系：

```
1. 2.3.5 样式基础（CSS + MsgInput mitt 接入）
   ↓ 提供视觉反馈基础
2. 2.3.7 移动端入口（复用 2.3.5 的样式 + mitt 事件）
   ↓ 私密模式链路完整
3. 2.3.6 截屏检测（依赖私密模式启动/停止）
   ↓ 截屏防护闭环
4. 2.2.6 FriendListView 拆分（独立，无依赖）
```

---

## 5. 全局约束

- 每任务一个 Conventional Commit
- 每任务完成后跑验收命令：`pnpm vue-tsc --noEmit` / `pnpm test:run` / `pnpm check` / `pnpm check:ratchet`
- TDD：涉及逻辑的任务（2.3.6/2.3.7）先写失败测试
- 图标必须 SVG，颜色必须 `--tjg-*` token
- 不破坏 SDK 边界：Matrix 操作走 `src/services/matrix/` 服务层
- 不改变现有交互行为（拖拽、视图切换、响应式断点、消息收发）

---

## 6. 验收标准

| 任务 | 验收标准 |
|---|---|
| 2.3.5 | 私密模式激活时：发送气泡红色背景；接收气泡红色边框；输入框红色虚线边框 |
| 2.3.6 | 私密模式激活时截屏：macOS/Windows 发送系统消息 + Toast；Linux 仅 Toast + 水印 |
| 2.3.7 | 移动端聊天界面 S 按钮可见；激活后样式变化；确认对话框显示 4 项说明 |
| 2.2.6 | FriendListView.vue <300 行；每新文件 <500 行；vue-tsc 0 错误；测试通过 |

---

## 7. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| 2.3.6 跨平台 Rust 实现复杂 | 先 macOS + Windows，Linux 降级 | `git revert` 截屏检测提交 |
| 2.3.7 mitt 事件全局泄露 | 通过 `currentRoomId` 校验 | 回退 HeaderBar 改动 |
| 2.2.6 RecycleScroller 适配失败 | 保留内联模式作为 fallback | 回退到拆分前 |
| 私密模式样式影响非私密场景 | CSS 选择器限定 `.private-mode-active` 父类 | 删除新增 SCSS 规则 |
