// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  extractFileName,
  formatBottomText,
  formatBytes,
  formatDuration,
  getFileSuffix,
  getMimeTypeFromExtension,
  removeTag
} from '../Formatting'

describe('Formatting', () => {
  describe('formatBytes', () => {
    it('returns "0 B" for non-positive or NaN input', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(-1)).toBe('0 B')
      expect(formatBytes(NaN)).toBe('0 B')
    })

    it('formats bytes', () => {
      expect(formatBytes(512)).toBe('512 B')
    })

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })

    it('formats megabytes and gigabytes', () => {
      expect(formatBytes(1024 ** 2)).toBe('1 MB')
      expect(formatBytes(1024 ** 3)).toBe('1 GB')
    })
  })

  describe('getFileSuffix', () => {
    it('returns "other" for empty input or no extension', () => {
      expect(getFileSuffix('')).toBe('other')
      expect(getFileSuffix('file_without_dot')).toBe('other')
    })

    it('maps common image extensions to "jpg"', () => {
      expect(getFileSuffix('photo.jpg')).toBe('jpg')
      expect(getFileSuffix('photo.JPEG')).toBe('jpg')
      expect(getFileSuffix('photo.png')).toBe('jpg')
      expect(getFileSuffix('photo.webp')).toBe('jpg')
    })

    it('maps doc/xls/ppt families', () => {
      expect(getFileSuffix('a.docx')).toBe('doc')
      expect(getFileSuffix('a.xlsx')).toBe('xls')
      expect(getFileSuffix('a.pptx')).toBe('ppt')
    })

    it('maps archive types to "zip"', () => {
      expect(getFileSuffix('a.rar')).toBe('zip')
      expect(getFileSuffix('a.7z')).toBe('zip')
    })

    it('falls back to "other" for unknown suffix', () => {
      expect(getFileSuffix('weird.xyzzy')).toBe('other')
    })
  })

  describe('extractFileName', () => {
    it('extracts file name from POSIX path', () => {
      expect(extractFileName('/var/tmp/photo.png')).toBe('photo.png')
    })

    it('extracts file name from Windows path', () => {
      expect(extractFileName('C:\\Users\\me\\file.txt')).toBe('file.txt')
    })

    it('returns the input when there is no separator', () => {
      expect(extractFileName('only.txt')).toBe('only.txt')
    })

    it('falls back to "file" when path is empty', () => {
      expect(extractFileName('')).toBe('file')
    })
  })

  describe('getMimeTypeFromExtension', () => {
    it('maps known extensions', () => {
      expect(getMimeTypeFromExtension('a.jpg')).toBe('image/jpeg')
      expect(getMimeTypeFromExtension('a.JPEG')).toBe('image/jpeg')
      expect(getMimeTypeFromExtension('a.png')).toBe('image/png')
      expect(getMimeTypeFromExtension('a.gif')).toBe('image/gif')
      expect(getMimeTypeFromExtension('a.webp')).toBe('image/webp')
      expect(getMimeTypeFromExtension('a.svg')).toBe('image/svg+xml')
    })

    it('falls back to image/png for unknown extensions', () => {
      expect(getMimeTypeFromExtension('a.unknown')).toBe('image/png')
      expect(getMimeTypeFromExtension('no-ext')).toBe('image/png')
    })
  })

  describe('removeTag', () => {
    it('strips HTML tags but keeps the text', () => {
      expect(removeTag('<p>hello <b>world</b></p>')).toContain('hello world')
    })

    it('replaces <br> with newline', () => {
      expect(removeTag('a<br>b')).toBe('a\nb')
    })

    it('replaces nbsp with regular space', () => {
      expect(removeTag('a&nbsp;b')).toBe('a b')
    })
  })

  describe('formatDuration', () => {
    it('默认向下取整，分钟不补零', () => {
      expect(formatDuration(0)).toBe('0:00')
      expect(formatDuration(5)).toBe('0:05')
      expect(formatDuration(65)).toBe('1:05')
      expect(formatDuration(65.9)).toBe('1:05')
      expect(formatDuration(3661)).toBe('61:01')
    })

    it('round: true 时对秒数四舍五入', () => {
      expect(formatDuration(59.6, { round: true })).toBe('1:00')
      expect(formatDuration(65.4, { round: true })).toBe('1:05')
    })

    it('padMinutes: true 时分钟补零到两位', () => {
      expect(formatDuration(5, { padMinutes: true })).toBe('00:05')
      expect(formatDuration(65, { padMinutes: true })).toBe('01:05')
      expect(formatDuration(3661, { padMinutes: true })).toBe('61:01')
    })

    it('round 与 padMinutes 组合', () => {
      expect(formatDuration(65.6, { round: true, padMinutes: true })).toBe('01:06')
    })

    it('非有限或负数按 0 处理', () => {
      expect(formatDuration(NaN)).toBe('0:00')
      expect(formatDuration(-1)).toBe('0:00')
      expect(formatDuration(Infinity)).toBe('0:00')
      expect(formatDuration(NaN, { padMinutes: true })).toBe('00:00')
    })
  })

  describe('formatBottomText', () => {
    it('returns input unchanged when it contains Chinese', () => {
      expect(formatBottomText('你好世界这是一个长文本')).toBe('你好世界这是一个长文本')
    })

    it('returns input unchanged when length within maxLength', () => {
      expect(formatBottomText('hello', 6)).toBe('hello')
    })

    it('truncates long ASCII strings', () => {
      const result = formatBottomText('abcdefghij', 6)
      expect(result.endsWith('...')).toBe(true)
      expect(result.length).toBeLessThan('abcdefghij'.length + 3)
    })

    it('counts non-space characters when truncating', () => {
      const result = formatBottomText('a b c d e f g h', 4)
      expect(result.endsWith('...')).toBe(true)
    })
  })
})
