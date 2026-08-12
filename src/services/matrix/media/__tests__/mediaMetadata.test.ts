import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAudioDuration, getImageDimensions, getVideoMetadata, withTimeout } from '../mediaMetadata'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

// ---------------------------------------------------------------------------
// Shared URL mocks
// ---------------------------------------------------------------------------
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'mock-url')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// withTimeout
// ---------------------------------------------------------------------------
describe('withTimeout', () => {
  it('resolves with value when promise completes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('result'), 1000, 'timeout error')
    expect(result).toBe('result')
  })

  it('rejects with error message when timeout fires first', async () => {
    vi.useFakeTimers()
    const neverResolves = new Promise<string>(() => {})
    const wrapped = withTimeout(neverResolves, 1000, 'timeout error')
    vi.advanceTimersByTime(1000)
    await expect(wrapped).rejects.toThrow('timeout error')
  })

  it('clears timer after resolution', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    await withTimeout(Promise.resolve('result'), 1000, 'timeout error')
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('clears timer after timeout', async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const neverResolves = new Promise<string>(() => {})
    const wrapped = withTimeout(neverResolves, 1000, 'timeout error')
    vi.advanceTimersByTime(1000)
    await expect(wrapped).rejects.toThrow('timeout error')
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('propagates rejection from the original promise', async () => {
    await expect(withTimeout(Promise.reject(new Error('original error')), 1000, 'timeout error')).rejects.toThrow(
      'original error'
    )
  })
})

// ---------------------------------------------------------------------------
// getImageDimensions
// ---------------------------------------------------------------------------
describe('getImageDimensions', () => {
  // The instance created by `new Image()` is captured here so tests can
  // trigger onload / onerror callbacks.
  let mockImgInstance: {
    naturalWidth: number
    naturalHeight: number
    onload: (() => void) | null
    onerror: (() => void) | null
    src: string
  }

  beforeEach(() => {
    mockImgInstance = undefined as any
    vi.stubGlobal(
      'Image',
      class MockImage {
        naturalWidth: number
        naturalHeight: number
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        src = ''

        constructor() {
          this.naturalWidth = 1920
          this.naturalHeight = 1080
          mockImgInstance = this
        }
      }
    )
  })

  it('returns dimensions on successful load', async () => {
    const file = new File([''], 'test.png', { type: 'image/png' })
    const promise = getImageDimensions(file)

    mockImgInstance.onload!()

    const result = await promise
    expect(result).toEqual({ width: 1920, height: 1080 })
    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url')
  })

  it('returns 0x0 on error', async () => {
    const file = new File([''], 'broken.png', { type: 'image/png' })
    const promise = getImageDimensions(file)

    mockImgInstance.onerror!()

    const result = await promise
    expect(result).toEqual({ width: 0, height: 0 })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url')
  })

  it('returns 0x0 on timeout', async () => {
    vi.useFakeTimers()
    const file = new File([''], 'slow.png', { type: 'image/png' })
    const promise = getImageDimensions(file)

    // Do not trigger onload/onerror – let the 10s timeout fire
    vi.advanceTimersByTime(10000)

    const result = await promise
    expect(result).toEqual({ width: 0, height: 0 })
  })
})

// ---------------------------------------------------------------------------
// getVideoMetadata
// ---------------------------------------------------------------------------
describe('getVideoMetadata', () => {
  let mockVideo: {
    videoWidth: number
    videoHeight: number
    duration: number
    preload: string
    onloadedmetadata: (() => void) | null
    onerror: (() => void) | null
    src: string
  }

  beforeEach(() => {
    mockVideo = {
      videoWidth: 1280,
      videoHeight: 720,
      duration: 10.5,
      preload: '',
      onloadedmetadata: null,
      onerror: null,
      src: ''
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockVideo as any)
  })

  it('returns width/height/duration on loadedmetadata', async () => {
    const file = new File([''], 'test.mp4', { type: 'video/mp4' })
    const promise = getVideoMetadata(file)

    mockVideo.onloadedmetadata!()

    const result = await promise
    expect(result).toEqual({ width: 1280, height: 720, duration: 10500 })
    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url')
  })

  it('rejects on error', async () => {
    const file = new File([''], 'broken.mp4', { type: 'video/mp4' })
    const promise = getVideoMetadata(file)

    mockVideo.onerror!()

    await expect(promise).rejects.toThrow('无法加载视频')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url')
  })

  it('rejects on timeout', async () => {
    vi.useFakeTimers()
    const file = new File([''], 'slow.mp4', { type: 'video/mp4' })
    const promise = getVideoMetadata(file)

    // Do not trigger onloadedmetadata/onerror – let the 10s timeout fire
    vi.advanceTimersByTime(10000)

    await expect(promise).rejects.toThrow('获取视频元数据超时')
  })
})

// ---------------------------------------------------------------------------
// getAudioDuration
// ---------------------------------------------------------------------------
describe('getAudioDuration', () => {
  // The instance created by `new Audio()` is captured here so tests can
  // trigger onloadedmetadata / onerror callbacks.
  let mockAudioInstance: {
    duration: number
    preload: string
    onloadedmetadata: (() => void) | null
    onerror: (() => void) | null
    src: string
  }

  beforeEach(() => {
    mockAudioInstance = undefined as any
    vi.stubGlobal(
      'Audio',
      class MockAudio {
        duration: number
        preload = ''
        onloadedmetadata: (() => void) | null = null
        onerror: (() => void) | null = null
        src = ''

        constructor() {
          this.duration = 30.5
          mockAudioInstance = this
        }
      }
    )
  })

  it('returns duration in ms on loadedmetadata', async () => {
    const file = new File([''], 'test.mp3', { type: 'audio/mp3' })
    const promise = getAudioDuration(file)

    mockAudioInstance.onloadedmetadata!()

    const result = await promise
    expect(result).toBe(30500)
    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url')
  })

  it('rejects on error', async () => {
    const file = new File([''], 'broken.mp3', { type: 'audio/mp3' })
    const promise = getAudioDuration(file)

    mockAudioInstance.onerror!()

    await expect(promise).rejects.toThrow('无法加载音频')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url')
  })

  it('rejects on timeout', async () => {
    vi.useFakeTimers()
    const file = new File([''], 'slow.mp3', { type: 'audio/mp3' })
    const promise = getAudioDuration(file)

    // Do not trigger onloadedmetadata/onerror – let the 10s timeout fire
    vi.advanceTimersByTime(10000)

    await expect(promise).rejects.toThrow('获取音频时长超时')
  })
})
