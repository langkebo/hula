import { computed, shallowReactive } from 'vue'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomQueryFacade } from '@/services/matrix/room/QueryFacade'
import { Direction, EventType } from '@/services/matrix/sdk'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { MatrixGroupInfo } from './types'

const logger = createLogger('GroupStore.Info')

/**
 * 群信息模块：群资料加载与 name/topic/avatar/可见性等元数据维护。
 */
export function createGroupInfo() {
  const globalStore = useGlobalStore()

  const groupInfoMap = shallowReactive<Record<string, MatrixGroupInfo>>({})

  const currentGroupInfo = computed(() => {
    const roomId = globalStore.currentSessionRoomId
    return roomId ? groupInfoMap[roomId] : null
  })

  const countInfo = computed(() => currentGroupInfo.value)

  const getGroupDetailByRoomId = computed(() => (roomId: string) => {
    return groupInfoMap[roomId] || null
  })

  const groupDetails = computed(() => Object.values(groupInfoMap))

  async function loadGroupInfo(roomId: string): Promise<MatrixGroupInfo | null> {
    try {
      const room = await matrixRoomQueryFacade.getRoom(roomId, false)
      if (!room) {
        return null
      }

      const state = room.getLiveTimeline().getState(Direction.Forward)
      const createEvent = state?.getStateEvents(EventType.RoomCreate, '')
      const creator = createEvent?.getSender() || null

      const groupInfo: MatrixGroupInfo = {
        roomId,
        name: room.name || roomId,
        avatarUrl: room.getMxcAvatarUrl?.() || null,
        avatar: room.getMxcAvatarUrl?.() || '',
        topic:
          ((room.currentState.getStateEvents(EventType.RoomTopic, '')?.getContent() as Record<string, unknown>)
            ?.topic as string) || null,
        memberCount: room.getJoinedMembers().length,
        memberNum: room.getJoinedMembers().length,
        // onlineNum 留空由 presence 同步流填写；不要用 memberCount 冒充
        isEncrypted: await matrixCryptoService.isRoomEncrypted(roomId),
        isPublic: room.currentState.getStateEvents(EventType.RoomJoinRules, '')?.getContent()?.join_rule === 'public',
        creator,
        groupName: room.name || roomId,
        roleId: 0,
        account: '',
        myName: '',
        allowScanEnter: false
      }

      groupInfoMap[roomId] = groupInfo
      return groupInfo
    } catch (err) {
      logger.error(`[GroupStore] 加载群组信息失败: ${err}`)
      return null
    }
  }

  async function setRoomName(roomId: string, name: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.setRoomName(roomId, name)
      if (groupInfoMap[roomId]) {
        groupInfoMap[roomId] = { ...groupInfoMap[roomId], name }
      }
      logger.info(`[GroupStore] 设置房间名称成功: ${name}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 设置房间名称失败: ${err}`)
      return false
    }
  }

  async function setRoomTopic(roomId: string, topic: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.setRoomTopic(roomId, topic)
      if (groupInfoMap[roomId]) {
        groupInfoMap[roomId] = { ...groupInfoMap[roomId], topic }
      }
      logger.info(`[GroupStore] 设置房间主题成功`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 设置房间主题失败: ${err}`)
      return false
    }
  }

  async function setRoomAvatar(roomId: string, avatarUrl: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.setRoomAvatar(roomId, avatarUrl)
      if (groupInfoMap[roomId]) {
        groupInfoMap[roomId] = { ...groupInfoMap[roomId], avatar: avatarUrl }
      }
      logger.info(`[GroupStore] 设置房间头像成功`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 设置房间头像失败: ${err}`)
      return false
    }
  }

  async function setVisibility(roomId: string, visibility: 'public' | 'private'): Promise<boolean> {
    try {
      await matrixRoomActionFacade.setRoomVisibility(roomId, visibility)
      logger.info(`[GroupStore] 设置房间可见性成功: ${visibility}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 设置房间可见性失败: ${err}`)
      return false
    }
  }

  async function getVisibility(roomId: string): Promise<'public' | 'private'> {
    try {
      return await matrixRoomActionFacade.getRoomVisibility(roomId)
    } catch (err) {
      logger.error(`[GroupStore] 获取房间可见性失败: ${err}`)
      return 'private'
    }
  }

  function updateGroupDetail(roomId: string, detail: Partial<MatrixGroupInfo>): void {
    if (groupInfoMap[roomId]) {
      groupInfoMap[roomId] = { ...groupInfoMap[roomId], ...detail }
    }
  }

  function updateGroupNumber(roomId: string, totalNum: number): void {
    if (groupInfoMap[roomId]) {
      groupInfoMap[roomId] = { ...groupInfoMap[roomId], memberNum: totalNum }
    }
  }

  async function addGroupDetail(roomId: string): Promise<void> {
    await loadGroupInfo(roomId)
  }

  function removeGroupDetail(roomId: string): void {
    delete groupInfoMap[roomId]
  }

  return {
    groupInfoMap,
    currentGroupInfo,
    countInfo,
    getGroupDetailByRoomId,
    groupDetails,
    loadGroupInfo,
    setRoomName,
    setRoomTopic,
    setRoomAvatar,
    setVisibility,
    getVisibility,
    updateGroupDetail,
    updateGroupNumber,
    addGroupDetail,
    removeGroupDetail
  }
}
