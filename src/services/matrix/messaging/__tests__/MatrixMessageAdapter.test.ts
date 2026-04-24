import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import matrixMessageAdapter from '../MatrixMessageAdapter'

describe('MatrixMessageAdapter', () => {
  describe('getMsgTypeFromEventLike', () => {
    it('should map m.voice events to voice messages', () => {
      expect(
        matrixMessageAdapter.getMsgTypeFromEventLike('m.room.message', {
          msgtype: 'm.voice',
          body: 'voice.ogg'
        })
      ).toBe(MsgEnum.VOICE)
    })

    it('should map member events to system messages', () => {
      expect(
        matrixMessageAdapter.getMsgTypeFromEventLike('m.room.member', {
          membership: 'join'
        })
      ).toBe(MsgEnum.SYSTEM)
    })

    it('should detect link preview payloads from event-like content', () => {
      expect(
        matrixMessageAdapter.getMsgTypeFromEventLike('m.room.message', {
          body: 'https://example.com',
          'org.matrix.msc2788.room.message': {
            url: 'https://example.com'
          }
        })
      ).toBe(MsgEnum.LINK_PREVIEW)
    })
  })

  describe('convertMatrixContent', () => {
    it('should keep matrix voice metadata in the unified voice body model', () => {
      const result = matrixMessageAdapter.convertMatrixContent(
        {
          msgtype: 'm.audio',
          body: 'voice_123.mp3',
          url: 'mxc://example.org/voice-123',
          info: {
            size: 4096,
            duration: 8,
            mimetype: 'audio/mpeg'
          }
        },
        MsgEnum.VOICE
      )

      expect(result).toMatchObject({
        size: 4096,
        second: 8,
        url: 'mxc://example.org/voice-123'
      })
    })
  })
})
