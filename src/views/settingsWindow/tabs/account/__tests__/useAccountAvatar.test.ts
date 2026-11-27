import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openMock, readFileMock, showFeedbackMock, imageBehavior } = vi.hoisted(() => ({
  openMock: vi.fn(),
  readFileMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  imageBehavior: { mode: 'load' as 'load' | 'error' }
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => openMock(...args)
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: (...args: unknown[]) => readFileMock(...args)
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    getMediaUrl: vi.fn(() => ''),
    uploadImage: vi.fn()
  }
}))

vi.mock('@/composables/common/useWindowSessionReady', () => ({
  useWindowSessionReady: () => ({
    ready: { value: true },
    ensureSessionReady: vi.fn().mockResolvedValue('ready')
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    currentUserAvatarUrl: '',
    matrixProfile: null,
    fetchUserProfile: vi.fn(),
    updateAvatar: vi.fn()
  })
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { clearCache: vi.fn() }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/assets/img/win.png', () => ({
  default: 'default-avatar.png'
}))

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => {
      if (imageBehavior.mode === 'load') this.onload?.()
      else this.onerror?.()
    })
  }
}

class MockFileReader {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  readAsDataURL(blob: Blob) {
    this.result = `data:${blob.type};base64,AAAA`
    queueMicrotask(() => this.onload?.())
  }
}

describe('useAccountAvatar 设置页头像选择', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    imageBehavior.mode = 'load'
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('FileReader', MockFileReader)
    openMock.mockResolvedValue('/Users/test/avatar.png')
    readFileMock.mockResolvedValue(new Uint8Array([137, 80, 78, 71]))
  })

  it('把选中的文件读成 data URL 后再交给裁剪器，而不是 asset URL', async () => {
    const { useAccountAvatar } = await import('../useAccountAvatar')
    const avatar = useAccountAvatar()

    avatar.handleAvatarChange()
    await flushPromises()
    await flushPromises()

    expect(readFileMock).toHaveBeenCalledWith('/Users/test/avatar.png')
    expect(avatar.localImageUrl.value.startsWith('data:image/png;base64,')).toBe(true)
    expect(avatar.showCropper.value).toBe(true)
  })

  it('图片无法解码时不打开裁剪器并给出提示', async () => {
    imageBehavior.mode = 'error'
    const { useAccountAvatar } = await import('../useAccountAvatar')
    const avatar = useAccountAvatar()

    avatar.handleAvatarChange()
    await flushPromises()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('setting.account.avatar_format_invalid', 'error')
    expect(avatar.showCropper.value).toBe(false)
    expect(avatar.localImageUrl.value).toBe('')
  })
})
