import { type ComputedRef, type CSSProperties, computed, type Ref, ref, watch } from 'vue'
import { useResponsiveBreakpoint } from '@/composables/layout/useResponsiveBreakpoint'
import { useRightPaneWidth } from '@/composables/layout/useRightPaneWidth'
import type { RightViewType } from '@/layout/right/types'

/** 信息面板折叠状态持久化键 */
export const CHAT_SIDEBAR_COLLAPSED_KEY = 'tjg.chatSidebar.collapsed'

interface UseChatSidebarOptions {
  /** 当前房间是否为群聊；单聊不展示信息面板 */
  isGroup: Ref<boolean>
}

interface UseChatSidebarReturn {
  /** 面板是否折叠（折叠时宽度为 0） */
  isCollapsed: Ref<boolean>
  /** 窄屏（768-991px）下改为抽屉浮层 */
  isDrawer: Ref<boolean>
  /** 单栏（<768px）下不渲染面板 */
  isHidden: Ref<boolean>
  /** 抽屉是否处于展开状态（需要渲染遮罩） */
  isDrawerOpen: Ref<boolean>
  /** 面板根节点动态 class */
  panelClass: Ref<string>
  /** 面板根节点动态 style（宽度命中拖拽结果） */
  panelStyle: ComputedRef<CSSProperties | undefined>
  /** 抽屉遮罩 class */
  backdropClass: string
  /** 开始拖拽面板左缘调整宽度 */
  startDrag: (e: PointerEvent) => void
  /** 展开/收起切换 */
  toggle: () => void
  /** 收起面板 */
  collapse: () => void
}

/** 读取持久化的折叠状态；无记录时返回 null */
const readCollapsed = (): boolean | null => {
  try {
    const raw = window.localStorage.getItem(CHAT_SIDEBAR_COLLAPSED_KEY)
    if (raw === null) return null
    return raw === '1'
  } catch {
    return null
  }
}

/** 写入折叠状态（隐私模式等写入失败场景静默忽略） */
const writeCollapsed = (collapsed: boolean) => {
  try {
    window.localStorage.setItem(CHAT_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/**
 * 信息面板（240px）折叠、拖拽与抽屉行为
 *
 * - 折叠状态持久化到 localStorage，刷新后保留
 * - 无持久化记录时：>=1200px 默认展开，其余断点默认折叠
 * - 768-991px（shrink）改为抽屉浮层 + 遮罩；<768px（single）不渲染面板
 * - 桌面端展开时可通过左缘拖拽调整宽度（与 tjg.rightPaneWidth 共用持久化）
 */
export function useChatSidebar({ isGroup }: UseChatSidebarOptions): UseChatSidebarReturn {
  const { mode } = useResponsiveBreakpoint()

  const isDrawer = computed(() => mode.value === 'shrink')
  const isHidden = computed(() => mode.value === 'single')
  const isCollapsed = ref(readCollapsed() ?? mode.value !== 'wide')
  const isDrawerOpen = computed(() => isDrawer.value && !isCollapsed.value)

  watch(isCollapsed, (collapsed) => writeCollapsed(collapsed))

  const { width, isDragging, startDrag } = useRightPaneWidth({ rightView: ref<RightViewType>('chat') })

  const toggle = () => {
    isCollapsed.value = !isCollapsed.value
  }

  const collapse = () => {
    isCollapsed.value = true
  }

  const panelClass = computed(() => {
    if (!isGroup.value || isCollapsed.value || isHidden.value) return 'w-0 border-none'
    if (isDrawer.value) {
      return 'fixed right-0 top-0 bottom-0 z-40 w-240px shadow-lg bg-[--tjg-surface-panel]'
    }
    return 'w-240px border-l border-[--tjg-border-default] bg-[--tjg-surface-panel] shadow-sm'
  })

  const panelStyle = computed<CSSProperties | undefined>(() => {
    if (!isGroup.value || isHidden.value || isCollapsed.value || isDrawer.value) return undefined
    return { width: `${width.value}px`, transition: isDragging.value ? 'none' : undefined }
  })

  return {
    isCollapsed,
    isDrawer,
    isHidden,
    isDrawerOpen,
    panelClass,
    panelStyle,
    backdropClass: 'fixed inset-0 bg-[--tjg-overlay-mask-subtle]',
    startDrag,
    toggle,
    collapse
  }
}
