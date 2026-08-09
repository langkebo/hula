import { type ShallowRef, triggerRef } from 'vue'
import { OnlineEnum } from '@/enums'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { profileService } from '@/services/matrix/user/MatrixProfileService'
import { createLogger } from '@/utils/Logger'
import type { MatrixContact } from './types'

const logger = createLogger('ContactStore.Dm')

export type ContactDmContext = {
  contactsList: ShallowRef<MatrixContact[]>
}

/**
 * 私聊模块：DM 房间创建/复用、用户资料获取。
 */
export function createContactDm(ctx: ContactDmContext) {
  const { contactsList } = ctx

  async function getUserProfile(userId: string): Promise<MatrixContact | null> {
    try {
      const profile = await profileService.getProfile(userId)
      return {
        userId,
        uid: userId,
        displayName: profile.displayname || null,
        name: profile.displayname || userId.split(':')[0],
        avatarUrl: profile.avatarUrl || null,
        avatar: profile.avatarUrl || '',
        account: userId.split(':')[0],
        activeStatus: OnlineEnum.ONLINE,
        remark: '',
        lastOptTime: Date.now(),
        hideMyPosts: false,
        hideTheirPosts: false
      }
    } catch {
      logger.error(`[ContactStore] 获取用户资料失败: ${userId}`)
      return null
    }
  }

  async function startDirectRoom(userId: string, encrypted = false): Promise<string | null> {
    try {
      const existingContact = contactsList.value.find((c) => c.userId === userId)
      if (existingContact?.directRoomId) {
        return existingContact.directRoomId
      }

      const roomId = await matrixDirectMessageService.createDm(userId, { userIds: [userId], isEncrypted: encrypted })

      const contactIndex = contactsList.value.findIndex((c) => c.userId === userId)
      if (contactIndex >= 0) {
        contactsList.value[contactIndex].directRoomId = roomId
        triggerRef(contactsList)
      } else {
        contactsList.value.push({
          userId,
          uid: userId,
          displayName: null,
          name: userId.split(':')[0],
          avatarUrl: null,
          avatar: '',
          directRoomId: roomId,
          account: userId.split(':')[0],
          activeStatus: OnlineEnum.ONLINE,
          remark: '',
          lastOptTime: Date.now(),
          hideMyPosts: false,
          hideTheirPosts: false
        })
        triggerRef(contactsList)
      }

      logger.info(`[ContactStore] 创建私聊房间成功: ${roomId}`)
      return roomId
    } catch (err) {
      logger.error(`[ContactStore] 创建私聊房间失败: ${err}`)
      return null
    }
  }

  return {
    getUserProfile,
    startDirectRoom
  }
}
