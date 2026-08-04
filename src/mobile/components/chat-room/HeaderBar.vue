<template>
  <div class="w-full h-[56px] grid grid-cols-[100px_1fr_100px] z-2 bg-background text-foreground">
    <div @click="handleBack" class="w-full h-full flex items-center">
      <svg class="iconpark-icon w-24px h-24px ms-16px p-5px">
        <use href="#fanhui" class="text-foreground"></use>
      </svg>
      <div
        v-show="props.msgCount ? (props.msgCount > 0 ? true : false) : false"
        class="rounded-15px flex items-center bg-[--tjg-color-primary-100] px-7px text-14px min-h-20px">
        {{ formattedMsgCount }}
      </div>
    </div>
    <div class="w-full h-full overflow-hidden flex items-center justify-center">
      <div @click="handleRoomNameClick" :class="props.isOfficial ? ['chat-room-name-official'] : ['chat-room-name']">
        <div class="truncate whitespace-nowrap overflow-hidden text-foreground text-ellipsis w-full text-center">
          {{ props.roomName }}
        </div>
        <svg v-if="props.isOfficial" class="w-18px h-18px iconpark-icon text-[--color-primary]">
          <use href="#auth"></use>
        </svg>
      </div>
    </div>
    <div class="w-full h-full flex items-center">
      <div v-if="!props.hiddenRight" class="w-full justify-end flex pe-16px items-center gap-8px">
        <button
          v-if="!props.isGroup"
          type="button"
          class="private-toggle-btn-mobile"
          :class="{ 'private-toggle-btn-mobile--active': props.privateModeActive }"
          :aria-label="props.privateModeActive ? '退出私密模式' : '进入私密模式'"
          @click="emits('togglePrivateMode')">
          <span class="private-toggle-btn-mobile__letter">S</span>
        </button>
        <svg class="w-24px h-24px iconpark-icon p-5px"><use href="#diannao"></use></svg>
        <svg @click="handleMoreClick" class="w-24px h-24px iconpark-icon p-5px"><use href="#more"></use></svg>
      </div>
    </div>
  </div>

  <div v-if="props.border" class="h-1px bg-[--tjg-border-layout-divider]"></div>
</template>

<script setup lang="ts">
import router from '@/router'

interface HeaderBarProps {
  msgCount?: number
  isOfficial?: boolean
  isGroup?: boolean
  hiddenRight?: boolean
  enableDefaultBackground?: boolean
  enableShadow?: boolean
  roomName?: string | false
  border?: boolean
  privateModeActive?: boolean
}

const props = withDefaults(defineProps<HeaderBarProps>(), {
  isOfficial: true,
  isGroup: false,
  hiddenRight: false,
  enableDefaultBackground: true,
  enableShadow: true,
  roomName: false,
  border: false,
  privateModeActive: false
})

const emits = defineEmits<{
  roomNameClick: [payload: HeaderBarProps]
  togglePrivateMode: []
}>()

const handleRoomNameClick = () => {
  emits('roomNameClick', props)
}

const formattedMsgCount = computed(() => {
  if (!props.msgCount) return ''
  return props.msgCount > 100 ? '99+' : `${props.msgCount}`
})

const handleBack = async () => {
  router.back()
}

const handleMoreClick = () => {
  router.push(`/mobile/chatRoom/setting`)
}
</script>

<style lang="scss" scoped>
.chat-room-name {
  @apply grid items-center;
}

.chat-room-name-official {
  @apply grid grid-cols-[1fr_20px] items-center gap-5px;
}

.private-toggle-btn-mobile {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--tjg-text-tertiary);
  border: 1px solid var(--tjg-border-default);
  cursor: pointer;

  &--active {
    background: var(--tjg-color-danger-500);
    color: var(--tjg-text-inverse);
    border-color: var(--tjg-color-danger-500);
  }

  &__letter {
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }
}
</style>
