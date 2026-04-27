import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImageViewer } from '../imageViewer'

describe('useImageViewer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state', () => {
    const store = useImageViewer()
    expect(store.imageList).toEqual([])
    expect(store.currentIndex).toBe(0)
    expect(store.originalImageList).toEqual([])
    expect(store.singleImage).toBe('')
    expect(store.isSingleMode).toBe(false)
  })

  it('resetImageList deduplicates list while preserving order', () => {
    const store = useImageViewer()
    store.resetImageList(['a', 'b', 'a', 'c'], 0)
    expect(store.imageList).toEqual(['a', 'b', 'c'])
  })

  it('resetImageList preserves the originally selected image as currentIndex', () => {
    const store = useImageViewer()
    store.resetImageList(['a', 'b', 'a', 'c'], 2)
    expect(store.currentIndex).toBe(0)
  })

  it('resetImageList falls back to index 0 when original not found', () => {
    const store = useImageViewer()
    store.resetImageList([], 5)
    expect(store.currentIndex).toBe(0)
    expect(store.imageList).toEqual([])
  })

  it('resetImageList stores provided originalList separately', () => {
    const store = useImageViewer()
    store.resetImageList(['a', 'b'], 0, ['x', 'y', 'z'])
    expect(store.imageList).toEqual(['a', 'b'])
    expect(store.originalImageList).toEqual(['x', 'y', 'z'])
  })

  it('resetImageList copies imageList into originalImageList when none provided', () => {
    const store = useImageViewer()
    store.resetImageList(['a', 'b'], 0)
    expect(store.originalImageList).toEqual(['a', 'b'])
    expect(store.originalImageList).not.toBe(store.imageList)
  })

  it('resetImageList disables single mode', () => {
    const store = useImageViewer()
    store.setSingleImage('foo')
    expect(store.isSingleMode).toBe(true)
    store.resetImageList(['a'], 0)
    expect(store.isSingleMode).toBe(false)
  })

  it('setSingleImage enables single mode and sets list to single url', () => {
    const store = useImageViewer()
    store.setSingleImage('https://example.com/a.png')
    expect(store.isSingleMode).toBe(true)
    expect(store.singleImage).toBe('https://example.com/a.png')
    expect(store.imageList).toEqual(['https://example.com/a.png'])
    expect(store.originalImageList).toEqual(['https://example.com/a.png'])
    expect(store.currentIndex).toBe(0)
  })

  it('setSingleImage with empty url produces empty lists', () => {
    const store = useImageViewer()
    store.setSingleImage('')
    expect(store.isSingleMode).toBe(true)
    expect(store.imageList).toEqual([])
    expect(store.originalImageList).toEqual([])
  })

  it('updateImageAt replaces the URL at a given index', () => {
    const store = useImageViewer()
    store.resetImageList(['a', 'b', 'c'], 0)
    store.updateImageAt(1, 'B')
    expect(store.imageList).toEqual(['a', 'B', 'c'])
  })

  it('updateImageAt is a no-op for out-of-range index', () => {
    const store = useImageViewer()
    store.resetImageList(['a'], 0)
    store.updateImageAt(5, 'X')
    expect(store.imageList).toEqual(['a'])
  })

  it('updateSingleImageSource only updates when in single mode', () => {
    const store = useImageViewer()
    store.updateSingleImageSource('ignored')
    expect(store.singleImage).toBe('')

    store.setSingleImage('first')
    store.updateSingleImageSource('second')
    expect(store.singleImage).toBe('second')
  })
})
