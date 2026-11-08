import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useWaveformRenderer } from '../useWaveformRenderer'

const { AudioContextStub, decodeAudioDataMock } = vi.hoisted(() => {
  const decodeAudioDataMock = vi.fn(async () => ({
    getChannelData: () => new Float32Array(64)
  }))

  class AudioContextStub {
    static instances = 0

    decodeAudioData = decodeAudioDataMock

    constructor() {
      AudioContextStub.instances += 1
    }
  }

  ;(globalThis as { AudioContext?: unknown }).AudioContext = AudioContextStub

  return { AudioContextStub, decodeAudioDataMock }
})

const createRenderer = () =>
  useWaveformRenderer(ref(10), ref(0), ref(false), ref(0), () => ({ playedColor: 'red', unplayedColor: 'gray' }))

describe('useWaveformRenderer', () => {
  it('多个渲染器实例共享同一个 AudioContext', async () => {
    const first = createRenderer()
    const second = createRenderer()

    await first.generateWaveformData(new ArrayBuffer(8))
    await second.generateWaveformData(new ArrayBuffer(8))

    // 每个实例各建一个 AudioContext 会耗尽浏览器上下文配额
    expect(AudioContextStub.instances).toBe(1)
    expect(decodeAudioDataMock).toHaveBeenCalledTimes(2)
    expect(first.waveformData.value.length).toBeGreaterThan(0)
    expect(second.waveformData.value.length).toBeGreaterThan(0)
  })
})
