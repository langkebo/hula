import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

const { useCallBell } = await import('../useCallBell')

class FakeAudio {
  src: string
  loop = false
  play = vi.fn()
  pause = vi.fn()
  constructor(src: string) {
    this.src = src
  }
}

describe('useCallBell', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('startBell creates a looping audio and plays it', () => {
    const { bellAudio, startBell } = useCallBell('/sound/bell.mp3')
    startBell()

    expect(bellAudio.value).toBeInstanceOf(FakeAudio)
    const audio = bellAudio.value as unknown as FakeAudio
    expect(audio.src).toBe('/sound/bell.mp3')
    expect(audio.loop).toBe(true)
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('startBell is a no-op when url is empty (mute mode)', () => {
    const { bellAudio, startBell } = useCallBell('')
    startBell()
    expect(bellAudio.value).toBeNull()
  })

  it('stopBell pauses and clears the audio', () => {
    const { bellAudio, startBell, stopBell } = useCallBell('/sound/bell.mp3')
    startBell()
    const audio = bellAudio.value as unknown as FakeAudio

    stopBell()
    expect(audio.pause).toHaveBeenCalledTimes(1)
    expect(bellAudio.value).toBeNull()
  })

  it('pauseBell and playBell delegate to the underlying audio', () => {
    const { bellAudio, startBell, pauseBell, playBell } = useCallBell('/sound/bell.mp3')
    startBell()
    const audio = bellAudio.value as unknown as FakeAudio
    audio.play.mockClear()

    pauseBell()
    expect(audio.pause).toHaveBeenCalledTimes(1)

    playBell()
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('pauseBell / playBell without a bell are safe no-ops', () => {
    const { pauseBell, playBell } = useCallBell('/sound/bell.mp3')
    expect(() => pauseBell()).not.toThrow()
    expect(() => playBell()).not.toThrow()
  })
})
