import { type ComputedRef, computed, onScopeDispose, type Ref, ref, watch } from 'vue'
import type { RightViewType } from '@/layout/right/types'

/**
 * 右侧栏各视图默认宽度（px）
 * 需求文档 §3.3.4
 */
export const VIEW_WIDTH_MAP: Record<RightViewType, number> = {
  empty: 360,
  details: 380,
  search: 440,
  addFriend: 420,
  createRoom: 460,
  joinRoom: 420,
  createSpace: 460,
  applyList: 400,
  spaceChildren: 440,
  chat: 620
}

/** 拖拽宽度范围 */
const DEFAULT_MIN = 360
const DEFAULT_MAX = 800
const DEFAULT_STORAGE_KEY = 'hula.rightPaneWidth'

export interface UseRightPaneWidthOptions {
  /** 当前右侧栏视图（路由派生） */
  rightView: Ref<RightViewType>
  /** localStorage 持久化 key，默认 'hula.rightPaneWidth' */
  storageKey?: string
  /** 最小宽度，默认 360 */
  min?: number
  /** 最大宽度，默认 800 */
  max?: number
}

export interface UseRightPaneWidthReturn {
  /** 当前实际宽度（用户调整 > 默认） */
  width: ComputedRef<number>
  /** 当前视图的默认宽度 */
  defaultWidth: ComputedRef<number>
  /** 是否正在拖拽 */
  isDragging: Ref<boolean>
  /** 过渡动画是否启用（拖拽时禁用） */
  transitionEnabled: ComputedRef<boolean>
  /** 开始拖拽（绑定到拖拽分隔条 pointerdown） */
  startDrag: (e: PointerEvent) => void
  /** 重置当前视图宽度到默认值 */
  resetWidth: () => void
}

/**
 * 右侧栏视图驱动动态宽度 composable
 *
 * - 从 rightView 派生默认宽度（VIEW_WIDTH_MAP）
 * - 支持拖拽左边缘调整（min-max 范围内）
 * - 拖拽时禁用过渡动画，避免卡顿
 * - localStorage 按视图类型持久化（key=hula.rightPaneWidth.{viewType} 结构为 JSON 映射）
 */
export function useRightPaneWidth(options: UseRightPaneWidthOptions): UseRightPaneWidthReturn {
  const { rightView, storageKey = DEFAULT_STORAGE_KEY, min = DEFAULT_MIN, max = DEFAULT_MAX } = options

  const clamp = (value: number) => Math.min(Math.max(value, min), max)

  // 从 localStorage 加载所有视图的持久化宽度
  const loadPersistedWidths = (): Record<string, number> => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const result: Record<string, number> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          result[key] = clamp(value)
        }
      }
      return result
    } catch {
      return {}
    }
  }

  const persistedWidths = ref<Record<string, number>>(loadPersistedWidths())
  // 当前视图用户调整的宽度（null 表示未调整，使用默认）
  const userWidth = ref<number | null>(null)
  const isDragging = ref(false)

  let startX = 0
  let startWidth = 0

  const defaultWidth = computed(() => VIEW_WIDTH_MAP[rightView.value] ?? DEFAULT_MIN)

  const width = computed(() => {
    if (userWidth.value !== null) return clamp(userWidth.value)
    const persisted = persistedWidths.value[rightView.value]
    return persisted !== undefined ? clamp(persisted) : defaultWidth.value
  })

  const transitionEnabled = computed(() => !isDragging.value)

  // 视图切换时重置用户调整状态，让宽度跟随视图变化
  watch(
    () => rightView.value,
    () => {
      userWidth.value = null
    }
  )

  const persistWidths = () => {
    try {
      const entries = Object.keys(persistedWidths.value)
      if (entries.length === 0) {
        window.localStorage.removeItem(storageKey)
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(persistedWidths.value))
      }
    } catch {
      // 静默失败：localStorage 不可用时仅丢失持久化
    }
  }

  const doDrag = (e: PointerEvent) => {
    // 向左拖增大宽度（右栏左边缘）：delta = startX - clientX
    const delta = startX - e.clientX
    userWidth.value = clamp(startWidth + delta)
  }

  const stopDrag = () => {
    document.removeEventListener('pointermove', doDrag)
    document.removeEventListener('pointerup', stopDrag)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    isDragging.value = false

    if (userWidth.value !== null) {
      persistedWidths.value = {
        ...persistedWidths.value,
        [rightView.value]: userWidth.value
      }
      persistWidths()
    }
  }

  const startDrag = (e: PointerEvent) => {
    e.preventDefault()
    startX = e.clientX
    startWidth = width.value
    userWidth.value = startWidth
    isDragging.value = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.addEventListener('pointermove', doDrag)
    document.addEventListener('pointerup', stopDrag)
  }

  const resetWidth = () => {
    userWidth.value = null
    if (persistedWidths.value[rightView.value] !== undefined) {
      const next = { ...persistedWidths.value }
      delete next[rightView.value]
      persistedWidths.value = next
      persistWidths()
    }
  }

  // 清理：拖拽中卸载组件时移除监听
  onScopeDispose(() => {
    if (isDragging.value) {
      document.removeEventListener('pointermove', doDrag)
      document.removeEventListener('pointerup', stopDrag)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      isDragging.value = false
    }
  })

  return {
    width,
    defaultWidth,
    isDragging,
    transitionEnabled,
    startDrag,
    resetWidth
  }
}
