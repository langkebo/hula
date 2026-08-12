import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum } from '@/enums'
import VideoMessage from '../Video.vue'

const {
  openVideoViewerMock,
  getLocalVideoPathMock,
  checkVideoDownloadedMock,
  enqueueThumbnailMock,
  invalidateMock,
  getFileStatusMock,
  downloadEncryptedFileMock,
  getMessageMock,
  updateMsgMock,
  safeExistsPathMock,
  updateVideoPathMock,
  invokeSilentlyMock,
  downloadFileMock,
  isMobileMock
} = vi.hoisted(() => ({
  openVideoViewerMock: vi.fn(),
  getLocalVideoPathMock: vi.fn(),
  checkVideoDownloadedMock: vi.fn(),
  enqueueThumbnailMock: vi.fn(),
  invalidateMock: vi.fn(),
  getFileStatusMock: vi.fn(),
  downloadEncryptedFileMock: vi.fn(),
  getMessageMock: vi.fn(),
  updateMsgMock: vi.fn(),
  safeExistsPathMock: vi.fn(),
  updateVideoPathMock: vi.fn(),
  invokeSilentlyMock: vi.fn(),
  downloadFileMock: vi.fn(),
  isMobileMock: vi.fn(() => false)
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/appdata'),
  join: vi.fn().mockResolvedValue('/joined'),
  resourceDir: vi.fn().mockResolvedValue('/resource')
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 'AppData', Resource: 'Resource' },
  exists: vi.fn().mockResolvedValue(false)
}))

vi.mock('@/composables/common/useDownload', async () => {
  const { ref } = await import('vue')
  return {
    useDownload: () => ({
      downloadFile: downloadFileMock,
      isDownloading: ref(false),
      process: ref(0)
    })
  }
})

vi.mock('@/composables/common/useIntersectionTaskQueue', () => ({
  useIntersectionTaskQueue: () => ({ observe: vi.fn(), disconnect: vi.fn() })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { on: vi.fn(), off: vi.fn(), emit: vi.fn() }
}))

vi.mock('@/composables/common/useVideoViewer', () => ({
  useVideoViewer: () => ({
    openVideoViewer: openVideoViewerMock,
    getLocalVideoPath: getLocalVideoPathMock,
    checkVideoDownloaded: checkVideoDownloadedMock
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

vi.mock('@/stores/domains/widget/videoViewer', () => ({
  useVideoViewer: () => ({
    updateVideoPath: updateVideoPathMock
  })
}))

vi.mock('@/utils/Formatting', () => ({
  extractFileName: (url: string) => {
    const segment = url.split('/').pop() || ''
    return segment.includes('.') ? segment : 'file'
  },
  formatBytes: (size?: number) => (size ? `${size} B` : '')
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
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
      emits: ['click', 'dblclick', 'error', 'load'],
      setup(props, { slots, emit }) {
        return () =>
          h('div', { 'data-test': 'NImage' }, [
            slots.placeholder?.(),
            slots.error?.(),
            h('img', {
              src: props.src as string,
              onClick: () => emit('click'),
              onDblclick: () => emit('dblclick'),
              onError: () => emit('error'),
              onLoad: () => emit('load')
            })
          ])
      }
    })
  }
})

describe('renderMessage/Video', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLocalVideoPathMock.mockResolvedValue('relative/video.mp4')
    checkVideoDownloadedMock.mockResolvedValue(true)
    safeExistsPathMock.mockResolvedValue(false)
    enqueueThumbnailMock.mockResolvedValue(undefined)
  })

  const baseBody = {
    url: 'mxc://server/video123',
    filename: 'demo.mp4',
    size: 100,
    thumbUrl: 'https://thumb.example.com/t.jpg'
  }

  const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(VideoMessage, {
      props: { body: baseBody, ...props } as never
    })

  it('渲染视频文件名与格式化大小', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('demo.mp4')
    expect(wrapper.text()).toContain('100 B')
  })

  it('存在播放/下载控制按钮', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.find('.play-button').exists()).toBe(true)
  })

  it('发送中（SENDING）展示上传进度环', async () => {
    const wrapper = mountComponent({ messageStatus: MessageStatusEnum.SENDING, uploadProgress: 42 })
    await flushPromises()
    expect(wrapper.find('.upload-progress').exists()).toBe(true)
  })

  it('非发送状态不展示上传进度环', async () => {
    const wrapper = mountComponent({ messageStatus: MessageStatusEnum.SUCCESS })
    await flushPromises()
    expect(wrapper.find('.upload-progress').exists()).toBe(false)
  })

  it('挂载时按 thumbUrl 入队缩略图下载', async () => {
    const _wrapper = mountComponent({ message: { id: 'm1', roomId: '!room:server' } as never })
    await flushPromises()
    expect(enqueueThumbnailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: baseBody.thumbUrl,
        msgId: 'm1',
        roomId: '!room:server',
        kind: 'video'
      })
    )
  })

  it('双击已下载视频触发 openVideoViewer', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.trigger('dblclick')
    await flushPromises()
    expect(openVideoViewerMock).toHaveBeenCalledWith('mxc://server/video123', expect.any(Array))
  })

  it('提供 onVideoClick 时双击优先调用自定义回调', async () => {
    const onVideoClick = vi.fn()
    const wrapper = mountComponent({ onVideoClick })
    await flushPromises()
    await wrapper.trigger('dblclick')
    await flushPromises()
    expect(onVideoClick).toHaveBeenCalledWith('mxc://server/video123')
    expect(openVideoViewerMock).not.toHaveBeenCalled()
  })
})
