<template>
  <div
    class="header-bar tjg-glass tjg-glass--nav w-full h-[56px] flex items-center gap-8px z-2 text-[--tjg-text-primary]">
    <div v-clickable @click="handleBack" class="flex items-center shrink-0 min-h-[44px]">
      <svg class="iconpark-icon w-24px h-24px ms-16px p-5px" aria-hidden="true">
        <use href="#fanhui" class="text-foreground"></use>
      </svg>
      <div
        v-show="props.msgCount ? (props.msgCount > 0 ? true : false) : false"
        class="rounded-15px flex items-center bg-[--tjg-color-primary-100] px-7px text-14px min-h-20px">
        {{ formattedMsgCount }}
      </div>
    </div>
    <div class="flex-1 min-w-0 flex items-center justify-center overflow-hidden">
      <!-- 标题可点（查看房间信息），但文字盒只有 28×21：用伪元素纵向扩到 45px，
           既满足 44px 触控下限，又不改变顶栏高度与视觉排版 -->
      <div
        v-clickable
        @click="handleRoomNameClick"
        :class="[
          'relative justify-center after:absolute after:inset-x-0 after:-inset-y-12px after:content-[\'\']',
          props.isOfficial ? 'chat-room-name-official' : 'chat-room-name'
        ]"
        :style="{ minWidth: '44px' }">
        <div class="chat-room-name__text truncate whitespace-nowrap overflow-hidden text-foreground text-ellipsis">
          {{ props.roomName }}
        </div>
        <svg
          v-if="props.isOfficial"
          class="w-18px h-18px iconpark-icon shrink-0 text-[--tjg-color-primary-500]"
          aria-hidden="true">
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
    <div v-if="!props.hiddenRight" class="header-bar__actions flex items-center justify-end gap-8px shrink-0 pe-16px">
      <button
        v-if="!props.isGroup && canUseBurnAfterRead"
        type="button"
        class="private-toggle-btn-mobile"
        :class="{ 'private-toggle-btn-mobile--active': props.privateModeActive }"
        :aria-label="props.privateModeActive ? t('chat.header.private_mode_exit') : t('chat.header.private_mode_enter')"
        @click="emits('togglePrivateMode')">
        <span class="private-toggle-btn-mobile__letter">S</span>
      </button>
      <button
        type="button"
        class="min-w-[44px] min-h-[44px] flex items-center justify-center"
        :aria-label="t('chat.header.more_options')"
        @click="handleMoreClick">
        <svg class="w-24px h-24px iconpark-icon" aria-hidden="true">
          <use href="#more"></use>
        </svg>
      </button>
    </div>
  </div>

  <div v-if="props.border" class="h-1px bg-[--tjg-border-layout-divider]"></div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSafeBack } from '#/composables/useSafeBack'
import FederationBadge from '@/components/atomic/FederationBadge.vue'
import RoomHomeserverLabel from '@/components/room/RoomHomeserverLabel.vue'
import router from '@/router'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'

const { t } = useI18n()
const canUseBurnAfterRead = useServerCapability().canUseBurnAfterRead

interface HeaderBarProps {
  msgCount?: number | undefined
  isOfficial?: boolean | undefined
  isGroup?: boolean | undefined
  hiddenRight?: boolean | undefined
  enableDefaultBackground?: boolean | undefined
  enableShadow?: boolean | undefined
  roomName?: string | false | undefined
  border?: boolean | undefined
  privateModeActive?: boolean | undefined
  /** 联邦服务器域名（非空即显示联邦图标徽章） */
  federationServer?: string | undefined
  /** 当前房间的 homeserver 域名（非空即常显域名 chip，与是否联邦无关） */
  roomServer?: string | undefined
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

const { goBack } = useSafeBack()

const handleBack = () => {
  goBack()
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
  /* flex-1：房间名吃掉剩余宽度并截断，域名 chip / 徽章保持固定宽度不挤压 */
  @apply min-w-0 flex-1;
}

/* 右侧操作区：两个 44px 热区并排，间距必须 >= 16px，否则可点区重叠导致误触私密模式 */
.header-bar__actions {
  gap: 16px;
}

/* <360dp 窄屏：收紧右侧操作区，避免次要按钮挤压房间名 */
@media (max-width: 359.98px) {
  .header-bar__actions {
    gap: 16px;
    padding-inline-end: 8px;
  }

  .private-toggle-btn-mobile {
    width: 24px;
    height: 24px;

    &__letter {
      font-size: 14px;
    }
  }
}

.private-toggle-btn-mobile {
  position: relative;
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

  /* 视觉保持 28/24px，热区扩到 44px（居中 44px 覆盖层，窄屏 24px 同样成立） */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }

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
