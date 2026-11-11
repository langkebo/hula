# 移动端来电信令迁移至 Matrix VoIP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让移动端来电由 Matrix `Call.incoming` 驱动，浮层携带 `callId`，接听/拒接真正落到 `MatrixVoIPService`，并移除旧 WS 通话信令的移动端分支。

**Architecture:** 保持单一入口：`useVoIPIncomingCall` 已在 `App.vue` 注册 `matrixVoIPService.setIncomingCallCallback`，移动端分支改为通过 mitt 事件把完整 `CallInfo`（含 `callId`）派发给 `RtcCallFloatCell`。浮层接听后把 `callId` 写入路由 query，`rtcCall` 页面已通过 `mapMobileRtcCallProps` 归一参数并经 `useVoIPCallFlow({ initialCallId })` 调用 `answerCall`；浮层拒接直接调用 `matrixVoIPService.rejectCall(callId)`。同时修复 `useVoIPCallFlow` 未用已有 `CallInfo` 初始化的问题，否则来电页会停留“去电响铃”态。

**Tech Stack:** Vue 3 `<script setup>`、Pinia、mitt、vue-router、matrix-js-sdk（经 `MatrixVoIPService`）、Vitest + Vue Test Utils。

## Global Constraints

- 不 `git commit`、不 `git push`（用户本轮未要求提交）。
- 遵守 R1：一切 Matrix 通话操作走 `src/services/matrix/media/MatrixVoIPService.ts`，禁止在组件内新建通话 API 或裸 `fetch`。
- 遵守 R2：不得在 `src/mobile/**` 引入 admin / AI 模块。
- 遵守 R3：每步完成后回答“是否复用 SDK/服务层、是否引入移动端 admin/AI、移动端构建是否可产出”。
- 颜色只用 `--tjg-*` token；图标只用 SVG；`.vue` 内禁止新增中文字面量（统一走 i18n key `mobile_voice_video.*` / `voip.*`）。
- `tsconfig` 开启 `exactOptionalPropertyTypes`：可选属性不得显式传 `undefined`（用条件展开或省略）。
- Biome 2 空格缩进、单引号、无分号。
- 不修改并行会话文件：`e2e/my-hub-live.spec.ts`、`src/mobile/views/my/MobileInvitePermission.vue`、`src/mobile/views/my/mobileSettingsSearchIndex.ts`。

---

## 文件结构

| 文件 | 责任 |
| :--- | :--- |
| `src/enums/chat.ts` | 删除 `MOBILE_RTC_CALL_REQUEST`，新增 `MOBILE_VOIP_INCOMING_CALL` 事件名 |
| `src/composables/useVoIPIncomingCall.ts` | 移动端分支把 `CallInfo` 派发给浮层；桌面端行为不变 |
| `src/mobile/components/RtcCallFloatCell.vue` | 由 Matrix 来电驱动，持有 `callId`，接听透传、拒接走服务、通话结束自动收起 |
| `src/composables/useVoIPCallFlow.ts` | `initialCallId` 存在时从 `matrixVoIPService.getActiveCalls()` 种子 `callInfo` |
| `src/composables/app/useWsEventHandler.ts` | 删除 `VideoCallRequest` 的移动端 mitt 转发分支 |
| `src/composables/__tests__/useVoIPIncomingCall.test.ts` | 新建：移动端派发 / 桌面窗口 / 信息不完整 |
| `src/mobile/components/__tests__/RtcCallFloatCell.test.ts` | 新建：展示、接听 query、拒接服务调用、结束收起 |
| `src/composables/__tests__/useVoIPCallFlow.test.ts` | 新建：种子 `callInfo` 与订阅更新 |
| `docs/TJG-移动端我的页对比与优化方案-2026-11-11.md` | §15.2 移除“旧信令遗留”描述，记录闭环结论 |

---

### Task 1: 建立 Matrix 来电 → 移动端浮层的事件通道

**Files:**
- Modify: `src/enums/chat.ts:74-75`
- Modify: `src/composables/useVoIPIncomingCall.ts:1-39`
- Test: `src/composables/__tests__/useVoIPIncomingCall.test.ts`（新建）

