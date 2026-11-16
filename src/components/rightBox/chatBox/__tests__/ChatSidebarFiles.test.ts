import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ChatSidebarFiles 的配额区判据（§19.22）。
 *
 * 这个面板此前的「1.2 GB / 5.0 GB + 24%」是硬编码假值，会让用户以为看到了真实用量。
 * 现在数据来自 `matrixMediaService.getQuotaStats()`；该接口内部已吞错、失败一律返回 `null`
 * （`fetchQuotaStats` 的 try/catch），所以组件侧不再包 catch。判据核心：
 * **取不到 `null` 就整块隐藏**，绝不用 0 或占位冒充。
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

import ChatSidebarFiles from '../ChatSidebarFiles.vue'

const quotaText = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-test="chat-sidebar-quota-text"]')

describe('ChatSidebarFiles — 配额区', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('面板可见时拉取配额并渲染真实用量与百分比', async () => {
    getQuotaStatsMock.mockResolvedValue({ storageBytes: 1536, mediaCount: 3, limitBytes: 2048 })

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)
    expect(quotaText(wrapper).text()).toBe('1.5 KB / 2 KB')
    expect(wrapper.find('[data-test="NProgress"]').attributes('data-percentage')).toBe('75')
    wrapper.unmount()
  })

  it('配额取不到时整块隐藏（不显示 0 或假数字），但仍给出文件空态', async () => {
    getQuotaStatsMock.mockResolvedValue(null)

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-test="NProgress"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="chat-sidebar-files-empty"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('服务端未给上限时只报用量，不编造分母', async () => {
    getQuotaStatsMock.mockResolvedValue({ storageBytes: 2048, mediaCount: 1, limitBytes: 0 })

    const wrapper = mount(ChatSidebarFiles, { props: { active: true } })
    await flushPromises()

    expect(quotaText(wrapper).text()).toBe('2 KB')
    expect(wrapper.find('[data-test="NProgress"]').attributes('data-percentage')).toBe('0')
    wrapper.unmount()
  })

  it('隐藏状态下不请求；60s 内重复切面板不重复请求，过期后会重取', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T00:00:00Z'))
    getQuotaStatsMock.mockResolvedValue({ storageBytes: 100, mediaCount: 1, limitBytes: 200 })

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
})
