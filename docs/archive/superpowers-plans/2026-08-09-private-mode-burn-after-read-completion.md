# 私密聊天模式与阅后即焚完善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有私密聊天模式与阅后即焚功能的基础上，修复已识别缺陷、补齐需求文档（`docs/UI界面需求文档.md` §3.12 与 §3.13.6）未满足的能力，确保功能完整、状态源统一、无死代码。

**Architecture:** 服务层（`MatrixBurnAfterReadService`）、Tauri 后端（`screenshot_watch.rs`）、核心组件（`BurnMessage`/`BurnIndicator`/`BurnAfterReadToggle`/`PrivateModeBanner`/`ScreenshotWatermark`/`PrivateModeConfirmDialog`）、composable（`usePrivateMode`/`useBurnAfterRead`/`useScreenshotDetection`）已完整实现且已被业务组件消费。本次完善聚焦四类问题：(1) 修复功能性 bug（重复 S 按钮、移动端设置页未调服务）；(2) 补齐缺失能力（房间级配置入口、待销毁消息管理 UI、composable 暴露完整服务）；(3) 统一状态源（桌面端设置页改用 `settingStore` + 真实服务）；(4) 清理死代码（`usePrivacyProtection`、`ChatBanners` 中未使用的 `BurnAfterReadToggle` import）。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`)、TypeScript、Pinia（`settingStore`）、Vitest、Naive UI（桌面）、Vant（移动）、UnoCSS、`--tjg-*` 设计 token、Tauri v2。

## Global Constraints

- 设计 token 唯一来源：`src/styles/css/design-tokens.css`；新代码一律使用 `--tjg-*` token，禁止硬编码颜色（`#xxx`/`rgb()`/`rgba()`）。
- 图标必须使用 SVG（`<svg>`/`<use>`/Iconify），线宽 1.5px，禁止 div-based 图标。
- TypeScript 严格模式；`vue-tsc --noEmit` 必须 0 错误。
- 单元测试用 Vitest；遵循 TDD（Red-Green-Refactor），先写失败测试再实现。
- 组件体量红线：任何 `.vue` 文件超过 800 行必须拆分。
- Matrix SDK 调用必须通过 `src/services/matrix/` 服务层，禁止组件/store 直接调用 SDK。
- 桌面/移动端策略：优先补全 `src/mobile/` 独立实现；`isMobile()` 内联分支只允许在临界候补组件。
- i18n 翻译键放在 `locales/zh-CN/*.json` 与 `locales/en/*.json`，键名遵循 `chat.burn.*` / `setting.burn_after_read.*` / `mobile_burn.*` 已有命名。
- 提交规范：Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `chore:`），不使用 emoji。
- 验收命令（每个任务结束前必跑）：`pnpm vue-tsc --noEmit` + `pnpm test:run` + `pnpm check`。

## 调研结论：已实现 vs 缺陷

### 已完整实现（本次计划不动）

| 能力 | 文件位置 | 备注 |
| :--- | :--- | :--- |
| 服务层全部 API | `src/services/matrix/messaging/MatrixBurnAfterReadService.ts:29-235` | enableBurn/disableBurn/getBurnSettings/isBurnEnabled/getPendingBurns/markBurnRead/cancelBurn/setBurnConfig/getBurnStats/sendMessage/burnMessage/extendBurnTime 全部实现 |
| 截屏检测 composable | `src/composables/chat/useScreenshotDetection.ts:18-86` | 真实调用 Tauri `start_screenshot_watch`/`stop_screenshot_watch`，监听 `screenshot-detected` 事件并发 m.notice 系统消息 |
| Tauri 截屏后端 | `src-tauri/src/desktops/screenshot_watch.rs:41,82` + `src-tauri/src/lib.rs:562,564` | 命令已注册 |
| 私密模式单例 composable | `src/composables/chat/usePrivateMode.ts:1-85` | 模块级单例，状态管理完整 |
| BurnMessage/BurnIndicator/BurnAfterReadToggle | `src/components/burn/*.vue` | 组件已实现 |
| PrivateModeBanner/ScreenshotWatermark | `src/components/common/*.vue` | 组件已实现 |
| 移动端 PrivateModeConfirmDialog | `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue` | van-dialog 实现 |
| 桌面端确认对话框 | `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue:77-116` | n-modal 实现，调用 confirmPrivateMode/cancelPrivateMode |
| 桌面端 S 按钮（工具栏） | `src/components/rightBox/chatBox/ChatHeader/ChatHeaderToolbar.vue:113-138` | emit `toggle-private-mode` |
| 桌面端 ChatMain 集成 | `src/components/rightBox/chatBox/ChatMain.vue:9-19,52,89-99` | 传递 privateModeActive/burnEnabled；message-list 加 `private-mode-active` class；BurnAfterReadToggle 条件渲染 |
| 桌面端 ChatMessageList 私密样式 | `src/components/rightBox/chatBox/ChatMessageList.vue:53,169-171` | `message-row--private-mode` 类（仅左边框，需补全） |
| 移动端 MobileChatMain 集成 | `src/mobile/views/chat-room/MobileChatMain.vue:67-71,125-144` | PrivateModeConfirmDialog + mitt 通信 |
| 消息渲染 BurnMessage 包裹 | `src/components/rightBox/renderMessage/index.vue:136-178` | `v-if="message.message.burnAfterRead"` 条件包裹 |
| 接收消息 burn 标记解析 | `src/services/matrix/MatrixEventService.ts:447-461` | 解析 burnExpiresIn → burnRemainingSeconds/isBurning/isBurned |
| 发送消息 burn 标记传递 | `src/composables/chat/useMsgInputSend.ts:507-509,756-758` | `isBurnAfterRead.value` → `burnPayload.burnExpiresInMs = burnDuration.value * 1000` |
| 桌面端全局设置页 | `src/views/settingsWindow/tabs/BurnAfterReadSettings.vue` | 调用 getBurnStats/enableBurn/disableBurn（但房间列表用 localStorage，需修） |
| settingStore burn 字段 | `src/stores/domains/settings/setting.ts:26-28,480-490` | burnDefaultEnabled/burnDefaultDuration/burnShowCountdown + setter |
| i18n 翻译键 | `locales/zh-CN/chat.json:32-47,68`、`locales/zh-CN/setting.json:852+`、`locales/zh-CN/mobile_burn.json` | chat.burn.* / chat.header.private_mode_* / chat.privacy.screenshot_detected_notice / setting.burn_after_read.* 基本齐全 |
| 测试覆盖 | 10 个测试文件 | MatrixBurnAfterReadService/useBurnAfterRead/BurnAfterReadToggle/BurnAfterReadSettings(desktop+mobile)/useScreenshotDetection/usePrivateMode.screenshot/PrivateModeBanner/ScreenshotWatermark/HeaderBar.private-mode/usePrivacyProtection |

### 已识别缺陷清单

| # | 缺陷 | 优先级 | 影响 |
| :--- | :--- | :--- | :--- |
| D1 | 桌面端 S 按钮重复：`ChatHeaderToolbar.vue` 与 `ChatBanners.vue` 各有一个 S 按钮，同一界面会出现两个 | P0 | 功能性 bug，违背需求 §3.13.6"图标顺序: [搜索] [语音] [视频] [S私密] [更多]" |
| D2 | `ChatBanners.vue` 中 `BurnAfterReadToggle` import 是死代码（`void BurnAfterReadToggle`） | P3 | 代码异味 |
| D3 | `usePrivacyProtection.ts` 与 `usePrivateMode.ts` 功能重复，且未被任何业务组件消费（仅测试引用） | P3 | 死代码 |
| D4 | `useBurnAfterRead.ts` 未暴露 `cancelBurn`/`getPendingBurns`/`setBurnConfig`/真实 `getBurnStats`（当前硬编码返回 0） | P1 | 待销毁消息管理 UI 无数据源；全局配置无法落地 |
| D5 | 移动端 `BurnAfterReadSettings.vue` 完全用 localStorage，`handleRoomToggle` 未调用 enableBurn/disableBurn 服务 | P0 | 违背需求 §3.12.4"全局配置: PUT /user/burn/config"和"用户统计: GET /user/burn/stats" |
| D6 | 房间级阅后即焚配置入口缺失（需求 §3.12.1 要求"房间设置 > 阅后即焚"） | P1 | 需求未满足 |
| D7 | 待销毁消息管理 UI 缺失（需求 §3.12.3 要求"房间设置 > 阅后即焚 > 待销毁消息"） | P1 | 需求未满足 |
| D8 | 私密模式红色主题样式不完整：仅 `border-left: 2px solid danger`，未区分发送/接收，未改背景色 | P2 | 违背需求 §3.13.6"发送消息红色背景，接收消息红色边框" |
| D9 | 私密模式 `BurnAfterReadToggle` 切换时只更新本地 `burnEnabled` ref，未调用 `enableBurn`/`disableBurn` 服务 | P1 | 房间级 burn 设置不会持久化到后端 |
| D10 | 桌面端 `BurnAfterReadSettings.vue` 房间列表用 localStorage 'tjg-burn-after-read-settings'，与 `settingStore` 状态源不一致 | P2 | 桌面/移动端状态分裂 |

