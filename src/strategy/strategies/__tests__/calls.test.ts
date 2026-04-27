import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { AudioCallMessageStrategyImpl } from '../audioCall'
import { VideoCallMessageStrategyImpl } from '../videoCall'

const callInfo = {
  duration: 60,
  reason: 'completed',
  startTime: 1000,
  endTime: 1060,
  creator: '@alice:example.com',
  isGroup: false
}

describe('Call message strategies', () => {
  describe('AudioCallMessageStrategyImpl', () => {
    const strategy = new AudioCallMessageStrategyImpl()

    it('uses MsgEnum.AUDIO_CALL as msgType', () => {
      expect(strategy.msgType).toBe(MsgEnum.AUDIO_CALL)
    })

    it('getMsg packs call info with type', () => {
      const result = strategy.getMsg('', callInfo as any)
      expect(result).toEqual({ type: MsgEnum.AUDIO_CALL, ...callInfo })
    })

    it('buildMessageBody mirrors call fields without type', () => {
      const body = strategy.buildMessageBody({ ...callInfo, type: MsgEnum.AUDIO_CALL })
      expect(body).toEqual(callInfo)
    })

    it('uploadFile resolves to empty urls', async () => {
      await expect(strategy.uploadFile()).resolves.toEqual({ uploadUrl: '', downloadUrl: '' })
    })

    it('doUpload resolves without value', async () => {
      await expect(strategy.doUpload()).resolves.toBeUndefined()
    })
  })

  describe('VideoCallMessageStrategyImpl', () => {
    const strategy = new VideoCallMessageStrategyImpl()

    it('uses MsgEnum.VIDEO_CALL as msgType', () => {
      expect(strategy.msgType).toBe(MsgEnum.VIDEO_CALL)
    })

    it('getMsg packs call info with type', () => {
      const result = strategy.getMsg('', callInfo as any)
      expect(result).toEqual({ type: MsgEnum.VIDEO_CALL, ...callInfo })
    })

    it('buildMessageBody mirrors call fields without type', () => {
      const body = strategy.buildMessageBody({ ...callInfo, type: MsgEnum.VIDEO_CALL })
      expect(body).toEqual(callInfo)
    })

    it('uploadFile / doUpload return empty defaults', async () => {
      await expect(strategy.uploadFile()).resolves.toEqual({ uploadUrl: '', downloadUrl: '' })
      await expect(strategy.doUpload()).resolves.toBeUndefined()
    })
  })
})
