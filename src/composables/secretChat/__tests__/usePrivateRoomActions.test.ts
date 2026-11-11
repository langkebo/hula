import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'

// 真实语言表驱动：若源码引用了不存在的 i18n 键，断言里会看到裸 key
vi.mock('vue-i18n', () => createI18nMock())

// vi.mock 会被提升到文件顶部，工厂里引用顶层 const 会 TDZ 报错，必须用 vi.hoisted
const mocks = vi.hoisted(() => ({
  showFeedback: vi.fn(),
  openUnlock: vi.fn(),
  markRoomPrivate: vi.fn(),
  unmarkRoomPrivate: vi.fn(),
  isPrivateRoom: vi.fn(),
  updateSession: vi.fn(),
  invoke: vi.fn(),
  hasTauriRuntime: vi.fn(),
  isRoomEncrypted: vi.fn(),
  getRoomEncryptionState: vi.fn(),
  enableEncryption: vi.fn(),
  state: { configured: true, unlocked: true }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))
vi.mock('@/composables/secretChat/useSecretChatGate', () => ({
  openSecretChatUnlock: mocks.openUnlock
}))
vi.mock('@/services/matrix/privateChat/privateRoomRegistry', () => ({
  isPrivateRoom: mocks.isPrivateRoom,
  markRoomPrivate: mocks.markRoomPrivate,
  unmarkRoomPrivate: mocks.unmarkRoomPrivate
}))
vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ isSecretChatConfigured: () => mocks.state.configured })
}))
vi.mock('@/stores/domains/settings/secretChatSession', () => ({
  isSecretChatUnlocked: () => mocks.state.unlocked
}))
vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ updateSession: mocks.updateSession })
}))
vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: mocks.hasTauriRuntime }))
vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: {
    isRoomEncrypted: mocks.isRoomEncrypted,
    getRoomEncryptionState: mocks.getRoomEncryptionState,
    enableEncryption: mocks.enableEncryption
  }
}))
vi.mock('@/utils/TauriInvokeHandler', () => ({ invokeWithErrorHandler: mocks.invoke }))

import { RoomTypeEnum } from '@/enums'
import { resetPrivateRoomEncryptionMemoryForTests, usePrivateRoomActions } from '../usePrivateRoomActions'

const SINGLE_ROOM = '!dm:example.com'
const PRIVATE_ROOM = '!private:example.com'

const session = (type: RoomTypeEnum = RoomTypeEnum.SINGLE) => ({ roomId: SINGLE_ROOM, type }) as any

