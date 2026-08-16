import { describe, expect, it } from 'vitest'
import { MatrixBurnDuration, MatrixContentField, MatrixMsgType } from '@/common/matrixConstants'
import { MsgEnum } from '@/enums'
import { buildMatrixContent, MatrixBurnDuration as ReexportedMatrixBurnDuration } from '../messageContentBuilder'

describe('buildMatrixContent', () => {
  describe('TEXT message', () => {
    it('should set msgtype to m.text', () => {
      const content = buildMatrixContent(MsgEnum.TEXT, { content: 'hello' })
      expect(content.msgtype).toBe(MatrixMsgType.TEXT)
    })

    it('should use body.content as body', () => {
      const content = buildMatrixContent(MsgEnum.TEXT, { content: 'hello world' })
      expect(content.body).toBe('hello world')
    })

    it('should use string body when content field is not provided', () => {
      const content = buildMatrixContent(MsgEnum.TEXT, 'plain text body')
      expect(content.body).toBe('plain text body')
    })

    it('should default body to empty string when no content or string body', () => {
      const content = buildMatrixContent(MsgEnum.TEXT, {})
      expect(content.body).toBe('')
    })

    it('should add m.relates_to with event_id when reply.id is provided', () => {
      const content = buildMatrixContent(MsgEnum.TEXT, {
        content: 'reply text',
        reply: { id: '$event123:server' }
      })
      expect(content[MatrixContentField.RELATES_TO]).toEqual({
        'm.in_reply_to': {
          event_id: '$event123:server'
        }
      })
    })

    it('should not add m.relates_to when reply.id is not a string', () => {
      const content = buildMatrixContent(MsgEnum.TEXT, {
        content: 'text',
        reply: { id: 123 }
      })
      expect(content[MatrixContentField.RELATES_TO]).toBeUndefined()
    })

    it('should not add m.relates_to when reply is not provided', () => {
      const content = buildMatrixContent(MsgEnum.TEXT, { content: 'text' })
      expect(content[MatrixContentField.RELATES_TO]).toBeUndefined()
    })
  })

  describe('NOTICE message', () => {
    it('should set msgtype to m.notice', () => {
      const content = buildMatrixContent(MsgEnum.NOTICE, { content: 'notice text' })
      expect(content.msgtype).toBe(MatrixMsgType.NOTICE)
    })

    it('should use body.content as body', () => {
      const content = buildMatrixContent(MsgEnum.NOTICE, { content: 'notice body' })
      expect(content.body).toBe('notice body')
    })

    it('should default body to empty string when no content', () => {
      const content = buildMatrixContent(MsgEnum.NOTICE, {})
      expect(content.body).toBe('')
    })

    it('should add m.relates_to with event_id when reply.id is provided', () => {
      const content = buildMatrixContent(MsgEnum.NOTICE, {
        content: 'notice reply',
        reply: { id: '$evt456:server' }
      })
      expect(content[MatrixContentField.RELATES_TO]).toEqual({
        'm.in_reply_to': {
          event_id: '$evt456:server'
        }
      })
    })

    it('should use string body when content field is not provided', () => {
      const content = buildMatrixContent(MsgEnum.NOTICE, 'plain notice')
      expect(content.body).toBe('plain notice')
    })
  })

  describe('IMAGE message', () => {
    it('should set msgtype to m.image', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, { fileName: 'pic.png', url: 'mxc://server/pic' })
      expect(content.msgtype).toBe(MatrixMsgType.IMAGE)
    })

    it('should use fileName as body', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, { fileName: 'photo.png', url: 'mxc://server/photo' })
      expect(content.body).toBe('photo.png')
    })

    it('should default body to "image" when fileName is not provided', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, { url: 'mxc://server/img' })
      expect(content.body).toBe('image')
    })

    it('should set url when no encrypted file is provided', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, { url: 'mxc://server/img' })
      expect(content.url).toBe('mxc://server/img')
      expect(content.file).toBeUndefined()
    })

    it('should set file when encryptedFile has both url and v as strings', () => {
      const encryptedFile = { url: 'mxc://server/enc', v: 'version1', key: { alg: 'A256CTR' } }
      const content = buildMatrixContent(MsgEnum.IMAGE, { fileName: 'enc.png', encryptedFile })
      expect(content.file).toEqual(encryptedFile)
      expect(content.url).toBeUndefined()
    })

    it('should not use encrypted file when v is missing', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, {
        url: 'mxc://server/img',
        encryptedFile: { url: 'mxc://server/enc' }
      })
      expect(content.file).toBeUndefined()
      expect(content.url).toBe('mxc://server/img')
    })

    it('should not use encrypted file when url is missing', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, {
        url: 'mxc://server/img',
        encryptedFile: { v: 'version1' }
      })
      expect(content.file).toBeUndefined()
      expect(content.url).toBe('mxc://server/img')
    })

    it('should set info with default values', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, { url: 'mxc://server/img' })
      expect(content.info).toEqual({
        size: 0,
        w: 0,
        h: 0,
        mimetype: 'image/png'
      })
    })

    it('should set info with provided values', () => {
      const content = buildMatrixContent(MsgEnum.IMAGE, {
        fileName: 'pic.png',
        url: 'mxc://server/pic',
        size: 1024,
        width: 800,
        height: 600,
        mimetype: 'image/jpeg'
      })
      expect(content.info).toEqual({
        size: 1024,
        w: 800,
        h: 600,
        mimetype: 'image/jpeg'
      })
    })
  })

  describe('EMOJI message', () => {
    it('should set msgtype to m.image (same as IMAGE)', () => {
      const content = buildMatrixContent(MsgEnum.EMOJI, { fileName: 'emoji.png', url: 'mxc://server/emoji' })
      expect(content.msgtype).toBe(MatrixMsgType.IMAGE)
    })

    it('should use fileName as body', () => {
      const content = buildMatrixContent(MsgEnum.EMOJI, { fileName: 'smile.png', url: 'mxc://server/smile' })
      expect(content.body).toBe('smile.png')
    })

    it('should default body to "image" when fileName is not provided', () => {
      const content = buildMatrixContent(MsgEnum.EMOJI, { url: 'mxc://server/emoji' })
      expect(content.body).toBe('image')
    })

    it('should set file when encryptedFile has both url and v', () => {
      const encryptedFile = { url: 'mxc://server/enc', v: 'v2' }
      const content = buildMatrixContent(MsgEnum.EMOJI, { encryptedFile })
      expect(content.file).toEqual(encryptedFile)
      expect(content.url).toBeUndefined()
    })

    it('should set url when no encrypted file', () => {
      const content = buildMatrixContent(MsgEnum.EMOJI, { url: 'mxc://server/emoji' })
      expect(content.url).toBe('mxc://server/emoji')
    })

    it('should set info with default values', () => {
      const content = buildMatrixContent(MsgEnum.EMOJI, { url: 'mxc://server/emoji' })
      expect(content.info).toEqual({
        size: 0,
        w: 0,
        h: 0,
        mimetype: 'image/png'
      })
    })

    it('should set info with provided values', () => {
      const content = buildMatrixContent(MsgEnum.EMOJI, {
        fileName: 'emoji.png',
        url: 'mxc://server/emoji',
        size: 512,
        width: 64,
        height: 64,
        mimetype: 'image/gif'
      })
      expect(content.info).toEqual({
        size: 512,
        w: 64,
        h: 64,
        mimetype: 'image/gif'
      })
    })
  })

  describe('VIDEO message', () => {
    it('should set msgtype to m.video', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, { fileName: 'clip.mp4', url: 'mxc://server/clip' })
      expect(content.msgtype).toBe(MatrixMsgType.VIDEO)
    })

    it('should use fileName as body', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, { fileName: 'movie.mp4', url: 'mxc://server/movie' })
      expect(content.body).toBe('movie.mp4')
    })

    it('should default body to "video" when fileName is not provided', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, { url: 'mxc://server/clip' })
      expect(content.body).toBe('video')
    })

    it('should set url when no encrypted file', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, { url: 'mxc://server/clip' })
      expect(content.url).toBe('mxc://server/clip')
      expect(content.file).toBeUndefined()
    })

    it('should set file when encryptedFile has both url and v', () => {
      const encryptedFile = { url: 'mxc://server/enc', v: 'v1' }
      const content = buildMatrixContent(MsgEnum.VIDEO, { fileName: 'clip.mp4', encryptedFile })
      expect(content.file).toEqual(encryptedFile)
      expect(content.url).toBeUndefined()
    })

    it('should set thumbnail_url when no encrypted thumbnail', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, {
        url: 'mxc://server/clip',
        thumbUrl: 'mxc://server/thumb'
      })
      expect((content.info as Record<string, unknown>).thumbnail_url).toBe('mxc://server/thumb')
      expect((content.info as Record<string, unknown>).thumbnail_file).toBeUndefined()
    })

    it('should set thumbnail_file when thumbnailEncryptedFile has both url and v', () => {
      const thumbnailEncryptedFile = { url: 'mxc://server/thumbenc', v: 'tv1' }
      const content = buildMatrixContent(MsgEnum.VIDEO, {
        url: 'mxc://server/clip',
        thumbnailEncryptedFile
      })
      expect((content.info as Record<string, unknown>).thumbnail_file).toEqual(thumbnailEncryptedFile)
      expect((content.info as Record<string, unknown>).thumbnail_url).toBeUndefined()
    })

    it('should set thumbnail_url when thumbnailEncryptedFile is missing v', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, {
        url: 'mxc://server/clip',
        thumbUrl: 'mxc://server/thumb',
        thumbnailEncryptedFile: { url: 'mxc://server/thumbenc' }
      })
      expect((content.info as Record<string, unknown>).thumbnail_url).toBe('mxc://server/thumb')
      expect((content.info as Record<string, unknown>).thumbnail_file).toBeUndefined()
    })

    it('should set info with default values', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, { url: 'mxc://server/clip' })
      expect(content.info).toEqual({
        size: 0,
        duration: 0,
        w: 0,
        h: 0,
        mimetype: 'video/mp4',
        thumbnail_info: {
          size: 0,
          w: 0,
          h: 0
        }
      })
    })

    it('should set info with provided values including thumbnail_info', () => {
      const content = buildMatrixContent(MsgEnum.VIDEO, {
        fileName: 'clip.mp4',
        url: 'mxc://server/clip',
        size: 5000,
        duration: 12000,
        thumbWidth: 320,
        thumbHeight: 240,
        mimetype: 'video/webm',
        thumbSize: 2048,
        thumbUrl: 'mxc://server/thumb'
      })
      expect(content.info).toEqual({
        size: 5000,
        duration: 12000,
        w: 320,
        h: 240,
        mimetype: 'video/webm',
        thumbnail_info: {
          size: 2048,
          w: 320,
          h: 240
        },
        thumbnail_url: 'mxc://server/thumb'
      })
    })
  })

  describe('VOICE message', () => {
    it('should set msgtype to m.audio', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, { fileName: 'voice.ogg', url: 'mxc://server/voice' })
      expect(content.msgtype).toBe(MatrixMsgType.AUDIO)
    })

    it('should use fileName as body', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, { fileName: 'rec.ogg', url: 'mxc://server/rec' })
      expect(content.body).toBe('rec.ogg')
    })

    it('should default body to "voice" when fileName is not provided', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, { url: 'mxc://server/voice' })
      expect(content.body).toBe('voice')
    })

    it('should use mxcUrl when provided', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, {
        fileName: 'v.ogg',
        mxcUrl: 'mxc://server/mxc',
        url: 'mxc://server/fallback'
      })
      expect(content.url).toBe('mxc://server/mxc')
    })

    it('should fallback to url when mxcUrl is not provided', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, {
        fileName: 'v.ogg',
        url: 'mxc://server/fallback'
      })
      expect(content.url).toBe('mxc://server/fallback')
    })

    it('should set file when encryptedFile has both url and v', () => {
      const encryptedFile = { url: 'mxc://server/enc', v: 'v1' }
      const content = buildMatrixContent(MsgEnum.VOICE, { fileName: 'v.ogg', encryptedFile })
      expect(content.file).toEqual(encryptedFile)
      expect(content.url).toBeUndefined()
    })

    it('should set info with default values', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, { url: 'mxc://server/voice' })
      expect(content.info).toEqual({
        size: 0,
        duration: 0,
        mimetype: 'audio/ogg'
      })
    })

    it('should set info with provided values using second as duration', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, {
        fileName: 'v.ogg',
        url: 'mxc://server/voice',
        size: 2048,
        second: 30,
        mimeType: 'audio/mpeg'
      })
      expect(content.info).toEqual({
        size: 2048,
        duration: 30,
        mimetype: 'audio/mpeg'
      })
    })

    it('should fallback to mimetype field when mimeType is not provided', () => {
      const content = buildMatrixContent(MsgEnum.VOICE, {
        url: 'mxc://server/voice',
        mimetype: 'audio/wav'
      })
      expect((content.info as Record<string, unknown>).mimetype).toBe('audio/wav')
    })
  })

  describe('FILE message', () => {
    it('should set msgtype to m.file', () => {
      const content = buildMatrixContent(MsgEnum.FILE, { fileName: 'doc.pdf', url: 'mxc://server/doc' })
      expect(content.msgtype).toBe(MatrixMsgType.FILE)
    })

    it('should use fileName as body', () => {
      const content = buildMatrixContent(MsgEnum.FILE, { fileName: 'doc.pdf', url: 'mxc://server/doc' })
      expect(content.body).toBe('doc.pdf')
    })

    it('should default body to "file" when fileName is not provided', () => {
      const content = buildMatrixContent(MsgEnum.FILE, { url: 'mxc://server/doc' })
      expect(content.body).toBe('file')
    })

    it('should set url when no encrypted file', () => {
      const content = buildMatrixContent(MsgEnum.FILE, { url: 'mxc://server/doc' })
      expect(content.url).toBe('mxc://server/doc')
      expect(content.file).toBeUndefined()
    })

    it('should set file when encryptedFile has both url and v', () => {
      const encryptedFile = { url: 'mxc://server/enc', v: 'v1' }
      const content = buildMatrixContent(MsgEnum.FILE, { fileName: 'doc.pdf', encryptedFile })
      expect(content.file).toEqual(encryptedFile)
      expect(content.url).toBeUndefined()
    })

    it('should set info with default values', () => {
      const content = buildMatrixContent(MsgEnum.FILE, { url: 'mxc://server/doc' })
      expect(content.info).toEqual({
        size: 0,
        mimetype: 'application/octet-stream'
      })
    })

    it('should set info with provided values', () => {
      const content = buildMatrixContent(MsgEnum.FILE, {
        fileName: 'doc.pdf',
        url: 'mxc://server/doc',
        size: 4096,
        mimetype: 'application/pdf'
      })
      expect(content.info).toEqual({
        size: 4096,
        mimetype: 'application/pdf'
      })
    })
  })

  describe('LOCATION message', () => {
    it('should set msgtype to m.location', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, { description: 'Home', geoUri: 'geo:1,2' })
      expect(content.msgtype).toBe(MatrixMsgType.LOCATION)
    })

    it('should use description as body', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, { description: 'Office', geoUri: 'geo:3,4' })
      expect(content.body).toBe('Office')
    })

    it('should use geoUri as geo_uri', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, { description: 'Park', geoUri: 'geo:5,6' })
      expect(content.geo_uri).toBe('geo:5,6')
    })

    it('should default body to empty string when description is not provided', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, { geoUri: 'geo:1,2' })
      expect(content.body).toBe('')
    })

    it('should default geo_uri to empty string when geoUri is not provided', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, { description: 'Somewhere' })
      expect(content.geo_uri).toBe('')
    })

    it('should fall back to snake_case geo_uri produced by the strategy', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, {
        geo_uri: 'geo:39.9,116.4;u=10',
        body: '位置: Beijing'
      })
      expect(content.geo_uri).toBe('geo:39.9,116.4;u=10')
    })

    it('should fall back to body when description is not provided', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, {
        geo_uri: 'geo:39.9,116.4;u=10',
        body: '位置: Beijing'
      })
      expect(content.body).toBe('位置: Beijing')
    })

    it('should preserve info.address from the strategy body', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, {
        geo_uri: 'geo:39.9,116.4;u=10',
        body: '位置: Beijing',
        info: { address: 'Beijing', timestamp: '1000' }
      })
      expect(content.info).toEqual({ address: 'Beijing', timestamp: '1000' })
    })

    it('should not set info for location messages without info', () => {
      const content = buildMatrixContent(MsgEnum.LOCATION, { description: 'Place', geoUri: 'geo:1,2' })
      expect(content.info).toBeUndefined()
    })
  })

  describe('default case (unhandled msgType)', () => {
    it('should set msgtype to m.audio for AUDIO (unhandled in buildMatrixContent switch)', () => {
      const content = buildMatrixContent(MsgEnum.AUDIO, 'some text')
      expect(content.msgtype).toBe(MatrixMsgType.AUDIO)
    })

    it('should use string body as-is', () => {
      const content = buildMatrixContent(MsgEnum.AUDIO, 'raw string body')
      expect(content.body).toBe('raw string body')
    })

    it('should JSON.stringify object body', () => {
      const obj = { foo: 'bar', num: 42 }
      const content = buildMatrixContent(MsgEnum.AUDIO, obj)
      expect(content.body).toBe(JSON.stringify(obj))
    })

    it('should JSON.stringify complex nested object body', () => {
      const obj = { nested: { a: 1 }, arr: [1, 2, 3] }
      const content = buildMatrixContent(MsgEnum.AUDIO, obj)
      expect(content.body).toBe(JSON.stringify(obj))
    })
  })

  describe('re-export of MatrixBurnDuration', () => {
    it('should re-export MatrixBurnDuration from the module', () => {
      expect(ReexportedMatrixBurnDuration).toBe(MatrixBurnDuration)
    })

    it('should have SEC_30 with value 30', () => {
      expect(ReexportedMatrixBurnDuration.SEC_30).toBe(30)
    })

    it('should have SEC_300 with value 300', () => {
      expect(ReexportedMatrixBurnDuration.SEC_300).toBe(300)
    })
  })
})
