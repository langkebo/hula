import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadProgress } from '@/composables/common/useUploadProgress'

describe('useUploadProgress — 统一上传进度 (§9.4.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  describe('初始状态', () => {
    it('progress 初始为 0', () => {
      const { progress } = useUploadProgress({ fileId: 'f1', fileName: 'a.png', total: 1000 })
      expect(progress.value).toBe(0)
    })

    it('status 初始为 pending', () => {
      const { status } = useUploadProgress({ fileId: 'f1', fileName: 'a.png', total: 1000 })
      expect(status.value).toBe('pending')
    })

    it('speed 初始为 0', () => {
      const { speed } = useUploadProgress({ fileId: 'f1', fileName: 'a.png', total: 1000 })
      expect(speed.value).toBe(0)
    })

    it('fileName 透传', () => {
      const { fileName } = useUploadProgress({ fileId: 'f1', fileName: 'photo.png', total: 1000 })
      expect(fileName.value).toBe('photo.png')
    })
  })

  describe('start — 开始上传', () => {
    it('start 后 status 为 uploading', () => {
      const { status, start } = useUploadProgress({ fileId: 'f1', fileName: 'a.png', total: 1000 })
      start()
      expect(status.value).toBe('uploading')
    })
  })

  describe('updateProgress — 更新进度', () => {
    it('更新 loaded 后 progress 按比例计算', () => {
      const { progress, start, updateProgress } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      updateProgress(500)
      expect(progress.value).toBe(50)
    })

    it('loaded=total 时 progress 为 100', () => {
      const { progress, start, updateProgress } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      updateProgress(1000)
      expect(progress.value).toBe(100)
    })

    it('progress 不超过 100', () => {
      const { progress, start, updateProgress } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      updateProgress(1200)
      expect(progress.value).toBe(100)
    })

    it('progress 不小于 0', () => {
      const { progress, start, updateProgress } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      updateProgress(-100)
      expect(progress.value).toBe(0)
    })

    it('根据时间差计算上传速率 (bytes/s)', () => {
      const { speed, start, updateProgress } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 10000
      })
      start()
      // 推进 1 秒
      vi.advanceTimersByTime(1000)
      updateProgress(5000)
      // 5000 bytes / 1s = 5000 bytes/s
      expect(speed.value).toBe(5000)
    })

    it('total 为 0 时 progress 始终为 0，不抛错', () => {
      const { progress, start, updateProgress } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 0
      })
      start()
      updateProgress(100)
      expect(progress.value).toBe(0)
    })
  })

  describe('完成/失败/取消状态', () => {
    it('markDone 后 status 为 done 且 progress 为 100', () => {
      const { status, progress, start, markDone } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      markDone()
      expect(status.value).toBe('done')
      expect(progress.value).toBe(100)
    })

    it('markError 后 status 为 error', () => {
      const { status, start, markError } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      markError()
      expect(status.value).toBe('error')
    })

    it('cancel 后 status 为 cancelled', () => {
      const { status, start, cancel } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      cancel()
      expect(status.value).toBe('cancelled')
    })

    it('cancel 触发 onCancel 回调', () => {
      const onCancel = vi.fn()
      const { start, cancel } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000,
        onCancel
      })
      start()
      cancel()
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('已完成后再 cancel 不触发 onCancel', () => {
      const onCancel = vi.fn()
      const { start, markDone, cancel } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000,
        onCancel
      })
      start()
      markDone()
      cancel()
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('isTerminal — 终态判断', () => {
    it('pending/uploading 非终态', () => {
      const { isTerminal, start } = useUploadProgress({ fileId: 'f1', fileName: 'a.png', total: 1000 })
      expect(isTerminal.value).toBe(false)
      start()
      expect(isTerminal.value).toBe(false)
    })

    it('done/error/cancelled 为终态', () => {
      const { isTerminal, start, markDone } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      markDone()
      expect(isTerminal.value).toBe(true)

      // 重置后测试 error
      const r2 = useUploadProgress({ fileId: 'f2', fileName: 'b.png', total: 1000 })
      r2.start()
      r2.markError()
      expect(r2.isTerminal.value).toBe(true)

      const r3 = useUploadProgress({ fileId: 'f3', fileName: 'c.png', total: 1000 })
      r3.start()
      r3.cancel()
      expect(r3.isTerminal.value).toBe(true)
    })
  })

  describe('reset — 重置状态', () => {
    it('reset 后回到初始 pending 状态', () => {
      const { status, progress, start, updateProgress, reset } = useUploadProgress({
        fileId: 'f1',
        fileName: 'a.png',
        total: 1000
      })
      start()
      updateProgress(500)
      reset()
      expect(status.value).toBe('pending')
      expect(progress.value).toBe(0)
    })
  })
})