**Interfaces:**
- Consumes: `matrixVoIPService.setIncomingCallCallback(cb: (info: CallInfo) => void)`、`CallInfo`（`src/services/matrix/media/voipTypes.ts:32-41`）。
- Produces: mitt 事件 `MittEnum.MOBILE_VOIP_INCOMING_CALL = 'mobileVoipIncomingCall'`，payload 为完整 `CallInfo`。Task 2 依赖该事件名与 payload。

- [ ] **Step 1: 写失败测试**

创建 `src/composables/__tests__/useVoIPIncomingCall.test.ts`：

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { CallTypeEnum, MittEnum } from '@/enums'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import { useVoIPIncomingCall } from '../useVoIPIncomingCall'

const {
  setIncomingCallCallbackMock,
  createRtcCallWindowMock,
  emitMock,
  isDesktopMock,
  isNonMatrixWindowMock
} = vi.hoisted(() => ({
  setIncomingCallCallbackMock: vi.fn(),
  createRtcCallWindowMock: vi.fn().mockResolvedValue(undefined),
  emitMock: vi.fn(),
  isDesktopMock: vi.fn(() => false),
  isNonMatrixWindowMock: vi.fn(() => false)
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: { setIncomingCallCallback: setIncomingCallCallbackMock }
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: emitMock }
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: isDesktopMock
}))

