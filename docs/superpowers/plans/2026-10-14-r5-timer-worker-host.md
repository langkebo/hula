# R-5：`timer.worker.ts` 共享宿主层重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 `timer.worker.ts` 在 7 处被各自 `new Worker` 实例化的重复，收敛为「每窗口 1 个 Worker + per-consumer channel 路由」，且**不改变任何消费者的可观测行为**。

**Architecture:** 新建主线程宿主 `src/services/timerWorkerHost.ts`，导出 `acquireTimerWorker(): TimerWorkerHandle`。宿主内部持有 module-level 单例 `{ worker, refCount, channelSeq, channels }`：每次 `acquire()` 分配一个数字 `channelId`，发送时把请求的 `msgId` 改写为 `${channelId}\u0000${msgId}`，worker 回包时按前缀反解路由回对应 channel 并把 `msgId` 还原成原值；无 `msgId` 的 `allTimersCompleted` 广播给全部 channel。`release()` 递减引用计数，归零时 `terminate()` 并置空，下次 `acquire()` 懒重建。`timer.worker.ts` **内部一行不改**。

**Tech Stack:** Tauri v2 + Vue 3 `<script setup>` + TypeScript + Vite 7；Vitest（`happy-dom`，`globals: true`，`tests/setup.ts`）；Biome；自研 `scripts/check-*.mjs` 守门。

## Global Constraints

- 工作目录：推荐隔离 worktree `.worktrees/r5-timer-worker-host`（分支 `refactor/r5-timer-worker-host`）；若要直接在主树 `/Users/ljf/Desktop/hu_ts/Tjg` 实施，需在动工前确认（见 Execution Handoff）。
- 若使用 worktree：**禁止 `pnpm install`**（`node_modules` 为指向主树的 symlink）。本地跑测试/类型检查用 `pnpm vitest run <path>`、`pnpm vue-tsc --noEmit`、`node scripts/*.mjs`。
- **不得改动 `src/workers/timer.worker.ts` 内部**（含 `ENABLE_LOGGING`/死分支 `setLogging`/`startReconnectTimer`/心跳）。这些列为后续独立可选项，不在本计划范围。
- **不得新增硬编码颜色**（`#xxx`/`rgb()`/`rgba()`）：只用 `--tjg-*` token 或现有语义类。
- **不得抬高任何 ratchet baseline**；基线数字只能持平或下降。
- `src/services/**` 导出的新符号**必须有 JSDoc**（`check:doc-coverage` 会把新缺失记为回归；`src/services/timerWorkerHost.ts` 落在该扫描范围内）。
- 组件/store 不得直接 import `matrix-js-sdk`；新宿主不得出现 `check-worker-client-boundary.mjs` 的违禁记号（`MatrixClient`/`state.client`/`slidingSyncInstance`/`createClient(`）。
- 提交：Conventional Commits，scope 仅 `core, ui, chat, mobile, plugin, hook, service, util, i18n, config, ci, test, tauri`；无 emoji；不使用 `--no-verify`。
- 每个任务的验收必须是**真实路径上的行为测试**（RED→GREEN），不接受「数数变少」或「删断言凑绿」。若某断言必须随 API 删除而移除，须替换为**等价意图**的新断言。
- 跑完 vitest 后若 `src/typings/auto-imports.d.ts` / `components.d.ts` 有非预期改动，必须回退、不得提交其 churn。

## 现状取证（2026-10-14 只读核实）

7 处 `new Worker(timer.worker.ts)`（生产方）：

