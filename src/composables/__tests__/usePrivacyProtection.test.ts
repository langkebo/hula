import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const userStoreMock = reactive<{
  userInfo?: { name?: string; uid?: string }
}>({
  userInfo: undefined
})

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({})
}))

const { usePrivacyProtection } = await import('@/composables/usePrivacyProtection')

describe('usePrivacyProtection', () => {
  beforeEach(() => {
    userStoreMock.userInfo = undefined
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T10:30:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('isPrivacyMode', () => {
    it('初始状态为 false', () => {
      const { isPrivacyMode } = usePrivacyProtection()
      expect(isPrivacyMode.value).toBe(false)
    })

    it('enterPrivateChat 后 isPrivacyMode 变为 true', () => {
      const { isPrivacyMode, enterPrivateChat } = usePrivacyProtection()
      expect(isPrivacyMode.value).toBe(false)
      enterPrivateChat()
      expect(isPrivacyMode.value).toBe(true)
    })

    it('leavePrivateChat 后 isPrivacyMode 变回 false', () => {
      const { isPrivacyMode, enterPrivateChat, leavePrivateChat } = usePrivacyProtection()
      enterPrivateChat()
      expect(isPrivacyMode.value).toBe(true)
      leavePrivateChat()
      expect(isPrivacyMode.value).toBe(false)
    })

    it('交替调用 enter/leave 时 isPrivacyMode 正确切换', () => {
      const { isPrivacyMode, enterPrivateChat, leavePrivateChat } = usePrivacyProtection()
      enterPrivateChat()
      expect(isPrivacyMode.value).toBe(true)
      leavePrivateChat()
      expect(isPrivacyMode.value).toBe(false)
      enterPrivateChat()
      expect(isPrivacyMode.value).toBe(true)
    })
  })

  describe('settings', () => {
    it('非私密模式下 watermarkEnabled 为 false', () => {
      const { settings } = usePrivacyProtection()
      expect(settings.value.watermarkEnabled).toBe(false)
    })

    it('私密模式下 watermarkEnabled 为 true', () => {
      const { settings, enterPrivateChat } = usePrivacyProtection()
      enterPrivateChat()
      expect(settings.value.watermarkEnabled).toBe(true)
    })

    it('非私密模式下 blockScreenshot 为 false', () => {
      const { settings } = usePrivacyProtection()
      expect(settings.value.blockScreenshot).toBe(false)
    })

    it('私密模式下 blockScreenshot 为 true', () => {
      const { settings, enterPrivateChat } = usePrivacyProtection()
      enterPrivateChat()
      expect(settings.value.blockScreenshot).toBe(true)
    })

    it('非私密模式下 blurEffect 为 false', () => {
      const { settings } = usePrivacyProtection()
      expect(settings.value.blurEffect).toBe(false)
    })
  })

  describe('enterPrivateChat / leavePrivateChat', () => {
    it('enterPrivateChat 调用 onPrivacyChange 回调并传入 true', () => {
      const onPrivacyChange = vi.fn()
      const { enterPrivateChat } = usePrivacyProtection({ onPrivacyChange })
      enterPrivateChat()
      expect(onPrivacyChange).toHaveBeenCalledTimes(1)
      expect(onPrivacyChange).toHaveBeenCalledWith(true)
    })

    it('leavePrivateChat 调用 onPrivacyChange 回调并传入 false', () => {
      const onPrivacyChange = vi.fn()
      const { leavePrivateChat } = usePrivacyProtection({ onPrivacyChange })
      leavePrivateChat()
      expect(onPrivacyChange).toHaveBeenCalledTimes(1)
      expect(onPrivacyChange).toHaveBeenCalledWith(false)
    })

    it('未提供 onPrivacyChange 时 enterPrivateChat 不抛错', () => {
      const { enterPrivateChat } = usePrivacyProtection()
      expect(() => enterPrivateChat()).not.toThrow()
    })

    it('未提供 onPrivacyChange 时 leavePrivateChat 不抛错', () => {
      const { leavePrivateChat } = usePrivacyProtection()
      expect(() => leavePrivateChat()).not.toThrow()
    })

    it('未提供 options 时 enterPrivateChat 不抛错', () => {
      const { enterPrivateChat } = usePrivacyProtection()
      expect(() => enterPrivateChat()).not.toThrow()
    })

    it('未提供 options 时 leavePrivateChat 不抛错', () => {
      const { leavePrivateChat } = usePrivacyProtection()
      expect(() => leavePrivateChat()).not.toThrow()
    })

    it('交替调用 enter/leave 时回调分别收到 true/false', () => {
      const onPrivacyChange = vi.fn()
      const { enterPrivateChat, leavePrivateChat } = usePrivacyProtection({ onPrivacyChange })
      enterPrivateChat()
      leavePrivateChat()
      enterPrivateChat()
      expect(onPrivacyChange).toHaveBeenNthCalledWith(1, true)
      expect(onPrivacyChange).toHaveBeenNthCalledWith(2, false)
      expect(onPrivacyChange).toHaveBeenNthCalledWith(3, true)
      expect(onPrivacyChange).toHaveBeenCalledTimes(3)
    })
  })

  describe('generateWatermark', () => {
    it('userInfo 存在时返回 "name(uid) timestamp" 格式', () => {
      userStoreMock.userInfo = { name: 'Alice', uid: '@alice:server' }
      const { generateWatermark } = usePrivacyProtection()
      const watermark = generateWatermark()
      expect(watermark).toContain('Alice')
      expect(watermark).toContain('(@alice:server)')
    })

    it('userInfo 为 undefined 时使用空字符串作为 name/uid', () => {
      userStoreMock.userInfo = undefined
      const { generateWatermark } = usePrivacyProtection()
      const watermark = generateWatermark()
      expect(watermark).toContain('()')
    })

    it('userInfo.name 为空时水印中包含空 name', () => {
      userStoreMock.userInfo = { name: '', uid: '@user:server' }
      const { generateWatermark } = usePrivacyProtection()
      const watermark = generateWatermark()
      expect(watermark).toContain('(@user:server)')
      expect(watermark.startsWith('(@user:server)')).toBe(true)
    })

    it('userInfo.uid 为空时水印中包含空 uid 括号', () => {
      userStoreMock.userInfo = { name: 'Bob', uid: '' }
      const { generateWatermark } = usePrivacyProtection()
      const watermark = generateWatermark()
      expect(watermark).toContain('Bob()')
    })

    it('水印包含时间戳', () => {
      userStoreMock.userInfo = { name: 'Alice', uid: '@alice:server' }
      const { generateWatermark } = usePrivacyProtection()
      const watermark = generateWatermark()
      expect(watermark.length).toBeGreaterThan('Alice(@alice:server) '.length)
    })

    it('不同时间点生成的水印不同', () => {
      userStoreMock.userInfo = { name: 'Alice', uid: '@alice:server' }
      const { generateWatermark } = usePrivacyProtection()
      const w1 = generateWatermark()
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'))
      const w2 = generateWatermark()
      expect(w2).not.toBe(w1)
    })
  })
})
