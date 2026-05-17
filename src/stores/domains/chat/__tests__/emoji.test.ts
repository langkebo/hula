import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useEmojiStore } from '../emoji'

const { emojiUpload, emojiList, showFeedbackMock } = vi.hoisted(() => ({
  emojiUpload: vi.fn(),
  emojiList: vi.fn(),
  showFeedbackMock: vi.fn()
}))

const mockUserStore = reactive({
  userInfo: {
    uid: '@user:server'
  }
})

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((value: string) => value)
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(),
  join: vi.fn(),
  resourceDir: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 'AppData',
    Resource: 'Resource'
  },
  exists: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => mockUserStore
}))

vi.mock('@/services/matrix/messaging/MatrixEmojiService', () => ({
  matrixEmojiService: {
    emojiUpload,
    emojiList
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn()
  })
}))

vi.mock('@/utils/PathUtil', () => ({
  detectRemoteFileType: vi.fn(),
  getUserEmojiDir: vi.fn()
}))

vi.mock('@/utils/Md5Util', () => ({
  md5FromString: vi.fn()
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: vi.fn(() => false)
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

describe('EmojiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    emojiUpload.mockReset().mockResolvedValue({
      id: 'emoji1',
      name: 'custom_emoji',
      url: 'https://example.com/emoji.webp',
      mxcUrl: 'mxc://example/emoji1'
    })
    emojiList.mockReset().mockResolvedValue([])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        blob: vi.fn().mockResolvedValue(new Blob(['emoji'], { type: 'image/webp' })),
        headers: {
          get: vi.fn(() => 'image/webp')
        }
      })
    )
  })

  it('uploads a real File when adding emoji from remote image url', async () => {
    const store = useEmojiStore()

    const result = await store.addEmoji('https://example.com/emoji.webp')

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://example.com/emoji.webp')
    expect(emojiUpload).toHaveBeenCalledTimes(1)
    const [file, name] = emojiUpload.mock.calls[0]
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/webp')
    expect(file.name).toBe('custom_emoji.webp')
    expect(name).toBe('custom_emoji')
    expect(showFeedbackMock).toHaveBeenCalledWith('添加表情成功', 'success')
  })
})
