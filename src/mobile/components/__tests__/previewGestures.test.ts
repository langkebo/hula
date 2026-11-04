import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ImagePreview from '../ImagePreview.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: vi.fn() }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    currentSessionInfo: null,
    getMessage: () => undefined,
    clearMsgCheck: vi.fn(),
    setMsgMultiChoose: vi.fn()
  })
}))

vi.mock('@/stores/domains/widget/file', () => ({
  useFileStore: () => ({ addFile: vi.fn() })
}))

vi.mock('@/stores/domains/widget/fileDownload', () => ({
  useFileDownloadStore: () => ({
    downloadFile: vi.fn(),
    downloadEncryptedFile: vi.fn(),
    getFileStatus: () => ({})
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() })
}))

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

const DOUBLE_TAP_MS = 300

type Point = { clientX: number; clientY: number }

const fireTouch = async (element: Element, type: string, points: Point[]) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: points, configurable: true })
  element.dispatchEvent(event)
  await nextTick()
}

const tap = async (element: Element) => {
  await fireTouch(element, 'touchstart', [{ clientX: 0, clientY: 0 }])
  await fireTouch(element, 'touchend', [])
}

const styleOfImage = (wrapper: ReturnType<typeof mount>) => wrapper.find('img').attributes('style') ?? ''

describe('preview gestures', () => {
  it('image preview does not close on tap while zoomed', () => {
    const source = read('src/mobile/components/ImagePreview.vue')
    expect(source).toContain('handleBackdropClick')
    expect(source).not.toContain('@click="handleClose"')
    expect(source).toContain('DOUBLE_TAP_SCALE')
    expect(source).toContain('CLOSE_DRAG_PX')
  })

  it('video preview ships native controls', () => {
    const source = read('src/mobile/components/VideoPreview.vue')
    expect(source).toContain('controls')
  })
})

describe('image preview tap behaviour', () => {
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    vi.useFakeTimers()
    wrapper = mount(ImagePreview, {
      props: { visible: true, imageUrl: 'blob:test-image' },
      global: { stubs: { teleport: true } }
    })
  })

  afterEach(() => {
    wrapper.unmount()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  const surface = () => wrapper.find('.touch-none > div')

  it('双击放大且不关闭，transform 切换到 scale(2.5)', async () => {
    await tap(surface().element)
    vi.advanceTimersByTime(100)
    await tap(surface().element)

    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(styleOfImage(wrapper)).toContain('scale(2.5)')

    vi.advanceTimersByTime(DOUBLE_TAP_MS * 2)
    await nextTick()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
  })

  it('单击不会立刻关闭，合成 click 被忽略，等待 DOUBLE_TAP_MS 后才关闭', async () => {
    await tap(surface().element)
    await wrapper.find('.touch-none').trigger('click')

    vi.advanceTimersByTime(DOUBLE_TAP_MS - 1)
    await nextTick()
    expect(wrapper.emitted('update:visible')).toBeUndefined()

    vi.advanceTimersByTime(2)
    await nextTick()
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('触摸工具栏按钮不会触发预览关闭', async () => {
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    await fireTouch(button.element, 'touchstart', [{ clientX: 0, clientY: 0 }])
    await fireTouch(button.element, 'touchend', [])

    vi.advanceTimersByTime(DOUBLE_TAP_MS * 2)
    await nextTick()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
  })

  it('放大态双击可复位到 scale(1)，随后单击关闭', async () => {
    await tap(surface().element)
    vi.advanceTimersByTime(100)
    await tap(surface().element)
    expect(styleOfImage(wrapper)).toContain('scale(2.5)')

    vi.advanceTimersByTime(DOUBLE_TAP_MS * 2)
    await tap(surface().element)
    vi.advanceTimersByTime(100)
    await tap(surface().element)

    expect(styleOfImage(wrapper)).toContain('scale(1)')
    vi.advanceTimersByTime(DOUBLE_TAP_MS * 2)
    expect(wrapper.emitted('update:visible')).toBeUndefined()

    await tap(surface().element)
    vi.advanceTimersByTime(DOUBLE_TAP_MS)
    await nextTick()
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })
})
