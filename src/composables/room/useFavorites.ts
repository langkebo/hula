import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useFavorites')

/** 收藏消息摘要（纯文本展示用） */
export interface FavoriteMessageInfo {
  eventId: string
  sender: string
  body: string
  timestamp: number
  msgtype: string
}

interface UseFavoritesOptions {
  /** 房间 ID，支持 ref / getter / 字符串 */
  roomId: MaybeRefOrGetter<string | null>
}

/**
 * 收藏消息 composable（P0-4 骨架）
 *
 * 数据源说明：
 * Matrix `m.tag` account data 是房间级标签（标注房间，非单条消息），
 * 单条消息的收藏需要 synapse-rust 扩展或客户端本地缓存支持。
 * 当前 `load()` 先返回空列表，待数据源确定后在此接入。
 */
export function useFavorites(options: UseFavoritesOptions) {
  const { t } = useI18n()

  const favorites = ref<FavoriteMessageInfo[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  const totalCount = computed(() => favorites.value.length)

  const latestFavoriteTime = computed(() => favorites.value.reduce((max, f) => Math.max(max, f.timestamp), 0))

  const load = async (): Promise<void> => {
    const roomId = toValue(options.roomId)
    if (!roomId) {
      favorites.value = []
      return
    }

    loading.value = true
    errorMessage.value = null
    try {
      // TODO(P0-4): 收藏消息数据接入
      // m.tag 为房间级标签，单条消息收藏需服务端扩展或本地缓存。
      // 数据源确定后在此实现拉取与解析逻辑。
      favorites.value = []
    } catch (err) {
      logger.error('加载收藏消息失败', err)
      errorMessage.value = t('home.chat_sidebar.favorites.load_failed')
    } finally {
      loading.value = false
    }
  }

  /** 导出收藏消息为 md / txt 纯文本 */
  const exportFavorites = (format: 'md' | 'txt'): string => {
    if (favorites.value.length === 0) return ''
    const header = format === 'md' ? '# 收藏消息\n\n' : '收藏消息\n\n'
    const lines = favorites.value.map((f) => {
      const time = new Date(f.timestamp).toLocaleString()
      return format === 'md' ? `- **${f.sender}** (${time}): ${f.body}` : `${f.sender} (${time}): ${f.body}`
    })
    return header + lines.join('\n')
  }

  return {
    favorites,
    loading,
    errorMessage,
    totalCount,
    latestFavoriteTime,
    load,
    exportFavorites
  }
}
