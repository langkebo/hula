import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showFeedbackMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn()
}))

const writeImage = vi.fn()
const writeText = vi.fn()
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeImage: (...a: unknown[]) => writeImage(...a),
  writeText: (...a: unknown[]) => writeText(...a)
}))

const isImageUrlMock = vi.fn()
const detectImageFormatMock = vi.fn()
const imageUrlToUint8ArrayMock = vi.fn()
vi.mock('@/utils/ImageUtils', () => ({
  isImageUrl: (...a: unknown[]) => isImageUrlMock(...a),
  detectImageFormat: (...a: unknown[]) => detectImageFormatMock(...a),
  imageUrlToUint8Array: (...a: unknown[]) => imageUrlToUint8ArrayMock(...a)
}))

vi.mock('@/utils/Formatting', () => ({
  removeTag: (s: string) => s.replace(/<[^>]+>/g, '')
}))

const getSelectedTextMock = vi.fn()
vi.mock('../selectionUtils', () => ({
  getSelectedText: (...a: unknown[]) => getSelectedTextMock(...a)
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

const { useChatCopy } = await import('../useChatCopy')

describe('useChatCopy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('warns and returns when content is empty and no selection', async () => {
    getSelectedTextMock.mockReturnValue('')
    const { handleCopy } = useChatCopy()
    await handleCopy(undefined)
    expect(showFeedbackMock).toHaveBeenCalledWith('没有可复制的内容', 'warning')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('prefers selected text over fallback content', async () => {
    getSelectedTextMock.mockReturnValue('picked')
    isImageUrlMock.mockReturnValue(false)
    const { handleCopy } = useChatCopy()
    await handleCopy('fallback', true, 'msg-1')

    expect(writeText).toHaveBeenCalledWith('picked')
    expect(showFeedbackMock).toHaveBeenCalledWith('选中文本已复制', 'success')
  })

  it('copies fallback text when prioritizeSelection=false', async () => {
    getSelectedTextMock.mockReturnValue('picked')
    isImageUrlMock.mockReturnValue(false)
    const { handleCopy } = useChatCopy()
    await handleCopy('<b>hi</b>', false)

    expect(getSelectedTextMock).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('hi')
    expect(showFeedbackMock).toHaveBeenCalledWith('消息内容已复制', 'success')
  })

  it('copies image bytes and reports PNG message', async () => {
    getSelectedTextMock.mockReturnValue('')
    isImageUrlMock.mockReturnValue(true)
    detectImageFormatMock.mockReturnValue('PNG')
    imageUrlToUint8ArrayMock.mockResolvedValueOnce(new Uint8Array([1, 2, 3]))

    const { handleCopy } = useChatCopy()
    await handleCopy('https://host/img.png')

    expect(writeImage).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
    expect(showFeedbackMock).toHaveBeenCalledWith('图片已复制到剪贴板', 'success')
  })

  it('announces PNG conversion for GIF/WEBP and reports conversion message', async () => {
    getSelectedTextMock.mockReturnValue('')
    isImageUrlMock.mockReturnValue(true)
    detectImageFormatMock.mockReturnValue('GIF')
    imageUrlToUint8ArrayMock.mockResolvedValueOnce(new Uint8Array())

    const { handleCopy } = useChatCopy()
    await handleCopy('https://host/a.gif')

    expect(showFeedbackMock).toHaveBeenCalledWith('正在将 GIF 格式图片转换为 PNG 并复制...', 'info')
    expect(showFeedbackMock).toHaveBeenCalledWith('图片已转换为 PNG 格式并复制到剪贴板', 'success')
  })

  it('swallows image copy errors and does not crash', async () => {
    getSelectedTextMock.mockReturnValue('')
    isImageUrlMock.mockReturnValue(true)
    detectImageFormatMock.mockReturnValue('PNG')
    imageUrlToUint8ArrayMock.mockRejectedValueOnce(new Error('network'))

    const { handleCopy } = useChatCopy()
    await expect(handleCopy('https://host/img.png')).resolves.toBeUndefined()
    expect(writeImage).not.toHaveBeenCalled()
    expect(showFeedbackMock).not.toHaveBeenCalledWith('图片已复制到剪贴板', 'success')
  })
})