---

## File Structure

### 新建文件

| 文件 | 职责 |
| :--- | :--- |
| `src/components/room/RoomBurnSettings.vue` | 房间级阅后即焚配置面板（开关 + 时长选择 + 待销毁数提示），嵌入 `RoomDetailPane.vue` |
| `src/components/room/PendingBurnMessages.vue` | 待销毁消息列表（消息预览 + 创建时间 + 剩余时间 + 取消销毁按钮） |
| `src/components/room/__tests__/RoomBurnSettings.test.ts` | RoomBurnSettings 单元测试 |
| `src/components/room/__tests__/PendingBurnMessages.test.ts` | PendingBurnMessages 单元测试 |
| `src/composables/__tests__/useBurnAfterRead.complete.test.ts` | useBurnAfterRead 完整能力暴露测试（cancelBurn/getPendingBurns/setBurnConfig/getBurnStats） |

### 修改文件

| 文件 | 改动 |
| :--- | :--- |
| `src/components/rightBox/chatBox/ChatBanners.vue` | 删除重复 S 按钮区块（保留 PrivateModeBanner/锁图标/ScreenshotWatermark）；删除死代码 `BurnAfterReadToggle` import 与 `void` 语句 |
| `src/composables/useBurnAfterRead.ts` | 暴露 `cancelBurn`/`getPendingBurns`/`setBurnConfig`/真实 `getBurnStats`（调用服务层） |
| `src/mobile/views/my/BurnAfterReadSettings.vue` | `handleRoomToggle` 改为调用 `useBurnAfterRead.enableBurn`/`disableBurn`；`loadBurnStats` 改为调用 `getBurnStats`；`loadBurnRooms` 改为从服务端拉取（或保留 localStorage 缓存但同步服务端状态） |
| `src/views/settingsWindow/tabs/BurnAfterReadSettings.vue` | 房间列表与全局开关状态改用 `settingStore`；`loadBurnStats` 已调用服务（保留） |
| `src/components/room/RoomDetailPane.vue` | 新增 RoomBurnSettings 区域（仅单聊/群聊均可，需求未限制） |
| `src/components/rightBox/chatBox/ChatMessageList.vue` | 完善 `.message-row--private-mode` 样式：发送方红色背景、接收方红色边框 |
| `src/components/rightBox/chatBox/ChatMain.vue` | `BurnAfterReadToggle` 的 `@update:enabled` 回调改为调用 `useBurnAfterRead.enableBurn`/`disableBurn` |

### 删除文件

| 文件 | 原因 |
| :--- | :--- |
| `src/composables/usePrivacyProtection.ts` | 与 `usePrivateMode.ts` 重复，未被业务组件消费 |
| `src/composables/__tests__/usePrivacyProtection.test.ts` | 配套测试 |

---

## Task 1: 修复桌面端 S 按钮重复 + 清理 ChatBanners 死代码

**Files:**
- Modify: `src/components/rightBox/chatBox/ChatBanners.vue:49-75,89-97`
- Test: `src/components/rightBox/chatBox/__tests__/ChatBanners.test.ts`（若不存在则新建）

**Interfaces:**
- Consumes: `privateModeActive: boolean`、`burnEnabled: boolean`、`currentUserId: string`、`currentUserName: string`（来自 ChatMain props）
- Produces: 仍 emit `togglePrivateMode: []`（但 S 按钮移除后该 emit 由 ChatHeaderToolbar 触发，ChatBanners 不再 emit）

- [ ] **Step 1: 写失败测试 — ChatBanners 不再渲染 S 按钮**

新建 `src/components/rightBox/chatBox/__tests__/ChatBanners.test.ts`：

```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatBanners from '../ChatBanners.vue'

const mountBanners = (props: Partial<InstanceType<typeof ChatBanners>['$props']> = {}) =>
  mount(ChatBanners, {
    props: {
      networkBannerText: null,
      isAnnouncementLoading: false,
      isGroup: false,
      topAnnouncement: null,
      currentRoomId: '!room1:server',
      privateModeActive: true,
      burnEnabled: false,
      currentUserId: '@me:server',
      currentUserName: 'Me',
      stickyEvents: [],
      canSetSticky: false,
      ...props
    },
    global: { stubs: ['E2EEBanner', 'StickyEventBanner', 'PrivateModeBanner', 'ScreenshotWatermark'] }
  })

describe('ChatBanners', () => {
  it('does NOT render private-mode S toggle button (delegated to ChatHeaderToolbar)', () => {
    const wrapper = mountBanners({ privateModeActive: false })
    expect(wrapper.find('[data-testid="private-toggle-btn"]').exists()).toBe(false)
  })

  it('renders PrivateModeBanner when privateModeActive and burnEnabled', () => {
    const wrapper = mountBanners({ privateModeActive: true, burnEnabled: true })
    expect(wrapper.findComponent({ name: 'PrivateModeBanner' }).exists()).toBe(true)
  })

  it('renders lock icon when privateModeActive', () => {
    const wrapper = mountBanners({ privateModeActive: true })
    expect(wrapper.find('[data-testid="private-lock-icon"]').exists()).toBe(true)
  })

  it('renders ScreenshotWatermark when privateModeActive', () => {
    const wrapper = mountBanners({ privateModeActive: true })
    expect(wrapper.findComponent({ name: 'ScreenshotWatermark' }).exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatBanners.test.ts`
Expected: FAIL — "does NOT render private-mode S toggle button" 断言失败（当前 S 按钮存在）

- [ ] **Step 3: 删除 ChatBanners 中的 S 按钮区块与死代码 import**

修改 `src/components/rightBox/chatBox/ChatBanners.vue`：

1. 删除模板中第 49-68 行的 `<!-- 私密模式切换按钮（仅单聊） -->` 整个 `<div class="private-mode-bar ...">` 区块（包含 `private-toggle-btn`、`PrivateModeBanner`、`private-lock-icon`）。
2. 保留 `ScreenshotWatermark` 区块（第 70-75 行）。
3. 把 `PrivateModeBanner` 与 `private-lock-icon` 移到 `ScreenshotWatermark` 同级的独立区块（保留显示能力）：

```vue
<!-- 私密模式提示（S 按钮由 ChatHeaderToolbar 提供，此处仅显示状态） -->
<PrivateModeBanner v-if="privateModeActive" :burn-enabled="burnEnabled" />
<div v-if="privateModeActive" class="flex-shrink-0 px-12px py-4px flex items-center gap-8px">
  <svg
    data-testid="private-lock-icon"
    class="size-16px flex-shrink-0 text-[--tjg-color-danger-500]"
    aria-label="私密模式">
    <use href="#lock"></use>
  </svg>
</div>

<!-- ScreenshotWatermark (private mode) -->
<ScreenshotWatermark
  v-if="privateModeActive"
  :user-id="currentUserId"
  :user-name="currentUserName"
  :enabled="privateModeActive" />
```

4. 删除 `<script setup>` 中第 89-97 行的 `import BurnAfterReadToggle` 与 `void BurnAfterReadToggle`。
5. 从 `defineProps` 中移除 `privateModeActive`、`burnEnabled`、`currentUserId`、`currentUserName` 之外的多余字段（若 S 按钮区块删除后 `togglePrivateMode` emit 不再触发，则从 `defineEmits` 中移除 `togglePrivateMode`）。
6. 删除 `<style scoped>` 中 `.private-toggle-btn` 相关样式（第 135-168 行）。

