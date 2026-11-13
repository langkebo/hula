import dayjs from 'dayjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PowerEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'

const { groupState, userState, globalState, settingState } = vi.hoisted(() => ({
  groupState: {
    userList: [] as Array<{ uid: string; roleId?: number }>,
    currentLordId: '',
    adminUidList: [] as string[]
  },
  userState: {
    userInfo: { uid: 'me', power: undefined as number | undefined }
  },
  globalState: {
    currentSession: { type: 1 } as { type: number } | null,
    currentSessionRoomId: 'room-1'
  },
  settingState: {
    recallTime: 120
  }
}))

vi.mock('@/stores/domains/chat/group', () => ({ useGroupStore: () => groupState }))
vi.mock('@/stores/domains/user/user', () => ({ useUserStore: () => userState }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => globalState }))
vi.mock('@/stores/domains/settings/setting', () => ({ useSettingStore: () => settingState }))

const { useGroupRoleGuard } = await import('../useGroupRoleGuard')

/** 构造最小消息项：仅撤回判定需要的 fromUser / sendTime */
const buildMessage = (uid: string, minutesAgo: number): MessageType =>
  ({
    fromUser: { uid },
    message: { sendTime: dayjs().subtract(minutesAgo, 'minute').format('YYYY-MM-DD HH:mm:ss') }
  }) as unknown as MessageType

describe('useGroupRoleGuard - 撤回时限', () => {
  beforeEach(() => {
    groupState.userList = [{ uid: 'me', roleId: RoleEnum.NORMAL }]
    groupState.currentLordId = 'lord'
    groupState.adminUidList = []
    userState.userInfo = { uid: 'me', power: undefined }
    globalState.currentSession = { type: RoomTypeEnum.GROUP }
    settingState.recallTime = 120
  })

  it('普通成员只对自己的消息显示撤回入口', () => {
    const { canRecallMessage } = useGroupRoleGuard()

    expect(canRecallMessage(buildMessage('me', 1))).toBe(true)
    expect(canRecallMessage(buildMessage('other', 1))).toBe(false)
  })

  it('按 settingStore.recallTime 判定时限（默认 2 分钟）', () => {
    const { isRecallExpired } = useGroupRoleGuard()

    expect(isRecallExpired(buildMessage('me', 1))).toBe(false)
    expect(isRecallExpired(buildMessage('me', 3))).toBe(true)

    settingState.recallTime = 600
    expect(isRecallExpired(buildMessage('me', 5))).toBe(false)
    expect(isRecallExpired(buildMessage('me', 11))).toBe(true)
  })

  it('系统管理员可撤回任意消息且不受时限约束', () => {
    userState.userInfo = { uid: 'me', power: PowerEnum.ADMIN }
    const { canRecallMessage, isRecallExpired } = useGroupRoleGuard()
    const message = buildMessage('other', 60)

    expect(canRecallMessage(message)).toBe(true)
    expect(isRecallExpired(message)).toBe(false)
  })

  it('群主 / 群管理撤回自己的历史消息不受时限约束', () => {
    groupState.userList = [{ uid: 'me', roleId: RoleEnum.ADMIN }]
    const { isRecallExpired } = useGroupRoleGuard()

    expect(isRecallExpired(buildMessage('me', 60))).toBe(false)
  })

  it('单聊不因群角色放行，仍按本人 + 时限判定', () => {
    globalState.currentSession = { type: RoomTypeEnum.SINGLE }
    groupState.userList = [{ uid: 'me', roleId: RoleEnum.LORD }]
    const { canRecallMessage, isRecallExpired } = useGroupRoleGuard()

    expect(canRecallMessage(buildMessage('other', 1))).toBe(false)
    expect(isRecallExpired(buildMessage('me', 3))).toBe(true)
  })
})
