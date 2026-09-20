import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CallTypeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/domains/widget/global'
import ChatHeaderRoot from '../ChatHeaderRoot.vue'

const { startRtcCallMock } = vi.hoisted(() => ({
  startRtcCallMock: vi.fn().mockResolvedValue(undefined)
}))

/**
 * `ChatHeaderRoot.vue` 在 setup 里 `useDialog()`，而 naive-ui 的 `useDialog`
 * 要求祖先链上存在 `<n-dialog-provider>`，否则抛
 * `[naive/use-dialog]: No outer <n-dialog-provider /> founded`。
 * 本用例只关心通话按钮接线，不适合为了一个 dialog 去搭整棵 provider 树，
 * 故按仓库既有惯例（见 `CreateRoomPane.test.ts` / `AccountSettings.test.ts`）
 * 局部替换 `useDialog`，其余 naive-ui 导出保持真实。
 */
vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useDialog: () => ({
      warning: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      create: vi.fn()
    })
  }
})

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    startRtcCall: startRtcCallMock
  })
}))

describe('ChatHeaderRoot 通话按钮接线 (#5)', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    useGlobalStore(pinia).currentSessionRoomId = '!room:example.com'
  })

  const mountComponent = () =>
    mount(ChatHeaderRoot, {
      global: {
        plugins: [pinia],
        stubs: {
          ChatHeaderInfo: true,
          ChatHeaderToolbar: true,
          ChatHeaderSidebar: true,
          'n-modal': true
        }
      }
    })

  it('语音通话按钮接 startRtcCall(AUDIO)', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleStartVoiceCall: () => Promise<void> }).handleStartVoiceCall()

    expect(startRtcCallMock).toHaveBeenCalledTimes(1)
    expect(startRtcCallMock).toHaveBeenCalledWith(CallTypeEnum.AUDIO)
  })

  it('视频通话按钮接 startRtcCall(VIDEO)', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleStartVideoCall: () => Promise<void> }).handleStartVideoCall()

    expect(startRtcCallMock).toHaveBeenCalledTimes(1)
    expect(startRtcCallMock).toHaveBeenCalledWith(CallTypeEnum.VIDEO)
  })

  it('屏幕共享按钮复用视频通话窗口 startRtcCall(VIDEO)', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleScreenShare: () => Promise<void> }).handleScreenShare()

    expect(startRtcCallMock).toHaveBeenCalledTimes(1)
    expect(startRtcCallMock).toHaveBeenCalledWith(CallTypeEnum.VIDEO)
  })

  it('缺少会话房间时静默返回，不发起通话', async () => {
    useGlobalStore(pinia).currentSessionRoomId = ''

    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleStartVideoCall: () => Promise<void> }).handleStartVideoCall()

    expect(startRtcCallMock).not.toHaveBeenCalled()
  })
})
