import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import { createI18nMock, resolveMessage } from '~/tests/i18n-messages'
import MessageActionBar from '../MessageActionBar.vue'

vi.mock('vue-i18n', () => createI18nMock())

const mountComponent = (overrides: Record<string, unknown> = {}) =>
  mount(MessageActionBar, {
    props: {
      visible: true,
      isMe: true,
      messageType: MsgEnum.TEXT,
      ...overrides
    },
    global: {
      stubs: {
        Tooltip: { template: '<div><slot name="trigger" /><slot /></div>' }
      }
    }
  })

const labels = (wrapper: ReturnType<typeof mountComponent>) =>
  wrapper.findAll('button.action-btn').map((button) => button.attributes('aria-label'))

describe('MessageActionBar 可见性', () => {
  it('本人普通消息展示删除动作', () => {
    const wrapper = mountComponent()

    expect(labels(wrapper)).toContain(resolveMessage('common.delete'))
  })

  it('非本人消息隐藏删除动作', () => {
    const wrapper = mountComponent({ isMe: false })

    expect(labels(wrapper)).not.toContain(resolveMessage('common.delete'))
  })

  it('具备管理权限时可删除他人消息', () => {
    const wrapper = mountComponent({ isMe: false, canModerate: true })

    expect(labels(wrapper)).toContain(resolveMessage('common.delete'))
  })

  it('已撤回 / 系统消息不展示任何交互动作', () => {
    const recalled = mountComponent({ messageType: MsgEnum.RECALL })
    const system = mountComponent({ messageType: MsgEnum.SYSTEM })

    expect(labels(recalled)).toEqual([])
    expect(labels(system)).toEqual([])
  })

  it('点击删除触发 delete 事件', async () => {
    const wrapper = mountComponent()
    const deleteButton = wrapper
      .findAll('button.action-btn')
      .find((button) => button.attributes('aria-label') === resolveMessage('common.delete'))

    await deleteButton?.trigger('click')

    expect(wrapper.emitted('delete')).toHaveLength(1)
  })
})
