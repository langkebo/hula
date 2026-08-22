import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SpaceInviteBar from '../SpaceInviteBar.vue'

// === Mocks ===
const { searchUsersMock, inviteMock, showFeedbackMock } = vi.hoisted(() => ({
  searchUsersMock: vi.fn(),
  inviteMock: vi.fn(async () => true),
  showFeedbackMock: vi.fn()
}))

const membersRef = ref<Array<{ space_id: string; user_id: string; membership?: string; joined_ts?: number }>>([])

const selfId = '@me:server'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/space/useSpaceMembers', () => ({
  useSpaceMembers: () => ({
    members: membersRef,
    loading: ref(false),
    mutating: ref(false),
    load: vi.fn(async () => undefined),
    invite: inviteMock
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => ({ getUserId: () => selfId })
  }
}))

vi.mock('@/services/matrix/user/MatrixUserDirectoryService', () => ({
  userDirectoryService: { searchUsers: searchUsersMock }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })
}))

// === Helpers ===
const mountBar = (props: Record<string, unknown> = {}) =>
  mount(SpaceInviteBar, { props: { spaceId: '!space-1:server', ...props } })

const runSearch = async (wrapper: ReturnType<typeof mountBar>, query: string) => {
  const input = wrapper.find('input')
  await input.setValue(query)
  vi.advanceTimersByTime(300)
  await flushPromises()
}

describe('SpaceInviteBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    membersRef.value = []
    searchUsersMock.mockResolvedValue([])
    inviteMock.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the search input', () => {
    const wrapper = mountBar()
    expect(wrapper.find('.space-invite-bar__input').exists()).toBe(true)
  })

  it('debounces the directory search and calls searchUsers with trimmed query', async () => {
    searchUsersMock.mockResolvedValue([])
    const wrapper = mountBar()
    await wrapper.find('input').setValue('  ali  ')
    // 防抖未到 300ms 前不应调用
    expect(searchUsersMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(searchUsersMock).toHaveBeenCalledWith('ali', 20)
  })

  it('renders search results with display name and userId', async () => {
    searchUsersMock.mockResolvedValue([
      { userId: '@alice:server', displayName: 'Alice', avatarUrl: '' },
      { userId: '@bob:server', displayName: 'Bob', avatarUrl: 'https://example.com/b.png' }
    ])
    const wrapper = mountBar()
    await runSearch(wrapper, 'a')

    const items = wrapper.findAll('.space-invite-bar__item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Alice')
    expect(items[0].text()).toContain('@alice:server')
  })

  it('marks the current user as self and disables the item', async () => {
    membersRef.value = []
    searchUsersMock.mockResolvedValue([{ userId: selfId, displayName: 'Me', avatarUrl: '' }])
    const wrapper = mountBar()
    await runSearch(wrapper, 'me')

    const item = wrapper.find('.space-invite-bar__item')
    expect(item.text()).toContain('space.invite_self_tag')
    expect((item.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('marks an already-joined member and disables the item', async () => {
    membersRef.value = [{ space_id: '!space-1:server', user_id: '@alice:server', membership: 'join' }]
    searchUsersMock.mockResolvedValue([{ userId: '@alice:server', displayName: 'Alice', avatarUrl: '' }])
    const wrapper = mountBar()
    await runSearch(wrapper, 'a')

    const item = wrapper.find('.space-invite-bar__item')
    expect(item.text()).toContain('space.invite_already_member')
    expect((item.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('invites a user on click and removes the result on success', async () => {
    inviteMock.mockResolvedValue(true)
    searchUsersMock.mockResolvedValue([
      { userId: '@new:server', displayName: 'New', avatarUrl: '' },
      { userId: selfId, displayName: 'Me', avatarUrl: '' }
    ])
    const wrapper = mountBar()
    await runSearch(wrapper, 'n')

    // 第一个是 @new:server（非 self / 非 member，可点击）
    const target = wrapper.findAll('.space-invite-bar__item')[0]
    expect(target.text()).toContain('@new:server')
    expect((target.element as HTMLButtonElement).disabled).toBe(false)

    await target.trigger('click')
    await flushPromises()

    expect(inviteMock).toHaveBeenCalledWith('@new:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_success', 'success')
    // 成功后该结果被移除
    expect(wrapper.findAll('.space-invite-bar__item').map((i) => i.text())).not.toContain(
      expect.stringContaining('@new:server')
    )
  })

  it('shows failure feedback when invite rejects', async () => {
    inviteMock.mockResolvedValue(false)
    searchUsersMock.mockResolvedValue([{ userId: '@new:server', displayName: 'New', avatarUrl: '' }])
    const wrapper = mountBar()
    await runSearch(wrapper, 'n')

    await wrapper.find('.space-invite-bar__item').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_failed', 'error')
  })

  it('disables the input when the directory is unavailable (404)', async () => {
    searchUsersMock.mockRejectedValue(new Error('Request failed with status code 404'))
    const wrapper = mountBar()
    await runSearch(wrapper, 'a')

    expect(wrapper.find('.space-invite-bar__input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.space-invite-bar__hint').exists()).toBe(true)
  })
})
