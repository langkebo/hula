import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImageMessage from '../Image.vue'

const {
  openImageViewerMock,
  enqueueThumbnailMock,
  invalidateMock,
  checkFileExistsMock,
  getFileStatusMock,
  downloadEncryptedFileMock,
  getMessageMock,
  updateMsgMock,
  safeExistsPathMock,
  invokeSilentlyMock,
  isMobileMock
} = vi.hoisted(() => ({
  openImageViewerMock: vi.fn(),
  enqueueThumbnailMock: vi.fn(),
  invalidateMock: vi.fn(),
  checkFileExistsMock: vi.fn(),
  getFileStatusMock: vi.fn(),
  downloadEncryptedFileMock: vi.fn(),
  getMessageMock: vi.fn(),
  updateMsgMock: vi.fn(),
  safeExistsPathMock: vi.fn(),
  invokeSilentlyMock: vi.fn(),
  isMobileMock: vi.fn(() => false)
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}))

vi.mock('@/composables/common/useImageViewer', () => ({
  useImageViewer: () => ({
    openImageViewer: openImageViewerMock
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    getMessage: getMessageMock,
    updateMsg: updateMsgMock
  })
}))

vi.mock('@/stores/domains/widget/fileDownload', () => ({
  useFileDownloadStore: () => ({
    checkFileExists: checkFileExistsMock,
    getFileStatus: getFileStatusMock,
    downloadEncryptedFile: downloadEncryptedFileMock
  })
}))

vi.mock('@/stores/domains/widget/thumbnailCache', () => ({
  useThumbnailCacheStore: () => ({
    enqueueThumbnail: enqueueThumbnailMock,
    invalidate: invalidateMock
  })
}))

vi.mock('@/utils/Formatting', () => ({
  extractFileName: (url: string) => {
    const segment = url.split('/').pop() || ''
    return segment.includes('.') ? segment : 'file'
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/utils/PathUtil', () => ({
  safeExistsPath: safeExistsPathMock
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: isMobileMock
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeSilently: invokeSilentlyMock
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    NFlex: defineComponent({
      name: 'NFlex',
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NFlex' }, slots.default?.())
      }
    }),
    NImage: defineComponent({
      name: 'NImage',
      props: ['src', 'objectFit', 'previewDisabled', 'imgProps'],
      emits: ['click', 'dblclick', 'error'],
      setup(props, { emit }) {
        return () =>
          h('img', {
            'data-test': 'NImage',
            src: props.src as string,
            onClick: () => emit('click'),
            onDblclick: () => emit('dblclick'),
            onError: () => emit('error')
          })
      }
    })
  }
})

// jsdom/happy-dom 无 IntersectionObserver，提供最小 stub
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

describe('renderMessage/Image', () => {
  const baseMessage = {
    id: 'msg-1',
    roomId: '!room:server.test'
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
    isMobileMock.mockReturnValue(false)
    enqueueThumbnailMock.mockResolvedValue(null)
    safeExistsPathMock.mockResolvedValue(false)
    checkFileExistsMock.mockResolvedValue(false)
    getFileStatusMock.mockReturnValue({})
  })

  const mountComponent = (body: Record<string, unknown>, extraProps: Record<string, unknown> = {}) =>
    mount(ImageMessage, {
      props: {
        body,
        message: baseMessage,
        ...extraProps
      } as never
    })

  it('按原始宽高比缩放图片（宽度优先）', async () => {
    const wrapper = mountComponent({ url: 'mxc://server/img', width: 640, height: 240 })
    await flushPromises()

    const container = wrapper.find('.select-none')
    // 640/240 = 2.67 > 320/240 = 1.33，以宽度为基准：320 x 120
    expect(container.attributes('style')).toContain('width: 320px')
    expect(container.attributes('style')).toContain('height: 120px')
  })

  it('按原始宽高比缩放图片（高度优先）', async () => {
    const wrapper = mountComponent({ url: 'mxc://server/img', width: 200, height: 600 })
    await flushPromises()

    const container = wrapper.find('.select-none')
    // 200/600 = 0.33 < 1.33，以高度为基准：240 * 0.334 = 80 x 240
    expect(container.attributes('style')).toContain('height: 240px')
    expect(container.attributes('style')).toContain('width: 80px')
  })

  it('无原始尺寸时使用默认最大尺寸', async () => {
    const wrapper = mountComponent({ url: 'mxc://server/img' })
    await flushPromises()

    const container = wrapper.find('.select-none')
    expect(container.attributes('style')).toContain('width: 320px')
    expect(container.attributes('style')).toContain('height: 240px')
  })

  it('小于最小尺寸时提升到 60px', async () => {
    const wrapper = mountComponent({ url: 'mxc://server/img', width: 10, height: 10 })
    await flushPromises()

    const container = wrapper.find('.select-none')
    expect(container.attributes('style')).toContain('width: 60px')
    expect(container.attributes('style')).toContain('height: 60px')
  })

  it('桌面端双击打开图片查看器', async () => {
    const wrapper = mountComponent({ url: 'mxc://server/img', width: 100, height: 100 })
    await flushPromises()

    await wrapper.find('img[data-test="NImage"]').trigger('dblclick')

    expect(openImageViewerMock).toHaveBeenCalledTimes(1)
  })

  it('存在 onImageClick 回调时优先使用自定义处理', async () => {
    const onImageClick = vi.fn()
    const wrapper = mountComponent({ url: 'mxc://server/custom', width: 100, height: 100 }, { onImageClick })
    await flushPromises()

    await wrapper.find('img[data-test="NImage"]').trigger('dblclick')

    expect(onImageClick).toHaveBeenCalledWith('mxc://server/custom')
    expect(openImageViewerMock).not.toHaveBeenCalled()
  })

  it('无缩略图时请求缩略图下载', async () => {
    enqueueThumbnailMock.mockResolvedValue('/cache/thumb.png')
    mountComponent({ url: 'mxc://server/img', width: 100, height: 100 })
    await flushPromises()

    expect(enqueueThumbnailMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'mxc://server/img', msgId: 'msg-1', roomId: '!room:server.test', kind: 'image' })
    )
  })

  it('缩略图下载成功后应用本地路径', async () => {
    enqueueThumbnailMock.mockResolvedValue('/cache/thumb.png')
    const wrapper = mountComponent({ url: 'mxc://server/img', width: 100, height: 100 })
    await flushPromises()

    const img = wrapper.find('img[data-test="NImage"]')
    expect(img.attributes('src')).toBe('asset://localhost//cache/thumb.png')
  })

  it('加密图片挂载时走加密下载流程', async () => {
    const encryptedFile = { url: 'mxc://server/enc', v: 'v2' }
    downloadEncryptedFileMock.mockResolvedValue('/local/enc.png')
    getMessageMock.mockReturnValue(null) // persistImageLocalPath 无消息时直接返回

    mountComponent({ url: 'mxc://server/enc-img', encryptedFile, width: 100, height: 100 })
    await flushPromises()

    expect(downloadEncryptedFileMock).toHaveBeenCalled()
  })

  it('body 无 url 时不渲染图片容器', async () => {
    const wrapper = mountComponent({})
    await flushPromises()

    expect(wrapper.find('img[data-test="NImage"]').exists()).toBe(false)
  })
})
