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
        <div class="chat-room-name__text truncate whitespace-nowrap overflow-hidden text-foreground text-ellipsis">
          {{ props.roomName }}
        </div>
        <svg v-if="props.isOfficial" class="w-18px h-18px iconpark-icon shrink-0 text-[--tjg-color-primary-500]">
          <use href="#auth"></use>
        </svg>
        <!-- 房间 homeserver 常显（不限联邦房间）；域名由组件的 resolvedServerName 解析，禁止在此 split -->
        <RoomHomeserverLabel v-if="props.roomServer" class="shrink-0" :server-name="props.roomServer" />
        <!-- 联邦房间额外挂徽章：域名已由上方 chip 承载，这里只留图标避免重复文案 -->
        <FederationBadge
          v-if="props.federationServer"
          :is-local="false"
          size="xs"
          :show-label="false"
          :title="props.federationServer" />
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
import FederationBadge from '@/components/atomic/FederationBadge.vue'
import RoomHomeserverLabel from '@/components/room/RoomHomeserverLabel.vue'
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
  /** 联邦服务器域名（非空即显示联邦图标徽章） */
  federationServer?: string
  /** 当前房间的 homeserver 域名（非空即常显域名 chip，与是否联邦无关） */
  roomServer?: string
}

const props = withDefaults(defineProps<HeaderBarProps>(), {
  isOfficial: true,
  isGroup: false,
  hiddenRight: false,
  enableDefaultBackground: true,
  enableShadow: true,
  roomName: false,
  border: false,
  privateModeActive: false,
  federationServer: '',
  roomServer: ''
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
/* 房间名行：单行 flex（原来是单列 grid，多个子元素会各自换行，
 * 56px 头部很容易被撑破）。域名 chip / 徽章固定不缩，房间名负责截断。 */
.chat-room-name {
  @apply flex items-center gap-5px min-w-0 max-w-full;
}

.chat-room-name-official {
  @apply flex items-center gap-5px min-w-0 max-w-full;
}

.chat-room-name__text {
  @apply min-w-0;
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
