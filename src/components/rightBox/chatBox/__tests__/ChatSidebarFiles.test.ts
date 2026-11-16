import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ChatSidebarFiles 的配额区判据（§19.22 + §19.29）。
 *
 * 这个面板此前的「1.2 GB / 5.0 GB + 24%」是硬编码假值，会让用户以为看到了真实用量。
 * 现在数据来自 `matrixMediaService.getQuotaStats()`；该接口返回 `{ ok, reason }`：
 * - `ok: true` → 展示真实用量；
 * - `unsupported`（服务端没有配额接口）→ 整块隐藏；
 * - `unavailable`（接口在但本次失败）→ 显示「暂不可用」。
 * 任何情况下都不显示 0 或占位数字。
 */
const { getQuotaStatsMock } = vi.hoisted(() => ({ getQuotaStatsMock: vi.fn() }))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: { getQuotaStats: (...args: unknown[]) => getQuotaStatsMock(...args) }
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['align', 'justify', 'description'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, [slots.default?.(), slots.icon?.()])
      }
    })
  return {
    NFlex: passthrough('NFlex'),
    NEmpty: passthrough('NEmpty'),
    NProgress: defineComponent({
      name: 'NProgress',
      props: ['type', 'percentage', 'height', 'showIndicator', 'color'],
      setup(props) {
        return () => h('div', { 'data-test': 'NProgress', 'data-percentage': String(props.percentage) })
      }
    })
  }
})

import { notifyMediaQuotaChanged } from '@/services/matrix/media/mediaQuotaEvents'
import ChatSidebarFiles from '../ChatSidebarFiles.vue'

const quotaText = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-test="chat-sidebar-quota-text"]')

describe('ChatSidebarFiles — 配额区', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('面板可见时拉取配额并渲染真实用量与百分比', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 1536, mediaCount: 3, limitBytes: 2048 } })

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)
    expect(quotaText(wrapper).text()).toBe('1.5 KB / 2 KB')
    expect(wrapper.find('[data-test="NProgress"]').attributes('data-percentage')).toBe('75')
    wrapper.unmount()
  })

  it('服务端没有配额接口（unsupported）时整块隐藏，不显示 0 或假数字', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: false, reason: 'unsupported' })

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-test="NProgress"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-quota-unavailable"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-files-empty"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('接口存在但本次取不到（unavailable）时说明「暂不可用」，不冒充用量为 0', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: false, reason: 'unavailable' })

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-test="NProgress"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-quota-unavailable"]').text()).toBe(
      'home.chat_sidebar.quota.unavailable'
    )
    wrapper.unmount()
  })

  it('服务端未给上限时只报用量，不编造分母', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 2048, mediaCount: 1, limitBytes: 0 } })

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).text()).toBe('2 KB')
    expect(wrapper.find('[data-test="NProgress"]').attributes('data-percentage')).toBe('0')
    wrapper.unmount()
  })

  it('隐藏状态下不请求；60s 内重复切面板不重复请求，过期后会重取', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T00:00:00Z'))
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 100, mediaCount: 1, limitBytes: 200 } })

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
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 100, mediaCount: 1, limitBytes: 200 } })

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)

    // 服务端配额变化：新用量应立刻反映出来
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 200, mediaCount: 2, limitBytes: 200 } })
    notifyMediaQuotaChanged()
    await flushPromises()

    expect(getQuotaStatsMock).toHaveBeenCalledTimes(2)
    expect(quotaText(wrapper).text()).toBe('200 B / 200 B')
    wrapper.unmount()
  })

  it('隐藏时收到配额变化通知只清缓存，不白打接口；下次可见再重取', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 100, mediaCount: 1, limitBytes: 200 } })

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
