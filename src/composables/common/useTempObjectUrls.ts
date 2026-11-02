/**
 * 临时 ObjectURL 托管。
 *
 * `URL.createObjectURL` 生成的地址必须显式 `revokeObjectURL`，否则浏览大量
 * 图片/音频后内存会持续上涨。本 composable 统一登记当前预览地址：
 * - `track`：登记新地址（同一时刻只保留最新一个，替换前先释放旧的）；
 * - `release`：立即释放指定地址（解析失败等提前退出路径）；
 * - 所属 scope 销毁时自动释放全部地址。
 */
import { getCurrentScope, onScopeDispose } from 'vue'

export interface TempObjectUrls {
  /** 登记新的临时地址；会先释放此前登记的地址。 */
  track: (url?: string | null) => void
  /** 立即释放指定地址（不存在时静默忽略）。 */
  release: (url: string) => void
  /** 释放当前登记的全部地址。 */
  revokeAll: () => void
}

export const useTempObjectUrls = (): TempObjectUrls => {
  const urls = new Set<string>()

  const revokeAll = () => {
    urls.forEach((url) => URL.revokeObjectURL(url))
    urls.clear()
  }

  const track = (url?: string | null) => {
    if (!url) return
    revokeAll()
    urls.add(url)
  }

  const release = (url: string) => {
    if (urls.delete(url)) {
      URL.revokeObjectURL(url)
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(revokeAll)
  }

  return { track, release, revokeAll }
}
