import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useVideoViewer } from '../videoViewer'

describe('useVideoViewer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state', () => {
    const store = useVideoViewer()
    expect(store.imageList).toEqual([])
    expect(store.videoList).toEqual([])
    expect(store.currentIndex).toBe(0)
    expect(store.currentVideoIndex).toBe(0)
    expect(store.isSingleMode).toBe(false)
    expect(store.singleImage).toBe('')
  })

  it('resetImageList deduplicates and preserves selection', () => {
    const store = useVideoViewer()
    store.resetImageList(['a', 'b', 'a', 'c'], 2)
    expect(store.imageList).toEqual(['a', 'b', 'c'])
    expect(store.currentIndex).toBe(0)
    expect(store.isSingleMode).toBe(false)
  })

  it('resetImageList falls back to index 0 when original not found', () => {
    const store = useVideoViewer()
    store.resetImageList([], 2)
    expect(store.currentIndex).toBe(0)
  })

  it('setSingleImage enables single mode', () => {
    const store = useVideoViewer()
    store.setSingleImage('https://example.com/a.png')
    expect(store.isSingleMode).toBe(true)
    expect(store.singleImage).toBe('https://example.com/a.png')
  })

  it('resetImageList disables single mode', () => {
    const store = useVideoViewer()
    store.setSingleImage('foo')
    store.resetImageList(['a'], 0)
    expect(store.isSingleMode).toBe(false)
  })

  it('resetVideoListOptimized deduplicates and preserves selection', () => {
    const store = useVideoViewer()
    store.resetVideoListOptimized(['v1', 'v2', 'v1', 'v3'], 1)
    expect(store.videoList).toEqual(['v1', 'v2', 'v3'])
    expect(store.currentVideoIndex).toBe(1)
  })

  it('resetVideoListOptimized falls back to 0 when original not found', () => {
    const store = useVideoViewer()
    store.resetVideoListOptimized([], 5)
    expect(store.currentVideoIndex).toBe(0)
  })

  it('updateVideoPath replaces matching url', () => {
    const store = useVideoViewer()
    store.resetVideoListOptimized(['remote://a', 'remote://b'], 0)
    store.updateVideoPath('remote://b', 'file:///local/b')
    expect(store.videoList).toEqual(['remote://a', 'file:///local/b'])
  })

  it('updateVideoPath is a no-op when url is missing', () => {
    const store = useVideoViewer()
    store.resetVideoListOptimized(['a'], 0)
    store.updateVideoPath('not-there', 'x')
    expect(store.videoList).toEqual(['a'])
  })

  it('updateVideoListPaths applies a mapping, preserving unmapped entries', () => {
    const store = useVideoViewer()
    store.resetVideoListOptimized(['a', 'b', 'c'], 0)
    store.updateVideoListPaths({ a: 'A', c: 'C' })
    expect(store.videoList).toEqual(['A', 'b', 'C'])
  })
})