- [ ] **Step 4: 修改 ChatMain.vue 移除对 ChatBanners 的 toggle-private-mode 监听**

修改 `src/components/rightBox/chatBox/ChatMain.vue:15`：删除 `@toggle-private-mode="togglePrivateMode"`（S 按钮已移到 ChatHeaderToolbar，ChatHeaderRoot 已处理该事件）。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatBanners.test.ts`
Expected: PASS — 4 个测试全部通过

- [ ] **Step 6: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误，所有测试通过

- [ ] **Step 7: 提交**

```bash
git add src/components/rightBox/chatBox/ChatBanners.vue src/components/rightBox/chatBox/ChatMain.vue src/components/rightBox/chatBox/__tests__/ChatBanners.test.ts
git commit -m "fix(chat): 移除 ChatBanners 中重复的私密模式 S 按钮，保留状态提示

S 按钮已在 ChatHeaderToolbar 中实现，ChatBanners 中的重复按钮导致
同一界面出现两个 S 按钮。删除重复区块与死代码 BurnAfterReadToggle
import，保留 PrivateModeBanner/锁图标/ScreenshotWatermark 状态显示。

Ref: docs/UI界面需求文档.md §3.13.6"
```

---

## Task 2: useBurnAfterRead 暴露完整服务能力

**Files:**
- Modify: `src/composables/useBurnAfterRead.ts:62-119`
- Test: `src/composables/__tests__/useBurnAfterRead.complete.test.ts`（新建）

**Interfaces:**
- Consumes: `matrixBurnAfterReadService.cancelBurn`/`getPendingBurns`/`setBurnConfig`/`getBurnStats`（已存在于服务层）
- Produces:
  - `cancelBurn(roomId: string, eventId: string): Promise<boolean>`
  - `getPendingBurns(roomId: string): Promise<BurnPendingEvent[]>`
  - `setBurnConfig(defaultBurnMs: number): Promise<number | null>`
  - `getBurnStats(): Promise<BurnStats>`（真实调用服务层，替换当前硬编码实现）

- [ ] **Step 1: 写失败测试 — useBurnAfterRead 暴露完整能力**

新建 `src/composables/__tests__/useBurnAfterRead.complete.test.ts`：

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBurnAfterRead } from '../useBurnAfterRead'

vi.mock('@/services/matrix/messaging/MatrixBurnAfterReadService', () => ({
  matrixBurnAfterReadService: {
    cancelBurn: vi.fn().mockResolvedValue(true),
    getPendingBurns: vi.fn().mockResolvedValue([
      { eventId: '$evt1:server', createdAt: 1700000000000, deleteAt: 1700000060000 }
    ]),
    setBurnConfig: vi.fn().mockResolvedValue(60000),
    getBurnStats: vi.fn().mockResolvedValue({
      totalBurned: 10,
      totalPending: 3,
      roomsWithBurnEnabled: 2
    }),
    enableBurn: vi.fn().mockResolvedValue({ enabled: true, burnAfterMs: 60000 }),
    disableBurn: vi.fn().mockResolvedValue({ enabled: false, burnAfterMs: 0 }),
    getBurnSettings: vi.fn().mockResolvedValue(null),
    isBurnEnabled: vi.fn().mockResolvedValue(false),
    markBurnRead: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room1:server' })
}))

describe('useBurnAfterRead complete API surface', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exposes cancelBurn that delegates to service', async () => {
    const { cancelBurn } = useBurnAfterRead()
    const result = await cancelBurn('!room1:server', '$evt1:server')
    expect(result).toBe(true)
    const { matrixBurnAfterReadService } = await import('@/services/matrix/messaging/MatrixBurnAfterReadService')
    expect(matrixBurnAfterReadService.cancelBurn).toHaveBeenCalledWith('!room1:server', '$evt1:server')
  })

  it('exposes getPendingBurns that returns mapped BurnPendingEvent[]', async () => {
    const { getPendingBurns } = useBurnAfterRead()
    const result = await getPendingBurns('!room1:server')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      eventId: '$evt1:server',
      createdAt: 1700000000000,
      deleteAt: 1700000060000
    })
  })

  it('exposes setBurnConfig that returns defaultBurnMs', async () => {
    const { setBurnConfig } = useBurnAfterRead()
    const result = await setBurnConfig(60000)
    expect(result).toBe(60000)
  })

  it('exposes getBurnStats that returns real stats from service (not hardcoded 0)', async () => {
    const { getBurnStats } = useBurnAfterRead()
    const result = await getBurnStats()
    expect(result).toEqual({
      totalBurned: 10,
      totalPending: 3,
      roomsWithBurnEnabled: 2
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/composables/__tests__/useBurnAfterRead.complete.test.ts`
Expected: FAIL — `cancelBurn is not a function` / `getPendingBurns is not a function` / `setBurnConfig is not a function` / `getBurnStats` 返回硬编码 0

- [ ] **Step 3: 在 useBurnAfterRead 中暴露完整能力**

修改 `src/composables/useBurnAfterRead.ts`：

1. 顶部 import 新增类型：
```typescript
import { matrixBurnAfterReadService, type BurnPendingEvent, type BurnStats } from '@/services/matrix/messaging/MatrixBurnAfterReadService'
```

2. 替换 `getBurnStats` 实现（当前第 72-82 行硬编码返回 0）为真实调用：
```typescript
const getBurnStats = async (): Promise<BurnStats> => {
  try {
    return await matrixBurnAfterReadService.getBurnStats()
  } catch {
    return { totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 }
  }
}
```

3. 新增三个方法：
```typescript
const cancelBurn = async (roomId: string, eventId: string): Promise<boolean> => {
  try {
    return await matrixBurnAfterReadService.cancelBurn(roomId, eventId)
  } catch {
    return false
  }
}

const getPendingBurns = async (roomId: string): Promise<BurnPendingEvent[]> => {
  try {
    return await matrixBurnAfterReadService.getPendingBurns(roomId)
  } catch {
    return []
  }
}

const setBurnConfig = async (defaultBurnMs: number): Promise<number | null> => {
  try {
    return await matrixBurnAfterReadService.setBurnConfig(defaultBurnMs)
  } catch {
    return null
  }
}
```

4. 在 return 对象中追加暴露：
```typescript
return {
  isRoomBurnEnabled,
  getRoomBurnDuration,
  refreshBurnSettings,
  toggleRoomBurn,
  markMessageRead,
  getBurnStats,
  enableBurn,
  disableBurn,
  cancelBurn,
  getPendingBurns,
  setBurnConfig
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/composables/__tests__/useBurnAfterRead.complete.test.ts`
Expected: PASS — 4 个测试全部通过

- [ ] **Step 5: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run`
Expected: 0 错误，所有测试通过

- [ ] **Step 6: 提交**

```bash
git add src/composables/useBurnAfterRead.ts src/composables/__tests__/useBurnAfterRead.complete.test.ts
git commit -m "feat(burn): useBurnAfterRead 暴露 cancelBurn/getPendingBurns/setBurnConfig/真实 getBurnStats

替换原硬编码 getBurnStats（始终返回 0）为真实服务调用，并补齐
cancelBurn/getPendingBurns/setBurnConfig 三个方法的暴露，为待销毁
消息管理 UI 与全局配置落地提供数据源。

Ref: docs/UI界面需求文档.md §3.12.3 §3.12.4"
```

---

## Task 3: 移动端 BurnAfterReadSettings 改用真实服务调用

**Files:**
- Modify: `src/mobile/views/my/BurnAfterReadSettings.vue:137-218`
- Test: `src/mobile/views/my/__tests__/BurnAfterReadSettings.test.ts`（已存在，需补充用例）

**Interfaces:**
- Consumes: `useBurnAfterRead.enableBurn`/`disableBurn`/`getBurnStats`/`setBurnConfig`、`settingStore.setBurnDefaultEnabled`/`setBurnDefaultDuration`
- Produces: 移动端设置页房间开关切换真实生效；统计卡片真实数据

- [ ] **Step 1: 写失败测试 — 房间开关切换调用 enableBurn/disableBurn**

修改 `src/mobile/views/my/__tests__/BurnAfterReadSettings.test.ts`，新增用例：

```typescript
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BurnAfterReadSettings from '../BurnAfterReadSettings.vue'

