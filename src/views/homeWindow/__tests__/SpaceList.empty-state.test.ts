/**
 * M-2 反馈循环测试：空间页缺少数据/未显示空状态组件
 *
 * 测试场景：登录 test1（无空间）后导航到空间页
 * 预期：加载完成后应显示空状态组件（n-empty）
 * 实际（测试报告）：空间页无数据，未显示空状态组件
 *
 * 验证三个层级：
 * 1. SpaceListPane 组件层：spaces=[] + loading=false → 空状态应渲染
 * 2. SpaceList 集成层：useSpaces 返回空列表 → 空状态应渲染
 * 3. 加载中 → 加载完成 → 空状态的过渡
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import SpaceListView from '../SpaceList.vue'

const {
  routerPushMock,
  showFeedbackMock,
  announceMock,
  roomHasTagMock,
  addRoomTagMock,
  removeRoomTagMock,
  loadSpacesMock,
  leaveSpaceMock,
  deleteSpaceMock
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  announceMock: vi.fn(),
  roomHasTagMock: vi.fn(() => false),
  addRoomTagMock: vi.fn(async () => undefined),
  removeRoomTagMock: vi.fn(async () => undefined),
  loadSpacesMock: vi.fn(async () => undefined),
  leaveSpaceMock: vi.fn(async () => undefined),
  deleteSpaceMock: vi.fn(async () => undefined)
}))

// 可变的 spaces ref，用于模拟 test1 无空间的场景
const spacesRef = ref<
  Array<{ spaceId: string; name: string; topic?: string; childCount: number; memberCount: number; avatarUrl?: string }>
>([])
const loadingRef = ref(false)

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'space', path: '/space', params: {}, query: {} }),
  useRouter: () => ({ push: routerPushMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({ announce: announceMock })
}))

vi.mock('@/composables/search/useSearchShortcut', () => ({
  triggerGlobalSearch: vi.fn()
}))

vi.mock('@/composables/space', () => ({
  useSpaces: () => ({
    spaces: computed(() => spacesRef.value),
    loading: computed(() => loadingRef.value),
    load: loadSpacesMock
  })
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    leaveSpace: leaveSpaceMock,
    deleteSpace: deleteSpaceMock
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '' })
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({
    hasTag: roomHasTagMock,
    addRoomTag: addRoomTagMock,
    removeRoomTag: removeRoomTagMock
  })
}))

describe('SpaceListView M-2: 空状态渲染（test1 无空间场景）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 模拟 test1：无任何空间
    spacesRef.value = []
    loadingRef.value = false
    roomHasTagMock.mockReturnValue(false)
    loadSpacesMock.mockResolvedValue(undefined)
  })

  it('加载完成且 spaces 为空时，应显示空状态组件（EmptyState no-spaces）', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    // 空状态组件应存在
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    // 应渲染 no-spaces 插图
    expect(wrapper.find('[data-testid="illustration-no-spaces"]').exists()).toBe(true)
    // 不应显示骨架屏
    expect(wrapper.findAll('.skeleton-base').length).toBe(0)
    // 不应显示空间卡片
    expect(wrapper.findAll('[data-test="space-card"]').length).toBe(0)
  })

  it('加载中应显示骨架屏，加载完成后切换为空状态', async () => {
    // 初始为加载中
    loadingRef.value = true
    const wrapper = mount(SpaceListView)
    await flushPromises()

    // 加载中：骨架屏显示
    expect(wrapper.findAll('.skeleton-base').length).toBeGreaterThan(0)
    expect(wrapper.find('.empty-state').exists()).toBe(false)

    // 加载完成
    loadingRef.value = false
    await flushPromises()
    // 等待 transition 完成
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 空状态应显示
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.findAll('.skeleton-base').length).toBe(0)
  })

  it('空状态应显示正确的提示文案（space.no_spaces_yet）', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    const emptyEl = wrapper.find('.empty-state')
    expect(emptyEl.exists()).toBe(true)
    // 默认 filter=all，空状态文案应为 space.no_spaces_yet
    expect(emptyEl.text()).toContain('space.no_spaces_yet')
  })

  it('空状态应显示"创建空间"快捷操作按钮', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    const emptyEl = wrapper.find('.empty-state')
    expect(emptyEl.exists()).toBe(true)
    // EmptyState 的 actionText 引导按钮应存在
    const createBtn = emptyEl.find('[data-testid="empty-action"]')
    expect(createBtn.exists()).toBe(true)
  })

  it('getSpaces 抛错时，spaces 仍为空，应显示空状态（而非白屏）', async () => {
    // 模拟 useSpaces.load 内部捕获错误后：spaces 保持空、loading 完成
    // （真实 useSpaces.load 会 catch 错误并设置 error.value，不会向外抛出）
    spacesRef.value = []
    loadingRef.value = false
    loadSpacesMock.mockResolvedValue(undefined)

    const wrapper = mount(SpaceListView)
    await flushPromises()

    // 即使加载失败，空状态也应显示（不应白屏）
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })
})