describe('usePrivateRoomActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPrivateRoomEncryptionMemoryForTests()
    mocks.state.configured = true
    mocks.state.unlocked = true
    mocks.isPrivateRoom.mockReturnValue(false)
    mocks.hasTauriRuntime.mockReturnValue(false)
    mocks.markRoomPrivate.mockResolvedValue(undefined)
    mocks.unmarkRoomPrivate.mockResolvedValue(undefined)
    mocks.invoke.mockResolvedValue(undefined)
    mocks.isRoomEncrypted.mockResolvedValue(true)
    mocks.getRoomEncryptionState.mockResolvedValue('encrypted')
    mocks.enableEncryption.mockResolvedValue(undefined)
  })

  it('未设置密码时拒绝标记并提示（不做任何写入）', async () => {
    mocks.state.configured = false
    const { togglePrivateRoom } = usePrivateRoomActions()

    expect(await togglePrivateRoom(session())).toBe(false)
    expect(mocks.showFeedback).toHaveBeenCalledWith('请先在设置中设置私密聊天密码', 'warning')
    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('已配置但未解锁时拒绝标记，并唤起解锁框', async () => {
    mocks.state.unlocked = false
    const { togglePrivateRoom } = usePrivateRoomActions()

    expect(await togglePrivateRoom(session())).toBe(false)
    expect(mocks.openUnlock).toHaveBeenCalledTimes(1)
    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
  })

  it('群聊不允许标记为私密（成员不可控，否则是假承诺）', async () => {
    const { togglePrivateRoom } = usePrivateRoomActions()

    expect(await togglePrivateRoom(session(RoomTypeEnum.GROUP))).toBe(false)
    expect(mocks.showFeedback).toHaveBeenCalledWith('私密聊天仅支持单聊会话', 'warning')
    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
  })

  it('标记成功时写登记表，并同步 hide 兼容镜像', async () => {
    const { togglePrivateRoom } = usePrivateRoomActions()

    expect(await togglePrivateRoom(session())).toBe(true)
    expect(mocks.markRoomPrivate).toHaveBeenCalledWith(SINGLE_ROOM)
    expect(mocks.unmarkRoomPrivate).not.toHaveBeenCalled()
    expect(mocks.updateSession).toHaveBeenCalledWith(SINGLE_ROOM, { hide: true })
    expect(mocks.showFeedback).toHaveBeenCalledWith('已设置为私密聊天', 'success')
  })

  it('已标记时走取消标记，并把 hide 复位', async () => {
    mocks.isPrivateRoom.mockReturnValue(true)
    const { togglePrivateRoom } = usePrivateRoomActions()

    expect(await togglePrivateRoom(session())).toBe(true)
    expect(mocks.unmarkRoomPrivate).toHaveBeenCalledWith(SINGLE_ROOM)
    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
    expect(mocks.updateSession).toHaveBeenCalledWith(SINGLE_ROOM, { hide: false })
  })

  it('Tauri 环境额外同步本地 SQLite 的 hide 标志', async () => {
    mocks.hasTauriRuntime.mockReturnValue(true)
    const { togglePrivateRoom } = usePrivateRoomActions()

    await togglePrivateRoom(session())
    expect(mocks.invoke).toHaveBeenCalledWith('hide_contact_command', {
      data: { roomId: SINGLE_ROOM, hide: true }
    })
  })

  it('非 Tauri 环境不调用本地命令（移动端无此命令）', async () => {
    const { togglePrivateRoom } = usePrivateRoomActions()

    await togglePrivateRoom(session())
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('登记表写入失败时提示错误且不改本地会话状态', async () => {
    mocks.markRoomPrivate.mockRejectedValueOnce(new Error('account data unavailable'))
    const { togglePrivateRoom } = usePrivateRoomActions()

    expect(await togglePrivateRoom(session())).toBe(false)
    expect(mocks.showFeedback).toHaveBeenCalledWith('Error: account data unavailable', 'error')
    expect(mocks.updateSession).not.toHaveBeenCalled()
  })

  it('未加密的房间在设为私密前会开启加密', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(false)
    const { togglePrivateRoom } = usePrivateRoomActions()

    const ok = await togglePrivateRoom(session())

    expect(mocks.enableEncryption).toHaveBeenCalledWith(SINGLE_ROOM)
    expect(mocks.markRoomPrivate).toHaveBeenCalledWith(SINGLE_ROOM)
    expect(mocks.showFeedback).toHaveBeenCalledWith('已设为私密聊天，并开启端到端加密', 'success')
    expect(ok).toBe(true)
  })

  it('用户拒绝开启加密时放弃设为私密', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(false)
    const confirmEnableEncryption = vi.fn().mockResolvedValue(false)
    const { togglePrivateRoom } = usePrivateRoomActions()

    const ok = await togglePrivateRoom(session(), { confirmEnableEncryption })

    expect(confirmEnableEncryption).toHaveBeenCalledTimes(1)
    expect(mocks.enableEncryption).not.toHaveBeenCalled()
    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
    expect(ok).toBe(false)
  })

  it('开启加密失败时不写私密标记', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(false)
    mocks.enableEncryption.mockRejectedValueOnce(new Error('power level too low'))
    const { togglePrivateRoom } = usePrivateRoomActions()

    const ok = await togglePrivateRoom(session())

    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
    expect(ok).toBe(false)
  })

  it('本地加密状态生效后才标记私密（跨 sync 的窗口期不外泄明文）', async () => {
    vi.useFakeTimers()
    try {
      mocks.isRoomEncrypted.mockResolvedValueOnce(false)
      mocks.getRoomEncryptionState.mockResolvedValueOnce('unknown').mockResolvedValueOnce('encrypted')
      const { togglePrivateRoom } = usePrivateRoomActions()

      const pending = togglePrivateRoom(session())
      await vi.advanceTimersByTimeAsync(1000)

      expect(await pending).toBe(true)
      expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(2)
      expect(mocks.markRoomPrivate).toHaveBeenCalledWith(SINGLE_ROOM)
      expect(mocks.showFeedback).toHaveBeenCalledWith('已设为私密聊天，并开启端到端加密', 'success')
    } finally {
      vi.useRealTimers()
    }
  })

  it('加密已提交但本地状态超时未生效时，不标记私密并提示稍后重试', async () => {
    vi.useFakeTimers()
    try {
      mocks.isRoomEncrypted.mockResolvedValueOnce(false)
      mocks.getRoomEncryptionState.mockResolvedValue('unknown')
      const { togglePrivateRoom } = usePrivateRoomActions()

      const pending = togglePrivateRoom(session())
      await vi.advanceTimersByTimeAsync(5000)

      expect(await pending).toBe(false)
      expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(5)
      expect(mocks.enableEncryption).toHaveBeenCalledWith(SINGLE_ROOM)
      expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
      expect(mocks.updateSession).not.toHaveBeenCalled()
      expect(mocks.showFeedback).toHaveBeenCalledWith(
        '端到端加密已提交但尚未生效，请稍后重试；本次未设为私密',
        'warning'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('超时后重试不再重复确认、不重发 state event，直接等待生效', async () => {
    vi.useFakeTimers()
    try {
      mocks.isRoomEncrypted.mockResolvedValue(false)
      mocks.getRoomEncryptionState.mockResolvedValue('plaintext')
      const confirmEnableEncryption = vi.fn().mockResolvedValue(true)
      const { togglePrivateRoom } = usePrivateRoomActions()

      const first = togglePrivateRoom(session(), { confirmEnableEncryption })
      await vi.advanceTimersByTimeAsync(5000)
      expect(await first).toBe(false)

      mocks.getRoomEncryptionState.mockResolvedValue('encrypted')
      expect(await togglePrivateRoom(session(), { confirmEnableEncryption })).toBe(true)

      expect(confirmEnableEncryption).toHaveBeenCalledTimes(1)
      expect(mocks.enableEncryption).toHaveBeenCalledTimes(1)
      expect(mocks.markRoomPrivate).toHaveBeenCalledTimes(1)
      expect(mocks.showFeedback).toHaveBeenLastCalledWith('已设为私密聊天，并开启端到端加密', 'success')
    } finally {
      vi.useRealTimers()
    }
  })

  it('同一房间切换在途时，重复触发直接忽略（不重复确认、不重复发 state event）', async () => {
    let resolveState!: (value: string) => void
    mocks.isRoomEncrypted.mockResolvedValueOnce(false)
    mocks.getRoomEncryptionState.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveState = resolve
      })
    )
    const confirmEnableEncryption = vi.fn().mockResolvedValue(true)
    const { togglePrivateRoom } = usePrivateRoomActions()

    const first = togglePrivateRoom(session(), { confirmEnableEncryption })
    const second = await togglePrivateRoom(session(), { confirmEnableEncryption })

    expect(second).toBe(false)

    await vi.waitFor(() => expect(mocks.getRoomEncryptionState).toHaveBeenCalledTimes(1))
    resolveState('encrypted')
    expect(await first).toBe(true)
    expect(confirmEnableEncryption).toHaveBeenCalledTimes(1)
    expect(mocks.enableEncryption).toHaveBeenCalledTimes(1)
    expect(mocks.markRoomPrivate).toHaveBeenCalledTimes(1)
  })

  it('已加密房间不再重复开启加密', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(true)
    const { togglePrivateRoom } = usePrivateRoomActions()

    await togglePrivateRoom(session())

    expect(mocks.enableEncryption).not.toHaveBeenCalled()
    expect(mocks.markRoomPrivate).toHaveBeenCalledWith(SINGLE_ROOM)
  })

  it('取消私密不会关闭房间加密', async () => {
    mocks.isPrivateRoom.mockReturnValue(true)
    const { togglePrivateRoom } = usePrivateRoomActions()

    await togglePrivateRoom({ roomId: PRIVATE_ROOM, type: RoomTypeEnum.SINGLE } as any)

    expect(mocks.unmarkRoomPrivate).toHaveBeenCalledWith(PRIVATE_ROOM)
    expect(mocks.enableEncryption).not.toHaveBeenCalled()
  })
})
