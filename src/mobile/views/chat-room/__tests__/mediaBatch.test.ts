import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MEDIA_BATCH_SIZE, nextMediaBatchCount, sliceMediaBatch } from '../mediaBatch'

const makeMediaList = (count: number) => Array.from({ length: count }, (_, index) => ({ url: `file-${index}` }))

describe('mediaBatch', () => {
  it('首次只渲染一批媒体', () => {
    const list = makeMediaList(100)

    expect(MEDIA_BATCH_SIZE).toBe(40)
    expect(sliceMediaBatch(list, MEDIA_BATCH_SIZE)).toHaveLength(40)
    expect(sliceMediaBatch(list, MEDIA_BATCH_SIZE)[0]).toEqual({ url: 'file-0' })
  })

  it('滚动到底部时按批追加并保留原有顺序', () => {
    const list = makeMediaList(100)
    let rendered = MEDIA_BATCH_SIZE

    rendered = nextMediaBatchCount(rendered, list.length)
    expect(rendered).toBe(80)
    expect(sliceMediaBatch(list, rendered)).toHaveLength(80)

    rendered = nextMediaBatchCount(rendered, list.length)
    expect(sliceMediaBatch(list, rendered)).toHaveLength(100)
    expect(sliceMediaBatch(list, rendered)[99]).toEqual({ url: 'file-99' })
  })

  it('加载完毕后数量封顶于总数，不再追加', () => {
    const list = makeMediaList(50)
    const rendered = nextMediaBatchCount(MEDIA_BATCH_SIZE, list.length)

    expect(rendered).toBe(50)
    expect(nextMediaBatchCount(rendered, list.length)).toBe(50)
    expect(sliceMediaBatch(list, nextMediaBatchCount(rendered, list.length))).toHaveLength(50)
  })

  it('空列表与非法数量返回空批次', () => {
    expect(sliceMediaBatch([], MEDIA_BATCH_SIZE)).toEqual([])
    expect(sliceMediaBatch(makeMediaList(10), 0)).toEqual([])
    expect(sliceMediaBatch(makeMediaList(10), -1)).toEqual([])
    expect(sliceMediaBatch(makeMediaList(10), Number.NaN)).toEqual([])
    expect(nextMediaBatchCount(0, 0)).toBe(0)
  })
})

describe('MediaViewer 分批渲染接入', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/mobile/views/chat-room/MediaViewer.vue'), 'utf-8')

  it('列表只渲染当前批次而非全量', () => {
    expect(source).toContain('v-for="image in visibleImages"')
    expect(source).not.toContain('v-for="image in imageList"')
  })

  it('通过底部哨兵追加下一批', () => {
    expect(source).toContain('sentinelRef')
    expect(source).toContain('new IntersectionObserver')
    expect(source).toContain('nextMediaBatchCount')
  })

  it('缩略图使用原生懒加载', () => {
    expect(source).toContain('loading="lazy"')
  })
})
