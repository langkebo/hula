/**
 * Task 18: 语音波形预计算（读取 audio_waveform 字段）
 *
 * 验证 useWaveformRenderer 优先使用 Matrix 语音事件中预计算的
 * `org.matrix.msc3245.voice.audio_waveform` 字段，跳过昂贵的
 * AudioContext.decodeAudioData 实时计算；并在缺失时回退到实时计算。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useWaveformRenderer } from '@/composables/chat/useWaveformRenderer'

describe('Precomputed waveform (audio_waveform field)', () => {
  // 保存原始 AudioContext 描述符以便恢复
  const saveDescriptor = (obj: object, key: string) => {
    const d = Object.getOwnPropertyDescriptor(obj, key)
    return d ? { obj, key, d } : null
  }
  const originals = {
    globalThis: saveDescriptor(globalThis, 'AudioContext'),
    window: saveDescriptor(window, 'AudioContext')
  }

  // 跨测试共享的 spy：decodeAudioData 调用计数与构造计数
  let decodeSpy: ReturnType<typeof vi.fn>
  let ctorCalls: number

  beforeEach(() => {
    ctorCalls = 0
    // 为 generateWaveformData fallback 测试提供 AudioContext mock。
    // 预计算路径不会用到它，但统一设置保持环境一致。
    const channelData = new Float32Array(100).fill(1)
    const mockBuffer = { getChannelData: (_ch: number) => channelData }
    decodeSpy = vi.fn().mockResolvedValue(mockBuffer)
    // 使用普通函数构造器：`new MockAudioContext()` 返回带 decodeAudioData 的实例。
    // （vi.fn().mockImplementation 在 `new` 下不会返回实现返回的对象，会导致 decodeAudioData 为 undefined）
    function MockAudioContext(this: unknown) {
      ctorCalls++
      return { decodeAudioData: decodeSpy }
    }
    // happy-dom 可能将 AudioContext 定义为只读/原型属性，使用 defineProperty 强制覆盖
    const define = (obj: object) =>
      Object.defineProperty(obj, 'AudioContext', {
        value: MockAudioContext,
        configurable: true,
        writable: true
      })
    define(globalThis)
    define(window)
  })

  afterEach(() => {
    const restore = (entry: { obj: object; key: string; d: PropertyDescriptor } | null) => {
      if (!entry) {
        return
      }
      Object.defineProperty(entry.obj, entry.key, entry.d)
    }
    restore(originals.globalThis)
    restore(originals.window)
  })

  // 用合理默认值实例化 composable
  const makeRenderer = () =>
    useWaveformRenderer(
      ref(10), // duration（秒）→ waveformWidth=50, samples=25
      ref(0), // playbackProgress
      ref(false), // isDragging
      ref(0), // previewTime
      () => ({ playedColor: '#ffffff', unplayedColor: '#888888' })
    )

  it('loadPrecomputedWaveform 设置 waveformData 并归一化到 0-1', () => {
    const r = makeRenderer()
    r.loadPrecomputedWaveform([10, 50, 80, 30, 90])
    // max=90, divisor=max(1024, 90)=1024
    expect(r.waveformData.value).toEqual([10 / 1024, 50 / 1024, 80 / 1024, 30 / 1024, 90 / 1024])
  })

  it('loadPrecomputedWaveform 将 >1 的值缩放到 0-1 范围', () => {
    const r = makeRenderer()
    r.loadPrecomputedWaveform([512, 1024, 256])
    // max=1024, divisor=max(1024, 1024)=1024
    expect(r.waveformData.value).toEqual([0.5, 1, 0.25])
    expect(r.waveformData.value.every((v) => v >= 0 && v <= 1)).toBe(true)
  })

  it('loadPrecomputedWaveform 对超出 1024 的值按最大值归一化', () => {
    const r = makeRenderer()
    r.loadPrecomputedWaveform([0, 2048, 1024])
    // max=2048, divisor=max(1024, 2048)=2048
    expect(r.waveformData.value).toEqual([0, 1, 0.5])
  })

  it('loadPrecomputedWaveform 保留已归一化（0-1）的值不变', () => {
    const r = makeRenderer()
    r.loadPrecomputedWaveform([0.1, 0.5, 0.9])
    expect(r.waveformData.value).toEqual([0.1, 0.5, 0.9])
  })

  it('loadPrecomputedWaveform 标记缓存需要更新', () => {
    const r = makeRenderer()
    r.loadPrecomputedWaveform([10, 50, 80])
    expect(r.shouldUpdateCache.value).toBe(true)
  })

  it('loadPrecomputedWaveform 对空数组不做任何操作', () => {
    const r = makeRenderer()
    r.loadPrecomputedWaveform([100, 200])
    const before = r.waveformData.value
    r.loadPrecomputedWaveform([])
    expect(r.waveformData.value).toEqual(before)
  })

  it('loadFromEvent 存在 audio_waveform 时返回 true 并加载数据', () => {
    const r = makeRenderer()
    const event = {
      content: {
        'org.matrix.msc3245.voice': {
          audio_waveform: [10, 50, 80, 30, 90]
        }
      }
    }
    const ok = r.loadFromEvent(event)
    expect(ok).toBe(true)
    expect(r.waveformData.value).toEqual([10 / 1024, 50 / 1024, 80 / 1024, 30 / 1024, 90 / 1024])
  })

  it('loadFromEvent 缺少 audio_waveform 时返回 false', () => {
    const r = makeRenderer()
    const ok = r.loadFromEvent({ content: { 'org.matrix.msc3245.voice': {} } })
    expect(ok).toBe(false)
    expect(r.waveformData.value).toEqual([])
  })

  it('loadFromEvent 缺少 content 时返回 false', () => {
    const r = makeRenderer()
    const ok = r.loadFromEvent({})
    expect(ok).toBe(false)
  })

  it('loadFromEvent 对空数组返回 false', () => {
    const r = makeRenderer()
    const ok = r.loadFromEvent({
      content: { 'org.matrix.msc3245.voice': { audio_waveform: [] } }
    })
    expect(ok).toBe(false)
  })

  it('loadFromEvent 对非数组 audio_waveform 返回 false', () => {
    const r = makeRenderer()
    const ok = r.loadFromEvent({
      content: { 'org.matrix.msc3245.voice': { audio_waveform: 'not-an-array' } }
    })
    expect(ok).toBe(false)
  })

  it('loadFromEvent 对含非数字元素的数组返回 false', () => {
    const r = makeRenderer()
    const ok = r.loadFromEvent({
      content: { 'org.matrix.msc3245.voice': { audio_waveform: [10, 'bad', 30] } }
    })
    expect(ok).toBe(false)
  })

  it('generateWaveformData 仍可作为 fallback 正常工作', async () => {
    const r = makeRenderer()
    await r.generateWaveformData(new ArrayBuffer(8))
    // duration=10 → width=50 → samples=25
    expect(r.waveformData.value.length).toBe(25)
    // channelData 全为 1 → rms=1, max=1, intensity=min(1, 1)=1
    expect(r.waveformData.value.every((v) => v === 1)).toBe(true)
    // 确认走了 AudioContext.decodeAudioData 路径
    expect(decodeSpy).toHaveBeenCalledTimes(1)
  })

  it('预计算路径跳过 AudioContext.decodeAudioData', () => {
    const r = makeRenderer()
    r.loadPrecomputedWaveform([10, 50, 80, 30, 90])
    // 预计算路径不应构造 AudioContext，也不应调用 decodeAudioData
    expect(ctorCalls).toBe(0)
    expect(decodeSpy).not.toHaveBeenCalled()
    expect(r.waveformData.value.length).toBe(5)
  })
})