const enableBurnMock = vi.fn().mockResolvedValue(true)
const disableBurnMock = vi.fn().mockResolvedValue(true)
const getBurnStatsMock = vi.fn().mockResolvedValue({ totalBurned: 5, totalPending: 2, roomsWithBurnEnabled: 1 })

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    enableBurn: enableBurnMock,
    disableBurn: disableBurnMock,
    getBurnStats: getBurnStatsMock
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    burnDefaultEnabled: false,
    burnDefaultDuration: 60,
    burnShowCountdownEnabled: true,
    setBurnDefaultEnabled: vi.fn(),
    setBurnDefaultDuration: vi.fn(),
    setBurnShowCountdownEnabled: vi.fn(),
    migrateLegacyPreferenceSettings: vi.fn()
  })
}))

describe('Mobile BurnAfterReadSettings service integration', () => {
  it('calls enableBurn when toggling room on', async () => {
    const wrapper = mount(BurnAfterReadSettings, { global: { stubs: ['Icon', 'van-cell-group', 'van-cell', 'van-switch', 'van-loading', 'van-popup', 'van-picker', 'AutoFixHeightPage', 'HeaderBar'] } })
    await flushPromises()
    // 找到房间开关并触发 change
    const switches = wrapper.findAllComponents({ name: 'van-switch' })
    // 房间开关是最后一个 switch
    const roomSwitch = switches[switches.length - 1]
    await roomSwitch.vm.$emit('change', true)
    await flushPromises()
    expect(enableBurnMock).toHaveBeenCalled()
  })

  it('calls disableBurn when toggling room off', async () => {
    const wrapper = mount(BurnAfterReadSettings, { global: { stubs: ['Icon', 'van-cell-group', 'van-cell', 'van-switch', 'van-loading', 'van-popup', 'van-picker', 'AutoFixHeightPage', 'HeaderBar'] } })
    await flushPromises()
    const switches = wrapper.findAllComponents({ name: 'van-switch' })
    const roomSwitch = switches[switches.length - 1]
    await roomSwitch.vm.$emit('change', false)
    await flushPromises()
    expect(disableBurnMock).toHaveBeenCalled()
  })

  it('loads real stats from getBurnStats', async () => {
    mount(BurnAfterReadSettings, { global: { stubs: ['Icon', 'van-cell-group', 'van-cell', 'van-switch', 'van-loading', 'van-popup', 'van-picker', 'AutoFixHeightPage', 'HeaderBar'] } })
    await flushPromises()
    expect(getBurnStatsMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/mobile/views/my/__tests__/BurnAfterReadSettings.test.ts`
Expected: FAIL — enableBurn/disableBurn 未被调用

- [ ] **Step 3: 修改移动端 BurnAfterReadSettings 调用真实服务**

修改 `src/mobile/views/my/BurnAfterReadSettings.vue`：

1. 在 `<script setup>` 中 import `useBurnAfterRead`：
```typescript
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
const { enableBurn, disableBurn, getBurnStats } = useBurnAfterRead()
```

2. 替换 `loadBurnStats`（第 181-190 行）为真实调用：
```typescript
async function loadBurnStats() {
  try {
    const stats = await getBurnStats()
    burnStats.value = {
      totalBurned: stats.totalBurned,
      activeRooms: stats.roomsWithBurnEnabled
    }
  } catch {
    // 保留默认 0
  }
}
```

3. 替换 `handleRoomToggle`（第 214-218 行）为真实调用：
```typescript
async function handleRoomToggle(
  room: { roomId: string; name: string; duration: number; enabled: boolean },
  val: boolean
) {
  try {
    if (val) {
      await enableBurn(room.roomId, room.duration * 1000)
    } else {
      await disableBurn(room.roomId)
    }
    room.enabled = val
    saveBurnRooms()
    showToast(val ? t('mobile_burn.room_enabled') : t('mobile_burn.room_disabled'))
    await loadBurnStats()
  } catch {
    showToast(t('mobile_burn.room_toggle_failed'))
  }
}
```

4. 在 `locales/zh-CN/mobile_burn.json` 与 `locales/en/mobile_burn.json` 中新增 `room_toggle_failed` 键：
```json
"room_toggle_failed": "操作失败，请重试"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/mobile/views/my/__tests__/BurnAfterReadSettings.test.ts`
Expected: PASS

- [ ] **Step 5: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误

- [ ] **Step 6: 提交**

```bash
git add src/mobile/views/my/BurnAfterReadSettings.vue src/mobile/views/my/__tests__/BurnAfterReadSettings.test.ts locales/zh-CN/mobile_burn.json locales/en/mobile_burn.json
git commit -m "fix(mobile/burn): 移动端阅后即焚设置改用真实服务调用

handleRoomToggle 改为调用 enableBurn/disableBurn，loadBurnStats 改为
调用 getBurnStats，避免状态仅存于 localStorage 与后端脱节。

Ref: docs/UI界面需求文档.md §3.12.4"
```

---

## Task 4: 桌面端 BurnAfterReadSettings 统一用 settingStore

**Files:**
- Modify: `src/views/settingsWindow/tabs/BurnAfterReadSettings.vue:165-240`
- Test: `src/views/settingsWindow/tabs/__tests__/BurnAfterReadSettings.test.ts`（已存在，需补充用例）

**Interfaces:**
- Consumes: `settingStore.burnDefaultEnabled`/`burnDefaultDuration`/`burnShowCountdownEnabled` + setter
- Produces: 桌面端全局开关状态来自 settingStore（与移动端一致）

- [ ] **Step 1: 写失败测试 — 全局开关使用 settingStore**

修改 `src/views/settingsWindow/tabs/__tests__/BurnAfterReadSettings.test.ts`，新增用例：

```typescript
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BurnAfterReadSettings from '../BurnAfterReadSettings.vue'

const setBurnDefaultEnabledMock = vi.fn()
const setBurnDefaultDurationMock = vi.fn()

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    burnDefaultEnabled: false,
    burnDefaultDuration: 60,
    burnShowCountdownEnabled: true,
    setBurnDefaultEnabled: setBurnDefaultEnabledMock,
    setBurnDefaultDuration: setBurnDefaultDurationMock,
    setBurnShowCountdownEnabled: vi.fn()
  })
}))

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    getBurnStats: vi.fn().mockResolvedValue({ totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 }),
    enableBurn: vi.fn().mockResolvedValue(true),
    disableBurn: vi.fn().mockResolvedValue(true)
  })
}))

