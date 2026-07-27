import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type UseCreateRoomFlowConfig, useCreateRoomFlow } from '@/composables/room/useCreateRoomFlow'

describe('useCreateRoomFlow — 创建房间分阶段流程 (§5.1)', () => {
  let createRoomMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createRoomMock = vi.fn().mockResolvedValue({ room_id: '!newroom:server' })
  })

  /** 将 mock 转为 composable 所需的函数类型 */
  function makeConfig(extra?: Partial<UseCreateRoomFlowConfig>): UseCreateRoomFlowConfig {
    return {
      createRoom: createRoomMock as unknown as UseCreateRoomFlowConfig['createRoom'],
      ...extra
    }
  }

  describe('阶段管理', () => {
    it('初始阶段为 create（创建阶段）', () => {
      const { stage } = useCreateRoomFlow(makeConfig())
      expect(stage.value).toBe('create')
    })

    it('创建成功后进入 invite（邀请阶段）', async () => {
      const { stage, createRoom } = useCreateRoomFlow(makeConfig())
      await createRoom('测试房间', 'group')
      expect(stage.value).toBe('invite')
    })

    it('跳过邀请后进入 done 阶段', async () => {
      const { stage, createRoom, skipInvite } = useCreateRoomFlow(makeConfig())
      await createRoom('测试房间', 'group')
      skipInvite()
      expect(stage.value).toBe('done')
    })

    it('重置后回到 create 阶段', async () => {
      const { stage, createRoom, reset } = useCreateRoomFlow(makeConfig())
      await createRoom('测试房间', 'group')
      reset()
      expect(stage.value).toBe('create')
    })
  })

  describe('创建参数', () => {
    it('使用默认值：preset=private_chat, encryption=true', async () => {
      const { createRoom } = useCreateRoomFlow(makeConfig())
      await createRoom('测试房间', 'group')

      expect(createRoomMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '测试房间',
          preset: 'private_chat',
          encrypted: true
        })
      )
    })

    it('创建成功后记录 roomId', async () => {
      const { createRoom, createdRoomId } = useCreateRoomFlow(makeConfig())
      await createRoom('测试房间', 'group')

      expect(createdRoomId.value).toBe('!newroom:server')
    })

    it('创建失败时不进入邀请阶段', async () => {
      createRoomMock.mockRejectedValueOnce(new Error('网络错误'))
      const { stage, createRoom } = useCreateRoomFlow(makeConfig())

      await expect(createRoom('测试房间', 'group')).rejects.toThrow('网络错误')
      expect(stage.value).toBe('create')
    })
  })

  describe('邀请阶段', () => {
    it('inviteMembers 调用邀请方法', async () => {
      const inviteUserMock = vi.fn().mockResolvedValue(undefined)
      const { createRoom, inviteMembers } = useCreateRoomFlow(makeConfig({ inviteUser: inviteUserMock }))

      await createRoom('测试房间', 'group')
      await inviteMembers(['@alice:server', '@bob:server'])

      expect(inviteUserMock).toHaveBeenCalledTimes(2)
      expect(inviteUserMock).toHaveBeenCalledWith('!newroom:server', '@alice:server')
      expect(inviteUserMock).toHaveBeenCalledWith('!newroom:server', '@bob:server')
    })

    it('邀请完成后进入 done 阶段', async () => {
      const inviteUserMock = vi.fn().mockResolvedValue(undefined)
      const { createRoom, inviteMembers, stage } = useCreateRoomFlow(makeConfig({ inviteUser: inviteUserMock }))

      await createRoom('测试房间', 'group')
      await inviteMembers(['@alice:server'])
      expect(stage.value).toBe('done')
    })
  })

  describe('表单验证', () => {
    it('房间名为空时 canCreate 为 false', () => {
      const { canCreate, roomName } = useCreateRoomFlow(makeConfig())
      roomName.value = ''
      expect(canCreate.value).toBe(false)
    })

    it('房间名非空时 canCreate 为 true', () => {
      const { canCreate, roomName } = useCreateRoomFlow(makeConfig())
      roomName.value = '我的房间'
      expect(canCreate.value).toBe(true)
    })

    it('纯空格房间名 canCreate 为 false', () => {
      const { canCreate, roomName } = useCreateRoomFlow(makeConfig())
      roomName.value = '   '
      expect(canCreate.value).toBe(false)
    })
  })
})
