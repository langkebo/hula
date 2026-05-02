import { matrixSessionService } from '../auth/MatrixSessionService'
import { matrixReceiptService } from '../messaging/MatrixReceiptService'
import { matrixRoomSummaryService } from './MatrixRoomSummaryService'
import { matrixRoomSummaryAggregateService } from './SummaryService'

/**
 * 房间列表聚合服务
 * 整合了房间摘要、统计信息及排序策略
 */
class RoomListService {
  /**
   * 获取房间摘要
   */
  getRoomSummary(roomId: string) {
    return matrixRoomSummaryAggregateService.getRoomSummary(roomId)
  }

  /**
   * 获取房间列表摘要（批量）
   */
  getRoomSummaries(roomIds: string[]) {
    return matrixRoomSummaryAggregateService.getRoomSummaries(roomIds)
  }

  /**
   * 标记房间已读
   */
  markAsRead(roomId: string) {
    return matrixReceiptService.markRoomAsRead(roomId)
  }

  /**
   * 清除未读计数（Synapse 扩展）
   */
  clearUnreadSummary(roomId: string) {
    return matrixRoomSummaryService.clearUnreadSummary(roomId)
  }

  /**
   * 重新计算房间英雄（Heroes）
   */
  recalculateHeroes(roomId: string) {
    return matrixRoomSummaryService.recalculateHeroes(roomId)
  }

  /**
   * 设置会话置顶
   */
  setSessionTop(roomId: string, top: boolean) {
    return matrixSessionService.setSessionTop(roomId, top)
  }
}

export const roomListService = new RoomListService()