| # | 位置 | 作用域 | 终止语义 | msgId |
|---|---|---|---|---|
| 1 | [layout/index.vue:231](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/index.vue#L231) | 模块级（组件外） | `onUnmounted` L489 `terminate()` | `checkUpdate` |
| 2 | [chat/timerWorker.ts:9](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/timerWorker.ts#L9) | module 单例 `getTimerWorker()` | **从不** terminate | 动态（撤回 msgId） |
| 3 | [useCountdown.ts:11](file:///Users/ljf/Desktop/hu_ts/Tjg/src/shared/composables/useCountdown.ts#L11) | **按实例** | `onScopeDispose` L42 `terminate()` | 调用方传入 |
| 4 | [useVoiceRecordRust.ts:53](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/chat/useVoiceRecordRust.ts#L53) | module 单例（首实例闭包） | `onUnmounted` L289 `terminate()`+置 null | `voiceRecordTimer` |
| 5 | [loginWindow/useLoginOrchestrator.ts:195](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/loginWindow/useLoginOrchestrator.ts#L195) | composable 级 | `cleanup()` L305 `terminate()` | `checkUpdate` |
| 6 | [forgetPasswordWindow/index.vue:219](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/forgetPasswordWindow/index.vue#L219) | 组件级 | `onBeforeUnmount` L544 `terminate()` | `email_verification_timer` / `captcha_cooldown_timer` |
| 7 | [mobile/views/MobileForgetPassword.vue:156](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/MobileForgetPassword.vue#L156) | 组件级 | `onBeforeUnmount` L392 `terminate()` | 同上两个 |

关键约束证据：
- 7 处中有 5 处使用 `onmessage =` **独占覆写**（#4 #5 #6 #7 + #2 的 `recallManager`）；直接换共享单例会让任一消费者终止/覆写波及其他 —— 这正是必须建路由层的原因。
- [message.ts:421](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/message.ts#L421) 的 `terminateWorker: () => getTimerWorker().terminate()` **无任何调用方**（全仓 grep：`emoticon/index.vue` 的 `terminateWorker` 来自 `useEmojiLocalCache.ts:351`，是另一个 worker）→ 死代码。
- worker 下行 `reconnectTimeout`/`periodicHeartbeat` 与上行 `setLogging`/`startReconnectTimer`/`clearReconnectTimer`/`startPeriodicHeartbeat`/`stopPeriodicHeartbeat` 全仓无生产者 → 本计划**不**纳入宿主类型（保持最小面）。
- Tauri 每个 WebView 是独立 JS realm → 模块单例是「每窗口」的，本宿主的「单例」同样是 per-window。

**可观测等价性论证（每个 Task 必须自证）：** 单持有者场景（#3 #4 #5 #6 #7）行为与现状逐条等价；共享族（#1 #2）从「各自独立 worker」变为「同 worker 的不同 channel」，唯一语义差异是 `allTimersCompleted` 由「本 worker 内定时器清零」变为「全窗口定时器清零」——该事件的唯一消费者 `recallManager` 仅 `logger.debug`，无副作用，故不等价性不可观测。

---

### Task 1: 建立宿主层 `src/services/timerWorkerHost.ts` + 单测

**Files:**
- Create: `src/services/timerWorkerHost.ts`
- Test: `src/services/__tests__/timerWorkerHost.test.ts`

- [ ] **Step 1: 写失败测试（RED）**

创建 `src/services/__tests__/timerWorkerHost.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockMessageEvent = { data: unknown }

class MockWorker {
  postMessage = vi.fn()
  terminate = vi.fn()
  onmessage: ((event: MockMessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  constructor() {
    mockInstances.push(this)
  }
}

let mockInstances: MockWorker[] = []

beforeEach(() => {
  vi.resetModules()
  mockInstances = []
  vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker)
})

describe('timerWorkerHost', () => {
  it('shares one Worker across acquired handles', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    expect(mockInstances).toHaveLength(1)
    a.release()
    b.release()
  })

  it('namespaces msgId per channel and routes replies back with the original id', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    const seenA: Array<{ type: string; msgId: string }> = []
    const seenB: Array<{ type: string; msgId: string }> = []
    a.onMessage((e) => seenA.push(e as { type: string; msgId: string }))
    b.onMessage((e) => seenB.push(e as { type: string; msgId: string }))

    // 两个消费者使用同一个 msgId 'checkUpdate'
    a.postMessage({ type: 'startTimer', msgId: 'checkUpdate', duration: 1 })
    b.postMessage({ type: 'startTimer', msgId: 'checkUpdate', duration: 1 })

    const rawA = mockInstances[0].postMessage.mock.calls[0][0]
    const rawB = mockInstances[0].postMessage.mock.calls[1][0]
    expect(rawA.msgId).not.toBe(rawB.msgId)
    expect(rawA.msgId.endsWith('checkUpdate')).toBe(true)

    // 模拟 worker 只回 channel A 的 timeout
    mockInstances[0].onmessage?.({ data: { type: 'timeout', msgId: rawA.msgId } })
    expect(seenA).toEqual([{ type: 'timeout', msgId: 'checkUpdate' }])
    expect(seenB).toEqual([])

    a.release()
    b.release()
  })

  it('broadcasts allTimersCompleted to every channel', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    const aEvents: string[] = []
    const bEvents: string[] = []
    a.onMessage((e) => aEvents.push(e.type))
    b.onMessage((e) => bEvents.push(e.type))

    mockInstances[0].onmessage?.({ data: { type: 'allTimersCompleted' } })
    expect(aEvents).toEqual(['allTimersCompleted'])
    expect(bEvents).toEqual(['allTimersCompleted'])

    a.release()
    b.release()
  })

  it('terminates the Worker only after the last release, then lazily recreates', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    a.release()
    expect(mockInstances[0].terminate).not.toHaveBeenCalled()
    b.release()
    expect(mockInstances[0].terminate).toHaveBeenCalledTimes(1)

    const c = acquireTimerWorker()
    expect(mockInstances).toHaveLength(2)
    c.release()
  })

  it('does not deliver to unsubscribed handlers', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const seen: string[] = []
    const off = a.onMessage((e) => seen.push(e.type))
    off()
    mockInstances[0].onmessage?.({ data: { type: 'allTimersCompleted' } })
    expect(seen).toEqual([])
    a.release()
  })

  it('broadcasts worker errors to all channels', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const onError = vi.fn()
    a.onError(onError)
    const err = new Event('error') as ErrorEvent
    mockInstances[0].onerror?.(err)
    expect(onError).toHaveBeenCalledWith(err)
    a.release()
  })
})
```

Run: `pnpm vitest run src/services/__tests__/timerWorkerHost.test.ts`
Expected: **FAIL** —— 报 `Failed to resolve import "../timerWorkerHost"`（RED，证明测试真的在跑目标模块）。

- [ ] **Step 2: 实现宿主（GREEN）**

创建 `src/services/timerWorkerHost.ts`：

```ts
/**
 * `timer.worker.ts` 的主线程宿主：同一 JS realm（Tauri 窗口）内所有消费者共享一个定时器 Worker。
 *
 * 背景：该 Worker 原被 7 处各自 `new Worker` 实例化。直接改用共享单例会产生语义冲突——
 * 任一消费者 `terminate()` 或 `onmessage =` 独占覆写都会波及他人。本宿主以「channel 命名空间
 * + 引用计数」解决：每个消费者 `acquire()` 得到独立 channel，发送时把 `msgId` 改写为
 * `${channelId}\u0000${msgId}`，Worker 回包时按前缀路由回原 channel 并还原 `msgId`；
 * 因此同一 `msgId`（如 `checkUpdate`）在不同消费者间互不串扰；全部 channel `release()` 后
 * Worker 才终止，下一次 `acquire()` 懒重建。
 */
import { createLogger } from '@/utils/Logger'

const logger = createLogger('TimerWorkerHost')

/** channel 前缀分隔符（非可见字符，不会与业务 msgId 冲突）。 */
const CHANNEL_SEP = '\u0000'

/** 宿主接受的定时器请求（当前生产方只用 `startTimer` / `clearTimer`，且均带 `msgId`）。 */
export interface TimerWorkerRequest {
  /** 请求类型。 */
  type: 'startTimer' | 'clearTimer'
  /** 定时器标识；同一消费者的同一 `msgId` 会覆盖重设。 */
  msgId: string
  /** 仅 `startTimer` 使用：毫秒时长。 */
  duration?: number
}

/** 宿主向下分发的 Worker 事件，`msgId` 已还原为消费者发送时的原值。 */
export type TimerWorkerEvent =
  | { type: 'timeout'; msgId: string }
  | { type: 'debug'; msgId: string; remainingTime: number; timestamp: number }
  | { type: 'allTimersCompleted' }

/** 单个消费者持有的定时器 Worker 句柄。 */
export interface TimerWorkerHandle {
  /** 发送请求；宿主自动为 `msgId` 加上 channel 前缀。 */
  postMessage(request: TimerWorkerRequest): void
  /** 订阅本 channel 的事件；返回取消订阅函数。 */
  onMessage(handler: (event: TimerWorkerEvent) => void): () => void
  /** 订阅 Worker 级错误；返回取消订阅函数。 */
  onError(handler: (event: ErrorEvent) => void): () => void
  /** 释放本 channel；引用计数归零时终止底层 Worker。幂等。 */
  release(): void
}

interface ChannelState {
  messageHandlers: Set<(event: TimerWorkerEvent) => void>
  errorHandlers: Set<(event: ErrorEvent) => void>
}

let worker: Worker | null = null
let refCount = 0
let channelSeq = 0
const channels = new Map<number, ChannelState>()

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url), { type: 'module' })

  worker.onmessage = (e: MessageEvent) => {
    const data = e.data as { type?: string; msgId?: unknown }
    if (data?.type === 'allTimersCompleted') {
      for (const channel of channels.values()) {
        for (const handler of channel.messageHandlers) handler({ type: 'allTimersCompleted' })
      }
      return
    }
    if (typeof data?.msgId !== 'string') return
    const sep = data.msgId.indexOf(CHANNEL_SEP)
    if (sep < 0) return
    const channel = channels.get(Number(data.msgId.slice(0, sep)))
    if (!channel) return
    const event = { ...(data as TimerWorkerEvent), msgId: data.msgId.slice(sep + 1) }
    for (const handler of channel.messageHandlers) handler(event)
  }

  worker.onerror = (event: ErrorEvent) => {
    logger.error('Worker Error', event)
    for (const channel of channels.values()) {
      for (const handler of channel.errorHandlers) handler(event)
    }
  }

  return worker
}

/**
 * 取得一个定时器 Worker 句柄。同一 JS realm 内所有句柄共享同一个底层 Worker，
 * 消费完毕必须调用 `release()`。
 */
export function acquireTimerWorker(): TimerWorkerHandle {
  const instance = ensureWorker()
  refCount++
  const channelId = ++channelSeq
  const channel: ChannelState = { messageHandlers: new Set(), errorHandlers: new Set() }
  channels.set(channelId, channel)
  let released = false

  return {
    postMessage(request) {
      if (released) return
      instance.postMessage({ ...request, msgId: `${channelId}${CHANNEL_SEP}${request.msgId}` })
    },
    onMessage(handler) {
      channel.messageHandlers.add(handler)
      return () => channel.messageHandlers.delete(handler)
    },
    onError(handler) {
      channel.errorHandlers.add(handler)
      return () => channel.errorHandlers.delete(handler)
    },
    release() {
      if (released) return
      released = true
      channels.delete(channelId)
      channel.messageHandlers.clear()
      channel.errorHandlers.clear()
      refCount--
      if (refCount <= 0 && worker) {
        worker.terminate()
        worker = null
      }
    }
  }
}
```

Run: `pnpm vitest run src/services/__tests__/timerWorkerHost.test.ts`
Expected: **PASS**（6 个用例全绿）。

- [ ] **Step 3: 守卫 + 类型**

Run: `node scripts/check-worker-client-boundary.mjs && pnpm vue-tsc --noEmit`
Expected: 边界守卫 `OK`（新文件不在 `src/workers/**`，且不含违禁记号）；类型 0 错误。

- [ ] **Step 4: 提交**

```bash
git add src/services/timerWorkerHost.ts src/services/__tests__/timerWorkerHost.test.ts
git commit -m "refactor(service): 新增 timer.worker 主线程共享宿主（channel 路由 + 引用计数）"
```

---

### Task 2: 迁移共享单例族（`chat/timerWorker.ts` / `recallManager.ts` / `message.ts`）+ 同步测试

**Files:**
- Modify: `src/stores/domains/chat/chat/timerWorker.ts`
- Modify: `src/stores/domains/chat/chat/recallManager.ts:16-32`
- Modify: `src/stores/domains/chat/chat/message.ts:9,421`
- Test: `src/stores/domains/chat/chat/__tests__/recallManager.test.ts`
- Test: `src/stores/domains/chat/chat/__tests__/message.test.ts`

- [ ] **Step 1: 先改测试为「新协议」（RED）**

`recallManager.test.ts`：把 mock 从 `{ postMessage, onmessage }` 改为 `{ postMessage, onMessage }`，并捕获订阅到的处理器。

将 [recallManager.test.ts:1-37](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/__tests__/recallManager.test.ts#L1-L37) 替换为：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPostMessage = vi.fn()
let capturedHandler: ((event: { type: string; msgId?: string }) => void) | null = null
const mockOnMessage = vi.fn((handler: (event: { type: string; msgId?: string }) => void) => {
  capturedHandler = handler
  return () => {}
})
const mockWorker = {
  postMessage: mockPostMessage,
  onMessage: mockOnMessage
}

vi.mock('../timerWorker', () => ({
  getTimerWorker: () => mockWorker
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    reactive: (obj: Record<string, unknown>) => obj
  }
})

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

import { createRecallManager } from '../recallManager'
import { RECALL_EXPIRATION_TIME } from '../types'

describe('recallManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandler = null
  })
```

并把 [recallManager.test.ts:137-147](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/__tests__/recallManager.test.ts#L137-L147) 的最后一个用例改为：

```ts
  it('timer worker timeout event removes message', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({ messageId: 'msg1', content: 'test', originalType: 1, isSelf: true })

    // 模拟宿主把 worker 的 timeout 路由回本 channel（msgId 已还原）
    capturedHandler?.({ type: 'timeout', msgId: 'msg1' })

    expect(manager.getRecalledMessage('msg1')).toBeUndefined()
  })
```

`message.test.ts`：[L6-30](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/__tests__/message.test.ts#L6-L30) 的 `timerWorkerMock` 由 `{ postMessage, terminate, onmessage }` 改为 host 句柄形状：

```ts
    timerWorkerMock: {
      postMessage: vi.fn(),
      onMessage: vi.fn((handler: (event: { type: string; msgId?: string }) => void) => {
        messageHandlerRef.value = handler
        return () => {}
      }),
      onError: vi.fn(),
      release: vi.fn()
    },
```

并在 `vi.hoisted` 块中一并声明 `messageHandlerRef: { value: null as null | ((event: { type: string; msgId?: string }) => void) }`，在顶层解构时带上它。

把 [message.test.ts:187-189](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/__tests__/message.test.ts#L187-L189) 的 reset 改为：

```ts
    timerWorkerMock.postMessage.mockClear()
    timerWorkerMock.release.mockClear()
    messageHandlerRef.value = null
```

把 [message.test.ts:342-349](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/__tests__/message.test.ts#L342-L349) 的断言改为等价意图（`allTimersCompleted` 不得清空/释放）：

```ts
    messageHandlerRef.value?.({
      type: 'allTimersCompleted'
    })

    expect(store.getRecalledMessage('50')).toBeDefined()
    expect(timerWorkerMock.release).not.toHaveBeenCalled()
```

Run: `pnpm vitest run src/stores/domains/chat/chat/__tests__/recallManager.test.ts src/stores/domains/chat/chat/__tests__/message.test.ts`
Expected: **FAIL** —— `recallManager` 仍调 `getTimerWorker().onmessage`，新 mock 无该属性 → 用例报错（RED）。

- [ ] **Step 2: 改共享单例模块与消费者（GREEN）**

`src/stores/domains/chat/chat/timerWorker.ts` 全文替换为：

```ts
import { acquireTimerWorker, type TimerWorkerHandle } from '@/services/timerWorkerHost'

let handle: TimerWorkerHandle | null = null

/**
 * 取得聊天域共享的定时器 Worker 句柄。
 *
 * 进程内单例、永不释放（与重构前的 module 级单例生命周期一致）；实际 Worker 实例由
 * `timerWorkerHost` 统一持有，与其他消费者共享。
 */
export const getTimerWorker = (): TimerWorkerHandle => {
  if (!handle) {
    handle = acquireTimerWorker()
  }
  return handle
}
```

`recallManager.ts` 将 [L16-32](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/recallManager.ts#L16-L32) 的 `timerWorkerListenerAttached` 守卫替换为 `onMessage` 订阅：

```ts
  let unsubscribeTimerWorker: (() => void) | null = null

  const ensureTimerWorkerListener = () => {
    if (unsubscribeTimerWorker) return
    unsubscribeTimerWorker = getTimerWorker().onMessage((event) => {
      if (event.type === 'timeout') {
        logger.debug(`消息ID: ${event.msgId} 已过期`)
        delete recalledMessages[event.msgId]
        delete expirationTimers[event.msgId]
      } else if (event.type === 'allTimersCompleted') {
        logger.debug('撤回消息计时器已全部结束')
      }
    })
  }
```

`recallManager.ts` 中其余 `getTimerWorker().postMessage({ type: 'startTimer' | 'clearTimer', msgId })` 调用**保持不变**（宿主内部加前缀）。

`message.ts`：删除 [L9](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/message.ts#L9) 的 `import { getTimerWorker } from './timerWorker'`，并删除 [L421](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/message.ts#L421) 的 `terminateWorker: () => getTimerWorker().terminate()`（连同上一行末尾逗号的调整，确保对象字面量语法正确）。

Run: `pnpm vitest run src/stores/domains/chat/chat/__tests__/recallManager.test.ts src/stores/domains/chat/chat/__tests__/message.test.ts`
Expected: **PASS**。

- [ ] **Step 3: 死代码取证 + 守卫**

Run: `grep -rn "terminateWorker" src/ | grep -v emoticon`
Expected: 仅剩 `src/components/rightBox/emoticon/**`（属于 emoji cache worker，非本主题）；`message.ts` 不再出现。

Run: `pnpm vue-tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 4: 提交**

```bash
git add src/stores/domains/chat/chat/timerWorker.ts src/stores/domains/chat/chat/recallManager.ts src/stores/domains/chat/chat/message.ts src/stores/domains/chat/chat/__tests__/recallManager.test.ts src/stores/domains/chat/chat/__tests__/message.test.ts
git commit -m "refactor(chat): 聊天域计时器改用共享宿主，删除死代码 terminateWorker"
```

---

### Task 3: 迁移 `useCountdown.ts`

**Files:**
- Modify: `src/shared/composables/useCountdown.ts`

- [ ] **Step 1: 改实现**

将 [useCountdown.ts:8-46](file:///Users/ljf/Desktop/hu_ts/Tjg/src/shared/composables/useCountdown.ts#L8-L46) 替换为：

```ts
import { onScopeDispose, ref } from 'vue'
import { acquireTimerWorker } from '@/services/timerWorkerHost'

export function useCountdown(timerId: string) {
  const timer = acquireTimerWorker()
  const countdown = ref(0)

  const stop = () => {
    timer.postMessage({ type: 'clearTimer', msgId: timerId })
    countdown.value = 0
  }

  const start = (duration = 60) => {
    countdown.value = duration
    timer.postMessage({ type: 'startTimer', msgId: timerId, duration: duration * 1000 })
  }

  timer.onMessage((event) => {
    if (event.msgId !== timerId) return
    if (event.type === 'debug') {
      countdown.value = Math.max(0, Math.ceil(event.remainingTime / 1000))
    } else if (event.type === 'timeout') {
      countdown.value = 0
    }
  })

  timer.onError(() => {
    countdown.value = 0
  })

  onScopeDispose(() => {
    stop()
    timer.release()
  })

  return { countdown, start, stop }
}
```

文件头 JSDoc 第 4-5 行的「在组件作用域销毁时自动清理定时器和 Worker」需同步改为「…自动清理定时器并释放宿主 channel（引用计数归零时才终止 Worker）」。

- [ ] **Step 2: 验证**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run src/shared`
Expected: 类型 0 错误；`src/shared` 下既有用例全绿（若无对应用例则说明现状，不新增）。

- [ ] **Step 3: 提交**

```bash
git add src/shared/composables/useCountdown.ts
git commit -m "refactor(hook): useCountdown 改用共享 timer worker 宿主"
```

---

### Task 4: 迁移 `useVoiceRecordRust.ts`

**Files:**
- Modify: `src/composables/chat/useVoiceRecordRust.ts:16,52-80,284-291`

- [ ] **Step 1: 改实现**

[L16](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/chat/useVoiceRecordRust.ts#L16) 的 `let timerWorker: Worker | null = null` 改为：

```ts
let voiceTimerHandle: TimerWorkerHandle | null = null
```

并把顶部 import 补上 `import { acquireTimerWorker, type TimerWorkerHandle } from '@/services/timerWorkerHost'`（放在其他 `@/` import 组内）。

[L51-80](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/chat/useVoiceRecordRust.ts#L51-L80) 的懒创建 + `onmessage =` 改为：

```ts
      // 初始化 worker 计时器（module 级共享，行为与重构前一致）
      if (!voiceTimerHandle) {
        voiceTimerHandle = acquireTimerWorker()
        voiceTimerHandle.onMessage((event) => {
          if (event.type !== 'timeout' || event.msgId !== timerMsgId) return

          // 每秒更新录音时间
          if (isRecording.value) {
            const currentTime = Math.floor((Date.now() - startTime.value) / 1000)
            recordingTime.value = currentTime

            // 检查是否达到60秒限制
            if (currentTime === 59) {
              // 达到60秒，自动停止录音
              stopRecordingAudio()
              return
            }

            // 重新启动1秒定时器
            voiceTimerHandle?.postMessage({
              type: 'startTimer',
              msgId: timerMsgId,
              duration: 1000
            })
          }
        })
      }
```

[L284-291](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/chat/useVoiceRecordRust.ts#L284-L291) 的清理改为：

```ts
    // 清理 worker
    if (voiceTimerHandle) {
      voiceTimerHandle.postMessage({
        type: 'clearTimer',
        msgId: timerMsgId
      })
      voiceTimerHandle.release()
      voiceTimerHandle = null
    }
```

- [ ] **Step 2: 验证**

Run: `pnpm vue-tsc --noEmit && grep -n "timerWorker" src/composables/chat/useVoiceRecordRust.ts`
Expected: 类型 0 错误；grep 无 `timerWorker` 残留（全改为 `voiceTimerHandle`）。

- [ ] **Step 3: 提交**

```bash
git add src/composables/chat/useVoiceRecordRust.ts
git commit -m "refactor(hook): 录音计时改用共享 timer worker 宿主"
```

---

### Task 5: 迁移窗口级单例 `layout/index.vue` 与 `useLoginOrchestrator.ts`

**Files:**
- Modify: `src/layout/index.vue:231-243,442-446,485-489`
- Modify: `src/views/loginWindow/useLoginOrchestrator.ts:195-206,287-291,301-305`

- [ ] **Step 1: 改 `layout/index.vue`**

[L231-243](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/index.vue#L231-L243) 替换为：

```ts
// 共享定时器 Worker 宿主
const timerWorker = acquireTimerWorker()

timerWorker.onError((error) => {
  logger.error('Worker Error', error)
})

// 监听 Worker 消息
timerWorker.onMessage((event) => {
  if (event.type === 'timeout') {
    checkUpdate('home')
  }
})
```

（`acquireTimerWorker` 走 `@/services/timerWorkerHost` 的自动导入或显式 import，按本文件既有 import 风格处理。）

[L442-446](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/index.vue#L442-L446) 的 `postMessage({ type: 'startTimer', msgId: 'checkUpdate', duration: CHECK_UPDATE_TIME })` **文本不变**（字段与 `TimerWorkerRequest` 兼容）。

[L485-489](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/index.vue#L485-L489) 的 `onUnmounted` 内 `timerWorker.terminate()` 改为 `timerWorker.release()`：

```ts
onUnmounted(() => {
  cleanupNativeFileDropListeners()
  // 清除共享计时器并释放本窗口 channel
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: 'checkUpdate'
  })
  timerWorker.release()
})
```

- [ ] **Step 2: 改 `useLoginOrchestrator.ts`**

[L195-206](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/loginWindow/useLoginOrchestrator.ts#L195-L206) 替换为：

```ts
  const timerWorker = acquireTimerWorker()

  timerWorker.onError((error) => {
    logger.error('Worker Error', error)
  })

  timerWorker.onMessage((event) => {
    if (event.type === 'timeout') {
      checkUpdate('login')
    }
  })
```

[L287-291](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/loginWindow/useLoginOrchestrator.ts#L287-L291) 的 `postMessage` **文本不变**。

[L301-305](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/loginWindow/useLoginOrchestrator.ts#L301-L305) 的 `cleanup()` 末尾 `timerWorker.terminate()` 改为 `timerWorker.release()`。

- [ ] **Step 3: 验证**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run src/views/loginWindow`
Expected: 类型 0 错误；`src/views/loginWindow/__tests__` 全绿（该目录已有 `MockWorker` stub，登录编排若有用例会随之覆盖）。

- [ ] **Step 4: 提交**

```bash
git add src/layout/index.vue src/views/loginWindow/useLoginOrchestrator.ts
git commit -m "refactor(ui): home/login 窗口的 checkUpdate 计时改用共享宿主"
```

---

### Task 6: 迁移组件级双计时器 `forgetPasswordWindow/index.vue` 与 `mobile/views/MobileForgetPassword.vue`

**Files:**
- Modify: `src/views/forgetPasswordWindow/index.vue:219,484-518,530-545`
- Modify: `src/mobile/views/MobileForgetPassword.vue:156,349-375,381-393`

- [ ] **Step 1: 改桌面端 `forgetPasswordWindow/index.vue`**

[L219](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/forgetPasswordWindow/index.vue#L219)：

```ts
const timerWorker = acquireTimerWorker()
```

[L484-518](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/forgetPasswordWindow/index.vue#L484-L518) 的 `onmessage`/`onerror` 改为：

```ts
// 监听 Worker 消息
timerWorker.onMessage((event) => {
  const { type, msgId, remainingTime } = event

  if (msgId === EMAIL_TIMER_ID) {
    // 邮箱验证码计时器消息处理
    if (type === 'debug') {
      // 更新倒计时显示
      const secondsRemaining = Math.ceil(remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = t('auth.forget.actions.retry_in', { seconds: secondsRemaining })
    } else if (type === 'timeout') {
      // 计时结束
      sendBtnDisabled.value = false
      emailCodeBtnText.value = t('auth.forget.actions.resend')
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    // 图片验证码冷却计时器消息处理
    if (type === 'debug') {
      // 更新剩余冷却时间，供用户点击时显示
      captchaCooldownRemaining.value = Math.ceil(remainingTime / 1000)
    } else if (type === 'timeout') {
      // 冷却结束
      captchaInCooldown.value = false
      captchaCooldownRemaining.value = 0
    }
  }
})

// Worker 错误处理
timerWorker.onError((error) => {
  logger.error('Timer Worker Error', error)
  sendBtnDisabled.value = false
  emailCodeBtnText.value = t('auth.forget.actions.resend')
})
```

注意：`event` 为联合类型，`debug` 分支才有 `remainingTime`；上面写法在 `msgId === EMAIL_TIMER_ID` 且 `type === 'debug'` 分支内访问 `remainingTime` 需要 TS 收窄——若类型收窄报错，改为在分支内判 `event.type === 'debug'` 后访问 `event.remainingTime`：

```ts
timerWorker.onMessage((event) => {
  if (event.type === 'allTimersCompleted') return
  const { msgId } = event
  if (msgId === EMAIL_TIMER_ID) {
    if (event.type === 'debug') {
      const secondsRemaining = Math.ceil(event.remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = t('auth.forget.actions.retry_in', { seconds: secondsRemaining })
    } else {
      sendBtnDisabled.value = false
      emailCodeBtnText.value = t('auth.forget.actions.resend')
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    if (event.type === 'debug') {
      captchaCooldownRemaining.value = Math.ceil(event.remainingTime / 1000)
    } else {
      captchaInCooldown.value = false
      captchaCooldownRemaining.value = 0
    }
  }
})
```

（以 `pnpm vue-tsc --noEmit` 通过为准，二选一。）

[L530-545](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/forgetPasswordWindow/index.vue#L530-L545) 的 `onBeforeUnmount` 内 `timerWorker.terminate()` 改为 `timerWorker.release()`，两个 `postMessage({ type: 'clearTimer', msgId: ... })` 保持不变。

- [ ] **Step 2: 改移动端 `MobileForgetPassword.vue`**

[L156](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/MobileForgetPassword.vue#L156)：`const timerWorker = acquireTimerWorker()`。

[L349-375](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/MobileForgetPassword.vue#L349-L375) 改为（同样按需用类型收窄写法）：

```ts
timerWorker.onMessage((event) => {
  if (event.type === 'allTimersCompleted') return
  const { msgId } = event

  if (msgId === EMAIL_TIMER_ID) {
    if (event.type === 'debug') {
      const secondsRemaining = Math.ceil(event.remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = t('mobile_forget_code.email_resend_in', { seconds: secondsRemaining })
    } else {
      sendBtnDisabled.value = false
      emailCodeBtnText.value = t('mobile_forget_code.button.send_email_code')
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    if (event.type === 'debug') {
      captchaCooldownRemaining.value = Math.ceil(event.remainingTime / 1000)
    } else {
      captchaInCooldown.value = false
      captchaCooldownRemaining.value = 0
    }
  }
})

timerWorker.onError((error) => {
  logger.error('Timer Worker Error', error)
  sendBtnDisabled.value = false
  emailCodeBtnText.value = t('mobile_forget_code.button.send_email_code')
})
```

[L381-393](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/MobileForgetPassword.vue#L381-L393) 的 `onBeforeUnmount` 内 `timerWorker.terminate()` 改为 `timerWorker.release()`。

- [ ] **Step 3: 验证**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run src/views/forgetPasswordWindow src/mobile`
Expected: 类型 0 错误；相关目录用例全绿。

- [ ] **Step 4: 提交**

```bash
git add src/views/forgetPasswordWindow/index.vue src/mobile/views/MobileForgetPassword.vue
git commit -m "refactor(mobile): 忘记密码双计时器改用共享宿主"
```

---

### Task 7: 全量门禁 + 收敛性取证 + 报告回写

**Files:**
- Modify: `docs/TJG-前端技术审查报告-2026-10-12.md`（R-5 行 L418、§4.5 第 6 条 L456）

- [ ] **Step 1: 确认剩余 `new Worker(timer.worker.ts)` 只剩宿主一处**

Run:
```bash
grep -rn "timer\.worker" src/ | grep -v __tests__ | grep -v "timerWorkerHost"
```
Expected: **仅剩 `src/services/timerWorkerHost.ts`**（其内部 `new URL('../workers/timer.worker.ts', ...)`）与 `src/workers/timer.worker.ts` 自身；7 处消费者引用全部消失。

- [ ] **Step 2: 跑门禁（全绿）**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check:ratchet
pnpm check
node scripts/check-worker-client-boundary.mjs
pnpm check:doc-coverage
pnpm check:doc-paths
```
Expected: 全部 exit 0；`check:ratchet` 基线**持平或下降**、不得抬高；`check:doc-coverage` 对新导出符号的 JSDoc 无新增缺失。

- [ ] **Step 3: 提交门禁产物（如有 ratchet 基线收紧）**

若 `check:ratchet` 允许把 `is_mobile_branch` 或其它计数下调，单独提交：

```bash
git add <收紧的 baseline 文件>
git commit -m "chore(ci): R-5 落地后收紧 ratchet 基线"
```

- [ ] **Step 4: 回写审查报告**

在 [报告 L418](file:///Users/ljf/Desktop/hu_ts/Tjg/docs/TJG-前端技术审查报告-2026-10-12.md#L418) 的 R-5 行状态列，从「**2026-10-14 复核：维持待排期（高风险）**」改为「**已完成**」并追加落地口径：

> 已建 `src/services/timerWorkerHost.ts`（`acquireTimerWorker()` → `TimerWorkerHandle`：`postMessage` / `onMessage` / `onError` / `release`；`msgId` 以 `${channelId}\u0000` 前缀命名空间化、回包按前缀路由并还原；`allTimersCompleted` 广播；引用计数归零才 `terminate()`）。7 处消费者全部迁移，`timer.worker.ts` 内部未改；同步删除 [message.ts:421](file:///Users/ljf/Desktop/hu_ts/Tjg/src/stores/domains/chat/chat/message.ts#L421) 的死代码 `terminateWorker`。同窗口 timer worker 峰值 3 → 1（home 窗口 layout + 录音 + 撤回；登录/忘记密码窗口各 1，卸载后归零）。

把 [§4.5 第 6 条 L456](file:///Users/ljf/Desktop/hu_ts/Tjg/docs/TJG-前端技术审查报告-2026-10-12.md#L456) 中 `R-5`（…**高风险待排期**）改为 `R-5`（…**已完成（2026-10-14）**，共享宿主 + channel 路由，7 处消费者收敛为每窗口 1 实例）。

- [ ] **Step 5: 提交**

```bash
git add docs/TJG-前端技术审查报告-2026-10-12.md
git commit -m "docs(ci): 回写 R-5 timer worker 宿主层落地evidence"
```

---

## Self-Review

**Spec 覆盖度（对照报告 R-5 行 L418 / §4.5 L456）：**
- 7 处 `new Worker` → Task 2/3/4/5/6 逐处迁移，Task 7 Step 1 用 grep 取证「仅剩宿主一处」。✅
- 「无法直接共用单例（terminate/覆写冲突）」→ 核心即 Task 1 的 channel 路由 + 引用计数。✅
- `message.ts` 的 `terminateWorker` 死代码 → Task 2 Step 2 删除，Step 3 取证。✅
- 报告回写 → Task 7 Step 4。✅

**行为等价性（每个 Task 的自证点）：**
- `useCountdown`：原 `onmessage` 先按 `msgId` 过滤再分 `debug`/`timeout`；新 `onMessage` 同序同判。✅
- `useVoiceRecordRust`：保留 module 级共享与「首实例闭包」结构，`release` 时机与旧 `terminate` 一致（任一实例卸载即清）。✅
- `layout` / `useLoginOrchestrator`：仅 `type === 'timeout'` 触发，`release` 替换 `terminate`。✅
- 忘记密码桌面/移动：双 msgId 分支保持，`allTimersCompleted` 无 msgId 自然落空。✅
- `recallManager`：`timeout` 删记录 + `allTimersCompleted` 仅 debug；`allTimersCompleted` 语义由「本 worker」扩为「全窗口」但无副作用（不可观测）。✅

**类型严谨性：**
- 请求/事件用 union 限定为实际在用的 `startTimer`/`clearTimer` 与 `timeout`/`debug`/`allTimersCompleted`；死分支（setLogging/心跳/重连）不纳入，避免过度设计。✅
- `msgId` 统一为 `string`（7 处调用点全为 string），避免 number↔string 还原歧义。✅

**风险与未覆盖：**
- 若 `pnpm check:ratchet` 因新增文件的行数/风格规则要求提高某阈值——**不允许**抬高，须改代码而非改基线（Global Constraints）。
- 忘记密码两文件的 `event` 类型收窄写法给了两版，以 `vue-tsc` 通过为准（Task 6 Step 1 已说明）。
- 未纳入：`timer.worker.ts` 内部死分支清理（独立可选项）、worker 心跳/重连协议的删除。

**Placeholder 扫描：** 无 TBD/TODO；所有 Step 均给出可执行的 Run 与 Expected。

---

## Execution Handoff

计划已写入 `docs/superpowers/plans/2026-10-14-r5-timer-worker-host.md`（7 个 Task，均含 RED→GREEN 证据与提交命令）。

**请选择执行方式：**

1. **Subagent-Driven（推荐）** —— 每个 Task 派一个全新 sub-agent，Task 间做评审检查点，主上下文不被实现细节淹没。
2. **Inline Execution** —— 在本会话内按 Task 顺序逐个执行，遇阻随时停下来确认。

**另需确认一个前置决策：** 是否先建隔离 worktree（`.worktrees/r5-timer-worker-host`，分支 `refactor/r5-timer-worker-host`），还是**直接在主树** `/Users/ljf/Desktop/hu_ts/Tjg` 上实施？前者更符合本仓惯例（高风险跨 7 文件），代价是 `node_modules` 为 symlink、本地命令需用 `pnpm vitest run` / `pnpm vue-tsc` 而非重装依赖。
