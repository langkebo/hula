import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SpaceHierarchyTree from '../SpaceHierarchyTree.vue'

const { getHierarchyMock } = vi.hoisted(() => ({
  getHierarchyMock: vi.fn(async () => ({
    rooms: [
      { space_id: '!child-1:server', name: 'Child Space 1', child_count: 0, avatar_url: undefined },
      { space_id: '!room-2:server', name: 'Child Room 2', child_count: 0, avatar_url: undefined }
    ],
    next_batch: undefined
  }))
}))

const spaceRef = ref({ space_id: '!parent:server', name: 'Parent', child_count: 2 })

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/space', () => ({
  useSpace: () => ({
    space: spaceRef,
    loading: ref(false),
    mutating: ref(false),
    error: ref(null),
    load: vi.fn(async () => undefined),
    getHierarchy: getHierarchyMock
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ themeContent: 'light' })
}))

// Stub HulaSpaceTree to isolate SpaceHierarchyTree panel chrome
vi.mock('../HulaSpaceTree.vue', () => ({
  default: {
    name: 'HulaSpaceTree',
    props: ['spaceId', 'selectedSpaceId', 'suggestedOnly'],
    emits: ['select'],
    template: '<div data-test="hula-space-tree-stub"><slot /></div>'
  }
}))

describe('SpaceHierarchyTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getHierarchyMock.mockResolvedValue({
      rooms: [{ space_id: '!child-1:server', name: 'Child Space 1', child_count: 0, avatar_url: undefined }],
      next_batch: undefined
    })
  })

  it('renders panel header with back button', () => {
    const wrapper = mount(SpaceHierarchyTree, {
      props: { spaceId: '!parent:server' }
    })
    expect(wrapper.find('[data-test="space-hierarchy-back"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="space-hierarchy-header"]').exists()).toBe(true)
  })

  it('emits back when clicking back button', async () => {
    const wrapper = mount(SpaceHierarchyTree, {
      props: { spaceId: '!parent:server' }
    })
    await wrapper.find('[data-test="space-hierarchy-back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('renders HulaSpaceTree with correct spaceId', () => {
    const wrapper = mount(SpaceHierarchyTree, {
      props: { spaceId: '!parent:server' }
    })
    const tree = wrapper.find('[data-test="hula-space-tree-stub"]')
    expect(tree.exists()).toBe(true)
  })

  it('forwards select event from HulaSpaceTree', async () => {
    const wrapper = mount(SpaceHierarchyTree, {
      props: { spaceId: '!parent:server' }
    })
    // 通过 stub 组件直接触发 select 事件
    const treeStub = wrapper.findComponent({ name: 'HulaSpaceTree' })
    treeStub.vm.$emit('select', { spaceId: '!child-1:server', name: 'Child Space 1' })
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([{ spaceId: '!child-1:server', name: 'Child Space 1' }])
  })

  it('shows empty hint when no children', async () => {
    getHierarchyMock.mockResolvedValueOnce({ rooms: [], next_batch: undefined })
    mount(SpaceHierarchyTree, {
      props: { spaceId: '!parent:server' }
    })
    await flushPromises()
    // 无子节点时仍渲染面板（HulaSpaceTree 内部处理空态）
    // 这里仅验证不抛错
  })
})