describe('Desktop BurnAfterReadSettings settingStore integration', () => {
  it('calls setBurnDefaultEnabled when global toggle changes', async () => {
    const wrapper = mount(BurnAfterReadSettings, {
      global: { stubs: ['n-switch', 'n-select', 'n-spin', 'n-divider', 'n-tag', 'n-button', 'n-modal', 'n-form', 'n-form-item', 'n-alert', 'useDialog'] }
    })
    await flushPromises()
    const switches = wrapper.findAllComponents({ name: 'NSwitch' })
    // 第一个 switch 是全局开关
    await switches[0].vm.$emit('update:value', true)
    await flushPromises()
    expect(setBurnDefaultEnabledMock).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/views/settingsWindow/tabs/__tests__/BurnAfterReadSettings.test.ts`
Expected: FAIL — setBurnDefaultEnabled 未被调用（当前用 localStorage）

- [ ] **Step 3: 修改桌面端 BurnAfterReadSettings 使用 settingStore**

修改 `src/views/settingsWindow/tabs/BurnAfterReadSettings.vue`：

1. 在 `<script setup>` 中 import settingStore：
```typescript
import { useSettingStore } from '@/stores/domains/settings/setting'
const settingStore = useSettingStore()
```

2. 将 `globalBurnEnabled`/`globalBurnDuration`/`showBurnCountdown` 三个 ref 的初始值改为读取 settingStore：
```typescript
const globalBurnEnabled = ref(settingStore.burnDefaultEnabled)
const globalBurnDuration = ref(settingStore.burnDefaultDuration)
const showBurnCountdown = ref(settingStore.burnShowCountdownEnabled)
```

3. `handleGlobalBurnToggle` 中 `globalBurnEnabled.value = true/false` 后追加 `settingStore.setBurnDefaultEnabled(value)`。

4. `handleBurnDurationChange` 中追加 `settingStore.setBurnDefaultDuration(value)`。

5. 保留 `autoBurnRead`/`burnNotification`/`burnSound` 三个纯前端偏好继续用 localStorage（这些是 UI 偏好，无后端对应）。

6. `loadSettings` 中保留 localStorage 读取仅用于这三个 UI 偏好；`globalBurnEnabled`/`globalBurnDuration`/`showBurnCountdown` 不再从 localStorage 读。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/views/settingsWindow/tabs/__tests__/BurnAfterReadSettings.test.ts`
Expected: PASS

- [ ] **Step 5: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误

- [ ] **Step 6: 提交**

```bash
git add src/views/settingsWindow/tabs/BurnAfterReadSettings.vue src/views/settingsWindow/tabs/__tests__/BurnAfterReadSettings.test.ts
git commit -m "refactor(settings/burn): 桌面端阅后即焚全局开关统一用 settingStore

globalBurnEnabled/globalBurnDuration/showBurnCountdown 改为读写
settingStore，与移动端状态源一致；autoBurnRead/burnNotification/
burnSound 三个纯 UI 偏好保留 localStorage。

Ref: docs/UI界面需求文档.md §3.12.4"
```

---

## Task 5: 新增房间级阅后即焚配置组件 RoomBurnSettings

**Files:**
- Create: `src/components/room/RoomBurnSettings.vue`
- Modify: `src/components/room/RoomDetailPane.vue`（嵌入新组件）
- Test: `src/components/room/__tests__/RoomBurnSettings.test.ts`

**Interfaces:**
- Consumes: `useBurnAfterRead.refreshBurnSettings`/`enableBurn`/`disableBurn`/`getPendingBurns`、`matrixBurnAfterReadService.getBurnSettings`
- Produces: `RoomBurnSettings.vue` 组件，props: `{ roomId: string }`，无 emits

- [ ] **Step 1: 写失败测试 — RoomBurnSettings 渲染开关 + 时长选择 + 待销毁数**

新建 `src/components/room/__tests__/RoomBurnSettings.test.ts`：

```typescript
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomBurnSettings from '../RoomBurnSettings.vue'

const refreshBurnSettingsMock = vi.fn().mockResolvedValue(undefined)
const enableBurnMock = vi.fn().mockResolvedValue(true)
const disableBurnMock = vi.fn().mockResolvedValue(true)
const getPendingBurnsMock = vi.fn().mockResolvedValue([])

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    isRoomBurnEnabled: () => false,
    getRoomBurnDuration: () => 60,
    refreshBurnSettings: refreshBurnSettingsMock,
    enableBurn: enableBurnMock,
    disableBurn: disableBurnMock,
    getPendingBurns: getPendingBurnsMock
  })
}))

describe('RoomBurnSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders toggle switch, duration select, and pending count', async () => {
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="room-burn-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-burn-duration"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-burn-pending-count"]').exists()).toBe(true)
  })

  it('calls enableBurn when toggle turned on', async () => {
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    await wrapper.findComponent({ name: 'NSwitch' }).vm.$emit('update:value', true)
    await flushPromises()
    expect(enableBurnMock).toHaveBeenCalledWith('!room1:server', expect.any(Number))
  })

  it('calls disableBurn when toggle turned off', async () => {
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    await wrapper.findComponent({ name: 'NSwitch' }).vm.$emit('update:value', false)
    await flushPromises()
    expect(disableBurnMock).toHaveBeenCalledWith('!room1:server')
  })

  it('refreshes settings on mount', async () => {
    mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    expect(refreshBurnSettingsMock).toHaveBeenCalledWith('!room1:server')
  })

  it('shows pending count from getPendingBurns', async () => {
    getPendingBurnsMock.mockResolvedValueOnce([
      { eventId: '$e1', createdAt: 0, deleteAt: 0 },
      { eventId: '$e2', createdAt: 0, deleteAt: 0 }
    ])
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="room-burn-pending-count"]').text()).toContain('2')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/room/__tests__/RoomBurnSettings.test.ts`
Expected: FAIL — `Cannot find module '../RoomBurnSettings.vue'`

- [ ] **Step 3: 创建 RoomBurnSettings.vue**

新建 `src/components/room/RoomBurnSettings.vue`：

```vue
<template>
  <div class="room-burn-settings" data-testid="room-burn-settings">
    <div class="room-burn-settings__header">
      <svg class="room-burn-settings__icon" aria-hidden="true">
        <use href="#timer"></use>
      </svg>
      <span class="room-burn-settings__title">{{ t('room.burn.title') }}</span>
    </div>

    <div class="room-burn-settings__row">
      <div class="room-burn-settings__info">
        <span class="room-burn-settings__label">{{ t('room.burn.enable_label') }}</span>
        <span class="room-burn-settings__desc">{{ t('room.burn.enable_desc') }}</span>
      </div>
      <n-switch
        data-testid="room-burn-toggle"
        :value="enabled"
        :loading="toggling"
        @update:value="handleToggle" />
    </div>

    <div v-if="enabled" class="room-burn-settings__row">
      <div class="room-burn-settings__info">
        <span class="room-burn-settings__label">{{ t('room.burn.duration_label') }}</span>
        <span class="room-burn-settings__desc">{{ t('room.burn.duration_desc') }}</span>
      </div>
      <n-select
        data-testid="room-burn-duration"
        :value="durationSeconds"
        :options="durationOptions"
        style="width: 130px"
        @update:value="handleDurationChange" />
    </div>

    <div v-if="enabled" class="room-burn-settings__pending">
      <span data-testid="room-burn-pending-count">
        {{ t('room.burn.pending_count', { count: pendingCount }) }}
      </span>
    </div>

    <p v-if="enabled" class="room-burn-settings__tip">{{ t('room.burn.tip') }}</p>
  </div>
</template>

<script setup lang="ts">
import { NSelect, NSwitch } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'

const props = defineProps<{ roomId: string }>()
const { t } = useI18n()
const burn = useBurnAfterRead()

const enabled = ref(false)
const durationSeconds = ref(60)
const pendingCount = ref(0)
const toggling = ref(false)

const durationOptions = computed(() => [
  { label: t('setting.burn_after_read.durations.30_seconds'), value: 30 },
  { label: t('setting.burn_after_read.durations.1_minute'), value: 60 },
  { label: t('setting.burn_after_read.durations.5_minutes'), value: 300 },
  { label: t('setting.burn_after_read.durations.1_hour'), value: 3600 },
  { label: t('setting.burn_after_read.durations.24_hours'), value: 86400 }
])

async function loadState() {
  await burn.refreshBurnSettings(props.roomId)
  enabled.value = burn.isRoomBurnEnabled(props.roomId)
  durationSeconds.value = Math.max(1, Math.round(burn.getRoomBurnDuration(props.roomId) / 1000)) || 60
  const pending = await burn.getPendingBurns(props.roomId)
  pendingCount.value = pending.length
}

async function handleToggle(val: boolean) {
  toggling.value = true
  try {
    if (val) {
      await burn.enableBurn(props.roomId, durationSeconds.value * 1000)
    } else {
      await burn.disableBurn(props.roomId)
    }
    enabled.value = val
    await loadState()
  } finally {
    toggling.value = false
  }
}

async function handleDurationChange(val: number) {
  durationSeconds.value = val
  if (enabled.value) {
    await burn.enableBurn(props.roomId, val * 1000)
    await loadState()
  }
}

onMounted(loadState)
watch(() => props.roomId, loadState)
</script>

<style scoped>
.room-burn-settings {
  padding: var(--tjg-space-3) var(--tjg-space-4);
  border-top: 1px solid var(--tjg-border-layout-divider);
}

.room-burn-settings__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--tjg-space-3);
}

.room-burn-settings__icon {
  width: 16px;
  height: 16px;
  color: var(--tjg-color-danger-500);
}

.room-burn-settings__title {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.room-burn-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-2) 0;
}

.room-burn-settings__info {
  display: flex;
  flex-direction: column;
}

.room-burn-settings__label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.room-burn-settings__desc {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
  margin-top: 2px;
}

.room-burn-settings__pending {
  padding: var(--tjg-space-2) 0;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-secondary);
}

.room-burn-settings__tip {
  margin-top: var(--tjg-space-2);
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-quaternary);
}
</style>
```

- [ ] **Step 4: 补充 i18n 翻译键**

在 `locales/zh-CN/room.json` 的 `burn_after_read` 同级或 `room` 命名空间下新增（若已有 `room.burn_after_read` 则复用）：

```json
"burn": {
  "title": "阅后即焚",
  "enable_label": "启用阅后即焚",
  "enable_desc": "开启后，新发送的消息在对方阅读后将自动销毁",
  "duration_label": "焚毁时间",
  "duration_desc": "消息阅读后多少时间后销毁",
  "pending_count": "当前待销毁消息：{count} 条",
  "tip": "提示：销毁后消息无法恢复，请谨慎使用"
}
```

在 `locales/en/room.json` 同步新增英文翻译。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/components/room/__tests__/RoomBurnSettings.test.ts`
Expected: PASS — 5 个测试全部通过

- [ ] **Step 6: 集成到 RoomDetailPane.vue**

修改 `src/components/room/RoomDetailPane.vue`：在合适位置（如成员列表之后）追加：

```vue
<RoomBurnSettings v-if="roomId" :room-id="roomId" />
```

并 import：
```typescript
import RoomBurnSettings from './RoomBurnSettings.vue'
```

- [ ] **Step 7: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误

- [ ] **Step 8: 提交**

```bash
git add src/components/room/RoomBurnSettings.vue src/components/room/__tests__/RoomBurnSettings.test.ts src/components/room/RoomDetailPane.vue locales/zh-CN/room.json locales/en/room.json
git commit -m "feat(room/burn): 新增房间级阅后即焚配置组件 RoomBurnSettings

在房间详情抽屉中新增阅后即焚配置区域，支持开关切换、焚毁时间选择、
待销毁消息数显示与提示文案，调用 useBurnAfterRead 真实服务。

Ref: docs/UI界面需求文档.md §3.12.1"
```

---

## Task 6: 新增待销毁消息管理组件 PendingBurnMessages

**Files:**
- Create: `src/components/room/PendingBurnMessages.vue`
- Modify: `src/components/room/RoomBurnSettings.vue`（嵌入新组件）
- Test: `src/components/room/__tests__/PendingBurnMessages.test.ts`

**Interfaces:**
- Consumes: `useBurnAfterRead.getPendingBurns`/`cancelBurn`
- Produces: `PendingBurnMessages.vue` 组件，props: `{ roomId: string }`，无 emits

- [ ] **Step 1: 写失败测试 — PendingBurnMessages 渲染列表 + 取消按钮**

新建 `src/components/room/__tests__/PendingBurnMessages.test.ts`：

```typescript
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PendingBurnMessages from '../PendingBurnMessages.vue'

const getPendingBurnsMock = vi.fn()
const cancelBurnMock = vi.fn().mockResolvedValue(true)

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    getPendingBurns: getPendingBurnsMock,
    cancelBurn: cancelBurnMock
  })
}))

