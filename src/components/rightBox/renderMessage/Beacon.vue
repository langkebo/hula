<template>
  <main class="beacon-message" @dblclick.stop="handleBeaconClick">
    <!-- 位置图标和标题 -->
    <n-flex align="center" justify="space-between" class="pb-8px">
      <div class="flex-y-center gap-8px">
        <svg class="size-14px color-#ff7a00">
          <use href="#local"></use>
        </svg>
        <p class="text-14px font-medium color-[--text-color]">实时位置共享</p>
      </div>

      <div class="flex-y-center gap-4px">
        <span v-if="isActive" class="status-dot active"></span>
        <span v-else class="status-dot inactive"></span>
        <p class="text-10px" :class="isActive ? 'color-#13987f' : 'color-#999'">
          {{ isActive ? '共享中' : '已结束' }}
        </p>
      </div>
    </n-flex>

    <!-- 描述信息 -->
    <div class="text-(12px [--chat-text-color]) pb-8px leading-5 line-clamp-2">
      {{ body?.description || '发起了位置共享' }}
    </div>

    <!-- 状态面板 -->
    <div class="relative rounded-6px overflow-hidden bg-gray-100 dark:bg-#202020 h-80px flex-col-center gap-8px">
      <template v-if="isActive">
        <p class="text-12px color-[--text-color-2]">剩余时间: {{ remainingTimeText }}</p>
        <n-button size="small" type="primary" secondary @click.stop="handleJoinClick">查看位置</n-button>
      </template>
      <template v-else>
        <svg class="size-24px color-[--text-color-3]">
          <use href="#time-out"></use>
        </svg>
        <span class="text-12px color-[--text-color-3]">本次位置共享已结束</span>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { BeaconBody } from '@/services/types'
import { isWindows } from '@/utils/PlatformConstants'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(
  defineProps<{
    body?: BeaconBody
  }>(),
  {
    body: undefined
  }
)

// 计算是否仍在共享中
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval>

const isActive = computed(() => {
  if (!props.body || !props.body.isLive) return false
  const startTime = props.body.lastUpdateTs || Date.now() // 理想情况应该使用消息的发送时间
  return now.value < startTime + (props.body.timeout || 0)
})

const remainingTimeText = computed(() => {
  if (!props.body) return '00:00'
  const startTime = props.body.lastUpdateTs || Date.now()
  const endTime = startTime + (props.body.timeout || 0)
  const diff = Math.max(0, Math.floor((endTime - now.value) / 1000))

  if (diff <= 0) return '00:00'

  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

const handleBeaconClick = () => {
  if (!isWindows() || !isActive.value) return
  // TODO: 打开地图查看实时位置的逻辑
  window.$message.info('打开实时位置地图模块 (待实现)')
}

const handleJoinClick = () => {
  handleBeaconClick()
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped lang="scss">
.beacon-message {
  cursor: default;
  user-select: none;
  @apply: w-260px flex flex-col h-fit bg-[--group-notice-bg]
  border-(1px solid #e3e3e3) dark:border-(1px solid #404040)
  hover:bg-#fefefe99 dark:hover:bg-#60606040 rounded-8px p-8px box-border
  custom-shadow transition-colors duration-200;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;

  &.active {
    background-color: #13987f;
    box-shadow: 0 0 4px #13987f;
    animation: pulse 2s infinite;
  }

  &.inactive {
    background-color: #999;
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
