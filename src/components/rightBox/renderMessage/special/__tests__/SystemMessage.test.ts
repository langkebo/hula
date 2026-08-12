import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SystemMessage from '../SystemMessage.vue'

describe('renderMessage/special/SystemMessage', () => {
  const mountComponent = (body: string) =>
    mount(SystemMessage, {
      props: {
        body,
        fromUserUid: 'user-1'
      }
    })

  it('渲染系统消息文本', () => {
    const wrapper = mountComponent('管理员已开启全员禁言')
    expect(wrapper.find('p').text()).toBe('管理员已开启全员禁言')
  })

  it('空字符串时渲染空消息', () => {
    const wrapper = mountComponent('')
    expect(wrapper.find('p').text()).toBe('')
  })

  it('保留富文本占位内容（不转义）', () => {
    const wrapper = mountComponent('欢迎 <b>新成员</b>')
    // 文本插值不会解析 HTML，原样输出
    expect(wrapper.find('p').text()).toContain('<b>')
  })
})
