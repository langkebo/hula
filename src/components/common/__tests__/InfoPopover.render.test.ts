import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import InfoPopover from '@/components/common/InfoPopover.vue'

describe('InfoPopover 渲染冒烟', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('挂载自身 uid 不应抛错', async () => {
    const wrapper = mount(InfoPopover, {
      props: { uid: '@self:hula.im', activeStatus: 1 }
    })
    // 等待 onMounted + loadProfile 的微任务
    await new Promise((r) => setTimeout(r, 50))
    expect(wrapper.exists()).toBe(true)
  })

  it('挂载他人 uid 不应抛错', async () => {
    const wrapper = mount(InfoPopover, {
      props: { uid: '@other:hula.im', activeStatus: 0 }
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(wrapper.exists()).toBe(true)
  })
})
