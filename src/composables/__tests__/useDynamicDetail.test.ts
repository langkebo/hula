import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { getDynamicStatusTagType, type UseDynamicDetailOptions, useDynamicDetail } from '../useDynamicDetail'

const { routeMock, startRenderSampleMock, completeRenderSampleMock } = vi.hoisted(() => ({
  routeMock: { params: {} as Record<string, string>, query: {} as Record<string, string> },
  startRenderSampleMock: vi.fn(),
  completeRenderSampleMock: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeMock
}))

vi.mock('@/utils/AppHarness', () => ({
  startRenderSample: startRenderSampleMock,
  completeRenderSampleOnNextFrame: completeRenderSampleMock
}))

/** 在真实组件 setup 中执行 composable，避免 onMounted 脱离组件实例触发告警。 */
function mountDetail(options: UseDynamicDetailOptions) {
  let state!: ReturnType<typeof useDynamicDetail>
  const Comp = defineComponent({
    setup() {
      state = useDynamicDetail(options)
      return () => h('div', state.selectedItem.value.title)
    }
  })

  mount(Comp)
  return state
}

describe('useDynamicDetail', () => {
  beforeEach(() => {
    routeMock.params = {}
    routeMock.query = {}
    startRenderSampleMock.mockClear()
    completeRenderSampleMock.mockClear()
  })

  it('falls back to the shared detail item when the route carries no id', () => {
    const state = mountDetail({ sampleName: 'desktop-dynamic-detail', routePrefix: '/dynamic' })

    expect(state.detailId.value).toBe('detail')
    expect(state.selectedItem.value.id).toBe('detail')
    expect(startRenderSampleMock).toHaveBeenCalledWith('desktop-dynamic-detail', {
      route: '/dynamic/detail',
      meta: { source: 'page-entry' }
    })
  })

  it('reads the detail id from route params and reports the platform route prefix', () => {
    routeMock.params = { id: 'feed' }
    const state = mountDetail({ sampleName: 'mobile-dynamic-detail', routePrefix: '/mobile/dynamic' })

    expect(state.detailId.value).toBe('feed')
    expect(state.selectedItem.value.id).toBe('feed')
    expect(startRenderSampleMock).toHaveBeenCalledWith('mobile-dynamic-detail', {
      route: '/mobile/dynamic/feed',
      meta: { source: 'page-entry' }
    })
  })

  it('reads the detail id from the query as a fallback', () => {
    routeMock.query = { id: 'publisher' }
    const state = mountDetail({ sampleName: 'mobile-dynamic-detail', routePrefix: '/mobile/dynamic' })

    expect(state.detailId.value).toBe('publisher')
    expect(state.selectedItem.value.id).toBe('publisher')
  })

  it('completes the render sample once the page is mounted', () => {
    routeMock.params = { id: 'detail' }
    mountDetail({ sampleName: 'mobile-dynamic-detail', routePrefix: '/mobile/dynamic' })

    expect(completeRenderSampleMock).toHaveBeenCalledWith('mobile-dynamic-detail', {
      route: '/mobile/dynamic/detail'
    })
  })

  it('maps roadmap statuses to a shared tag type', () => {
    expect(getDynamicStatusTagType('in-progress')).toBe('primary')
    expect(getDynamicStatusTagType('blocked')).toBe('warning')
    expect(getDynamicStatusTagType('planned')).toBe('default')
  })
})
