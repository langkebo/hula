import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Logger first so AudioManager imports a stubbed logger
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
  })
}))

import { audioManager } from '../AudioManager'

function createAudioElement(src = 'test-audio.mp3'): HTMLAudioElement {
  const audio = new Audio()
  audio.src = src
  audio.play = vi.fn().mockResolvedValue(undefined) as unknown as typeof audio.play
  audio.pause = vi.fn() as unknown as typeof audio.pause
  // jsdom defaults to `paused: true`, which makes AudioManager skip pause() calls
  // because the code guards with `if (!this.currentAudio.paused)`. Force `paused`
  // to report `false` so the element looks actively playing.
  Object.defineProperty(audio, 'paused', {
    configurable: true,
    get: () => false
  })
  return audio
}

describe('AudioManager', () => {
  let audioElement: HTMLAudioElement

  beforeEach(() => {
    // Ensure each test starts with a clean state
    audioManager.stop()
    vi.clearAllMocks()

    audioElement = createAudioElement()
  })

  afterEach(() => {
    audioManager.stop()
    vi.restoreAllMocks()
  })

  describe('play', () => {
    it('plays a new audio and tracks the current audio id', async () => {
      await audioManager.play(audioElement, 'audio-1')
      expect(audioElement.play).toHaveBeenCalled()
      expect(audioManager.getCurrentAudioId()).toBe('audio-1')
      expect(audioManager.isPlaying('audio-1')).toBe(true)
    })

    it('stops the current audio when switching to a different one', async () => {
      const firstAudio = createAudioElement('first.mp3')
      const secondAudio = createAudioElement('second.mp3')

      await audioManager.play(firstAudio, 'first')
      expect(firstAudio.play).toHaveBeenCalledTimes(1)

      await audioManager.play(secondAudio, 'second')
      expect(firstAudio.pause).toHaveBeenCalled()
      expect(secondAudio.play).toHaveBeenCalledTimes(1)
      expect(audioManager.getCurrentAudioId()).toBe('second')
    })

    it('resets current audio when playing the same id again', async () => {
      await audioManager.play(audioElement, 'audio-1')
      expect(audioManager.getCurrentAudioId()).toBe('audio-1')

      // Playing the same id again should reset currentTime
      audioElement.currentTime = 10
      await audioManager.play(audioElement, 'audio-1')
      expect(audioElement.currentTime).toBe(0)
      expect(audioManager.getCurrentAudioId()).toBe('audio-1')
    })

    it('ignores AbortError from play() without throwing', async () => {
      const abortError = new DOMException('The play() request was interrupted', 'AbortError')
      audioElement.play = vi.fn().mockRejectedValue(abortError) as unknown as typeof audioElement.play

      await expect(audioManager.play(audioElement, 'audio-abort')).resolves.toBeUndefined()
      expect(audioManager.getCurrentAudioId()).toBeNull()
    })

    it('rethrows non-Abort errors and clears state', async () => {
      const notAllowedError = new DOMException('Playback not allowed', 'NotAllowedError')
      audioElement.play = vi.fn().mockRejectedValue(notAllowedError) as unknown as typeof audioElement.play

      await expect(audioManager.play(audioElement, 'audio-fail')).rejects.toBe(notAllowedError)
      expect(audioManager.getCurrentAudioId()).toBeNull()
      expect(audioManager.isPlaying('audio-fail')).toBe(false)
    })
  })

  describe('pause', () => {
    it('pauses the current audio', async () => {
      await audioManager.play(audioElement, 'audio-1')
      audioManager.pause()
      expect(audioElement.pause).toHaveBeenCalled()
    })

    it('does not throw when no audio is playing', () => {
      expect(() => audioManager.pause()).not.toThrow()
    })

    it('clears state when pause throws', async () => {
      await audioManager.play(audioElement, 'audio-1')
      // Force pause to throw
      audioElement.pause = vi.fn(() => {
        throw new Error('pause failed')
      }) as unknown as typeof audioElement.pause

      audioManager.pause()
      expect(audioManager.getCurrentAudioId()).toBeNull()
    })
  })

  describe('stop', () => {
    it('stops and resets the current audio', async () => {
      await audioManager.play(audioElement, 'audio-1')
      audioElement.currentTime = 42

      audioManager.stop()
      expect(audioElement.pause).toHaveBeenCalled()
      expect(audioElement.currentTime).toBe(0)
      expect(audioManager.getCurrentAudioId()).toBeNull()
      expect(audioManager.isPlaying('audio-1')).toBe(false)
    })

    it('is a no-op when no audio is playing', () => {
      expect(() => audioManager.stop()).not.toThrow()
    })

    it('notifies listeners on stop', async () => {
      const listener = vi.fn()
      audioManager.addListener(listener)

      await audioManager.play(audioElement, 'audio-1')
      listener.mockClear()

      audioManager.stop()
      expect(listener).toHaveBeenCalled()
    })

    it('clears state even if pause throws', async () => {
      await audioManager.play(audioElement, 'audio-1')
      audioElement.pause = vi.fn(() => {
        throw new Error('stop failed')
      }) as unknown as typeof audioElement.pause

      audioManager.stop()
      expect(audioManager.getCurrentAudioId()).toBeNull()
    })
  })

  describe('stopAll', () => {
    it('stops the current managed audio', async () => {
      await audioManager.play(audioElement, 'audio-1')
      audioManager.stopAll()
      expect(audioElement.pause).toHaveBeenCalled()
      expect(audioManager.getCurrentAudioId()).toBeNull()
    })

    it('also stops other audio elements in the document', async () => {
      const otherAudio = createAudioElement('other.mp3')
      document.body.appendChild(otherAudio)

      audioManager.stopAll()
      expect(otherAudio.pause).toHaveBeenCalled()
      document.body.removeChild(otherAudio)
    })

    it('notifies listeners even when no current audio is managed', () => {
      const listener = vi.fn()
      audioManager.addListener(listener)
      audioManager.stopAll()
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('isPlaying', () => {
    it('returns true when the given id is currently playing', async () => {
      await audioManager.play(audioElement, 'audio-1')
      expect(audioManager.isPlaying('audio-1')).toBe(true)
    })

    it('returns false for an unknown id', async () => {
      await audioManager.play(audioElement, 'audio-1')
      expect(audioManager.isPlaying('unknown')).toBe(false)
    })

    it('returns false when no audio is managed', () => {
      expect(audioManager.isPlaying('audio-1')).toBe(false)
    })

    it('returns false after the audio is paused', async () => {
      await audioManager.play(audioElement, 'audio-1')
      // Simulate the element being paused via the browser
      Object.defineProperty(audioElement, 'paused', {
        configurable: true,
        get: () => true
      })
      expect(audioManager.isPlaying('audio-1')).toBe(false)
    })

    it('returns false after stop() even when paused reports false', async () => {
      await audioManager.play(audioElement, 'audio-1')
      audioManager.stop()
      expect(audioManager.isPlaying('audio-1')).toBe(false)
    })
  })

  describe('getCurrentAudioId', () => {
    it('returns null initially', () => {
      expect(audioManager.getCurrentAudioId()).toBeNull()
    })

    it('returns the id of the currently playing audio', async () => {
      await audioManager.play(audioElement, 'current-audio')
      expect(audioManager.getCurrentAudioId()).toBe('current-audio')
    })

    it('returns null after stop', async () => {
      await audioManager.play(audioElement, 'current-audio')
      audioManager.stop()
      expect(audioManager.getCurrentAudioId()).toBeNull()
    })
  })

  describe('listeners', () => {
    it('addListener registers a callback', async () => {
      const listener = vi.fn()
      audioManager.addListener(listener)
      await audioManager.play(audioElement, 'audio-1')
      listener.mockClear()
      audioManager.stop()
      expect(listener).toHaveBeenCalled()
    })

    it('removeListener unregisters the callback', async () => {
      const listener = vi.fn()
      audioManager.addListener(listener)
      audioManager.removeListener(listener)
      await audioManager.play(audioElement, 'audio-1')
      listener.mockClear()
      audioManager.stop()
      expect(listener).not.toHaveBeenCalled()
    })
  })
})