describe('PendingBurnMessages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when no pending messages', async () => {
    getPendingBurnsMock.mockResolvedValueOnce([])
    const wrapper = mount(PendingBurnMessages, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-spin', 'n-empty', 'n-button'] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="pending-empty"]').exists()).toBe(true)
  })

  it('renders list items with preview, created time, remaining time, cancel button', async () => {
    const now = Date.now()
    getPendingBurnsMock.mockResolvedValueOnce([
      { eventId: '$e1:server', createdAt: now - 30000, deleteAt: now + 30000 }
    ])
    const wrapper = mount(PendingBurnMessages, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-spin', 'n-empty', 'n-button'] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="pending-item-$e1:server"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pending-cancel-$e1:server"]').exists()).toBe(true)
  })

  it('calls cancelBurn when cancel button clicked', async () => {
    const now = Date.now()
    getPendingBurnsMock.mockResolvedValueOnce([
      { eventId: '$e1:server', createdAt: now - 30000, deleteAt: now + 30000 }
    ])
    const wrapper = mount(PendingBurnMessages, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-spin', 'n-empty', 'n-button'] }
    })
    await flushPromises()
    await wrapper.find('[data-testid="pending-cancel-$e1:server"]').trigger('click')
    await flushPromises()
    expect(cancelBurnMock).toHaveBeenCalledWith('!room1:server', '$e1:server')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/room/__tests__/PendingBurnMessages.test.ts`
Expected: FAIL — `Cannot find module '../PendingBurnMessages.vue'`

- [ ] **Step 3: 创建 PendingBurnMessages.vue**

新建 `src/components/room/PendingBurnMessages.vue`：

```vue
<template>
  <div class="pending-burn-messages" data-testid="pending-burn-messages">
    <div class="pending-burn-messages__header">
      <span class="pending-burn-messages__title">{{ t('room.burn.pending_title') }}</span>
    </div>

    <n-spin :show="loading">
      <div v-if="pendingList.length === 0" data-testid="pending-empty" class="pending-burn-messages__empty">
        {{ t('room.burn.pending_empty') }}
      </div>
      <ul v-else class="pending-burn-messages__list">
        <li
          v-for="item in pendingList"
          :key="item.eventId"
          :data-testid="`pending-item-${item.eventId}`"
          class="pending-burn-messages__item">
          <div class="pending-burn-messages__info">
            <span class="pending-burn-messages__event-id">{{ shortenEventId(item.eventId) }}</span>
            <span class="pending-burn-messages__created">{{ formatTime(item.createdAt) }}</span>
            <span class="pending-burn-messages__remaining">{{ formatRemaining(item.deleteAt) }}</span>
          </div>
          <n-button
            size="tiny"
            type="warning"
            :data-testid="`pending-cancel-${item.eventId}`"
            @click="handleCancel(item.eventId)">
            {{ t('room.burn.cancel') }}
          </n-button>
        </li>
      </ul>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSpin } from 'naive-ui'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import type { BurnPendingEvent } from '@/services/matrix/messaging/MatrixBurnAfterReadService'

const props = defineProps<{ roomId: string }>()
const { t } = useI18n()
const burn = useBurnAfterRead()

const loading = ref(false)
const pendingList = ref<BurnPendingEvent[]>([])

async function loadList() {
  loading.value = true
  try {
    pendingList.value = await burn.getPendingBurns(props.roomId)
  } finally {
    loading.value = false
  }
}

async function handleCancel(eventId: string) {
  const ok = await burn.cancelBurn(props.roomId, eventId)
  if (ok) {
    pendingList.value = pendingList.value.filter((p) => p.eventId !== eventId)
  }
}

function shortenEventId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatRemaining(deleteAt: number): string {
  const remain = Math.max(0, deleteAt - Date.now())
  const seconds = Math.floor(remain / 1000)
  if (seconds < 60) return t('room.burn.remaining_seconds', { count: seconds })
  return t('room.burn.remaining_minutes', { count: Math.floor(seconds / 60) })
}

onMounted(loadList)
watch(() => props.roomId, loadList)
</script>

<style scoped>
.pending-burn-messages {
  padding: var(--tjg-space-2) var(--tjg-space-4);
}

.pending-burn-messages__header {
  margin-bottom: var(--tjg-space-2);
}

.pending-burn-messages__title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.pending-burn-messages__empty {
  padding: var(--tjg-space-4);
  text-align: center;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-quaternary);
}

.pending-burn-messages__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.pending-burn-messages__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-2);
  background: var(--tjg-surface-subtle);
  border-radius: var(--tjg-radius-sm);
}

