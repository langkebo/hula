import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { MessageType } from '@/stores/domains/chat/chat'

const { toFriendInfoPage, getUserByIds } = vi.hoisted(() => ({
  toFriendInfoPage: vi.fn(),
  getUserByIds: vi.fn()
}))

vi.mock('@/utils/RouterUtils', () => ({ toFriendInfoPage }))
vi.mock('@/services/matrix/user/MatrixContactService', () => ({
  matrixContactService: { getUserByIds }
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: () => null,
    getUserDisplayName: () => '',
    updateUserItem: vi.fn(),
    isCurrentLord: () => false,
    isAdmin: () => false
  })
}))
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:hs', avatar: '' } })
}))

const { useMessageUser } = await import('../useMessageUser')

const buildMessage = () =>
  ({ message: { id: 'm1', roomId: 'room-1' }, fromUser: { uid: '@other:hs' } }) as unknown as MessageType

const setup = (avatarClickOpensProfile: boolean) => {
  const selectKey = ref('')
  const api = useMessageUser(
    { message: buildMessage(), fromUser: { uid: '@other:hs' }, isGroup: false },
    { selectKey, avatarClickOpensProfile }
  )
  return { api, selectKey }
}

describe('useMessageUser - 头像点击行为', () => {
  beforeEach(() => {
    toFriendInfoPage.mockClear()
    getUserByIds.mockResolvedValue([])
  })

  it('宿主声明移动端行为时进入个人资料页', () => {
    const { api } = setup(true)

    api.handleAvatarClick('@other:hs', 'm1')

    expect(toFriendInfoPage).toHaveBeenCalledWith('@other:hs')
  })

  it('默认（桌面）选中该消息，不跳转资料页', () => {
    const { api, selectKey } = setup(false)

    api.handleAvatarClick('@other:hs', 'm1')

    expect(toFriendInfoPage).not.toHaveBeenCalled()
    expect(selectKey.value).toBe('m1')
  })
})
