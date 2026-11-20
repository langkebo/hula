import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ChatSidebarFiles 的配额区 + 文件列表判据（§19.22 + §19.29 + §19.55 + §19.88）。
 *
 * 配额区：该面板此前的「1.2 GB / 5.0 GB + 24%」是硬编码假值，会让用户以为看到了真实用量。
 * 现在数据来自 `matrixMediaService.getQuotaStats()`；该接口返回 `{ ok, reason }`：
 * - `ok: true` → 展示真实用量；
 * - `unsupported`（服务端没有配额接口）→ 整块隐藏；
 * - `unavailable`（接口在但本次失败）→ 局部失败信号 + 重试入口。
 *
 * 文件列表：数据来自 `matrixRoomTimelineService.getRoomFiles()`（`/messages` 分页 +
 * 客户端附件筛选）。分页扫描必然有「还有更早历史」的状态，因此空页不等于空房间，
 * 失败也不等于没有文件，三者必须分别呈现。
 */
const {
  getQuotaStatsMock,
  getRoomFilesMock,
  getThumbnailUrlMock,
  downloadFileMock,
  downloadEncryptedFileMock,
  emitMock,
  revealItemInDirMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  getQuotaStatsMock: vi.fn(),
  getRoomFilesMock: vi.fn(),
  getThumbnailUrlMock: vi.fn(),
  downloadFileMock: vi.fn(),
  downloadEncryptedFileMock: vi.fn(),
  emitMock: vi.fn(),
  revealItemInDirMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    getQuotaStats: (...args: unknown[]) => getQuotaStatsMock(...args),
    getThumbnailUrl: (...args: unknown[]) => getThumbnailUrlMock(...args)
  }
}))

vi.mock('@/services/matrix/room/TimelineService', () => ({
  matrixRoomTimelineService: { getRoomFiles: (...args: unknown[]) => getRoomFilesMock(...args) }
}))

vi.mock('@/stores/domains/widget/fileDownload', () => ({
  useFileDownloadStore: () => ({
    downloadFile: (...args: unknown[]) => downloadFileMock(...args),
    downloadEncryptedFile: (...args: unknown[]) => downloadEncryptedFileMock(...args)
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: (...args: unknown[]) => emitMock(...args) }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: (...args: unknown[]) => revealItemInDirMock(...args)
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['align', 'justify', 'description', 'loading', 'block', 'quaternary', 'size'],
      setup(props, { slots }) {
        // description 是真实 NEmpty 的文案来源，mock 必须把它渲染出来，否则空态断言无效
        return () =>
          h('div', { 'data-test': name }, [
            typeof props.description === 'string' ? props.description : null,
            slots.default?.(),
            slots.icon?.()
          ])
      }
    })
  return {
    NFlex: passthrough('NFlex'),
    NEmpty: passthrough('NEmpty'),
    NButton: passthrough('NButton'),
    NSkeleton: defineComponent({
      name: 'NSkeleton',
      props: ['height', 'width', 'sharp', 'text', 'repeat'],
      setup() {
        return () => h('div', { 'data-test': 'NSkeleton' })
      }
    }),
    NProgress: defineComponent({
      name: 'NProgress',
      props: ['type', 'percentage', 'height', 'showIndicator', 'color'],
      setup(props) {
        return () => h('div', { 'data-test': 'NProgress', 'data-percentage': String(props.percentage) })
      }
    })
  }
})

import { MittEnum } from '@/enums'
import { makeMediaQuotaStats, makeMediaQuotaStatsUnavailable } from '@/services/matrix/admin/__tests__/fixtures/quota'
import { notifyMediaQuotaChanged } from '@/services/matrix/media/mediaQuotaEvents'
import {
  makeEmptyRoomFilesOutcome,
  makeRoomFileEntry,
  makeRoomFilesError,
  makeRoomFilesOutcome,
  makeRoomFilesUnsupported
} from '@/services/matrix/room/__tests__/fixtures/roomFiles'
import ChatSidebarFiles from '../ChatSidebarFiles.vue'