vi.mock('@/utils/windowLabels', () => ({
  isNonMatrixWindow: isNonMatrixWindowMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const callInfo: CallInfo = {
  callId: 'call-1',
  roomId: '!room:example.com',
  isVideo: true,
  isGroup: false,
  state: 'ringing',
  participants: [
    { userId: '@alice:example.com', displayName: 'Alice', isMuted: false, isVideoMuted: false, isSpeaking: false }
  ]
}

const Harness = defineComponent({
  setup() {
    useVoIPIncomingCall({ createRtcCallWindow: createRtcCallWindowMock })
    return () => null
  }
})

const mountAndGetHandler = async () => {
  mount(Harness)
  await flushPromises()
  return setIncomingCallCallbackMock.mock.calls[0]?.[0] as (info: CallInfo) => Promise<void>
}

describe('useVoIPIncomingCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDesktopMock.mockReturnValue(false)
    isNonMatrixWindowMock.mockReturnValue(false)
  })

  afterEach(() => {
    isDesktopMock.mockReturnValue(false)
  })

  it('移动端把完整 CallInfo 派发给浮层', async () => {
    const handler = await mountAndGetHandler()
    await handler(callInfo)
    await flushPromises()

    expect(emitMock).toHaveBeenCalledWith(MittEnum.MOBILE_VOIP_INCOMING_CALL, callInfo)
    expect(createRtcCallWindowMock).not.toHaveBeenCalled()
  })

  it('桌面端仍创建来电窗口且不派发移动端事件', async () => {
    isDesktopMock.mockReturnValue(true)
    const handler = await mountAndGetHandler()
    await handler(callInfo)
    await flushPromises()

    expect(createRtcCallWindowMock).toHaveBeenCalledWith(
      true,
      '@alice:example.com',
      '!room:example.com',
      CallTypeEnum.VIDEO
    )
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('参与者缺失时跳过，不派发也不建窗', async () => {
    const handler = await mountAndGetHandler()
    await handler({ ...callInfo, participants: [] })
    await flushPromises()

    expect(emitMock).not.toHaveBeenCalled()
    expect(createRtcCallWindowMock).not.toHaveBeenCalled()
  })

  it('非 Matrix 窗口不注册来电回调', async () => {
    isNonMatrixWindowMock.mockReturnValue(true)
    mount(Harness)
    await flushPromises()

    expect(setIncomingCallCallbackMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/composables/__tests__/useVoIPIncomingCall.test.ts`

Expected: FAIL，`MittEnum.MOBILE_VOIP_INCOMING_CALL` 不存在（或 `emit` 未被调用）。

- [ ] **Step 3: 最小实现**

`src/enums/chat.ts` 在既有 `MOBILE_RTC_CALL_REQUEST` 下方新增（旧键由 Task 4 统一删除，避免本任务类型检查因 `RtcCallFloatCell.vue` 仍引用旧键而失败）：

```ts
  /** Matrix 来电派发给移动端浮层 */
  MOBILE_VOIP_INCOMING_CALL = 'mobileVoipIncomingCall',
```

`src/composables/useVoIPIncomingCall.ts` 顶部补 import：

```ts
import { useMitt } from '@/composables/common/useMitt'
import { CallTypeEnum, MittEnum } from '@/enums'
```

把 `handleIncomingCall` 的桌面/移动分支改为：

```ts
    const callType = callInfo.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO

    if (isDesktop()) {
      if (!deps?.createRtcCallWindow) return
      try {
        await deps.createRtcCallWindow(true, callerUserId, callInfo.roomId, callType)
        logger.info(`来电窗口已创建: ${callerUserId} in ${callInfo.roomId}`)
      } catch (err) {
        logger.error('创建来电窗口失败:', err)
      }
      return
    }

    // 移动端：把完整 CallInfo（含 callId）交给 RtcCallFloatCell，拒绝/接听才能落到 SDK
    useMitt.emit(MittEnum.MOBILE_VOIP_INCOMING_CALL, callInfo)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/composables/__tests__/useVoIPIncomingCall.test.ts`

Expected: PASS（4 passed）。

- [ ] **Step 5: 类型检查**

Run: `pnpm vue-tsc --noEmit`

Expected: EXIT=0。

---

### Task 2: 浮层改为 Matrix 来电驱动并携带 callId

**Files:**
- Modify: `src/mobile/components/RtcCallFloatCell.vue`
- Test: `src/mobile/components/__tests__/RtcCallFloatCell.test.ts`（新建）

**Interfaces:**
- Consumes: `MittEnum.MOBILE_VOIP_INCOMING_CALL` + `CallInfo`（Task 1）；`matrixVoIPService.rejectCall(callId)`、`matrixVoIPService.onCallUpdate(callId, handler): () => void`。
- Produces: 路由 query `{ callId, remoteUserId, roomId, callType, isIncoming: 'true' }`，由既有 `mapMobileRtcCallProps`（`src/router/routes/mobile.ts`）读取。

- [ ] **Step 1: 写失败测试**

创建 `src/mobile/components/__tests__/RtcCallFloatCell.test.ts`：

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MittEnum } from '@/enums'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import RtcCallFloatCell from '../RtcCallFloatCell.vue'

const {
  handlers,
  pushMock,
  rejectCallMock,
  onCallUpdateMock,
  callUpdateHandlers,
  getUserInfoMock
} = vi.hoisted(() => {
  const handlers = new Map<string, (payload?: unknown) => void>()
  const callUpdateHandlers: Array<(info: CallInfo) => void> = []
  return {
    handlers,
    callUpdateHandlers,
    pushMock: vi.fn().mockResolvedValue(undefined),
    rejectCallMock: vi.fn().mockResolvedValue(undefined),
    onCallUpdateMock: vi.fn((_callId: string, handler: (info: CallInfo) => void) => {
      callUpdateHandlers.push(handler)
      return () => {}
    }),
    getUserInfoMock: vi.fn(() => undefined)
  }
})

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: (event: string, handler: (payload?: unknown) => void) => {
      handlers.set(event, handler)
      return () => handlers.delete(event)
    }
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock })
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: { rejectCall: rejectCallMock, onCallUpdate: onCallUpdateMock }
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ getUserInfo: getUserInfoMock })
}))

vi.mock('@/stores/domains/settings/mobile', () => ({
  useMobileStore: () => ({ safeArea: { top: 0, bottom: 0 } })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '1' } })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const callInfo: CallInfo = {
  callId: 'call-1',
  roomId: '!room:example.com',
  isVideo: true,
  isGroup: false,
  state: 'ringing',
  participants: [
    { userId: '@alice:example.com', displayName: 'Alice', isMuted: false, isVideoMuted: false, isSpeaking: false }
  ]
}

const emitIncoming = async (info: CallInfo = callInfo) => {
  handlers.get(MittEnum.MOBILE_VOIP_INCOMING_CALL)?.(info)
  await flushPromises()
}

describe('RtcCallFloatCell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    callUpdateHandlers.length = 0
    getUserInfoMock.mockReturnValue(undefined)
  })

  it('收到 Matrix 来电后显示来电人与通话类型', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('mobile_voice_video.video_call_invitation')
  })

  it('接听把 callId 透传到路由 query', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    await wrapper.find('.rtc-action-button.accept').trigger('click')
    await flushPromises()

    expect(pushMock).toHaveBeenCalledWith({
      path: '/mobile/rtcCall',
      query: {
        callId: 'call-1',
        remoteUserId: '@alice:example.com',
        roomId: '!room:example.com',
        callType: '2',
        isIncoming: 'true'
      }
    })
  })

  it('拒接调用 MatrixVoIPService.rejectCall 并收起浮层', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    await wrapper.find('.rtc-action-button.reject').trigger('click')
    await flushPromises()

    expect(rejectCallMock).toHaveBeenCalledWith('call-1')
    expect(wrapper.find('.rtc-call-card').exists()).toBe(false)
  })

  it('通话结束后自动收起浮层', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    callUpdateHandlers[0]?.({ ...callInfo, state: 'ended' })
    await flushPromises()

    expect(wrapper.find('.rtc-call-card').exists()).toBe(false)
  })

  it('信息不完整时忽略', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming({ ...callInfo, participants: [] })

    expect(wrapper.find('.rtc-call-card').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/mobile/components/__tests__/RtcCallFloatCell.test.ts`

Expected: FAIL，浮层不出现（当前仍监听旧 `MOBILE_RTC_CALL_REQUEST`）。

- [ ] **Step 3: 重写浮层脚本**

`src/mobile/components/RtcCallFloatCell.vue` 的 `<script setup>` 改为：

```ts
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/composables/common/useMitt'
import { CallTypeEnum, MittEnum } from '@/enums'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import { matrixVoIPService } from '@/services/matrix/media/MatrixVoIPService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useMobileStore } from '@/stores/domains/settings/mobile'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RtcCallFloatCell')

const router = useRouter()
const mobileStore = useMobileStore()
const groupStore = useGroupStore()
const { t } = useI18n()

const currentCall = ref<{
  callId: string
  callerUid: string
  roomId: string
  callType: CallTypeEnum
  displayName: string
  avatar: string
} | null>(null)

let unsubscribeCallUpdate: (() => void) | null = null

const topOffset = computed(() => {
  const safeTop = mobileStore.safeArea.top
  const base = safeTop > 0 ? safeTop + 16 : 16
  return `${base}px`
})

const isVisible = computed(() => currentCall.value !== null)
const avatarUrl = computed(() => currentCall.value?.avatar ?? AvatarUtils.getAvatarUrl(''))
const displayName = computed(() => currentCall.value?.displayName || t('mobile_voice_video.unknown_user'))
const callMessage = computed(() => {
  if (!currentCall.value) return ''
  return currentCall.value.callType === CallTypeEnum.VIDEO
    ? t('mobile_voice_video.video_call_invitation')
    : t('mobile_voice_video.audio_call_invitation')
})

const toAvatarUrl = (raw?: unknown) => {
  if (typeof raw === 'string') return AvatarUtils.getAvatarUrl(raw)
  if (raw === undefined || raw === null) return AvatarUtils.getAvatarUrl('')
  return AvatarUtils.getAvatarUrl(String(raw))
}

const clearCall = () => {
  unsubscribeCallUpdate?.()
  unsubscribeCallUpdate = null
  currentCall.value = null
}

const handleIncomingCall = (info: CallInfo) => {
  const callerUid = info.participants?.[0]?.userId ?? ''
  if (!info.callId || !info.roomId || !callerUid) return

  clearCall()
  const remoteUserInfo = groupStore.getUserInfo(callerUid, info.roomId)
  currentCall.value = {
    callId: info.callId,
    callerUid,
    roomId: info.roomId,
    callType: info.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO,
    displayName:
      remoteUserInfo?.myName ||
      remoteUserInfo?.name ||
      info.participants[0]?.displayName ||
      t('mobile_voice_video.unknown_user'),
    avatar: toAvatarUrl(remoteUserInfo?.avatar ?? info.participants[0]?.avatarUrl)
  }

  unsubscribeCallUpdate = matrixVoIPService.onCallUpdate(info.callId, (update) => {
    if (update.state === 'ended' || update.state === 'error') clearCall()
  })
}

const handleReject = async () => {
  const call = currentCall.value
  if (!call) return
  try {
    await matrixVoIPService.rejectCall(call.callId)
  } catch (error) {
    logger.error('Failed to reject incoming call:', error)
  } finally {
    clearCall()
  }
}

const handleAccept = async () => {
  const call = currentCall.value
  if (!call) return

  const query = {
    callId: call.callId,
    remoteUserId: call.callerUid,
    roomId: call.roomId,
    callType: String(call.callType),
    isIncoming: 'true'
  } as const

  try {
    await router.push({ path: '/mobile/rtcCall', query })
  } catch (error) {
    logger.error('Failed to navigate to call page:', error)
  } finally {
    clearCall()
  }
}

useMitt.on(MittEnum.MOBILE_VOIP_INCOMING_CALL, handleIncomingCall)
onUnmounted(clearCall)
```

同时删除：`sendMatrixVoipSignal`、`CallPayload`、`extractTargetIds`、`handleCallRequest`、`handleCallEnd`、`matchCurrentRoom`、`userStore` 导入，以及旧的 `CANCEL`/`DROPPED`/`TIMEOUT`/`CallRejected`/`CallAccepted`/`RoomClosed` 监听（这些事件在 `src/` 内已无发射点）。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/mobile/components/__tests__/RtcCallFloatCell.test.ts`

Expected: PASS（5 passed）。

- [ ] **Step 5: 回归既有浮层样式守卫**

Run: `pnpm vitest run src/mobile/layout/__tests__/mobileCssGuards.test.ts`

Expected: PASS（`RtcCallFloatCell.vue` 的 `-webkit-backdrop-filter` 守卫仍成立）。

---

### Task 3: 来电页用已有 CallInfo 种子初始状态

**Files:**
- Modify: `src/composables/useVoIPCallFlow.ts:55-59`
- Test: `src/composables/__tests__/useVoIPCallFlow.test.ts`（新建）

**Interfaces:**
- Consumes: `matrixVoIPService.getActiveCalls(): CallInfo[]`、`matrixVoIPService.onCallUpdate(callId, handler)`。
- Produces: `useVoIPCallFlow({ initialCallId })` 返回的 `callInfo` 在挂载时即为 `ringing`，`isIncoming === true`。

- [ ] **Step 1: 写失败测试**

创建 `src/composables/__tests__/useVoIPCallFlow.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import { useVoIPCallFlow } from '../useVoIPCallFlow'

const { getActiveCallsMock, onCallUpdateMock, handlers } = vi.hoisted(() => {
  const handlers: Array<(info: CallInfo) => void> = []
  return {
    handlers,
    getActiveCallsMock: vi.fn(),
    onCallUpdateMock: vi.fn((_callId: string, handler: (info: CallInfo) => void) => {
      handlers.push(handler)
      return () => {}
    })
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: {
    getActiveCalls: getActiveCallsMock,
    onCallUpdate: onCallUpdateMock,
    answerCall: vi.fn(),
    rejectCall: vi.fn(),
    hangupCall: vi.fn(),
    startCall: vi.fn(),
    toggleMute: vi.fn(),
    toggleVideo: vi.fn(),
    startScreenshare: vi.fn(),
    stopScreenshare: vi.fn(),
    checkMediaPermissions: vi.fn(),
    checkVoipAvailability: vi.fn()
  }
}))

const ringingCall: CallInfo = {
  callId: 'call-1',
  roomId: '!room:example.com',
  isVideo: true,
  isGroup: false,
  state: 'ringing',
  participants: [
    { userId: '@alice:example.com', displayName: 'Alice', isMuted: false, isVideoMuted: false, isSpeaking: false }
  ]
}

describe('useVoIPCallFlow 来电初始化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.length = 0
    getActiveCallsMock.mockReturnValue([ringingCall])
  })

  it('initialCallId 命中既有通话时立即进入来电态', () => {
    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow({ initialCallId: 'call-1', initialRoomId: '!room:example.com' })
        return () => null
      }
    })
    mount(Harness)

    expect(flow!.isIncoming.value).toBe(true)
    expect(flow!.isVideoEnabled.value).toBe(true)
    expect(flow!.callInfo.value).toEqual(ringingCall)
    expect(onCallUpdateMock).toHaveBeenCalledWith('call-1', expect.any(Function))
  })

  it('订阅后续状态更新', async () => {
    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow({ initialCallId: 'call-1' })
        return () => null
      }
    })
    mount(Harness)

    handlers[0]?.({ ...ringingCall, state: 'connected' })
    await Promise.resolve()

    expect(flow!.isConnected.value).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/composables/__tests__/useVoIPCallFlow.test.ts`

Expected: FAIL，`callInfo` 为 `null`、`isIncoming` 为 `false`。

- [ ] **Step 3: 最小实现**

`src/composables/useVoIPCallFlow.ts` 把：

```ts
  // 外部已建好通话（如来电透传 callId）时立即订阅，否则 callInfo 永远不会更新
  if (callId.value) {
    isIncomingCall.value = true
    subscribeCallUpdate()
  }
```

改为：

```ts
  // 外部已建好通话（如来电透传 callId）时必须先种子 callInfo：
  // 来电已经处于 ringing，不会再有 notifyCallUpdate 触发，否则页面会误判为去电响铃。
  if (callId.value) {
    isIncomingCall.value = true
    const existing = matrixVoIPService
      .getActiveCalls()
      .find((call) => call.callId === callId.value)
    callInfo.value = existing ?? null
    isVideoEnabled.value = !!existing?.isVideo
    subscribeCallUpdate()
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/composables/__tests__/useVoIPCallFlow.test.ts`

Expected: PASS（2 passed）。

- [ ] **Step 5: 回归来电页测试**

Run: `pnpm vitest run src/mobile/views/rtcCall/__tests__/index.test.ts src/router/__tests__/mobileRtcCallProps.test.ts`

Expected: PASS（14 + 4 passed）。

---

### Task 4: 移除旧 WS 通话信令的移动端分支

**Files:**
- Modify: `src/composables/app/useWsEventHandler.ts:74-86`
- Modify: `src/enums/chat.ts`（删除 `MOBILE_RTC_CALL_REQUEST`）

**Interfaces:**
- Consumes: 无（仅删除）。
- Produces: `MOBILE_RTC_CALL_REQUEST` 在 `src/` 内零引用；桌面 `callHandler.handleVideoCall` 行为不变。

- [ ] **Step 1: 删除移动端转发分支**

把：

```ts
    useMitt.on<VideoCallRequestPayload>(WsResponseMessageType.VideoCallRequest, (event) => {
      logger.info(`收到通话请求：${JSON.stringify(event)}`)
      const remoteUid = event.callerUid
      const callType = event.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
      if (isMobilePlatform) {
        useMitt.emit(MittEnum.MOBILE_RTC_CALL_REQUEST, {
          ...event,
          callerUid: remoteUid
        })
        return
      }
      callHandler.handleVideoCall(remoteUid, callType)
    })
```

改为：

```ts
    useMitt.on<VideoCallRequestPayload>(WsResponseMessageType.VideoCallRequest, (event) => {
      logger.info(`收到通话请求：${JSON.stringify(event)}`)
      // 移动端来电统一走 Matrix Call.incoming（useVoIPIncomingCall → RtcCallFloatCell），此处仅保留桌面链路
      if (isMobilePlatform) return
      const callType = event.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
      callHandler.handleVideoCall(event.callerUid, callType)
    })
```

- [ ] **Step 2: 删除旧枚举键**

确认 `rg -n "MOBILE_RTC_CALL_REQUEST" src` 无引用后，从 `src/enums/chat.ts` 删除：

```ts
  /** 移动端通话浮层请求 */
  MOBILE_RTC_CALL_REQUEST = 'mobileRtcCallRequest',
```

- [ ] **Step 3: 确认旧事件与死代码清零**

Run: `rg -n "MOBILE_RTC_CALL_REQUEST|sendMatrixVoipSignal" src`

Expected: 无输出（EXIT=1）。

- [ ] **Step 4: 类型检查**

Run: `pnpm vue-tsc --noEmit`

Expected: EXIT=0（若 `MittEnum` 在该文件已无其他用途，删除对应 import）。

- [ ] **Step 5: 回归移动端相关测试**

Run: `pnpm vitest run src/mobile/components/__tests__/RtcCallFloatCell.test.ts src/composables/__tests__/useVoIPIncomingCall.test.ts src/mobile/views/rtcCall/__tests__/index.test.ts`

Expected: PASS（5 + 4 + 14 passed）。

---

### Task 5: 文档更新与全量门禁

**Files:**
- Modify: `docs/TJG-移动端我的页对比与优化方案-2026-11-11.md`（§15.2 「遗留边界」段落）

**Interfaces:**
- Consumes: Task 1–4 的最终实现。
- Produces: 文档与代码一致，可复核。

- [ ] **Step 1: 更新 §15.2**

把“遗留边界：移动端来电仍走旧 WS 信令、无 Matrix `callId`，接听会明确提示失败而非静默；要真正闭环需迁移到 `useVoIPIncomingCall` 的 Matrix 来电，属独立任务。”替换为：

```markdown
- 已闭环：移动端来电改由 Matrix `Call.incoming` 驱动，`useVoIPIncomingCall` 将含 `callId` 的 `CallInfo` 派发给 `RtcCallFloatCell`，接听透传 `callId` 至 `/mobile/rtcCall`，拒接直接调用 `matrixVoIPService.rejectCall`；旧 WS 信号 `MOBILE_RTC_CALL_REQUEST` 的移动端分支已删除。
- 边界：桌面端 `VideoCallRequest` 链路保持不变，两端同时在线时以各端既有入口为准。
```

- [ ] **Step 2: 全量测试**

Run: `pnpm test:run`

Expected: 除并行会话文件 `src/mobile/views/my/__tests__/MobileInvitePermission.test.ts` 外全部通过；记录该失败与本次改动无关。

- [ ] **Step 3: 门禁命令**

依次运行并保留输出：

```bash
pnpm vue-tsc --noEmit
pnpm check
pnpm check:ratchet
pnpm check:doc-paths
pnpm check:doc-coverage
pnpm check:sdk-boundary
pnpm quality:no-raw-fetch
```

Expected: 全部 EXIT=0（`pnpm check` 对本次改动文件无报错）。

- [ ] **Step 4: R3 校验结论**

在汇报中逐条回答：
1. 复用 `MatrixVoIPService` 的 `setIncomingCallCallback` / `rejectCall` / `onCallUpdate` / `getActiveCalls`，未新增平行实现。
2. 移动端未引入 admin / AI 模块。
3. 移动端前端可正常构建（本次仅改 Vue/TS，未触碰 Tauri 配置）。

- [ ] **Step 5: 不提交**

保持工作区变更，等待用户确认后再按 Conventional Commits（如 `feat(mobile): route incoming calls through Matrix VoIP`）提交。

---

## 自检

- 规格覆盖：Matrix 来电 → 浮层（Task 1/2）、拒接闭环（Task 2）、接听透传 `callId`（Task 2 + 既有 router mapper）、页面状态正确（Task 3）、旧信令移除（Task 4）、文档与门禁（Task 5）。
- 占位符扫描：无 TBD / “类似 Task N” / 空泛错误处理。
- 类型一致性：`CallInfo` 字段（`callId/roomId/isVideo/participants[].userId/displayName/avatarUrl`）与 `voipTypes.ts` 一致；mitt 事件名 `MOBILE_VOIP_INCOMING_CALL` 在 Task 1 与 Task 2 完全一致；路由 query 键与 `mapMobileRtcCallProps` 一致。
