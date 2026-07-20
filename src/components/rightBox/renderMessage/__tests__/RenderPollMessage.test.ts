import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RenderPollMessage from '../RenderPollMessage.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'poll.votes': '票',
        'poll.ended': '已结束',
        'poll.ends_at': '截止'
      }
      return translations[key] || key
    }
  })
}))

vi.mock('@/utils/ComputedTime', () => ({
  formatTimestamp: vi.fn(() => '2026-07-17 10:00')
}))

const basePoll = {
  question: '午饭吃什么？',
  options: [
    { text: '拉面', count: 3 },
    { text: '盖饭', count: 1 }
  ],
  totalVotes: 4
}

const mountPoll = (props: Record<string, unknown> = {}) =>
  mount(RenderPollMessage, {
    props: { pollData: basePoll, ...props },
    global: {
      stubs: { 'n-radio': { template: '<span class="n-radio-stub" />' } }
    }
  })

describe('RenderPollMessage', () => {
  it('渲染问题与全部选项', () => {
    const wrapper = mountPoll()

    expect(wrapper.text()).toContain('午饭吃什么？')
    expect(wrapper.text()).toContain('拉面')
    expect(wrapper.text()).toContain('盖饭')
    expect(wrapper.findAll('.poll-option')).toHaveLength(2)
  })

  it('未投票时点击选项触发 vote 事件', async () => {
    const wrapper = mountPoll()

    await wrapper.findAll('.poll-option')[1].trigger('click')

    expect(wrapper.emitted('vote')).toEqual([[1]])
  })

  it('已投票后不再触发 vote 且展示票数与百分比', async () => {
    const wrapper = mountPoll({ hasVoted: true, votedOption: 0 })

    await wrapper.findAll('.poll-option')[1].trigger('click')

    expect(wrapper.emitted('vote')).toBeUndefined()
    expect(wrapper.text()).toContain('3 (75%)')
    expect(wrapper.text()).toContain('1 (25%)')
  })

  it('投票结束时展示已结束标记且不可投票', async () => {
    const wrapper = mountPoll({ isEnded: true })

    await wrapper.findAll('.poll-option')[0].trigger('click')

    expect(wrapper.emitted('vote')).toBeUndefined()
    expect(wrapper.text()).toContain('已结束')
    expect(wrapper.find('.n-radio-stub').exists()).toBe(false)
  })

  it('totalVotes 为 0 时百分比按 0 处理（不除零）', () => {
    const wrapper = mountPoll({
      pollData: { question: 'q', options: [{ text: 'a', count: 0 }], totalVotes: 0 },
      hasVoted: true
    })

    expect(wrapper.text()).toContain('0 (0%)')
    expect(wrapper.text()).toContain('0 票')
  })

  it('未结束且有截止时间时展示截止时间', () => {
    const wrapper = mountPoll({ endTime: 1789000000000 })

    expect(wrapper.text()).toContain('截止 2026-07-17 10:00')
  })
})
