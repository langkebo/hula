import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PermissionGuard from '../PermissionGuard.vue'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn(() => null) }
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: { getCapabilities: vi.fn().mockResolvedValue({}) }
}))

import { useCapabilityStore } from '@/stores/domains/chat/capability'

describe('PermissionGuard §16.5.3 (layer 2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the default slot when capability is granted', async () => {
    const store = useCapabilityStore()
    store.setCapabilities({ capabilities: { 'm.voip': true } })

    const wrapper = mount(PermissionGuard, {
      props: { require: 'voip' },
      slots: { default: '<button class="real">Call</button>' }
    })
    await flushPromises()

    expect(wrapper.find('.real').exists()).toBe(true)
    expect(wrapper.find('.hula-permission-gate').exists()).toBe(false)
    expect(wrapper.emitted('granted')).toBeTruthy()
  })

  it('grays out (default mode) when capability is missing, emits denied', async () => {
    const wrapper = mount(PermissionGuard, {
      props: { require: 'voip' },
      slots: { default: '<button class="real">Call</button>' }
    })
    await flushPromises()

    expect(wrapper.find('.hula-permission-gate').exists()).toBe(true)
    expect(wrapper.find('.real').exists()).toBe(true) // still present, but grayed
    expect(wrapper.emitted('denied')?.[0]).toEqual([['voip']])
  })

  it('hides the slot entirely when mode="hide"', async () => {
    const wrapper = mount(PermissionGuard, {
      props: { require: 'admin-api', mode: 'hide' },
      slots: { default: '<button class="real">Admin</button>' }
    })
    await flushPromises()

    expect(wrapper.find('.real').exists()).toBe(false)
    expect(wrapper.find('.hula-permission-gate').exists()).toBe(false)
    expect(wrapper.emitted('denied')?.[0]).toEqual([['admin-api']])
  })

  it('blocks interaction on the grayed-out affordance', async () => {
    const wrapper = mount(PermissionGuard, {
      props: { require: 'voip' },
      slots: { default: '<button class="real">Call</button>' }
    })
    await flushPromises()

    const gate = wrapper.find('.hula-permission-gate')
    await gate.trigger('click')
    // the second `denied` event fires from the click handler
    const events = wrapper.emitted('denied') || []
    expect(events.length).toBeGreaterThanOrEqual(2)
  })

  it('supports an array of capabilities — all must be granted', async () => {
    const store = useCapabilityStore()
    store.setCapabilities({ capabilities: { 'io.hula.admin': true } })

    const wrapper = mount(PermissionGuard, {
      props: { require: ['admin-api', 'friend-list'] },
      slots: { default: '<button class="real">X</button>' }
    })
    await flushPromises()

    // admin-api granted but friend-list missing → denied
    expect(wrapper.emitted('denied')?.[0]).toEqual([['friend-list']])
    expect(wrapper.find('.hula-permission-gate').exists()).toBe(true)
  })
})
