import { ref } from 'vue'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { MediaQuotaStats } from '@/services/matrix/media/mediaConfigOps'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MediaQuota')

/**
 * 配额提示四态。
 *
 * - `loading`：请求进行中，展示占位，不得把「未取到」渲染成「无配额」。
 * - `ready`：已取到用量，调用方按 `limitBytes > 0` 决定是否展示。
 * - `unsupported`：服务端没有配额能力，属于能力不存在，应静默隐藏。
 * - `unavailable`：能力存在但本次取不到，应提示「暂不可用」并提供重试。
 */
export type MediaQuotaState = 'loading' | 'ready' | 'unsupported' | 'unavailable'

/**
 * 媒体配额统一数据源，供桌面侧栏与移动端文件页共用，避免两处状态机各自漂移。
 *
 * 不内置生命周期钩子，由调用方决定何时 `load()`（挂载、上传成功后重取等）。
 */
export function useMediaQuotaStats() {
  const state = ref<MediaQuotaState>('loading')
  const stats = ref<MediaQuotaStats | null>(null)

  async function load() {
    state.value = 'loading'
    const result = await matrixMediaService.getQuotaStats()
    if (result.ok) {
      stats.value = result.stats
      state.value = 'ready'
      return
    }
    stats.value = null
    state.value = result.reason
    logger.warn(`Failed to load media quota stats (${result.reason})`)
  }

  return { state, stats, load }
}
