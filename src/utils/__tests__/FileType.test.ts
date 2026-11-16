import { describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import {
  fixFileMimeType,
  getAudioMimeType,
  getFileExtension,
  getImageMimeType,
  getMessageTypeByFile,
  getMimeTypeByExtension,
  getVideoMimeType,
  isPathUploadFile,
  isVideoUrl,
  resolveUploadMimeType,
  resolveUploadMimeTypeFromFile,
  sniffMimeTypeByBytes
} from '../FileType'

const makeFile = (name: string, type = ''): File => new File(['x'], name, { type })
const asciiBytes = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0))
const makeBinaryFile = (name: string, bytes: readonly number[], type = ''): File =>
  new File([Uint8Array.from(bytes)], name, { type })

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

  describe('getMimeTypeByExtension', () => {
    it('maps image, video, audio and document extensions', () => {
      expect(getMimeTypeByExtension('a.png')).toBe('image/png')
      expect(getMimeTypeByExtension('clip.MP4')).toBe('video/mp4')
      expect(getMimeTypeByExtension('a.flac')).toBe('audio/flac')
      expect(getMimeTypeByExtension('a.pdf')).toBe('application/pdf')
      expect(getMimeTypeByExtension('a.docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      expect(getMimeTypeByExtension('a.zip')).toBe('application/zip')
    })

    it('returns an empty string for unknown or missing extensions', () => {
      expect(getMimeTypeByExtension('a.unknown')).toBe('')
      expect(getMimeTypeByExtension('README')).toBe('')
    })
  })

  describe('resolveUploadMimeType', () => {
    it('prefers the declared MIME type over the extension', () => {
      expect(resolveUploadMimeType('text/csv', 'a.pdf')).toBe('text/csv')
    })

    it('falls back to the extension when the declared type is empty', () => {
      expect(resolveUploadMimeType('', 'a.pdf')).toBe('application/pdf')
      expect(resolveUploadMimeType(undefined, 'clip.MP4')).toBe('video/mp4')
    })

    it('uses the scenario fallback when neither declaration nor extension matches', () => {
      expect(resolveUploadMimeType('', 'README')).toBe('application/octet-stream')
      expect(resolveUploadMimeType('', 'a.unknown', 'image/png')).toBe('image/png')
    })
  })

  describe('sniffMimeTypeByBytes', () => {
    it('detects images by magic number', () => {
      expect(sniffMimeTypeByBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe('image/png')
      expect(sniffMimeTypeByBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
      expect(sniffMimeTypeByBytes(Uint8Array.from(asciiBytes('GIF89a')))).toBe('image/gif')
    })

    it('distinguishes RIFF containers (webp / wav)', () => {
      const webp = [...asciiBytes('RIFF'), 0x1a, 0x00, 0x00, 0x00, ...asciiBytes('WEBP')]
      const wav = [...asciiBytes('RIFF'), 0x1a, 0x00, 0x00, 0x00, ...asciiBytes('WAVE')]
      expect(sniffMimeTypeByBytes(Uint8Array.from(webp))).toBe('image/webp')
      expect(sniffMimeTypeByBytes(Uint8Array.from(wav))).toBe('audio/wav')
    })

    it('detects documents and zip containers', () => {
      expect(sniffMimeTypeByBytes(Uint8Array.from(asciiBytes('%PDF-1.7')))).toBe('application/pdf')
      expect(sniffMimeTypeByBytes(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe('application/zip')
    })

    it('distinguishes mp4 from quicktime by ftyp brand', () => {
      const mp4 = [...asciiBytes('\u0000\u0000\u0000\u0018ftyp'), ...asciiBytes('isom')]
      const mov = [...asciiBytes('\u0000\u0000\u0000\u0014ftyp'), ...asciiBytes('qt  ')]
      expect(sniffMimeTypeByBytes(Uint8Array.from(mp4))).toBe('video/mp4')
      expect(sniffMimeTypeByBytes(Uint8Array.from(mov))).toBe('video/quicktime')
    })

    it('detects heic / avif brands and leaves unknown brands unresolved', () => {
      const heic = [...asciiBytes('\u0000\u0000\u0000\u0018ftyp'), ...asciiBytes('heic')]
      const avif = [...asciiBytes('\u0000\u0000\u0000\u0018ftyp'), ...asciiBytes('avif')]
      const unknown = [...asciiBytes('\u0000\u0000\u0000\u0018ftyp'), ...asciiBytes('zzzz')]
      expect(sniffMimeTypeByBytes(Uint8Array.from(heic))).toBe('image/heic')
      expect(sniffMimeTypeByBytes(Uint8Array.from(avif))).toBe('image/avif')
      expect(sniffMimeTypeByBytes(Uint8Array.from(unknown))).toBe('')
    })

    it('detects audio containers', () => {
      expect(sniffMimeTypeByBytes(Uint8Array.from(asciiBytes('OggS')))).toBe('application/ogg')
      expect(sniffMimeTypeByBytes(Uint8Array.from(asciiBytes('fLaC')))).toBe('audio/flac')
      expect(sniffMimeTypeByBytes(Uint8Array.from(asciiBytes('ID3')))).toBe('audio/mpeg')
      expect(sniffMimeTypeByBytes(Uint8Array.from([0xff, 0xfb, 0x90]))).toBe('audio/mpeg')
    })

    it('returns an empty string for unknown or truncated input', () => {
      expect(sniffMimeTypeByBytes(Uint8Array.from(asciiBytes('hello')))).toBe('')
      expect(() => sniffMimeTypeByBytes(Uint8Array.from([0x89]))).not.toThrow()
      expect(sniffMimeTypeByBytes(new Uint8Array())).toBe('')
    })
  })

  describe('resolveUploadMimeTypeFromFile', () => {
    it('prefers the declared MIME type and skips byte sniffing', async () => {
      const file = makeBinaryFile('blob', [0x89, 0x50, 0x4e, 0x47], 'text/csv')
      await expect(resolveUploadMimeTypeFromFile(file, 'blob')).resolves.toBe('text/csv')
    })

    it('falls back to the extension before sniffing', async () => {
      const file = makeBinaryFile('季度报告.PDF', [0x00, 0x01, 0x02])
      await expect(resolveUploadMimeTypeFromFile(file, '季度报告.PDF')).resolves.toBe('application/pdf')
    })

    it('treats application/octet-stream as undeclared and sniffs the header', async () => {
      const file = makeBinaryFile('screenshot', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], 'application/octet-stream')
      await expect(resolveUploadMimeTypeFromFile(file, 'screenshot')).resolves.toBe('image/png')
    })

    it('falls back when the header is unknown', async () => {
      const file = makeBinaryFile('blob', asciiBytes('hello world'))
      await expect(resolveUploadMimeTypeFromFile(file, 'blob')).resolves.toBe('application/octet-stream')
      await expect(resolveUploadMimeTypeFromFile(file, 'blob', 'image/png')).resolves.toBe('image/png')
    })

    it('uses the scenario fallback when reading bytes throws', async () => {
      const file = makeFile('blob')
      vi.spyOn(file, 'slice').mockImplementation(() => {
        throw new Error('read failed')
      })

      await expect(resolveUploadMimeTypeFromFile(file, 'blob', 'video/mp4')).resolves.toBe('video/mp4')
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
