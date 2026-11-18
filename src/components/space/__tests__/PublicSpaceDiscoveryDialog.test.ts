import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicSpaceDiscoveryDialog from '../PublicSpaceDiscoveryDialog.vue'

// === Mocks ===
const {
  getPublicSpacesMock,
  searchSpacesMock,
  getSpaceHierarchyMock,
  joinSpaceMock,
  knockSpaceMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  getPublicSpacesMock: vi.fn(),
  searchSpacesMock: vi.fn(),
  getSpaceHierarchyMock: vi.fn(),
  joinSpaceMock: vi.fn(),
  knockSpaceMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    getPublicSpaces: getPublicSpacesMock,
    searchSpaces: searchSpacesMock,
    getSpaceHierarchy: getSpaceHierarchyMock,
    joinSpace: joinSpaceMock,
    knockSpace: knockSpaceMock
  }
}))

// === Helpers ===
const publicSpace = {
  spaceId: '!space-1:server',
  name: 'Design Guild',
  topic: 'Design system discussions',
  memberCount: 42,
  childCount: 2,
  joinRule: 'public' as const
}

const NModalStub = {
  props: ['show'],
  emits: ['update:show'],
  template: '<div v-if="show" data-testid="psd-modal"><slot /></div>'
}

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(PublicSpaceDiscoveryDialog, {
    props: { show: true, ...props },
    global: { stubs: { Modal: NModalStub } }
  })

const submitSearch = async (wrapper: ReturnType<typeof mountDialog>, keyword: string) => {
  const input = wrapper.get('[data-testid="psd-keyword"] input')
  await input.setValue(keyword)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  getPublicSpacesMock.mockReset()
  searchSpacesMock.mockReset()
  getSpaceHierarchyMock.mockReset()
  joinSpaceMock.mockReset()
  knockSpaceMock.mockReset()
  showFeedbackMock.mockReset()
  getPublicSpacesMock.mockResolvedValue([])
  searchSpacesMock.mockResolvedValue([])
  getSpaceHierarchyMock.mockResolvedValue({ rooms: [] })
  joinSpaceMock.mockResolvedValue(undefined)
  knockSpaceMock.mockResolvedValue(undefined)
})

describe('PublicSpaceDiscoveryDialog', () => {
  it('打开时加载并渲染公开空间列表', async () => {
    getPublicSpacesMock.mockResolvedValue([publicSpace])
    const wrapper = mountDialog()
    await flushPromises()

    expect(getPublicSpacesMock).toHaveBeenCalledWith(50, { throwOnError: true })
    const items = wrapper.findAll('[data-testid="psd-item"]')
    expect(items).toHaveLength(1)
    expect(items[0].get('[data-testid="psd-name"]').text()).toBe('Design Guild')
    expect(items[0].text()).toContain('space.member_count_value')
  })

  it('按关键词搜索公开空间', async () => {
    searchSpacesMock.mockResolvedValue([publicSpace])
    const wrapper = mountDialog()
    await flushPromises()

    await submitSearch(wrapper, 'design')

    expect(searchSpacesMock).toHaveBeenCalledWith('design', 20, { throwOnError: true })
    expect(wrapper.findAll('[data-testid="psd-item"]')).toHaveLength(1)
  })

  it('搜索失败时展示错误提示', async () => {
    searchSpacesMock.mockRejectedValueOnce(new Error('network down'))
    const wrapper = mountDialog()
    await flushPromises()

    await submitSearch(wrapper, 'design')

    expect(wrapper.get('[data-testid="psd-error"]').text()).toBe('space.load_failed')
    expect(wrapper.findAll('[data-testid="psd-item"]')).toHaveLength(0)
  })

  it('无搜索结果时展示空态', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.get('[data-testid="psd-empty"]').text()).toBe('space.no_results')
  })

  it('加入成功后给出反馈、禁用按钮并抛出 joined 事件', async () => {
    getPublicSpacesMock.mockResolvedValue([publicSpace])
    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.get('[data-testid="psd-join"]').trigger('click')
    await flushPromises()

    expect(joinSpaceMock).toHaveBeenCalledWith('!space-1:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.join_success', 'success')
    expect(wrapper.emitted('joined')).toEqual([['!space-1:server']])
    expect(wrapper.get('[data-testid="psd-join"]').attributes('disabled')).toBeDefined()
  })

  it('浏览子空间时展示层级中的子空间', async () => {
    getPublicSpacesMock.mockResolvedValue([publicSpace])
    getSpaceHierarchyMock.mockResolvedValue({
      rooms: [
        { room_id: '!child-1:server', room_type: 'm.space', name: 'Child Space', num_joined_members: 7 },
        { room_id: '!room-1:server', room_type: 'm.room', name: 'Normal Room' }
      ]
    })
    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.get('[data-testid="psd-browse"]').trigger('click')
    await flushPromises()

    expect(getSpaceHierarchyMock).toHaveBeenCalledWith('!space-1:server', { maxDepth: 2 })
    const children = wrapper.findAll('[data-testid="psd-child"]')
    expect(children).toHaveLength(1)
    expect(children[0].text()).toContain('Child Space')
  })

  it('子空间读取失败时展示错误与重试，而不是「暂无子空间」空态', async () => {
    getPublicSpacesMock.mockResolvedValue([publicSpace])
    getSpaceHierarchyMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.get('[data-testid="psd-browse"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="psd-children-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="psd-children-error"] [data-testid="error-retry"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="psd-children-empty"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="psd-child"]')).toHaveLength(0)
  })

  it('子空间读取失败后点击重试可恢复展示子空间', async () => {
    getPublicSpacesMock.mockResolvedValue([publicSpace])
    getSpaceHierarchyMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({
      rooms: [{ room_id: '!child-1:server', room_type: 'm.space', name: 'Child Space', num_joined_members: 7 }]
    })
    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.get('[data-testid="psd-browse"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="psd-children-error"]').exists()).toBe(true)

    await wrapper.get('[data-testid="psd-children-error"] [data-testid="error-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="psd-children-error"]').exists()).toBe(false)
    const children = wrapper.findAll('[data-testid="psd-child"]')
    expect(children).toHaveLength(1)
    expect(children[0].text()).toContain('Child Space')
  })
})
