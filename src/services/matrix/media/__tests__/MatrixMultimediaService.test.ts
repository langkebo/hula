import { describe, it, expect, vi } from 'vitest'
import { matrixMultimediaService } from '../MatrixMultimediaService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixMultimediaService', () => {
  describe('getFileIcon', () => {
    it('should return image for image types', () => {
      expect(matrixMultimediaService.getFileIcon('image/png')).toBe('image')
      expect(matrixMultimediaService.getFileIcon('image/jpeg')).toBe('image')
    })

    it('should return video for video types', () => {
      expect(matrixMultimediaService.getFileIcon('video/mp4')).toBe('video')
    })

    it('should return audio for audio types', () => {
      expect(matrixMultimediaService.getFileIcon('audio/ogg')).toBe('audio')
    })

    it('should return pdf for application/pdf', () => {
      expect(matrixMultimediaService.getFileIcon('application/pdf')).toBe('pdf')
    })

    it('should return document for word types', () => {
      expect(
        matrixMultimediaService.getFileIcon('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).toBe('document')
    })

    it('should return spreadsheet for excel types', () => {
      expect(matrixMultimediaService.getFileIcon('application/vnd.ms-excel')).toBe('spreadsheet')
      expect(matrixMultimediaService.getFileIcon('application/excel')).toBe('spreadsheet')
    })

    it('should return archive for zip types', () => {
      expect(matrixMultimediaService.getFileIcon('application/zip')).toBe('archive')
    })

    it('should return file for unknown types', () => {
      expect(matrixMultimediaService.getFileIcon('application/octet-stream')).toBe('file')
    })
  })

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(matrixMultimediaService.formatFileSize(0)).toBe('0 B')
    })

    it('should format bytes', () => {
      expect(matrixMultimediaService.formatFileSize(512)).toBe('512 B')
    })

    it('should format kilobytes', () => {
      expect(matrixMultimediaService.formatFileSize(1024)).toBe('1 KB')
    })

    it('should format megabytes', () => {
      expect(matrixMultimediaService.formatFileSize(1048576)).toBe('1 MB')
    })

    it('should format gigabytes', () => {
      expect(matrixMultimediaService.formatFileSize(1073741824)).toBe('1 GB')
    })
  })

  describe('formatDuration', () => {
    it('should format 0 ms', () => {
      expect(matrixMultimediaService.formatDuration(0)).toBe('0:00')
    })

    it('should format seconds', () => {
      expect(matrixMultimediaService.formatDuration(5000)).toBe('0:05')
    })

    it('should format minutes and seconds', () => {
      expect(matrixMultimediaService.formatDuration(65000)).toBe('1:05')
    })

    it('should format long durations', () => {
      expect(matrixMultimediaService.formatDuration(3661000)).toBe('61:01')
    })
  })

  describe('isRecording', () => {
    it('should return false when not recording', () => {
      expect(matrixMultimediaService.isRecording()).toBe(false)
    })
  })

  describe('getRecordingDuration', () => {
    it('should return 0 when not recording', () => {
      expect(matrixMultimediaService.getRecordingDuration()).toBe(0)
    })
  })

  describe('getAudioLevel', () => {
    it('should return 0 when no analyser', () => {
      expect(matrixMultimediaService.getAudioLevel()).toBe(0)
    })
  })

  describe('cancelVoiceRecording', () => {
    it('should not throw when not recording', () => {
      expect(() => matrixMultimediaService.cancelVoiceRecording()).not.toThrow()
    })
  })

  describe('stopVoiceRecording', () => {
    it('should throw when not recording', async () => {
      await expect(matrixMultimediaService.stopVoiceRecording()).rejects.toThrow()
    })
  })

  describe('generateThumbnail', () => {
    it('should return null for non-image file', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const result = await matrixMultimediaService.generateThumbnail(file)
      expect(result).toBeNull()
    })
  })

  describe('downloadMedia', () => {
    it('should throw when client not initialized', async () => {
      const { default: matrixClientService } = await import('../../MatrixClientService')
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)
      await expect(matrixMultimediaService.downloadMedia('mxc://server/abc', 'file.jpg')).rejects.toThrow()
    })
  })
})
