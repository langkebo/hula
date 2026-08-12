import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LinkPreview from '../LinkPreview.vue'

const { openExternalUrlMock, getMediaUrlMock } = vi.hoisted(() => ({
  openExternalUrlMock: vi.fn(),
  getMediaUrlMock: vi.fn()
}))

vi.mock('@/composables/common/useLinkSegments', () => ({
  openExternalUrl: openExternalUrlMock
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    getMediaUrl: getMediaUrlMock
  }
}))

describe('renderMessage/LinkPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMediaUrlMock.mockReturnValue('https://media.example.com/thumb.jpg')
  })

  const mountComponent = (props: Record<string, unknown>) => mount(LinkPreview, { props: props as never })

  const baseBody = {
    url: 'https://blog.example.com/posts/1',
    title: '示例文章标题',
    description: '这是一段摘要描述',
    imageUrl: 'https://img.example.com/cover.png',
    siteName: 'Example Blog'
  }

  it('showUrl 为真时渲染原始链接', () => {
    const wrapper = mountComponent({ body: baseBody, showUrl: true })
    expect(wrapper.text()).toContain('https://blog.example.com/posts/1')
  })

  it('showUrl 为假时不渲染原始链接', () => {
    const wrapper = mountComponent({ body: baseBody, showUrl: false })
    expect(wrapper.text()).not.toContain('https://blog.example.com/posts/1')
  })

  it('渲染标题与描述', () => {
    const wrapper = mountComponent({ body: baseBody })
    expect(wrapper.text()).toContain('示例文章标题')
    expect(wrapper.text()).toContain('这是一段摘要描述')
  })

  it('无标题时回退到 i18n unknown_link 文案', () => {
    const wrapper = mountComponent({ body: { url: 'https://x.com', title: '' } })
    expect(wrapper.text()).toContain('chat.link_preview.unknown_link')
  })

  it('提取域名作为来源展示', () => {
    const wrapper = mountComponent({ body: baseBody })
    expect(wrapper.text()).toContain('blog.example.com')
  })

  it('无 siteName 时回退到域名作为来源', () => {
    const wrapper = mountComponent({ body: { url: 'https://news.example.org/a' } })
    expect(wrapper.text()).toContain('news.example.org')
  })

  it('mxc:// 缩略图走 matrixMediaService.getMediaUrl', () => {
    mountComponent({ body: { ...baseBody, imageUrl: 'mxc://server/abc123' } })
    expect(getMediaUrlMock).toHaveBeenCalledWith('mxc://server/abc123', 90, 90)
  })

  it('非 mxc 缩略图直接作为图片地址，不调用 getMediaUrl', () => {
    mountComponent({ body: { ...baseBody, imageUrl: 'https://img.other.com/c.png' } })
    expect(getMediaUrlMock).not.toHaveBeenCalled()
  })

  it('点击链接调用 openExternalUrl 打开原地址', async () => {
    const wrapper = mountComponent({ body: baseBody })
    await wrapper.trigger('click')
    expect(openExternalUrlMock).toHaveBeenCalledWith('https://blog.example.com/posts/1')
  })
})