const quotaText = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-test="chat-sidebar-quota-text"]')

describe('ChatSidebarFiles — 配额区', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRoomFilesMock.mockResolvedValue(makeEmptyRoomFilesOutcome())
  })

  it('面板可见时拉取配额并渲染真实用量与百分比', async () => {
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStats({ storageBytes: 1536, mediaCount: 3, limitBytes: 2048 }))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)
    expect(quotaText(wrapper).text()).toBe('1.5 KB / 2 KB')
    expect(wrapper.find('[data-test="NProgress"]').attributes('data-percentage')).toBe('75')
    wrapper.unmount()
  })

  it('服务端没有配额接口（unsupported）时整块隐藏，不显示 0 或假数字', async () => {
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStatsUnavailable('unsupported'))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-test="NProgress"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-quota-unavailable"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-files-no-room"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('接口存在但本次取不到（unavailable）时给出局部失败信号与重试入口，不冒充用量为 0', async () => {
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStatsUnavailable('unavailable'))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-test="NProgress"]').exists()).toBe(false)
    const partial = wrapper.find('[data-testid="chat-sidebar-quota-partial"]')
    expect(partial.exists()).toBe(true)
    expect(partial.text()).toContain('home.chat_sidebar.quota.unavailable_hint')
    expect(partial.find('[data-testid="partial-retry"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('配额取数期间显示骨架屏，取回后替换为真实用量', async () => {
    let resolveQuota: (value: unknown) => void = () => {}
    getQuotaStatsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveQuota = resolve
      })
    )

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(wrapper.find('[data-test="NSkeleton"]').exists()).toBe(true)
    expect(quotaText(wrapper).exists()).toBe(false)

    resolveQuota(makeMediaQuotaStats({ storageBytes: 100, mediaCount: 1, limitBytes: 200 }))
    await flushPromises()

    expect(wrapper.find('[data-test="NSkeleton"]').exists()).toBe(false)
    expect(quotaText(wrapper).text()).toBe('100 B / 200 B')
    wrapper.unmount()
  })

  it('点击局部失败信号的重试后重新取数，成功后移除失败信号', async () => {
    getQuotaStatsMock.mockResolvedValueOnce(makeMediaQuotaStatsUnavailable('unavailable'))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()
    expect(wrapper.find('[data-testid="chat-sidebar-quota-partial"]').exists()).toBe(true)

    getQuotaStatsMock.mockResolvedValueOnce(makeMediaQuotaStats({ storageBytes: 100, mediaCount: 1, limitBytes: 200 }))
    await wrapper.find('[data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(getQuotaStatsMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="chat-sidebar-quota-partial"]').exists()).toBe(false)
    expect(quotaText(wrapper).text()).toBe('100 B / 200 B')
    wrapper.unmount()
  })

  it('服务端未给上限时只报用量，不编造分母', async () => {
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStats({ storageBytes: 2048, mediaCount: 1, limitBytes: 0 }))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).text()).toBe('2 KB')
    expect(wrapper.find('[data-test="NProgress"]').attributes('data-percentage')).toBe('0')
    wrapper.unmount()
  })

  it('隐藏状态下不请求；60s 内重复切面板不重复请求，过期后会重取', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T00:00:00Z'))
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStats({ storageBytes: 100, mediaCount: 1, limitBytes: 200 }))

    const wrapper = mount(ChatSidebarFiles, { props: { active: false } })
    await flushPromises()
    expect(getQuotaStatsMock).not.toHaveBeenCalled()

    await wrapper.setProps({ active: true })
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)

    // 60s 内再切回来：不重复打接口
    await wrapper.setProps({ active: false })
    await wrapper.setProps({ active: true })
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)

    // 超过 TTL 后再可见：重取（避免上传文件后整场陈旧）
    vi.setSystemTime(new Date('2026-11-16T00:02:00Z'))
    await wrapper.setProps({ active: false })
    await wrapper.setProps({ active: true })
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('上传/删除成功（配额变化通知）后面板可见时立即重取，不再等 60s TTL', async () => {
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStats({ storageBytes: 100, mediaCount: 1, limitBytes: 200 }))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)

    // 服务端配额变化：新用量应立刻反映出来
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStats({ storageBytes: 200, mediaCount: 2, limitBytes: 200 }))
    notifyMediaQuotaChanged()
    await flushPromises()

    expect(getQuotaStatsMock).toHaveBeenCalledTimes(2)
    expect(quotaText(wrapper).text()).toBe('200 B / 200 B')
    wrapper.unmount()
  })

  it('隐藏时收到配额变化通知只清缓存，不白打接口；下次可见再重取', async () => {
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStats({ storageBytes: 100, mediaCount: 1, limitBytes: 200 }))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ active: false })
    notifyMediaQuotaChanged()
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ active: true })
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})

