/**
 * 创建房间分阶段流程 Composable (§5.1)
 *
 * 将创建房间流程拆为 2 阶段：
 * 1. create — 必填阶段（名称 + 类型），使用默认隐私/加密设置
 * 2. invite — 可选阶段（邀请成员），可跳过
 *
 * 核心路径从 5 步缩减为 2 步，创建后立即进入房间，
 * 邀请步骤异步执行不阻塞。
 */

import { computed, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useCreateRoomFlow')

type CreateRoomStage = 'create' | 'invite' | 'done'

type RoomType = 'group' | 'channel' | 'space'

export interface CreateRoomResult {
  room_id: string
}

export interface UseCreateRoomFlowConfig {
  createRoom: (options: Record<string, unknown>) => Promise<CreateRoomResult>
  inviteUser?: (roomId: string, userId: string) => Promise<void>
}

export function useCreateRoomFlow(config: UseCreateRoomFlowConfig) {
  const stage = ref<CreateRoomStage>('create')
  const roomName = ref('')
  const roomType = ref<RoomType>('group')
  const createdRoomId = ref<string | null>(null)
  const isCreating = ref(false)
  const isInviting = ref(false)
  const error = ref<string | null>(null)

  /** 房间名非空时可创建 */
  const canCreate = computed(() => roomName.value.trim().length > 0)

  /**
   * 第一阶段：创建房间
   * 使用默认值 preset=private_chat, encryption=true
   */
  async function createRoom(name: string, type: RoomType = 'group'): Promise<CreateRoomResult> {
    if (!name.trim()) {
      throw new Error('房间名不能为空')
    }

    isCreating.value = true
    error.value = null

    try {
      const options: Record<string, unknown> = {
        name: name.trim(),
        preset: 'private_chat',
        encrypted: true
      }

      if (type === 'space') {
        options.creation_content = { type: 'm.space' }
      }

      const result = await config.createRoom(options)
      createdRoomId.value = result.room_id
      roomName.value = name
      roomType.value = type
      stage.value = 'invite'
      logger.info(`[CreateRoomFlow] 房间创建成功: ${result.room_id}`)
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      logger.error('[CreateRoomFlow] 房间创建失败:', err)
      throw err
    } finally {
      isCreating.value = false
    }
  }

  /**
   * 第二阶段：邀请成员（可批量）
   */
  async function inviteMembers(userIds: string[]): Promise<void> {
    if (!createdRoomId.value || !config.inviteUser) {
      stage.value = 'done'
      return
    }

    isInviting.value = true
    try {
      const roomId = createdRoomId.value
      await Promise.all(userIds.map((userId) => config.inviteUser!(roomId, userId)))
      logger.info(`[CreateRoomFlow] 邀请 ${userIds.length} 个成员完成`)
    } catch (err) {
      logger.error('[CreateRoomFlow] 部分邀请失败:', err)
      throw err
    } finally {
      isInviting.value = false
      stage.value = 'done'
    }
  }

  /**
   * 跳过邀请步骤
   */
  function skipInvite(): void {
    stage.value = 'done'
    logger.info('[CreateRoomFlow] 跳过邀请步骤')
  }

  /**
   * 重置流程，回到第一阶段
   */
  function reset(): void {
    stage.value = 'create'
    roomName.value = ''
    roomType.value = 'group'
    createdRoomId.value = null
    isCreating.value = false
    isInviting.value = false
    error.value = null
  }

  return {
    stage,
    roomName,
    roomType,
    createdRoomId,
    isCreating,
    isInviting,
    error,
    canCreate,
    createRoom,
    inviteMembers,
    skipInvite,
    reset
  }
}
