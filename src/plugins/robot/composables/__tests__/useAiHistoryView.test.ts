import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { aiServiceMock, mittMock, infoMock, errorMock } = vi.hoisted(() => ({
  aiServiceMock: {
    imageMyPage: vi.fn(),
    audioMyPage: vi.fn(),
    videoMyPage: vi.fn()
  },
  mittMock: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  infoMock: vi.fn(),
  errorMock: vi.fn()
}))

vi.mock('@/services/matrix', () => ({ aiService: aiServiceMock }))
vi.mock('@/hooks/useMitt.ts', () => ({ useMitt: mittMock }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: infoMock, error: errorMock, warn: vi.fn(), debug: vi.fn() })
}))

import { useAiHistoryView } from '../useAiHistoryView'

const mountWith = <T>(setup: () => T): T => {
  let value!: T
  const Comp = {
    setup() {
      value = setup()
      return () => null
    }
  }
  // minimal app harness for onMounted/onUnmounted lifecycle
  const { createApp, h } = require('vue')
  const app = createApp({ render: () => h(Comp) })
  app.mount(document.createElement('div'))
  ;(globalThis as any).__app = app
  return value
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).$message = { error: vi.fn(), warning: vi.fn(), success: vi.fn() }
  aiServiceMock.imageMyPage.mockResolvedValue({ list: [{ id: 'img1' }], total: 1 })
  aiServiceMock.audioMyPage.mockResolvedValue({ list: [{ id: 'aud1' }], total: 2 })
  aiServiceMock.videoMyPage.mockResolvedValue({ list: [{ id: 'vid1' }], total: 3 })
})

describe('useAiHistoryView', () => {
  it('initial state is empty + image tab', () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    expect(c.showHistoryModal.value).toBe(false)
    expect(c.historyType.value).toBe('image')
    expect(c.historyList.value).toEqual([])
    expect(c.historyPagination.value).toEqual({ pageNo: 1, pageSize: 12, total: 0 })
    expect(c.previewItem.value).toBeNull()
  })

  it('loadHistory(image) populates list + total via imageMyPage', async () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    await c.loadHistory()
    expect(aiServiceMock.imageMyPage).toHaveBeenCalledWith({ pageNo: 1, pageSize: 12 })
    expect(c.historyList.value).toEqual([{ id: 'img1' }])
    expect(c.historyPagination.value.total).toBe(1)
  })

  it('loadHistory(audio) routes to audioMyPage', async () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    c.historyType.value = 'audio'
    await c.loadHistory()
    expect(aiServiceMock.audioMyPage).toHaveBeenCalled()
    expect(c.historyList.value).toEqual([{ id: 'aud1' }])
  })

  it('loadHistory(video) routes to videoMyPage', async () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    c.historyType.value = 'video'
    await c.loadHistory()
    expect(aiServiceMock.videoMyPage).toHaveBeenCalled()
    expect(c.historyList.value).toEqual([{ id: 'vid1' }])
  })

  it('loadHistory error toasts and clears loading', async () => {
    aiServiceMock.imageMyPage.mockRejectedValueOnce(new Error('boom'))
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    await c.loadHistory()
    expect((window as any).$message.error).toHaveBeenCalledWith('加载历史记录失败')
    expect(c.historyLoading.value).toBe(false)
  })

  it('handleOpenHistory chooses image tab for type=2 model', async () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref({ type: 2 } as any) }))
    c.handleOpenHistory()
    expect(c.historyType.value).toBe('image')
    expect(c.showHistoryModal.value).toBe(true)
    expect(c.historyPagination.value.pageNo).toBe(1)
  })

  it('handleOpenHistory chooses audio tab for type=3 model', () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref({ type: 3 } as any) }))
    c.handleOpenHistory()
    expect(c.historyType.value).toBe('audio')
  })

  it('handleOpenHistory chooses video tab for type=4/7/8 model', () => {
    for (const type of [4, 7, 8]) {
      const c = mountWith(() => useAiHistoryView({ selectedModel: ref({ type } as any) }))
      c.handleOpenHistory()
      expect(c.historyType.value).toBe('video')
    }
  })

  it('switchHistoryType resets page + reloads', async () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    c.historyPagination.value.pageNo = 5
    c.switchHistoryType('audio')
    expect(c.historyType.value).toBe('audio')
    expect(c.historyPagination.value.pageNo).toBe(1)
    await Promise.resolve()
    expect(aiServiceMock.audioMyPage).toHaveBeenCalled()
  })

  it('handleHistoryPageChange updates page + reloads current tab', async () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    c.handleHistoryPageChange(3)
    expect(c.historyPagination.value.pageNo).toBe(3)
    await Promise.resolve()
    expect(aiServiceMock.imageMyPage).toHaveBeenCalledWith({ pageNo: 3, pageSize: 12 })
  })

  it('handleImagePreview wraps url into previewItem', () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    c.handleImagePreview('https://x/y.png')
    expect(c.previewItem.value).toEqual({ picUrl: 'https://x/y.png' })
    expect(c.showImagePreview.value).toBe(true)
  })

  it('handlePreviewImage stores item + opens image modal', () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    const item = { id: 'h1', picUrl: 'p' } as any
    c.handlePreviewImage(item)
    expect(c.previewItem.value).toEqual(item)
    expect(c.showImagePreview.value).toBe(true)
    expect(c.showVideoPreview.value).toBe(false)
  })

  it('handlePreviewVideo stores item + opens video modal', () => {
    const c = mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    const item = { id: 'h2', videoUrl: 'v' } as any
    c.handlePreviewVideo(item)
    expect(c.previewItem.value).toEqual(item)
    expect(c.showVideoPreview.value).toBe(true)
    expect(c.showImagePreview.value).toBe(false)
  })

  it('subscribes to mitt open-generation-history on mount', () => {
    mountWith(() => useAiHistoryView({ selectedModel: ref(null) }))
    expect(mittMock.on).toHaveBeenCalledWith('open-generation-history', expect.any(Function))
  })
})