describe('ChatSidebarFiles — 文件列表', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getQuotaStatsMock.mockResolvedValue(makeMediaQuotaStatsUnavailable('unsupported'))
    getRoomFilesMock.mockResolvedValue(makeEmptyRoomFilesOutcome())
    // 默认无缩略图、下载成功并落到本地路径
    getThumbnailUrlMock.mockReturnValue(null)
    downloadFileMock.mockResolvedValue('/tmp/downloads/report.pdf')
    downloadEncryptedFileMock.mockResolvedValue('/tmp/downloads/secret.png')
    revealItemInDirMock.mockResolvedValue(undefined)
  })

  it('未选中会话时不请求文件接口，给出「未选择会话」空态', async () => {
    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '' } })
    await flushPromises()

    expect(getRoomFilesMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="chat-sidebar-files-no-room"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('接入房间消息分页数据，渲染真实文件条目与元信息', async () => {
    getRoomFilesMock.mockResolvedValue(
      makeRoomFilesOutcome([
        makeRoomFileEntry(),
        makeRoomFileEntry({ eventId: '$file2', name: '', size: null, encrypted: true })
      ])
    )

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    expect(getRoomFilesMock).toHaveBeenCalledTimes(1)
    expect(getRoomFilesMock.mock.calls[0]?.[0]).toBe('!room:example.org')
    // 首页不带 from（从房间最新处开始）
    expect(getRoomFilesMock.mock.calls[0]?.[1]).toBeUndefined()

    const items = wrapper.findAll('[data-test="chat-sidebar-file-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('report.pdf')
    expect(items[0]?.text()).toContain('2 KB')
    // 缺文件名 / 缺尺寸时不伪装成空串或 0 B
    expect(items[1]?.text()).toContain('home.chat_sidebar.files.unnamed')
    expect(items[1]?.text()).not.toContain('0 B')
    expect(wrapper.find('[data-test="chat-sidebar-files-empty"]').exists()).toBe(false)
    // 已到房间开头：不再显示「加载更多」
    expect(wrapper.find('[data-test="chat-sidebar-files-more"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('扫描到房间开头仍无附件时给「暂无文件」，不宣称还有更早内容', async () => {
    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    expect(wrapper.find('[data-test="chat-sidebar-files-empty"]').text()).toContain('home.chat_sidebar.empty.files')
    expect(wrapper.find('[data-test="chat-sidebar-files-scope-hint"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-files-more"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('本页无附件但仍有更早历史时，说明扫描范围并支持继续翻页', async () => {
    getRoomFilesMock.mockResolvedValueOnce(makeEmptyRoomFilesOutcome('p1'))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    expect(wrapper.find('[data-test="chat-sidebar-files-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="chat-sidebar-files-scope-hint"]').text()).toBe(
      'home.chat_sidebar.files.scope_hint'
    )

    getRoomFilesMock.mockResolvedValueOnce(
      makeRoomFilesOutcome([makeRoomFileEntry({ eventId: '$older', name: 'older.png', kind: 'image' })])
    )
    await wrapper.find('[data-test="chat-sidebar-files-more"]').trigger('click')
    await flushPromises()

    expect(getRoomFilesMock).toHaveBeenCalledTimes(2)
    expect(getRoomFilesMock.mock.calls[1]?.[1]).toEqual({ from: 'p1' })
    expect(wrapper.findAll('[data-test="chat-sidebar-file-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('older.png')
    expect(wrapper.find('[data-test="chat-sidebar-files-more"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('分页失败时给局部失败信号，重试成功后渲染列表', async () => {
    getRoomFilesMock.mockResolvedValueOnce(makeRoomFilesError())

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    const partial = wrapper.find('[data-testid="chat-sidebar-files-partial"]')
    expect(partial.exists()).toBe(true)
    expect(partial.text()).toContain('home.chat_sidebar.files.load_failed')
    // 失败不能渲染成空态：用户会以为房间里真的没有文件
    expect(wrapper.find('[data-test="chat-sidebar-files-empty"]').exists()).toBe(false)

    getRoomFilesMock.mockResolvedValueOnce(makeRoomFilesOutcome([makeRoomFileEntry()]))
    await partial.find('[data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(getRoomFilesMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="chat-sidebar-files-partial"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-file-item"]').text()).toContain('report.pdf')
    wrapper.unmount()
  })

  it('服务端不支持消息分页时如实说明能力缺失，不伪装成空态', async () => {
    getRoomFilesMock.mockResolvedValue(makeRoomFilesUnsupported())

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    const unsupported = wrapper.find('[data-test="chat-sidebar-files-unsupported"]')
    expect(unsupported.exists()).toBe(true)
    expect(unsupported.text()).toContain('home.chat_sidebar.empty.files_unsupported')
    expect(wrapper.find('[data-test="chat-sidebar-files-empty"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('切换房间时丢弃在途的旧响应，不把上一个房间的文件写进新房间', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    getRoomFilesMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      })
    )

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!a:example.org' } })
    await flushPromises()

    getRoomFilesMock.mockResolvedValueOnce(
      makeRoomFilesOutcome([makeRoomFileEntry({ eventId: '$b1', name: 'b-room.txt' })])
    )
    await wrapper.setProps({ roomId: '!b:example.org' })
    await flushPromises()

    // 旧房间的响应姗姗来迟：必须被丢弃
    resolveFirst(makeRoomFilesOutcome([makeRoomFileEntry({ eventId: '$a1', name: 'a-room.txt' })]))
    await flushPromises()

    expect(wrapper.text()).toContain('b-room.txt')
    expect(wrapper.text()).not.toContain('a-room.txt')
    wrapper.unmount()
  })

  it('图片附件用服务端缩略图渲染，加密图片不解密出图、回落类型图标', async () => {
    getThumbnailUrlMock.mockReturnValue('https://example.org/_matrix/media/thumb')
    getRoomFilesMock.mockResolvedValue(
      makeRoomFilesOutcome([
        makeRoomFileEntry({ eventId: '$img', name: 'photo.png', kind: 'image' }),
        makeRoomFileEntry({
          eventId: '$enc',
          name: 'secret.png',
          kind: 'image',
          encrypted: true,
          encryptedFile: { url: 'mxc://example.org/enc', key: 'k', iv: 'v' }
        })
      ])
    )

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    // 只对未加密图片请求缩略图，且按 64x64 取
    expect(getThumbnailUrlMock).toHaveBeenCalledTimes(1)
    expect(getThumbnailUrlMock).toHaveBeenCalledWith('mxc://example.org/media1', 64, 64)
    const thumbs = wrapper.findAll('[data-test="chat-sidebar-file-thumb"]')
    expect(thumbs).toHaveLength(1)
    expect(thumbs[0]?.attributes('src')).toBe('https://example.org/_matrix/media/thumb')
    expect(wrapper.findAll('[data-test="chat-sidebar-file-item"]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('缩略图加载失败时移除该图，回落类型图标而不是显示破图', async () => {
    getThumbnailUrlMock.mockReturnValue('https://example.org/broken-thumb')
    getRoomFilesMock.mockResolvedValue(
      makeRoomFilesOutcome([makeRoomFileEntry({ eventId: '$img', name: 'photo.png', kind: 'image' })])
    )

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    const thumb = wrapper.find('[data-test="chat-sidebar-file-thumb"]')
    expect(thumb.exists()).toBe(true)
    await thumb.trigger('error')
    expect(wrapper.find('[data-test="chat-sidebar-file-thumb"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-file-item"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('下载普通附件复用 fileDownload store，成功后定位文件并给出成功反馈', async () => {
    getRoomFilesMock.mockResolvedValue(makeRoomFilesOutcome([makeRoomFileEntry()]))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()
    await wrapper.find('[data-test="chat-sidebar-file-download"]').trigger('click')
    await flushPromises()

    expect(downloadFileMock).toHaveBeenCalledWith('https://example.org/_matrix/media/media1', 'report.pdf')
    expect(downloadEncryptedFileMock).not.toHaveBeenCalled()
    expect(revealItemInDirMock).toHaveBeenCalledWith('/tmp/downloads/report.pdf')
    expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_sidebar.files.download_success', 'success')
    wrapper.unmount()
  })

  it('下载加密附件时把解密描述符原样交给 store，不走普通下载', async () => {
    const encryptedFile = { url: 'mxc://example.org/enc', key: 'k', iv: 'v' }
    getRoomFilesMock.mockResolvedValue(
      makeRoomFilesOutcome([
        makeRoomFileEntry({ eventId: '$enc', name: 'secret.png', kind: 'image', encrypted: true, encryptedFile })
      ])
    )

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()
    await wrapper.find('[data-test="chat-sidebar-file-download"]').trigger('click')
    await flushPromises()

    expect(downloadEncryptedFileMock).toHaveBeenCalledWith('mxc://example.org/media1', 'secret.png', encryptedFile)
    expect(downloadFileMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('缺少下载所需信息（加密无描述符 / 普通无 HTTP 地址）时如实提示，不发起下载', async () => {
    getRoomFilesMock.mockResolvedValue(
      makeRoomFilesOutcome([
        makeRoomFileEntry({ eventId: '$enc', name: 'secret.png', kind: 'image', encrypted: true, encryptedFile: null }),
        makeRoomFileEntry({ eventId: '$nohttp', name: 'broken.pdf', httpUrl: null })
      ])
    )

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()

    const downloads = wrapper.findAll('[data-test="chat-sidebar-file-download"]')
    await downloads[0]?.trigger('click')
    await downloads[1]?.trigger('click')
    await flushPromises()

    expect(downloadEncryptedFileMock).not.toHaveBeenCalled()
    expect(downloadFileMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_sidebar.files.download_unavailable', 'error')
    wrapper.unmount()
  })

  it('下载成功但无法在文件夹中定位时降级提示，不覆盖下载结果', async () => {
    revealItemInDirMock.mockRejectedValue(new Error('opener unavailable'))
    getRoomFilesMock.mockResolvedValue(makeRoomFilesOutcome([makeRoomFileEntry()]))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()
    await wrapper.find('[data-test="chat-sidebar-file-download"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_sidebar.files.download_success', 'success')
    expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_sidebar.files.reveal_failed', 'warning')
    wrapper.unmount()
  })

  it('点击「跳转到原消息」发出 NAVIGATE_TO_MESSAGE，由 ChatMain 定位并高亮', async () => {
    getRoomFilesMock.mockResolvedValue(makeRoomFilesOutcome([makeRoomFileEntry({ eventId: '$file1' })]))

    const wrapper = mount(ChatSidebarFiles, { props: { active: true, roomId: '!room:example.org' } })
    await flushPromises()
    await wrapper.find('[data-test="chat-sidebar-file-jump"]').trigger('click')

    expect(emitMock).toHaveBeenCalledWith(MittEnum.NAVIGATE_TO_MESSAGE, {
      roomId: '!room:example.org',
      eventId: '$file1'
    })
    wrapper.unmount()
  })
})
