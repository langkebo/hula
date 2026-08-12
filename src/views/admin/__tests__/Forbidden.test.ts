import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Forbidden from '../Forbidden.vue'

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    })
  }
})

describe('Forbidden', () => {
  it('渲染标题与描述', () => {
    const wrapper = mount(Forbidden)

    expect(wrapper.text()).toContain('admin.forbidden.title')
    expect(wrapper.text()).toContain('admin.forbidden.desc')
  })

  it('点击返回首页按钮跳转 /message', async () => {
    const wrapper = mount(Forbidden)

    await wrapper.find('button').trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/message')
  })
})
