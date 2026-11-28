import { beforeEach, describe, expect, it } from 'vitest'
import { globalFileUploadQueue } from '../useFileUploadQueue'

const makeFile = () => new File([new Uint8Array(10)], 'a.bin', { type: 'application/octet-stream' })

const initSingleItem = () => {
  globalFileUploadQueue.initQueue([makeFile()])
  const item = globalFileUploadQueue.queue.items[0]
  if (!item) throw new Error('queue item missing')
  return item
}

describe('useFileUploadQueue — updateFileServerProgress', () => {
  beforeEach(() => {
    globalFileUploadQueue.clearQueue()
  })

  it('uploading 状态下写入服务端分片进度', () => {
    const item = initSingleItem()
    globalFileUploadQueue.updateFileStatus(item.id, 'uploading')

    globalFileUploadQueue.updateFileServerProgress(item.id, 2, 5)

    expect(globalFileUploadQueue.queue.items[0]?.serverProgress).toEqual({ uploadedChunks: 2, totalChunks: 5 })
  })

  it('上传中写入字节进度与状态', () => {
    const item = initSingleItem()
    globalFileUploadQueue.updateFileStatus(item.id, 'uploading')

    globalFileUploadQueue.updateFileServerProgress(item.id, 2, 5, {
      uploadedSize: 2048,
      totalSize: 5120,
      status: 'in_progress'
    })

    expect(globalFileUploadQueue.queue.items[0]?.serverProgress).toEqual({
      uploadedChunks: 2,
      totalChunks: 5,
      uploadedSize: 2048,
      totalSize: 5120,
      status: 'in_progress'
    })
  })

  it('非 uploading 状态忽略写入', () => {
    const item = initSingleItem()

    globalFileUploadQueue.updateFileServerProgress(item.id, 1, 3)
    expect(globalFileUploadQueue.queue.items[0]?.serverProgress).toBeUndefined()

    globalFileUploadQueue.updateFileStatus(item.id, 'completed')
    globalFileUploadQueue.updateFileServerProgress(item.id, 1, 3)
    expect(globalFileUploadQueue.queue.items[0]?.serverProgress).toBeUndefined()
  })

  it('totalChunks 非正数时忽略写入', () => {
    const item = initSingleItem()
    globalFileUploadQueue.updateFileStatus(item.id, 'uploading')

    globalFileUploadQueue.updateFileServerProgress(item.id, 1, 0)

    expect(globalFileUploadQueue.queue.items[0]?.serverProgress).toBeUndefined()
  })

  it('未知 fileId 时不写入', () => {
    initSingleItem()

    globalFileUploadQueue.updateFileServerProgress('missing_id', 1, 2)

    expect(globalFileUploadQueue.queue.items[0]?.serverProgress).toBeUndefined()
  })
})

describe('useFileUploadQueue — 批次隔离', () => {
  beforeEach(() => {
    globalFileUploadQueue.clearQueue()
  })

  it('不同批次生成的 fileId 不重复，旧批次回调不会命中新批次条目', () => {
    const first = initSingleItem()
    globalFileUploadQueue.updateFileStatus(first.id, 'uploading')
    const second = initSingleItem()

    expect(second.id).not.toBe(first.id)

    globalFileUploadQueue.updateFileProgress(first.id, 50)

    expect(globalFileUploadQueue.queue.items[0]?.progress).toBe(0)
  })
})
