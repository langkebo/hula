import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import {
  fixFileMimeType,
  getAudioMimeType,
  getFileExtension,
  getImageMimeType,
  getMessageTypeByFile,
  getVideoMimeType,
  isPathUploadFile,
  isVideoUrl
} from '../FileType'

const makeFile = (name: string, type = ''): File => new File(['x'], name, { type })

describe('FileType', () => {
  describe('isPathUploadFile', () => {
    it('returns true for path upload objects', () => {
      expect(isPathUploadFile({ kind: 'path', path: '/tmp/a', name: 'a', size: 0, type: '' })).toBe(true)
    })

    it('returns false for browser File', () => {
      expect(isPathUploadFile(makeFile('a.txt'))).toBe(false)
    })
  })

  describe('getFileExtension', () => {
    it('returns lowercase extension', () => {
      expect(getFileExtension('Photo.JPG')).toBe('jpg')
      expect(getFileExtension('a.b.c.MP4')).toBe('mp4')
    })

    it('returns empty string when no extension', () => {
      expect(getFileExtension('README')).toBe('')
    })
  })

  describe('mime helpers', () => {
    it('getVideoMimeType maps known extensions and falls back', () => {
      expect(getVideoMimeType('clip.mp4')).toBe('video/mp4')
      expect(getVideoMimeType('clip.mov')).toBe('video/quicktime')
      expect(getVideoMimeType('clip.unknown')).toBe('video/mp4')
    })

    it('getAudioMimeType maps known extensions and falls back', () => {
      expect(getAudioMimeType('a.mp3')).toBe('audio/mpeg')
      expect(getAudioMimeType('a.flac')).toBe('audio/flac')
      expect(getAudioMimeType('a.unknown')).toBe('audio/mpeg')
    })

    it('getImageMimeType maps known extensions and falls back', () => {
      expect(getImageMimeType('a.jpg')).toBe('image/jpeg')
      expect(getImageMimeType('a.png')).toBe('image/png')
      expect(getImageMimeType('a.svg')).toBe('image/svg+xml')
      expect(getImageMimeType('a.unknown')).toBe('image/jpeg')
    })
  })

  describe('fixFileMimeType', () => {
    it('returns the file unchanged when MIME type is already correct', () => {
      const file = makeFile('a.png', 'image/png')
      expect(fixFileMimeType(file)).toBe(file)
    })

    it('repairs missing MIME for video extensions', () => {
      const file = makeFile('a.mov', '')
      const fixed = fixFileMimeType(file)
      expect(fixed).not.toBe(file)
      expect(fixed.type).toBe('video/quicktime')
    })

    it('repairs missing MIME for audio extensions', () => {
      const file = makeFile('a.flac', '')
      expect(fixFileMimeType(file).type).toBe('audio/flac')
    })

    it('repairs missing MIME for image extensions', () => {
      const file = makeFile('a.webp', '')
      expect(fixFileMimeType(file).type).toBe('image/webp')
    })

    it('keeps non-media files unchanged', () => {
      const file = makeFile('a.txt', '')
      expect(fixFileMimeType(file)).toBe(file)
    })
  })

  describe('getMessageTypeByFile', () => {
    it('classifies videos by extension or MIME', () => {
      expect(getMessageTypeByFile(makeFile('a.mp4', 'video/mp4'))).toBe(MsgEnum.VIDEO)
      expect(getMessageTypeByFile(makeFile('a.webm', ''))).toBe(MsgEnum.VIDEO)
    })

    it('classifies audio', () => {
      expect(getMessageTypeByFile(makeFile('a.mp3', 'audio/mpeg'))).toBe(MsgEnum.VOICE)
    })

    it('classifies images and excludes SVG MIME from IMAGE', () => {
      expect(getMessageTypeByFile(makeFile('a.png', 'image/png'))).toBe(MsgEnum.IMAGE)
      expect(getMessageTypeByFile(makeFile('a.svg', 'image/svg+xml'))).toBe(MsgEnum.FILE)
    })

    it('falls back to FILE for unknown types', () => {
      expect(getMessageTypeByFile(makeFile('a.bin', ''))).toBe(MsgEnum.FILE)
    })

    it('special-cases .ts to avoid being classified as video', () => {
      expect(getMessageTypeByFile(makeFile('a.ts', 'video/mp2t'))).toBe(MsgEnum.FILE)
    })
  })

  describe('isVideoUrl', () => {
    it('returns true for video extensions on http(s) URLs', () => {
      expect(isVideoUrl('https://example.com/clip.mp4')).toBe(true)
      expect(isVideoUrl('https://example.com/clip.webm')).toBe(true)
    })

    it('returns false for non-video extensions or invalid URLs', () => {
      expect(isVideoUrl('https://example.com/photo.jpg')).toBe(false)
      expect(isVideoUrl('not a url')).toBe(false)
    })
  })
})
