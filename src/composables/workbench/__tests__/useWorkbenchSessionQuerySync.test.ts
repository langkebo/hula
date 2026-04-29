import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import {
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'
import { useWorkbenchSessionQuerySync } from '../useWorkbenchSessionQuerySync'

const flushAll = async () => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const createHarness = async (routeName = 'message') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/other' },
      { path: '/message', name: 'message', component: defineComponent({ template: '<div />' }) },
      { path: '/roomList', name: 'roomList', component: defineComponent({ template: '<div />' }) },
      { path: '/other', name: 'other', component: defineComponent({ template: '<div />' }) }
    ]
  })

  const Harness = defineComponent({
    setup() {
      const searchKeyword = ref('')
      const sessionTypeFilter = ref<WorkbenchSessionTypeFilter>(WORKBENCH_SESSION_TYPE_FILTERS.all)
      const sessionSort = ref<WorkbenchSessionSort>(WORKBENCH_SESSION_SORTS.recent)

      const setSearchKeyword = (value: string) => {
        searchKeyword.value = value
      }
      const setSessionTypeFilter = (value: WorkbenchSessionTypeFilter) => {
        sessionTypeFilter.value = value
      }
      const setSessionSort = (value: WorkbenchSessionSort) => {
        sessionSort.value = value
      }

      useWorkbenchSessionQuerySync({
        routeName,
        searchKeyword,
        sessionTypeFilter,
        sessionSort,
        setSearchKeyword,
        setSessionTypeFilter,
        setSessionSort
      })

      return {
        searchKeyword,
        sessionTypeFilter,
        sessionSort,
        setSearchKeyword,
        setSessionTypeFilter,
        setSessionSort
      }
    },
    template: '<div />'
  })

  const wrapper = mount(Harness, {
    global: {
      plugins: [router]
    }
  })

  await router.push('/other')
  await router.isReady()
  await flushAll()

  return { wrapper, router }
}

describe('useWorkbenchSessionQuerySync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hydrates local filters from the current route query', async () => {
    const { wrapper, router } = await createHarness('message')

    await router.push('/message?search=%20alice%20&type=group&sort=name')
    await flushAll()

    expect((wrapper.vm as any).searchKeyword).toBe('alice')
    expect((wrapper.vm as any).sessionTypeFilter).toBe('group')
    expect((wrapper.vm as any).sessionSort).toBe('name')

    wrapper.unmount()
  })

  it('writes local filter changes back to the active route query', async () => {
    const { wrapper, router } = await createHarness('message')
    const replaceSpy = vi.spyOn(router, 'replace')

    await router.push('/message')
    await flushAll()

    ;(wrapper.vm as any).setSearchKeyword('  alice  ')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushAll()

    ;(wrapper.vm as any).setSessionTypeFilter('group')
    await flushAll()

    ;(wrapper.vm as any).setSessionSort('name')
    await flushAll()

    expect(replaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'message',
        query: expect.objectContaining({
          search: 'alice'
        })
      })
    )
    expect(router.currentRoute.value.query).toMatchObject({
      search: 'alice',
      type: 'group',
      sort: 'name'
    })

    ;(wrapper.vm as any).setSearchKeyword('')
    ;(wrapper.vm as any).setSessionTypeFilter(WORKBENCH_SESSION_TYPE_FILTERS.all)
    ;(wrapper.vm as any).setSessionSort(WORKBENCH_SESSION_SORTS.recent)
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushAll()

    expect(router.currentRoute.value.query).toEqual({})

    wrapper.unmount()
  })

  it('does not write query changes when the route name does not match', async () => {
    const { wrapper, router } = await createHarness('roomList')
    const replaceSpy = vi.spyOn(router, 'replace')

    await router.push('/message')
    await flushAll()

    ;(wrapper.vm as any).setSearchKeyword('alice')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushAll()

    expect(replaceSpy).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query).toEqual({})

    wrapper.unmount()
  })
})