.pending-burn-messages__info {
  display: flex;
  flex-direction: column;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-secondary);
}
</style>
```

- [ ] **Step 4: 补充 i18n 翻译键**

在 `locales/zh-CN/room.json` 的 `burn` 命名空间下新增：

```json
"pending_title": "待销毁消息",
"pending_empty": "暂无待销毁消息",
"cancel": "取消销毁",
"remaining_seconds": "{count} 秒后销毁",
"remaining_minutes": "{count} 分钟后销毁"
```

在 `locales/en/room.json` 同步新增英文翻译。

- [ ] **Step 5: 集成到 RoomBurnSettings.vue**

修改 `src/components/room/RoomBurnSettings.vue`：在待销毁数显示之后追加：

```vue
<PendingBurnMessages v-if="enabled && pendingCount > 0" :room-id="props.roomId" />
```

并 import：
```typescript
import PendingBurnMessages from './PendingBurnMessages.vue'
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm vitest run src/components/room/__tests__/PendingBurnMessages.test.ts`
Expected: PASS — 3 个测试全部通过

- [ ] **Step 7: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误

- [ ] **Step 8: 提交**

```bash
git add src/components/room/PendingBurnMessages.vue src/components/room/__tests__/PendingBurnMessages.test.ts src/components/room/RoomBurnSettings.vue locales/zh-CN/room.json locales/en/room.json
git commit -m "feat(room/burn): 新增待销毁消息管理组件 PendingBurnMessages

在房间阅后即焚配置中展示待销毁消息列表，支持查看消息预览、创建时间、
剩余时间，并提供取消销毁操作（调用 cancelBurn 服务）。

Ref: docs/UI界面需求文档.md §3.12.3"
```

---

## Task 7: 完善私密模式红色主题气泡样式

**Files:**
- Modify: `src/components/rightBox/chatBox/ChatMessageList.vue:44-61,169-171`
- Test: `src/components/rightBox/chatBox/__tests__/ChatMessageList.test.ts`（若不存在则新建）

**Interfaces:**
- Consumes: `privateModeActive: boolean`（已有 props）、`isMe` 信息（需从消息项判断）
- Produces: 私密模式下发送方消息红色背景、接收方消息红色边框

- [ ] **Step 1: 写失败测试 — 私密模式下发送方红色背景、接收方红色边框**

新建或修改 `src/components/rightBox/chatBox/__tests__/ChatMessageList.test.ts`：

```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ChatMessageList from '../ChatMessageList.vue'

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    chatMessageList: [],
    shouldShowNoMoreMessage: false,
    currentMessageOptions: { hasLoadedOnce: true },
    isMsgMultiChoose: false,
    msgMultiChooseMode: '',
    clearRoomMessages: vi.fn(),
    removeSession: vi.fn(),
    clearNewMsgCount: vi.fn(),
    loadMore: vi.fn()
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room1:server' })
}))

describe('ChatMessageList private mode styling', () => {
  it('applies private-mode class when privateModeActive', () => {
    const wrapper = mount(ChatMessageList, {
      props: { isGroup: false, privateModeActive: true, activeReply: '' },
      global: { stubs: ['DynamicScroller', 'DynamicScrollerItem', 'EmptyState', 'RenderMessage'] }
    })
    const messageList = wrapper.find('.message-list')
    expect(messageList.classes()).toContain('private-mode-active')
  })

  it('does NOT apply private-mode class when not active', () => {
    const wrapper = mount(ChatMessageList, {
      props: { isGroup: false, privateModeActive: false, activeReply: '' },
      global: { stubs: ['DynamicScroller', 'DynamicScrollerItem', 'EmptyState', 'RenderMessage'] }
    })
    const messageList = wrapper.find('.message-list')
    expect(messageList.classes()).not.toContain('private-mode-active')
  })
})
```

- [ ] **Step 2: 运行测试确认失败或通过（基线确认）**

Run: `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatMessageList.test.ts`
Expected: 当前 `private-mode-active` 类已存在于 `.message-list`（ChatMain.vue 第 52 行），测试可能直接通过。重点在 Step 3 的样式完善。

- [ ] **Step 3: 完善私密模式气泡样式**

修改 `src/components/rightBox/chatBox/ChatMessageList.vue`：

1. 在消息行 class 中追加 `isMe` 判断（需从 RenderMessage 上下文获取，或通过 `item.message.senderUid === userStore.userInfo?.uid` 判断）。在 `<script setup>` 中新增：
```typescript
import { useUserStore } from '@/stores/domains/user/user'
const userStore = useUserStore()
const isMessageFromMe = (item: MessageType) => item.message?.senderUid === userStore.userInfo?.uid
```

注意：MessageType 已有 `fromUser?.uid`，沿用现有 `getMessageSenderUid`：
```typescript
const isMessageFromMe = (item: MessageType) => getMessageSenderUid(item) === userStore.userInfo?.uid
```

2. 在消息行 class 数组中追加：
```vue
{ 'message-row--private-mode-sender': privateModeActive && isMessageFromMe(item) },
{ 'message-row--private-mode-receiver': privateModeActive && !isMessageFromMe(item) }
```

3. 在 `<style scoped>` 中替换原 `.message-row--private-mode`（第 169-171 行）为：
```scss
.message-row--private-mode {
  border-left: 2px solid var(--tjg-color-danger-500);
}

.message-row--private-mode-sender {
  background: color-mix(in srgb, var(--tjg-color-danger-500) 8%, transparent);
  border-left: 2px solid var(--tjg-color-danger-500);
}

.message-row--private-mode-receiver {
  border: 1px solid color-mix(in srgb, var(--tjg-color-danger-500) 40%, transparent);
  border-left: 2px solid var(--tjg-color-danger-500);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatMessageList.test.ts`
Expected: PASS

- [ ] **Step 5: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误

- [ ] **Step 6: 提交**

```bash
git add src/components/rightBox/chatBox/ChatMessageList.vue src/components/rightBox/chatBox/__tests__/ChatMessageList.test.ts
git commit -m "style(chat/private): 完善私密模式消息气泡红色主题

发送方消息红色背景 + 左边框，接收方消息红色边框 + 左边框，符合
需求文档 §3.13.6 界面变化要求。

Ref: docs/UI界面需求文档.md §3.13.6"
```

---

## Task 8: 私密模式 BurnAfterReadToggle 切换调用真实服务

**Files:**
- Modify: `src/components/rightBox/chatBox/ChatMain.vue:89-99`
- Test: `src/components/rightBox/chatBox/__tests__/ChatMain.test.ts`（已存在，需补充用例）

**Interfaces:**
- Consumes: `useBurnAfterRead.enableBurn`/`disableBurn`、`usePrivateMode.burnEnabled`/`burnDuration`
- Produces: BurnAfterReadToggle 切换时调用 enableBurn/disableBurn 持久化到后端

- [ ] **Step 1: 写失败测试 — BurnAfterReadToggle 切换调用 enableBurn/disableBurn**

修改 `src/components/rightBox/chatBox/__tests__/ChatMain.test.ts`，新增用例：

```typescript
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ChatMain from '../ChatMain.vue'

const enableBurnMock = vi.fn().mockResolvedValue(true)
const disableBurnMock = vi.fn().mockResolvedValue(true)

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    enableBurn: enableBurnMock,
    disableBurn: disableBurnMock,
    isRoomBurnEnabled: () => false,
    getRoomBurnDuration: () => 60,
    refreshBurnSettings: vi.fn()
  })
}))

