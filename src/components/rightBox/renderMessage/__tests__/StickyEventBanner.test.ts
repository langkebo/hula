import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { StickyEventInfo } from '@/composables/room/useStickyEvents'
import StickyEventBanner from '../StickyEventBanner.vue'

function makeEvent(overrides: Partial<StickyEventInfo> = {}): StickyEventInfo {
  return {
    eventId: '$evt1:server',
    sender: '@alice:server',
    body: '重要公告',
    timestamp: 1700000000000,
    ...overrides
  }
}

describe('StickyEventBanner — 粘性事件横幅 (§8.2)', () => {
  it('events 为空时不渲染横幅', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [] }
    })
    expect(wrapper.find('.sticky-banner').exists()).toBe(false)
  })

  it('events 非空时渲染横幅', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent()] }
    })
    expect(wrapper.find('.sticky-banner').exists()).toBe(true)
  })

  it('折叠态仅显示 1 条粘性事件', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent({ eventId: '$e1' }), makeEvent({ eventId: '$e2' }), makeEvent({ eventId: '$e3' })] }
    })
    expect(wrapper.findAll('.sticky-banner__item')).toHaveLength(1)
  })

  it('点击展开按钮后显示全部（最多 3 条）', async () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent({ eventId: '$e1' }), makeEvent({ eventId: '$e2' }), makeEvent({ eventId: '$e3' })] }
    })
    await wrapper.find('[data-testid="sticky-toggle-btn"]').trigger('click')
    expect(wrapper.findAll('.sticky-banner__item')).toHaveLength(3)
  })

  it('展开后点击按钮恢复折叠态', async () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent({ eventId: '$e1' }), makeEvent({ eventId: '$e2' })] }
    })
    await wrapper.find('[data-testid="sticky-toggle-btn"]').trigger('click')
    expect(wrapper.findAll('.sticky-banner__item')).toHaveLength(2)
    await wrapper.find('[data-testid="sticky-toggle-btn"]').trigger('click')
    expect(wrapper.findAll('.sticky-banner__item')).toHaveLength(1)
  })

  it('每条粘性事件显示发送者、摘要文本和时间', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent({ sender: '@alice:server', body: '会议改期' })] }
    })
    const item = wrapper.find('.sticky-banner__item')
    expect(item.text()).toContain('@alice:server')
    expect(item.text()).toContain('会议改期')
  })

  it('点击事件项触发 view 事件', async () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent({ eventId: '$evt1:server' })] }
    })
    await wrapper.find('.sticky-banner__item').trigger('click')
    const viewEvents = wrapper.emitted('view')
    expect(viewEvents).toBeTruthy()
    expect(viewEvents![0]).toEqual(['$evt1:server'])
  })

  it('canSetSticky=true 时显示「设为粘性事件」按钮', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent()], canSetSticky: true }
    })
    expect(wrapper.find('[data-testid="sticky-set-btn"]').exists()).toBe(true)
  })

  it('canSetSticky=false 时不显示「设为粘性事件」按钮', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent()], canSetSticky: false }
    })
    expect(wrapper.find('[data-testid="sticky-set-btn"]').exists()).toBe(false)
  })

  it('点击「设为粘性事件」按钮触发 set-sticky 事件', async () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent()], canSetSticky: true }
    })
    await wrapper.find('[data-testid="sticky-set-btn"]').trigger('click')
    expect(wrapper.emitted('set-sticky')).toBeTruthy()
  })

  it('横幅有可访问性 role=status', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent()] }
    })
    expect(wrapper.find('.sticky-banner').attributes('role')).toBe('status')
  })

  it('多条事件时展开按钮显示剩余数量提示', () => {
    const wrapper = mount(StickyEventBanner, {
      props: { events: [makeEvent({ eventId: '$e1' }), makeEvent({ eventId: '$e2' }), makeEvent({ eventId: '$e3' })] }
    })
    const toggleBtn = wrapper.find('[data-testid="sticky-toggle-btn"]')
    expect(toggleBtn.text()).toContain('2')
  })
})
