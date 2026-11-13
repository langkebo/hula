import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AddFriends from '../AddFriends.vue'

enableAutoUnmount(afterEach)

/**
 * F-8：添加好友搜索的 300ms 防抖、卸载清理与空态。
 *
 * 搜索本身由 useFriends 提供（内部 useDebounceFn 300ms），
 * 这里用真实 useDebounceFn 包裹 spy，验证组件把输入变化接到防抖搜索上。
 */

const mocks = vi.hoisted(() => ({
  executeSearch: vi.fn(),
  state: {} as {
    searchValue?: { value: string }
    searchResults?: { value: unknown[] }
    hasSearched?: { value: boolean }
    searchType?: { value: string }
  }
}))

vi.mock('@/composables/useFriends', async () => {
  const { ref } = await import('vue')
  const { useDebounceFn } = await import('@vueuse/core')
  const searchType = ref('user')
  const searchValue = ref('')
  const searchResults = ref<unknown[]>([])
  const hasSearched = ref(false)
  mocks.state = { searchType, searchValue, searchResults, hasSearched }
  return {
    useFriends: () => ({
      searchType,
      searchValue,
      searchResults,
      hasSearched,
      loading: ref(false),
      initialLoading: ref(false),
      handleSearch: useDebounceFn(mocks.executeSearch, 300),
      handleClear: vi.fn(),
      handleTypeChange: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      getActionKind: vi.fn(() => 'add')
    })
  }
})

vi.mock('@/components/common/FloatBlockList.vue', () => ({
  default: { name: 'FloatBlockList', template: '<div class="float-block-list" />' }
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>'
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />' }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ setAddFriendTarget: vi.fn(), setAddGroupTarget: vi.fn() })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/composables/common/useClipboard', () => ({
  useClipboard: () => ({ write: vi.fn().mockResolvedValue(undefined) })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (avatar?: string) => avatar || '/logo.png' }
}))

vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn() }))

vi.mock('@/router', () => ({ default: { push: vi.fn() } }))

// 模板中的 van-* 未显式 import（靠自动注册），测试里手动注册轻量替身
const { defineComponent } = await import('vue')
const passthrough = (name: string, tag = 'div') =>
  defineComponent({ name, inheritAttrs: false, template: `<${tag}><slot /></${tag}>` })
const vantStubs = {
  'van-tabs': passthrough('VanTabs'),
  'van-tab': passthrough('VanTab'),
  'van-loading': passthrough('VanLoading'),
  'van-button': passthrough('VanButton', 'button'),
  'van-empty': defineComponent({
    name: 'VanEmpty',
    props: ['description', 'image'],
    template: '<div class="van-empty">{{ description }}</div>'
  }),
  'van-field': defineComponent({
    name: 'VanField',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'clear'],
    template: '<input :value="modelValue" :placeholder="placeholder" />'
  })
}

const mountPage = () => mount(AddFriends, { global: { components: vantStubs } })
type PageVm = { searchValue: string }

describe('AddFriends 搜索防抖与空态（F-8）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.state.searchValue!.value = ''
    mocks.state.searchResults!.value = []
    mocks.state.hasSearched!.value = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('连续输入只触发最后一次搜索（300ms 防抖）', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as unknown as PageVm
    await nextTick()

    vm.searchValue = '张'
    await nextTick()
    vm.searchValue = '张三'
    await nextTick()
    vm.searchValue = '张三丰'
    await nextTick()

    vi.advanceTimersByTime(299)
    expect(mocks.executeSearch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(mocks.executeSearch).toHaveBeenCalledTimes(1)
  })

  it('组件卸载时清理未触发的防抖 timer', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as unknown as PageVm
    await nextTick()

    vm.searchValue = '张三'
    await nextTick()
    vi.advanceTimersByTime(100)

    wrapper.unmount()
    vi.advanceTimersByTime(1000)

    expect(mocks.executeSearch).not.toHaveBeenCalled()
  })

  it('关键词非空且无结果时展示「未找到该用户」空态', async () => {
    const wrapper = mountPage()
    await nextTick()

    mocks.state.searchValue!.value = 'nobody'
    mocks.state.searchResults!.value = []
    mocks.state.hasSearched!.value = true
    await nextTick()

    expect(wrapper.text()).toContain('mobile_contact.search_no_user')
    expect(wrapper.text()).not.toContain('mobile_contact.search_keyword_hint')
  })

  it('关键词为空时展示默认搜索提示而非空结果态', async () => {
    const wrapper = mountPage()
    await nextTick()

    expect(wrapper.text()).toContain('mobile_contact.search_keyword_hint')
    expect(wrapper.text()).not.toContain('mobile_contact.search_no_user')
  })
})
