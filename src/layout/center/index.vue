<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    :class="{ 'rounded-r-8px': shrinkStatus }"
    class="resizable select-none flex flex-col border-r-(1px solid [--hula-border-layout-divider])"
    :style="centerStyle">
    <!-- 分隔条 -->
    <div v-show="!shrinkStatus" class="resize-handle transition-all duration-600 ease-in-out" @mousedown="initDrag">
      <div :class="{ 'opacity-100': isDragging }" class="transition-all duration-600 ease-in-out opacity-0 drag-icon">
        <div
          style="border-radius: 8px 0 0 8px"
          class="h-60px w-14px absolute top-40% right-0 drag-icon bg-[--hula-surface-sidebar-selected]">
          <svg class="size-16px absolute top-1/2 right--2px transform -translate-y-1/2 color-[--hula-text-tertiary]">
            <use href="#sliding"></use>
          </svg>
        </div>
      </div>
    </div>

    <ActionBar
      class="absolute right-0 w-full"
      v-show="shrinkStatus"
      :shrink-status="!shrinkStatus"
      :max-w="false"
      :current-label="appWindow.label" />

    <!-- 列表 -->
    <div id="centerList" class="h-full" :class="{ 'shadow-inner': settingStore.pageShadowEnabled }">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['message', 'friendsList']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </main>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWindowSize } from '@vueuse/core'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useTimerManager } from '@/utils/TimerManager'
const timerManager = useTimerManager()

const settingStore = useSettingStore()
const appWindow = WebviewWindow.getCurrent()
/** 设置最小宽度 */
const minWidth = 160
/** 设置最大宽度 */
const maxWidth = 300
/** 初始化宽度 */
const initWidth = ref(250)
/**! 使用(vueUse函数获取)视口宽度 */
const { width } = useWindowSize()
/** 是否拖拽 */
const isDrag = ref(true)

const LEFT_MIN_WIDTH = 64
const RIGHT_MIN_WIDTH = 600 // 右侧面板保留的最小宽度
// 结合自定义缩放方案，获取当前页面的缩放比例，避免不同 DPI 下断点失真
const resolvePageScale = () => {
  if (typeof window === 'undefined') return 1
  const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-scale') || '1')
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

// 读取布局容器的实时宽度（在窗口拖拽或系统缩放时会动态变化）
const getLayoutWidth = (fallback: number) => {
  if (typeof document === 'undefined') return fallback
  const layout = document.getElementById('layout')
  return layout?.getBoundingClientRect().width ?? fallback
}

// 左侧导航在不同状态下宽度不固定，这里按需测量
const getLeftWidth = () => {
  if (typeof document === 'undefined') return LEFT_MIN_WIDTH
  const left = document.querySelector('#layout .left') as HTMLElement | null
  return left?.getBoundingClientRect().width ?? LEFT_MIN_WIDTH
}
const startX = ref()
const startWidth = ref()
const shrinkStatus = ref(false)
const isDragging = ref(false)
const centerEl = shallowRef<HTMLElement | null>(null)
// 统一测量布局宽度，避免多处重复读取 DOM
const layoutMetrics = computed(() => {
  const windowWidth = width.value / resolvePageScale()
  const layoutWidth = getLayoutWidth(windowWidth)
  const leftWidth = getLeftWidth()
  const available = layoutWidth - leftWidth - RIGHT_MIN_WIDTH

  return {
    layoutWidth,
    leftWidth,
    available,
    lockThreshold: leftWidth + initWidth.value + RIGHT_MIN_WIDTH,
    collapsedWidth: Math.max(layoutWidth - leftWidth, minWidth)
  }
})

// 拖拽时记录的宽度会在这里和当前可用空间取较小值
const centerWidth = computed(() => {
  const { available } = layoutMetrics.value

  if (available <= minWidth) {
    return minWidth
  }

  const desired = clamp(initWidth.value, minWidth, maxWidth)
  return clamp(Math.min(desired, available), minWidth, maxWidth)
})

// 根据布局状态产出中心面板最终的 flex 配置
const centerStyle = computed(() => {
  const { lockThreshold, layoutWidth, collapsedWidth } = layoutMetrics.value

  if (shrinkStatus.value) {
    return {
      flex: '1 1 auto',
      width: `${collapsedWidth}px`,
      minWidth: '0',
      maxWidth: 'none'
    }
  }

  const flexMode = layoutWidth > lockThreshold ? '0 0 auto' : '0 1 auto'

  return {
    flex: flexMode,
    width: `${centerWidth.value}px`,
    minWidth: `${minWidth}px`,
    maxWidth: `${maxWidth}px`
  }
})

// 监测窗口宽度，切换缩放模式并控制拖拽开关
watchEffect(() => {
  const { available } = layoutMetrics.value
  const shouldShrink = available <= minWidth
  const canDrag = available > minWidth

  if (shrinkStatus.value !== shouldShrink) {
    useMitt.emit(MittEnum.SHRINK_WINDOW, shouldShrink)
  }

  const center = centerEl.value ?? document.getElementById('center')

  if (shouldShrink) {
    center?.classList.add('flex-1')
    isDrag.value = false
  } else {
    center?.classList.remove('flex-1')
    isDrag.value = canDrag
  }
})

/** 定义一个函数，在鼠标拖动时调用 */
const doDrag = (e: MouseEvent) => {
  // 使用 requestAnimationFrame 来处理动画，确保动画在下一帧渲染前执行
  requestAnimationFrame(() => {
    // 计算新的宽度
    const newWidth = startWidth.value + e.clientX - startX.value
    // 如果新宽度不等于最大宽度，则更新宽度值
    if (newWidth !== maxWidth) {
      initWidth.value = clamp(newWidth, minWidth, maxWidth) // 使用 clamp 函数限制宽度值在最小值和最大值之间
    }
  })
}

/** 定义一个函数，用于将数值限制在指定的最小值和最大值之间 */
const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max) // 使用 Math.min 和 Math.max 函数来限制数值范围
}

const initDrag = (e: MouseEvent) => {
  if (!isDrag.value) return
  startX.value = e.clientX
  startWidth.value = initWidth.value
  isDragging.value = true
  document.addEventListener('mousemove', doDrag, false)
  document.addEventListener('mouseup', stopDrag, false)
  // 防止拖拽时选中文本
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

const stopDrag = () => {
  // 恢复文本选择功能
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', doDrag, false)
  document.removeEventListener('mouseup', stopDrag, false)
  isDragging.value = false
  timerManager.setTimeout(() => {
    // 移除 hover 样式
    const resizeHandle = document.querySelector('.resize-handle') as HTMLElement
    resizeHandle.classList.remove('hover')
  }, 1000)
}

onMounted(async () => {
  useMitt.on(MittEnum.SHRINK_WINDOW, (event: boolean) => {
    shrinkStatus.value = event
  })
})

onUnmounted(() => {
  // 清理拖拽相关的事件监听器和样式
  if (isDragging.value) {
    document.removeEventListener('mousemove', doDrag, false)
    document.removeEventListener('mouseup', stopDrag, false)
    document.body.style.userSelect = ''
    isDragging.value = false
  }
  timerManager.clearAll()
})
</script>

<style scoped lang="scss">
@use 'style';
</style>
