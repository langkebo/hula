import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { MsgEnum } from '@/enums'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readImage: vi.fn(),
  readText: vi.fn()
}))

vi.mock('@/utils/ImageUtils.ts', () => ({
  processClipboardImage: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

import { readImage, readText } from '@tauri-apps/plugin-clipboard-manager'
import { processClipboardImage } from '@/utils/ImageUtils.ts'
import { useClipboardPaste } from '../useClipboardPaste'

const makeOptions = () => {
  const dom = document.createElement('div')
  document.body.appendChild(dom)
  return {
    messageInputDom: ref(dom),
    imgPaste: vi.fn(),
    insertNode: vi.fn(),
    triggerInputEvent: vi.fn(),
    dom
  }
}

describe('useClipboardPaste', () => {
  let alertMock: ReturnType<typeof vi.fn>
  let originalAlert: typeof window.alert | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    alertMock = vi.fn()
    originalAlert = window.alert
    ;(window as unknown as { alert: typeof alertMock }).alert = alertMock
  })

  afterEach(() => {
    if (originalAlert) {
      window.alert = originalAlert
    } else {
      delete (window as unknown as { alert?: unknown }).alert
    }
  })

  it('menuList exposes five entries with paste item bound to handler', () => {
    const opts = makeOptions()
    const { menuList, handlePaste } = useClipboardPaste(opts)
    expect(menuList.value).toHaveLength(5)
    expect(menuList.value[2].click).toBe(handlePaste)
    expect(menuList.value[0].disabled).toBe(true)
    expect(menuList.value[1].disabled).toBe(true)
    expect(menuList.value[3].disabled).toBe(true)
  })

  it('handlePaste routes a clipboard image through imgPaste', async () => {
    const opts = makeOptions()
    const fakeFile = new File(['hi'], 'clip.png', { type: 'image/png' })
    vi.mocked(readImage).mockResolvedValueOnce({} as never)
    vi.mocked(processClipboardImage).mockResolvedValueOnce(fakeFile)

    const { handlePaste } = useClipboardPaste(opts)
    await handlePaste()
    await nextTick()

    expect(opts.imgPaste).toHaveBeenCalledWith(fakeFile, opts.dom)
    expect(opts.insertNode).not.toHaveBeenCalled()
    expect(alertMock).not.toHaveBeenCalled()
  })

  it('handlePaste falls back to readText when no image', async () => {
    const opts = makeOptions()
    vi.mocked(readImage).mockResolvedValueOnce(null as never)
    vi.mocked(readText).mockResolvedValueOnce('hello world')

    const { handlePaste } = useClipboardPaste(opts)
    await handlePaste()
    await nextTick()

    expect(opts.insertNode).toHaveBeenCalledWith(MsgEnum.TEXT, 'hello world', opts.dom)
    expect(opts.triggerInputEvent).toHaveBeenCalledWith(opts.dom)
    expect(opts.imgPaste).not.toHaveBeenCalled()
  })

  it('handlePaste alerts user when both image and text read fail', async () => {
    const opts = makeOptions()
    vi.mocked(readImage).mockResolvedValueOnce(null as never)
    vi.mocked(readText).mockResolvedValueOnce(null as never)

    const { handlePaste } = useClipboardPaste(opts)
    await handlePaste()

    expect(alertMock).toHaveBeenCalledTimes(1)
    expect(opts.imgPaste).not.toHaveBeenCalled()
    expect(opts.insertNode).not.toHaveBeenCalled()
  })

  it('handlePaste swallows processClipboardImage failure and tries text', async () => {
    const opts = makeOptions()
    vi.mocked(readImage).mockResolvedValueOnce({} as never)
    vi.mocked(processClipboardImage).mockRejectedValueOnce(new Error('decode'))
    vi.mocked(readText).mockResolvedValueOnce('fallback text')

    const { handlePaste } = useClipboardPaste(opts)
    await handlePaste()
    await nextTick()

    expect(opts.insertNode).toHaveBeenCalledWith(MsgEnum.TEXT, 'fallback text', opts.dom)
  })

  it('handlePaste is a no-op when messageInputDom is empty', async () => {
    const opts = {
      messageInputDom: ref<HTMLElement | null>(null),
      imgPaste: vi.fn(),
      insertNode: vi.fn(),
      triggerInputEvent: vi.fn()
    }
    const { handlePaste } = useClipboardPaste(opts)
    await handlePaste()

    expect(readImage).not.toHaveBeenCalled()
    expect(readText).not.toHaveBeenCalled()
    expect(opts.imgPaste).not.toHaveBeenCalled()
  })
})
