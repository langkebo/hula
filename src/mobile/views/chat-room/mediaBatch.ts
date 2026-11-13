/** 媒体列表每批渲染条数 */
export const MEDIA_BATCH_SIZE = 40

/**
 * 截取当前应渲染的媒体批次。
 * 完整列表保持不变，仅按渲染数量切片，避免大群一次性渲染全部缩略图。
 */
export const sliceMediaBatch = <T>(list: readonly T[], count: number): T[] => {
  if (!Number.isFinite(count) || count <= 0) return []
  return list.slice(0, Math.floor(count))
}

/** 追加一批后应渲染的条数，不超过总数 */
export const nextMediaBatchCount = (
  currentCount: number,
  total: number,
  batchSize: number = MEDIA_BATCH_SIZE
): number => {
  const safeTotal = Math.max(0, total)
  const safeCurrent = Math.max(0, currentCount)
  return Math.min(safeTotal, safeCurrent + Math.max(1, batchSize))
}