describe('ChatMain BurnAfterReadToggle service integration', () => {
  it('calls enableBurn when toggle turned on in private mode', async () => {
    const wrapper = mount(ChatMain, {
      global: {
        stubs: ['ChatBanners', 'ChatMessageList', 'ChatModals', 'ChatRoomSearch', 'FileUploadProgress', 'BurnAfterReadToggle', 'n-flex', 'n-icon']
      }
    })
    await flushPromises()
    // 模拟私密模式激活
    const toggle = wrapper.findComponent({ name: 'BurnAfterReadToggle' })
    await toggle.vm.$emit('update:enabled', true)
    await toggle.vm.$emit('select-duration', 60)
    await flushPromises()
    expect(enableBurnMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatMain.test.ts`
Expected: FAIL — enableBurn 未被调用

- [ ] **Step 3: 修改 ChatMain.vue 的 BurnAfterReadToggle 回调**

修改 `src/components/rightBox/chatBox/ChatMain.vue:89-99`：

1. 在 `<script setup>` 中 import `useBurnAfterRead`：
```typescript
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
const burnAfterRead = useBurnAfterRead()
```

2. 替换模板第 89-99 行的 BurnAfterReadToggle 区块：
```vue
<!-- 阅后即焚切换（私密模式激活时） -->
<div
  v-if="privateModeActive"
  class="flex-shrink-0 px-12px py-4px flex items-center gap-8px border-t border-[--tjg-border-default]">
  <BurnAfterReadToggle
    :enabled="burnEnabled"
    @update:enabled="handleBurnToggle"
    @select-duration="handleBurnDurationChange" />
  <span class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">
    {{ burnEnabled ? t('editor.burn_after_read_enabled') : t('editor.burn_after_read_disabled') }}
  </span>
</div>
```

3. 在 `<script setup>` 中新增处理函数：
```typescript
const handleBurnToggle = async (val: boolean) => {
  const roomId = globalStore.currentSessionRoomId
  if (!roomId) return
  try {
    if (val) {
      await burnAfterRead.enableBurn(roomId, burnDuration.value * 1000)
      burnEnabled.value = true
    } else {
      await burnAfterRead.disableBurn(roomId)
      burnEnabled.value = false
    }
  } catch {
    // 服务失败时不更新本地状态
  }
}

const handleBurnDurationChange = async (seconds: number) => {
  burnDuration.value = seconds
  const roomId = globalStore.currentSessionRoomId
  if (!roomId || !burnEnabled.value) return
  try {
    await burnAfterRead.enableBurn(roomId, seconds * 1000)
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatMain.test.ts`
Expected: PASS

- [ ] **Step 5: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误

- [ ] **Step 6: 提交**

```bash
git add src/components/rightBox/chatBox/ChatMain.vue src/components/rightBox/chatBox/__tests__/ChatMain.test.ts
git commit -m "fix(chat/private): BurnAfterReadToggle 切换调用 enableBurn/disableBurn 服务

私密模式下阅后即焚开关切换时，原仅更新本地 ref 不持久化到后端，导致
房间级 burn 设置丢失。改为调用 useBurnAfterRead.enableBurn/disableBurn
真实服务，并在时长变更时重新调用 enableBurn 更新配置。

Ref: docs/UI界面需求文档.md §3.13.6"
```

---

## Task 9: 删除 usePrivacyProtection 死代码

**Files:**
- Delete: `src/composables/usePrivacyProtection.ts`
- Delete: `src/composables/__tests__/usePrivacyProtection.test.ts`

**Interfaces:**
- 无（纯删除）

- [ ] **Step 1: 确认无业务组件引用 usePrivacyProtection**

Run: `pnpm grep "usePrivacyProtection" src/ --exclude-dir=__tests__`
Expected: 仅测试文件引用，无业务组件引用

若发现业务组件引用，停止该任务并 review 引用方。若仅测试引用，继续 Step 2。

- [ ] **Step 2: 删除文件**

删除：
- `src/composables/usePrivacyProtection.ts`
- `src/composables/__tests__/usePrivacyProtection.test.ts`

- [ ] **Step 3: 跑回归测试 + 类型检查**

Run: `pnpm vue-tsc --noEmit && pnpm test:run && pnpm check`
Expected: 0 错误，所有测试通过（usePrivacyProtection 测试已删除）

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore(cleanup): 删除 usePrivacyProtection 死代码

usePrivacyProtection 与 usePrivateMode 功能重复，且未被任何业务组件
消费（仅测试引用）。usePrivateMode 是模块级单例，已被 ChatHeaderRoot/
ChatMain/MobileChatMain 等组件使用，保留 usePrivateMode 删除
usePrivacyProtection。

Ref: docs/UI界面需求文档.md §3.13.6"
```

---

## Self-Review

### 1. Spec coverage

| 需求条目 | 对应任务 | 状态 |
| :--- | :--- | :--- |
| §3.12.1 房间级阅后即焚配置（开关 + 时长选择器 + 待销毁消息数 + 提示文案） | Task 5 | 覆盖 |
| §3.12.2 消息标记与销毁流程（发送方/接收方界面表现） | 已实现（renderMessage BurnMessage 包裹 + MatrixEventService 解析 + useMsgInputSend 传递 burnExpiresInMs） | 无需新增 |
| §3.12.3 待销毁消息管理（列表 + 取消销毁） | Task 6 | 覆盖 |
| §3.12.4 全局配置与统计（PUT /user/burn/config + GET /user/burn/stats） | Task 2（暴露 setBurnConfig/getBurnStats）+ Task 3（移动端调用）+ Task 4（桌面端统一） | 覆盖 |
| §3.12.5 移动端差异（紧凑倒计时、轻量动画、长按取消） | BurnIndicator 已有紧凑倒计时；长按取消销毁待后续迭代 | 部分覆盖（长按取消销毁未实现，作为后续迭代） |
| §3.13.6 私密聊天模式 S 入口 | 已实现（ChatHeaderToolbar） | Task 1 修复重复 |
| §3.13.6 私密模式确认对话框 | 已实现（桌面 n-modal + 移动 van-dialog） | 无需新增 |
| §3.13.6 私密模式头部锁图标 | 已实现（ChatBanners） | Task 1 保留 |
| §3.13.6 私密模式顶部红色提示条 | 已实现（PrivateModeBanner） | Task 1 保留 |
| §3.13.6 私密模式消息气泡红色主题 | Task 7 | 覆盖 |
| §3.13.6 私密模式输入框阅后即焚开关 | 已实现（ChatMain BurnAfterReadToggle） | Task 8 修复服务调用 |
| §3.13.6 阅后即焚 30 秒倒计时销毁 | 已实现（BurnMessage + BurnIndicator） | 无需新增 |
| §3.13.6 防截屏水印 | 已实现（ScreenshotWatermark） | 无需新增 |
| §3.13.6 截屏发送系统消息通知 | 已实现（useScreenshotDetection + screenshot_watch.rs） | 无需新增 |
| §3.13.6 移动端适配 | 已实现（MobileChatMain + PrivateModeConfirmDialog） | 无需新增 |

### 2. Placeholder scan

已扫描全文，无 TBD/TODO/"implement later"/"add appropriate error handling" 等占位符。每个步骤都包含具体代码或具体命令。

### 3. Type consistency

- `BurnPendingEvent` 类型在 Task 2/Task 6 中一致使用（eventId/createdAt/deleteAt 三个字段）。
- `BurnStats` 类型在 Task 2/Task 3/Task 4 中一致使用（totalBurned/totalPending/roomsWithBurnEnabled）。
- `useBurnAfterRead` 暴露的方法名在 Task 2 定义，Task 3/Task 5/Task 6/Task 8 消费时名称一致：`cancelBurn`/`getPendingBurns`/`setBurnConfig`/`getBurnStats`/`enableBurn`/`disableBurn`/`refreshBurnSettings`。
- `RoomBurnSettings` props `{ roomId: string }` 在 Task 5 定义，Task 6 中 PendingBurnMessages 同样使用 `{ roomId: string }`，类型一致。

### 4. 风险与权衡

- **Task 1 风险**：删除 ChatBanners 的 S 按钮后，需确认 `defineEmits` 中 `togglePrivateMode` 是否还有其他触发点。经核实仅 S 按钮触发，可安全移除 emit 声明。但 ChatMain.vue 模板中 `@toggle-private-mode="togglePrivateMode"` 监听也需同步移除（Step 4 已覆盖）。
- **Task 3 风险**：移动端 `loadBurnRooms` 仍保留 localStorage 缓存（避免每次进入页面都从服务端拉取房间列表，因为服务端无"已启用 burn 的房间列表"接口，只有 `getBurnStats` 返回 `roomsWithBurnEnabled` 计数）。房间列表靠用户在本页面操作时累积，操作时同步调用服务持久化。这是合理的折中。
- **Task 7 风险**：`isMessageFromMe` 判断依赖 `userStore.userInfo?.uid`，需确认消息项的 `senderUid` 字段确实存在。若 MessageType 无 `senderUid`，则用现有 `getMessageSenderUid(item)` 返回值（来自 `item.fromUser?.uid`）。Step 3 代码已使用 `getMessageSenderUid` 兜底。
- **Task 8 风险**：`burnEnabled` 和 `burnDuration` 来自 `usePrivateMode` 模块级单例，在 ChatMain 中已解构（第 213-222 行）。新增的 `handleBurnToggle`/`handleBurnDurationChange` 直接修改这两个 ref 即可全局生效。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-09-private-mode-burn-after-read-completion.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
