import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useOverlayController } from '../useOverlayController'

describe('useOverlayController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not show overlay when isInitialSync is false', () => {
    const isInitialSync = computed(() => false)
    const progress = ref(0)
    const { overlayVisible } = useOverlayController({ isInitialSync, progress })
    expect(overlayVisible.value).toBe(false)
  })

  it('shows overlay when isInitialSync is true', () => {
    const isInitialSync = computed(() => true)
    const progress = ref(0)
    const { overlayVisible } = useOverlayController({ isInitialSync, progress })
    expect(overlayVisible.value).toBe(true)
  })

  it('hides overlay after async components ready and minDisplayMs', async () => {
    const isInitialSync = computed(() => true)
    const progress = ref(0)
    const { overlayVisible, markAsyncLoaded } = useOverlayController({
      isInitialSync,
      progress,
      asyncTotal: 2,
      minDisplayMs: 500
    })
    expect(overlayVisible.value).toBe(true)

    markAsyncLoaded()
    expect(overlayVisible.value).toBe(true)

    markAsyncLoaded()
    expect(progress.value).toBe(100)

    vi.advanceTimersByTime(500)
    expect(overlayVisible.value).toBe(false)
  })

  it('keeps overlay visible until min display elapses even after progress=100', () => {
    const isInitialSync = computed(() => true)
    const progress = ref(50)
    const { overlayVisible, markAsyncLoaded } = useOverlayController({
      isInitialSync,
      progress,
      asyncTotal: 1,
      minDisplayMs: 600
    })

    markAsyncLoaded()
    expect(progress.value).toBe(100)
    vi.advanceTimersByTime(599)
    expect(overlayVisible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(overlayVisible.value).toBe(false)
  })

  it('asyncComponentsReady reflects load count vs asyncTotal', () => {
    const isInitialSync = computed(() => true)
    const progress = ref(0)
    const { asyncComponentsReady, markAsyncLoaded } = useOverlayController({
      isInitialSync,
      progress,
      asyncTotal: 3
    })
    expect(asyncComponentsReady.value).toBe(false)
    markAsyncLoaded()
    markAsyncLoaded()
    expect(asyncComponentsReady.value).toBe(false)
    markAsyncLoaded()
    expect(asyncComponentsReady.value).toBe(true)
  })

  it('markAsyncLoaded clamps load count to asyncTotal', () => {
    const isInitialSync = computed(() => true)
    const progress = ref(0)
    const { asyncComponentsReady, markAsyncLoaded } = useOverlayController({
      isInitialSync,
      progress,
      asyncTotal: 1
    })
    markAsyncLoaded()
    markAsyncLoaded()
    markAsyncLoaded()
    expect(asyncComponentsReady.value).toBe(true)
  })

  it('resetOverlay restores initial state when isInitialSync is true', () => {
    const isInitialSync = computed(() => true)
    const progress = ref(0)
    const { overlayVisible, markAsyncLoaded, resetOverlay } = useOverlayController({
      isInitialSync,
      progress,
      asyncTotal: 1,
      minDisplayMs: 100
    })
    markAsyncLoaded()
    vi.advanceTimersByTime(200)
    expect(overlayVisible.value).toBe(false)

    resetOverlay()
    expect(overlayVisible.value).toBe(true)
  })
})
