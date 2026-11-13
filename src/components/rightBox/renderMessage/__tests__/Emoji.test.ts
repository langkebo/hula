import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmojiMessage from '../Emoji.vue'

const { settingState } = vi.hoisted(() => ({
  settingState: { emojiSize: 'medium' as 'small' | 'medium' | 'large' }
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}))

vi.mock('@/composables/common/useImageViewer', () => ({
  useImageViewer: () => ({ openImageViewer: vi.fn() })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingState
}))

vi.mock('@/stores/domains/widget/thumbnailCache', () => ({
  useThumbnailCacheStore: () => ({ enqueueThumbnail: vi.fn() })
}))

vi.mock('@/utils/PathUtil', () => ({
  getRemoteFileSize: vi.fn().mockResolvedValue(null),
  safeExistsPath: vi.fn().mockResolvedValue(false)
}))

const mountEmoji = () =>
  mount(EmojiMessage, {
    props: { body: { url: 'https://example.com/emoji.png' } as never }
  })

/** 读取表情消息渲染出的图片与占位块尺寸上限 */
const readSizes = async () => {
  const wrapper = mountEmoji()
  await flushPromises()
  const imgStyle = wrapper.find('.msg-emoji img').attributes('style') ?? ''
  const placeholderStyle = wrapper.find('.msg-emoji .n-flex').attributes('style') ?? ''
  wrapper.unmount()
  return { imgStyle, placeholderStyle }
}

describe('Emoji.vue - 表情大小设置', () => {
  beforeEach(() => {
    settingState.emojiSize = 'medium'
  })

  it('medium（默认）沿用历史 120px 上限', async () => {
    const { imgStyle, placeholderStyle } = await readSizes()

    expect(imgStyle).toContain('max-width: 120px')
    expect(imgStyle).toContain('max-height: 120px')
    expect(placeholderStyle).toContain('width: 120px')
  })

  it('small 缩小到 80px', async () => {
    settingState.emojiSize = 'small'
    const { imgStyle, placeholderStyle } = await readSizes()

    expect(imgStyle).toContain('max-width: 80px')
    expect(placeholderStyle).toContain('width: 80px')
  })

  it('large 放大到 160px', async () => {
    settingState.emojiSize = 'large'
    const { imgStyle, placeholderStyle } = await readSizes()

    expect(imgStyle).toContain('max-width: 160px')
    expect(placeholderStyle).toContain('width: 160px')
  })
})
