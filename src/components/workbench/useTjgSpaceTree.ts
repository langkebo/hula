import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type SpaceInfo, useSpace } from '@/composables/space'
import { createLogger } from '@/utils/Logger'

export interface SpaceHierarchyLoaderOptions {
  spaceId: string
  from?: string
  limit?: number
  maxDepth?: number
  suggestedOnly?: boolean
}

export interface SpaceHierarchyLoaderResult {
  rooms: SpaceInfo[]
  next_batch?: string
}

export interface TjgSpaceTreeProps {
  spaceId?: string | undefined
  depth?: number | undefined
  nested?: boolean | undefined
  selectedSpaceId?: string | undefined
  suggestedOnly?: boolean | undefined
  loader?: ((options: SpaceHierarchyLoaderOptions) => Promise<SpaceHierarchyLoaderResult>) | undefined
}

type TjgSpaceTreeEmit = (event: 'select', room: SpaceInfo) => void

/**
 * 空间树 Composable
 *
 * 负责：
 * - 分级加载子空间（首屏与 load more 分页）
 * - 区分「首屏加载中 / 加载失败 / 空结果」三种展示态
 * - 维护展开集合与选中行为
 * - 键盘导航（上下移动、左右展开折叠、回车选择）
 */
export function useTjgSpaceTree(props: TjgSpaceTreeProps, emit: TjgSpaceTreeEmit) {
  const logger = createLogger('TjgSpaceTree')
  const { t } = useI18n()
  const { getHierarchy } = useSpace(() => props.spaceId!)
  const currentDepth = computed(() => props.depth ?? 0)
  const treeRole = computed(() => (props.nested ? 'group' : 'tree'))
  const treeAriaLabel = computed(() => (props.nested ? undefined : t('space.space_tree_label')))

  const rooms = ref<SpaceInfo[]>([])
  const loading = ref(false)
  // 读取失败不能落成空列表：那会把「读不到子空间」显示成「没有子空间」
  const loadFailed = ref(false)

  /** 首屏加载中与空结果分离：已有子空间时刷新不遮挡列表 */
  const isInitialLoading = computed(() => loading.value && rooms.value.length === 0)
  const isEmpty = computed(() => rooms.value.length === 0)
  const loadingMore = ref(false)
  const nextBatch = ref<string | undefined>(undefined)
  const expandedIds = ref<Set<string>>(new Set())

  const fallbackAvatar = computed(() => '/logo.png')

  const loadHierarchy = async (
    options: SpaceHierarchyLoaderOptions
  ): Promise<{ rooms: SpaceInfo[]; next_batch?: string | undefined }> => {
    if (props.loader) {
      return await props.loader(options)
    }

    const result = await getHierarchy(options)

    return {
      rooms: result.rooms as typeof result.rooms & SpaceInfo[],
      next_batch: result.next_batch
    }
  }

  const loadData = async (from?: string) => {
    if (!props.spaceId) return

    if (from) {
      loadingMore.value = true
    } else {
      loading.value = true
      loadFailed.value = false
    }

    try {
      const result = await loadHierarchy({
        spaceId: props.spaceId,
        limit: 20,
        ...(from !== undefined ? { from } : {}),
        maxDepth: 1,
        ...(props.suggestedOnly !== undefined ? { suggestedOnly: props.suggestedOnly } : {})
      })

      if (from) {
        rooms.value = [...rooms.value, ...result.rooms]
      } else {
        rooms.value = result.rooms
      }
      nextBatch.value = result.next_batch
    } catch (err) {
      logger.warn('Failed to load space room list:', err)
      // 加载更多失败时保留已渲染列表，只有首屏失败才进错误态
      if (!from) {
        rooms.value = []
        loadFailed.value = true
      }
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  const retryLoad = () => void loadData()

  const toggleExpand = (id: string) => {
    if (expandedIds.value.has(id)) {
      expandedIds.value.delete(id)
    } else {
      expandedIds.value.add(id)
    }
  }

  const handleSelect = (room: SpaceInfo) => {
    emit('select', room)
  }

  const loadMore = () => {
    if (nextBatch.value) {
      void loadData(nextBatch.value)
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    const currentItem = target.closest('[role="treeitem"]') as HTMLElement
    if (!currentItem) return

    switch (event.key) {
      case 'ArrowUp': {
        event.preventDefault()
        const prev = currentItem.previousElementSibling as HTMLElement
        if (prev?.focus) prev.focus()
        break
      }
      case 'ArrowDown': {
        event.preventDefault()
        const next = currentItem.nextElementSibling as HTMLElement
        if (next?.focus) next.focus()
        break
      }
      case 'ArrowRight': {
        event.preventDefault()
        const roomId = currentItem.dataset.id
        if (roomId && !expandedIds.value.has(roomId)) {
          toggleExpand(roomId)
        }
        break
      }
      case 'ArrowLeft': {
        event.preventDefault()
        const roomId = currentItem.dataset.id
        if (roomId && expandedIds.value.has(roomId)) {
          toggleExpand(roomId)
        }
        break
      }
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const roomId = currentItem.dataset.id
        const room = rooms.value.find((r) => r.spaceId === roomId)
        if (room) handleSelect(room)
        break
      }
    }
  }

  onMounted(() => void loadData())

  // 监听 spaceId 变化重新加载
  watch(
    () => props.spaceId,
    () => {
      rooms.value = []
      nextBatch.value = undefined
      expandedIds.value.clear()
      loadFailed.value = false
      void loadData()
    }
  )

  return {
    rooms,
    loadFailed,
    isInitialLoading,
    isEmpty,
    loadingMore,
    nextBatch,
    expandedIds,
    currentDepth,
    treeRole,
    treeAriaLabel,
    fallbackAvatar,
    retryLoad,
    toggleExpand,
    handleSelect,
    loadMore,
    handleKeyDown
  }
}
