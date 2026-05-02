import type { NotificationTypeEnum } from '@/enums'
import { matrixRoomNotificationService } from '../notifications/MatrixRoomNotificationService'
import { matrixRoomMemberProfileService } from './MemberProfileService'
import { matrixRoomMetadataService } from './MetadataService'
import { matrixRoomPinsService } from './PinsService'
import { matrixRoomStateService } from './StateService'
import { matrixRoomTagsService } from './TagsService'
import { matrixRoomTranslateService } from './TranslateService'

/**
 * 房间状态聚合服务
 * 整合了元数据、状态事件、标签、置顶消息、翻译及通知设置功能
 */
class RoomStateService {
  /**
   * 设置房间名称
   */
  setRoomName(roomId: string, name: string) {
    return matrixRoomStateService.setRoomName(roomId, name)
  }

  /**
   * 设置房间主题
   */
  setRoomTopic(roomId: string, topic: string) {
    return matrixRoomStateService.setRoomTopic(roomId, topic)
  }

  /**
   * 设置房间头像
   */
  setRoomAvatar(roomId: string, avatarUrl: string) {
    return matrixRoomStateService.setRoomAvatar(roomId, avatarUrl)
  }

  /**
   * 设置成员在房间内的显示名称
   */
  setMemberDisplayName(roomId: string, displayName: string) {
    return matrixRoomMemberProfileService.setMemberDisplayName(roomId, displayName)
  }

  /**
   * 获取房间所有标签
   */
  getRoomTags(roomId: string) {
    return matrixRoomTagsService.getTags(roomId)
  }

  /**
   * 添加房间标签
   */
  addRoomTag(roomId: string, tag: string, order?: number) {
    return matrixRoomTagsService.setTag(roomId, tag, order)
  }

  /**
   * 获取置顶消息
   */
  getPinnedEvents(roomId: string) {
    return matrixRoomPinsService.getPinnedEvents(roomId)
  }

  /**
   * 翻译文本
   */
  translateText(text: string, targetLang?: string) {
    return matrixRoomTranslateService.translateText(text, targetLang)
  }

  /**
   * 获取房间元数据
   */
  getRoomMetadata(roomId: string) {
    return matrixRoomMetadataService.getRoomMetadata(roomId)
  }

  /**
   * 设置房间通知类型
   */
  setRoomNotification(roomId: string, type: NotificationTypeEnum) {
    return matrixRoomNotificationService.setRoomNotification(roomId, type)
  }

  /**
   * 设置房间屏蔽状态
   */
  setRoomShield(roomId: string, shield: boolean) {
    return matrixRoomNotificationService.setRoomShield(roomId, shield)
  }
}

export const roomStateService = new RoomStateService()
