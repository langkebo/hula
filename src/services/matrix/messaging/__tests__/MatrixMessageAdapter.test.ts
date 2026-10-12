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

  // 快照契约：锁定事件类型判定与 content 反序列化的完整输出结构。
  // 与 messageContentBuilder 的快照互为逆向契约，覆盖收发两个方向的关键字段。
  describe('snapshot contracts', () => {
    const msgTypeCases: Array<[string, string, Record<string, unknown>]> = [
      ['redaction', 'm.room.redaction', {}],
      ['member', 'm.room.member', { membership: 'join' }],
      ['beacon info', 'm.beacon_info', { timeout: 1000, live: true }],
      ['text', 'm.room.message', { msgtype: 'm.text', body: 'hi' }],
      ['image', 'm.room.message', { msgtype: 'm.image' }],
      ['video', 'm.room.message', { msgtype: 'm.video' }],
      ['audio', 'm.room.message', { msgtype: 'm.audio' }],
      ['file', 'm.room.message', { msgtype: 'm.file' }],
      ['location', 'm.room.message', { msgtype: 'm.location' }],
      ['unknown msgtype', 'm.room.message', { msgtype: 'm.unknown' }],
      ['encrypted text', 'm.room.encrypted', { msgtype: 'm.text' }]
    ]

    for (const [name, eventType, content] of msgTypeCases) {
      it(`getMsgTypeFromEventLike snapshot for ${name}`, () => {
        expect(matrixMessageAdapter.getMsgTypeFromEventLike(eventType, content)).toMatchSnapshot()
      })
    }

    const contentCases: Array<[string, MsgEnum, Record<string, unknown>]> = [
      ['text', MsgEnum.TEXT, { msgtype: 'm.text', body: 'hello' }],
      [
        'image',
        MsgEnum.IMAGE,
        {
          msgtype: 'm.image',
          body: 'cat.png',
          url: 'mxc://server/cat',
          info: { size: 1024, w: 640, h: 480, mimetype: 'image/png' }
        }
      ],
      [
        'video with thumbnail',
        MsgEnum.VIDEO,
        {
          msgtype: 'm.video',
          body: 'clip.mp4',
          url: 'mxc://server/clip',
          info: {
            size: 2048,
            duration: 15,
            w: 320,
            h: 240,
            mimetype: 'video/mp4',
            thumbnail_url: 'mxc://server/thumb',
            thumbnail_info: { w: 320, h: 240 }
          }
        }
      ],
      [
        'voice',
        MsgEnum.VOICE,
        {
          msgtype: 'm.audio',
          body: 'voice.ogg',
          url: 'mxc://server/voice',
          info: { size: 300, duration: 8, mimetype: 'audio/ogg' }
        }
      ],
      ['file', MsgEnum.FILE, { msgtype: 'm.file', body: 'doc.pdf', url: 'mxc://server/doc', info: { size: 4096 } }],
      [
        'location',
        MsgEnum.LOCATION,
        {
          msgtype: 'm.location',
          body: '位置: 北京',
          'm.location': { uri: 'geo:39.9042,116.4074;u=10', description: '北京' },
          'm.ts': 1700000000000
        }
      ],
      ['beacon', MsgEnum.BEACON, { description: '实时位置共享', timeout: 3600000, live: true, 'm.ts': 1700000000000 }],
      ['unhandled msgtype falls back to json content', MsgEnum.UNKNOWN, { foo: 'bar' }]
    ]

    for (const [name, msgType, content] of contentCases) {
      it(`convertMatrixContent snapshot for ${name}`, () => {
        expect(matrixMessageAdapter.convertMatrixContent(content, msgType)).toMatchSnapshot()
      })
    }
  })
})
