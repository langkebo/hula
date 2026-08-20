import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
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

/**
 * 收藏消息 account-data 事件类型（用户级）。
 * 内容结构为 `{ [roomId]: FavoriteMessageInfo[] }`，按房间维度隔离收藏。
 * 复用 MatrixAccountService.getAccountData 读取（内部已做 null 安全与异常兜底）。
 * 命名空间 im.hula.* 与项目自定义 account-data（如 im.hula.user_emotes）保持一致。
 */
const FAVORITE_MESSAGES_EVENT = 'im.hula.favorite_messages'

/** 用户级收藏 account-data 内容：roomId -> 该房间收藏列表 */
type FavoriteAccountDataContent = Record<string, FavoriteMessageInfo[]>

/** 过滤服务端返回的异常条目，避免脏数据破坏渲染 */
function sanitizeFavorites(raw: unknown): FavoriteMessageInfo[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is FavoriteMessageInfo =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as FavoriteMessageInfo).eventId === 'string' &&
      typeof (item as FavoriteMessageInfo).timestamp === 'number'
  )
}

interface UseFavoritesOptions {
  /** 房间 ID，支持 ref / getter / 字符串 */
  roomId: MaybeRefOrGetter<string | null>
}

/**
 * 收藏消息 composable
 *
 * 数据源：用户级 Matrix account-data 事件 `im.hula.favorite_messages`，
 * 内容为 `{ [roomId]: FavoriteMessageInfo[] }`。load() 读取后按当前 roomId 过滤展示。
 * 跨设备实时性依赖客户端 sync；纯读取场景下 in-memory 缓存已足够。
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
      const content = await matrixAccountService.getAccountData<FavoriteAccountDataContent>(FAVORITE_MESSAGES_EVENT)
      // 事件不存在（content 为 null）或当前房间无收藏时均返回空列表
      const roomFavorites = content?.[roomId] ?? []
      favorites.value = sanitizeFavorites(roomFavorites)
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
