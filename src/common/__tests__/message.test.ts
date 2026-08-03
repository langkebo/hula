import { describe, expect, it } from 'vitest'
import { MSG_REPLY_TEXT_MAP } from '@/common/message'
import { MsgEnum } from '@/enums'

describe('message', () => {
  describe('MSG_REPLY_TEXT_MAP', () => {
    it('映射表的所有键都是有效的 MsgEnum 值', () => {
      const validMsgEnumValues = new Set<number>(
        Object.values(MsgEnum).filter((v): v is number => typeof v === 'number')
      )
      for (const key of Object.keys(MSG_REPLY_TEXT_MAP)) {
        const numericKey = Number(key)
        expect(validMsgEnumValues.has(numericKey)).toBe(true)
      }
    })

    it('映射表包含源文件中定义的所有消息类型', () => {
      const expectedKeys: number[] = [
        MsgEnum.UNKNOWN,
        MsgEnum.RECALL,
        MsgEnum.IMAGE,
        MsgEnum.FILE,
        MsgEnum.VOICE,
        MsgEnum.VIDEO,
        MsgEnum.EMOJI,
        MsgEnum.MERGE,
        MsgEnum.NOTICE,
        MsgEnum.VIDEO_CALL,
        MsgEnum.AUDIO_CALL,
        MsgEnum.BOT,
        MsgEnum.LOCATION,
        MsgEnum.BEACON,
        MsgEnum.LINK_PREVIEW
      ]
      for (const key of expectedKeys) {
        expect(MSG_REPLY_TEXT_MAP).toHaveProperty(String(key))
      }
    })

    it('UNKNOWN 映射到 [不支持的消息类型]', () => {
      expect(MSG_REPLY_TEXT_MAP[MsgEnum.UNKNOWN]).toBe('[不支持的消息类型]')
    })

    it('IMAGE 映射到 [图片]', () => {
      expect(MSG_REPLY_TEXT_MAP[MsgEnum.IMAGE]).toBe('[图片]')
    })

    it('VOICE 映射到 [语音]', () => {
      expect(MSG_REPLY_TEXT_MAP[MsgEnum.VOICE]).toBe('[语音]')
    })

    it('VIDEO 映射到 [视频]', () => {
      expect(MSG_REPLY_TEXT_MAP[MsgEnum.VIDEO]).toBe('[视频]')
    })

    it('所有映射值都是非空字符串', () => {
      for (const value of Object.values(MSG_REPLY_TEXT_MAP)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
      }
    })
  })
})
