import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PublicRoomDiscovery from '../PublicRoomDiscovery.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const stub = (name: string) =>
    defineComponent({
      name,
      props: { show: { type: Boolean, default: false }, value: { type: String, default: '' } },
      setup(_, { slots }) {
        return () => h('div', { class: name.toLowerCase() }, slots.default?.())
      }
    })
  return {
    NInput: stub('NInput'),
    NSpin: stub('NSpin'),
    NEmpty: stub('NEmpty'),
    NCard: stub('NCard'),
    NButton: stub('NButton')
  }
})

describe('PublicRoomDiscovery pagination', () => {
  it('exposes a nextBatch ref via defineExpose', () => {
    const wrapper = shallowMount(PublicRoomDiscovery, {
      props: { rooms: [], loading: false }
    })
    expect(wrapper.vm.nextBatch).toBeDefined()
  })

  it('exposes a loadMore function via defineExpose', () => {
    const wrapper = shallowMount(PublicRoomDiscovery, {
      props: { rooms: [], loading: false }
    })
    expect(typeof wrapper.vm.loadMore).toBe('function')
  })
})
