/**
 * 统一"进入聊天" / "进入空间"入口
 *
 * 需求文档 5.2 / 8.5 节规范：
 * - 好友/房间场景：调用 openMsgSession 创建/复用会话，路由派生切换到 chat 视图
 * - 空间场景：根据子房间数量智能跳转
 *   - 0 子房间：跳转 /space/{spaceId}（显示空状态 + 创建子房间按钮）
 *   - 1 子房间：直接进入该子房间的 chat 视图
 *   - 多子房间：跳转 /space/{spaceId}（展示子房间列表）
 *
 * Note: openMsgSession 内部已处理 globalStore.currentSessionRoomId 设置与路由跳转，
 * 此处不重复执行，避免副作用叠加。
 */
import { RoomTypeEnum } from '@/enums'
import router from '@/router'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { openMsgSession, openMsgSessionByRoomId } from './openMsgSession'

const logger = createLogger('useEnterChat')

export type EnterChatTarget = 'friend' | 'room' | 'space'

export function useEnterChat() {
  const globalStore = useGlobalStore()

  /**
   * 进入聊天（好友 / 房间）或进入空间
   * @param targetId 目标 ID（用户 ID / 房间 ID / 空间 ID）
   * @param targetType 目标类型
   */
  const enterChat = async (targetId: string, targetType: EnterChatTarget) => {
    if (!targetId) {
      logger.warn('enterChat called with empty targetId')
      return
    }

    if (targetType === 'space') {
      await enterSpace(targetId)
      return
    }

    if (targetType === 'friend') {
      await openMsgSession(targetId, RoomTypeEnum.SINGLE)
      return
    }

    // room：直接按 roomId 打开聊天会话
    await openMsgSessionByRoomId(targetId)
  }

  /**
   * 进入空间：按子房间数量智能跳转
   */
  const enterSpace = async (spaceId: string) => {
    if (!spaceId) return

    let childCount = 0
    let firstRoomId: string | null = null

    try {
      const children = await matrixSpaceService.getSpaceChildren(spaceId)
      childCount = children.length
      if (childCount === 1) {
        firstRoomId = children[0]?.room_id ?? null
      }
    } catch (err) {
      logger.error('获取空间子房间失败，降级到空间详情页:', err)
    }

    // 单子房间：直接进入该子房间的 chat 视图
    if (childCount === 1 && firstRoomId) {
      globalStore.currentSessionRoomId = firstRoomId
      await router.push(`/message/${firstRoomId}`)
      return
    }

    // 0 个或多个子房间：跳转空间详情页（右侧栏展示空状态或子房间列表）
    await router.push(`/space/${spaceId}`)
  }

  return { enterChat, enterSpace }
}
