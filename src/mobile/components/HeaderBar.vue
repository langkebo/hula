<template>
  <div class="w-full h-[56px] grid grid-cols-[100px_1fr_100px] z-2 bg-background text-foreground">
    <div @click="handleBack" class="w-full h-full flex items-center">
      <svg class="iconpark-icon w-24px h-24px ms-16px p-5px">
        <use href="#fanhui" class="text-foreground"></use>
      </svg>
      <div
        v-show="props.msgCount ? (props.msgCount > 0 ? true : false) : false"
        class="rounded-15px flex items-center bg-#C7DBD9 px-7px text-14px min-h-20px">
        {{ formattedMsgCount }}
      </div>
    </div>
    <div class="w-full h-full overflow-hidden flex items-center justify-center">
      <div @click="handleRoomNameClick" :class="props.isOfficial ? ['chat-room-name-official'] : ['chat-room-name']">
        <div class="truncate whitespace-nowrap overflow-hidden text-foreground text-ellipsis w-full text-center text-16px font-medium">
          {{ props.roomName || '' }}
        </div>
        <svg v-if="props.isOfficial" class="w-18px h-18px iconpark-icon text-#1A9B83"><use href="#auth"></use></svg>
      </div>
    </div>
    <div class="w-full h-full flex items-center">
      <div v-if="!props.hiddenRight" class="w-full justify-end flex pe-16px">
        <slot name="right">
          <svg v-if="props.showDesktopIcon" class="w-24px h-24px iconpark-icon p-5px"><use href="#diannao"></use></svg>
          <svg v-if="props.showMoreIcon" @click="handleMoreClick" class="w-24px h-24px iconpark-icon p-5px"><use href="#more"></use></svg>
        </slot>
      </div>
    </div>
  </div>

  <n-divider v-if="props.border" class="m-0!" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import router from '@/router'

export interface HeaderBarProps {
  msgCount?: number
  isOfficial?: boolean
  hiddenRight?: boolean
  enableDefaultBackground?: boolean
  enableShadow?: boolean
  roomName?: string | false
  border?: boolean
  showDesktopIcon?: boolean
  showMoreIcon?: boolean
}

const props = withDefaults(defineProps<HeaderBarProps>(), {
  isOfficial: false,
  hiddenRight: false,
  enableDefaultBackground: true,
  enableShadow: true,
  roomName: false,
  border: false,
  showDesktopIcon: false,
  showMoreIcon: true
})

const emits = defineEmits<{
  (e: 'roomNameClick', payload: HeaderBarProps): void
  (e: 'moreClick'): void
}>()

const formattedMsgCount = computed(() => {
  if (!props.msgCount) return ''
  return props.msgCount > 100 ? '99+' : `${props.msgCount}`
})

const handleBack = () => {
  router.back()
}

const handleRoomNameClick = () => {
  emits('roomNameClick', props)
}

const handleMoreClick = () => {
  emits('moreClick')
}
</script>

<style lang="scss" scoped>
.chat-room-name {
  @apply grid items-center;
}

.chat-room-name-official {
  @apply grid grid-cols-[1fr_20px] items-center gap-5px;
}
</style>
