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

    it('should map m.location messages to location messages', () => {
      expect(
        matrixMessageAdapter.getMsgTypeFromEventLike('m.room.message', {
          msgtype: 'm.location',
          body: '位置'
        })
      ).toBe(MsgEnum.LOCATION)
    })

    it('should map beacon_info events to beacon messages, but not m.beacon position updates', () => {
      expect(matrixMessageAdapter.getMsgTypeFromEventLike('m.beacon_info', { timeout: 1000, live: true })).toBe(
        MsgEnum.BEACON
      )
      // m.beacon（位置更新）不再映射为独立 BEACON 气泡（Blocker 3）
      expect(matrixMessageAdapter.getMsgTypeFromEventLike('m.beacon', { 'm.location': { uri: 'geo:1,2' } })).toBe(
        MsgEnum.UNKNOWN
      )
    })

    it('should map unstable beacon_info names to beacon messages, but not unstable m.beacon', () => {
      expect(matrixMessageAdapter.getMsgTypeFromEventLike('org.matrix.msc3672.beacon_info', { timeout: 1000 })).toBe(
        MsgEnum.BEACON
      )
      expect(matrixMessageAdapter.getMsgTypeFromEventLike('org.matrix.msc3672.beacon', {})).toBe(MsgEnum.UNKNOWN)
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

    it('should fall back to encrypted file metadata for media urls', () => {
      const result = matrixMessageAdapter.convertMatrixContent(
        {
          msgtype: 'm.file',
          body: 'secret.pdf',
          file: {
            url: 'mxc://example.org/encrypted-file',
            iv: 'iv',
            hashes: { sha256: 'hash' },
            v: 'v2',
            key: {
              alg: 'A256CTR',
              k: 'secret',
              kty: 'oct',
              ext: true,
              key_ops: ['encrypt', 'decrypt']
            }
          },
          info: {
            size: 5120
          }
        },
        MsgEnum.FILE
      )

      expect(result).toMatchObject({
        fileName: 'secret.pdf',
        size: 5120,
        url: 'mxc://example.org/encrypted-file',
        encryptedFile: {
          v: 'v2'
        }
      })
    })

    it('should parse location content into a LocationBody', () => {
      const result = matrixMessageAdapter.convertMatrixContent(
        {
          msgtype: 'm.location',
          body: '位置: 北京',
          geo_uri: 'geo:39.9042,116.4074;u=10',
          'm.location': { uri: 'geo:39.9042,116.4074;u=10', description: '北京' },
          'm.ts': 1700000000000
        },
        MsgEnum.LOCATION
      )

      expect(result).toEqual({
        latitude: '39.9042',
        longitude: '116.4074',
        address: '北京',
        precision: '',
        timestamp: '1700000000000'
      })
    })

    it('should fall back to geo_uri and unstable location key for location body', () => {
      const result = matrixMessageAdapter.convertMatrixContent(
        {
          msgtype: 'm.location',
          geo_uri: 'geo:39.9,116.4',
          'org.matrix.msc3488.location': { uri: 'geo:39.9,116.4', description: 'Office' },
          'org.matrix.msc3488.ts': 1234
        },
        MsgEnum.LOCATION
      )

      expect(result).toMatchObject({
        latitude: '39.9',
        longitude: '116.4',
        address: 'Office',
        timestamp: '1234'
      })
    })

    it('should default location coordinates to zero when geo uri is missing', () => {
      const result = matrixMessageAdapter.convertMatrixContent(
        { msgtype: 'm.location', body: '位置' },
        MsgEnum.LOCATION
      )

      expect(result).toMatchObject({
        latitude: '0',
        longitude: '0',
        address: '位置'
      })
    })

    it('should parse beacon_info content into a BeaconBody', () => {
      const result = matrixMessageAdapter.convertMatrixContent(
        {
          description: '实时位置共享',
          timeout: 3600000,
          live: true,
          'm.ts': 1700000000000
        },
        MsgEnum.BEACON
      )

      expect(result).toEqual({
        description: '实时位置共享',
        timeout: 3600000,
        isLive: true,
        uri: undefined,
        lastUpdateTs: 1700000000000
      })
    })
  })
})
