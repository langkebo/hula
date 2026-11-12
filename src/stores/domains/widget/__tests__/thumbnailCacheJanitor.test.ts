import { describe, expect, it, vi } from 'vitest'
import { ThumbnailCacheJanitor } from '@/stores/domains/widget/thumbnailCacheJanitor'

const createJanitor = () => {
  const saveMetadata = vi.fn()
  const janitor = new ThumbnailCacheJanitor(
    { deleteFile: vi.fn().mockResolvedValue(true), saveMetadata },
    { now: () => 1_000 }
  )
  return { janitor, saveMetadata }
}

describe('ThumbnailCacheJanitor.clearUnder', () => {
  it('只清掉路径包含 marker 的元数据，其他类别保留', () => {
    const { janitor, saveMetadata } = createJanitor()
    janitor.recordCache('/data/user/thumbnails/a.jpg', 100)
    janitor.recordCache('/data/user/emojis/b.webp', 200)

    janitor.clearUnder('emojis')

    expect(janitor.getMetadata('/data/user/emojis/b.webp')).toBeUndefined()
    expect(janitor.getMetadata('/data/user/thumbnails/a.jpg')).toEqual({
      createdAt: 1_000,
      lastAccessed: 1_000,
      size: 100
    })
    expect(saveMetadata).toHaveBeenCalled()
  })

  it('没有命中项时不重复持久化', () => {
    const { janitor, saveMetadata } = createJanitor()
    janitor.recordCache('/data/user/thumbnails/a.jpg', 100)
    saveMetadata.mockClear()

    janitor.clearUnder('emojis')

    expect(janitor.size()).toBe(1)
    expect(saveMetadata).not.toHaveBeenCalled()
  })

  it('marker 为空时不清任何元数据（避免误清全部）', () => {
    const { janitor } = createJanitor()
    janitor.recordCache('/data/user/thumbnails/a.jpg', 100)

    janitor.clearUnder('')

    expect(janitor.size()).toBe(1)
  })
})
