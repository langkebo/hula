import { describe, expect, it } from 'vitest'
import {
  ERROR_CLIENT_NOT_INITIALIZED_EN,
  isMessageEventType,
  MatrixBurnDuration,
  MatrixContentField,
  MatrixEventType,
  MatrixFormat,
  MatrixMsgType,
  MatrixRelType
} from '@/common/matrixConstants'

describe('matrixConstants', () => {
  describe('MatrixEventType', () => {
    it('定义所有 Matrix 事件类型常量', () => {
      expect(MatrixEventType.ROOM_MESSAGE).toBe('m.room.message')
      expect(MatrixEventType.ROOM_ENCRYPTED).toBe('m.room.encrypted')
      expect(MatrixEventType.ROOM_MEMBER).toBe('m.room.member')
      expect(MatrixEventType.ROOM_REDACTION).toBe('m.room.redaction')
      expect(MatrixEventType.ROOM_CREATE).toBe('m.room.create')
      expect(MatrixEventType.ROOM_NAME).toBe('m.room.name')
      expect(MatrixEventType.ROOM_TOPIC).toBe('m.room.topic')
      expect(MatrixEventType.ROOM_AVATAR).toBe('m.room.avatar')
      expect(MatrixEventType.ROOM_PINNED_EVENTS).toBe('m.room.pinned_events')
      expect(MatrixEventType.ROOM_POWER_LEVELS).toBe('m.room.power_levels')
      expect(MatrixEventType.ROOM_JOIN_RULES).toBe('m.room.join_rules')
      expect(MatrixEventType.ROOM_HISTORY_VISIBILITY).toBe('m.room.history_visibility')
      expect(MatrixEventType.ROOM_GUEST_ACCESS).toBe('m.room.guest_access')
      expect(MatrixEventType.ROOM_SERVER_ACL).toBe('m.room.server_acl')
      expect(MatrixEventType.REACTION).toBe('m.reaction')
      expect(MatrixEventType.KEY_VERIFICATION_START).toBe('m.key.verification.start')
      expect(MatrixEventType.KEY_VERIFICATION_DONE).toBe('m.key.verification.done')
      expect(MatrixEventType.KEY_VERIFICATION_CANCEL).toBe('m.key.verification.cancel')
    })
  })

  describe('MatrixMsgType', () => {
    it('定义所有 Matrix 消息类型常量', () => {
      expect(MatrixMsgType.TEXT).toBe('m.text')
      expect(MatrixMsgType.NOTICE).toBe('m.notice')
      expect(MatrixMsgType.IMAGE).toBe('m.image')
      expect(MatrixMsgType.FILE).toBe('m.file')
      expect(MatrixMsgType.AUDIO).toBe('m.audio')
      expect(MatrixMsgType.VIDEO).toBe('m.video')
      expect(MatrixMsgType.LOCATION).toBe('m.location')
      expect(MatrixMsgType.BEACON_INFO).toBe('m.beacon_info')
      expect(MatrixMsgType.BEACON).toBe('m.beacon')
      expect(MatrixMsgType.BAD_ENCRYPTED).toBe('m.bad.encrypted')
      expect(MatrixMsgType.SERVER_NOTICE).toBe('m.server_notice')
    })
  })

  describe('MatrixRelType', () => {
    it('定义所有 Matrix 关系类型常量', () => {
      expect(MatrixRelType.THREAD).toBe('m.thread')
      expect(MatrixRelType.REPLACES).toBe('m.replace')
      expect(MatrixRelType.REFERENCE).toBe('m.reference')
      expect(MatrixRelType.ANNOTATION).toBe('m.annotation')
    })
  })

  describe('MatrixContentField', () => {
    it('定义所有 Matrix 内容字段常量', () => {
      expect(MatrixContentField.RELATES_TO).toBe('m.relates_to')
      expect(MatrixContentField.FORMATTED_BODY).toBe('formatted_body')
      expect(MatrixContentField.FORMAT).toBe('format')
    })
  })

  describe('MatrixFormat', () => {
    it('定义 HTML 格式常量', () => {
      expect(MatrixFormat.HTML).toBe('org.matrix.custom.html')
    })
  })

  describe('MatrixBurnDuration', () => {
    it('定义阅后即焚时长常量', () => {
      expect(MatrixBurnDuration.SEC_30).toBe(30)
      expect(MatrixBurnDuration.SEC_300).toBe(300)
      expect(MatrixBurnDuration.SEC_3600).toBe(3600)
      expect(MatrixBurnDuration.SEC_86400).toBe(86400)
    })

    it('定义默认时长（毫秒）', () => {
      expect(MatrixBurnDuration.DEFAULT_MS).toBe(60000)
    })
  })

  describe('ERROR_CLIENT_NOT_INITIALIZED_EN', () => {
    it('定义客户端未初始化错误信息', () => {
      expect(ERROR_CLIENT_NOT_INITIALIZED_EN).toBe('Matrix client not initialized')
    })
  })

  describe('isMessageEventType', () => {
    it('m.room.message 返回 true', () => {
      expect(isMessageEventType(MatrixEventType.ROOM_MESSAGE)).toBe(true)
    })

    it('m.room.encrypted 返回 true', () => {
      expect(isMessageEventType(MatrixEventType.ROOM_ENCRYPTED)).toBe(true)
    })

    it('m.room.member 返回 false', () => {
      expect(isMessageEventType(MatrixEventType.ROOM_MEMBER)).toBe(false)
    })

    it('m.reaction 返回 false', () => {
      expect(isMessageEventType(MatrixEventType.REACTION)).toBe(false)
    })

    it('m.room.create 返回 false', () => {
      expect(isMessageEventType(MatrixEventType.ROOM_CREATE)).toBe(false)
    })

    it('空字符串返回 false', () => {
      expect(isMessageEventType('')).toBe(false)
    })

    it('任意字符串返回 false', () => {
      expect(isMessageEventType('m.unknown.type')).toBe(false)
    })
  })
})
