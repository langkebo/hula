<template>
  <!-- 网络状态提示 -->
  <n-flex
    v-if="networkBannerText"
    align="center"
    justify="center"
    class="z-999 w-full h-40px rounded-4px text-[var(--text-sm)] text-[--tjg-color-danger-500] bg-[--tjg-color-danger-100] flex-shrink-0">
    <svg class="size-16px">
      <use href="#cloudError"></use>
    </svg>
    {{ networkBannerText }}
  </n-flex>

  <!-- 置顶公告提示 -->
  <Transition name="announcement" mode="out-in">
    <div v-if="isAnnouncementLoading" key="announcement-loading" class="p-[6px_12px_0_12px]">
      <div class="custom-announcement flex items-center justify-center h-40px">
        <n-spin :size="20" />
      </div>
    </div>
    <div v-else-if="isGroup && topAnnouncement" key="announcement" class="p-[6px_12px_0_12px]">
      <div
        class="custom-announcement"
        :class="{ 'announcement-hover': isAnnouncementHover }"
        @mouseenter="isAnnouncementHover = true"
        @mouseleave="isAnnouncementHover = false">
        <n-flex :wrap="false" class="w-full" align="center" justify="space-between">
          <n-flex :wrap="false" align="center" class="pl-12px select-none flex-1" :size="6">
            <svg class="size-16px flex-shrink-0">
              <use href="#Loudspeaker"></use>
            </svg>
            <div class="flex-1 min-w-0 line-clamp-1 text-[var(--text-sm)] text-[--tjg-text-tertiary]">
              {{ topAnnouncement.content }}
            </div>
          </n-flex>
          <div class="flex-shrink-0 w-60px select-none" @click="$emit('viewAnnouncement')">
            <p class="text-[var(--text-sm)] text-[--tjg-color-primary-500] cursor-pointer">
              {{ t('home.chat_main.announcement.view_all') }}
            </p>
          </div>
        </n-flex>
      </div>
    </div>
  </Transition>

  <E2EEBanner v-if="currentRoomId" :key="currentRoomId" :room-id="currentRoomId" />

  <!-- 私密模式切换按钮（仅单聊） -->
  <div v-if="!isMobileRef && !isGroup" class="private-mode-bar flex-shrink-0 px-12px py-4px flex items-center gap-8px">
    <button
      data-testid="private-toggle-btn"
      type="button"
      class="private-toggle-btn"
      :class="{ 'private-toggle-btn--active': privateModeActive }"
      :title="privateModeActive ? '退出私密模式' : '进入私密模式'"
      @click="$emit('togglePrivateMode')">
      <span class="private-toggle-btn__letter">S</span>
    </button>
    <PrivateModeBanner v-if="privateModeActive" :burn-enabled="burnEnabled" />
    <svg
      v-if="privateModeActive"
      data-testid="private-lock-icon"
      class="size-16px flex-shrink-0 text-[--tjg-color-danger-500]"
      aria-label="私密模式">
      <use href="#lock"></use>
    </svg>
  </div>

  <!-- ScreenshotWatermark (private mode) -->
  <ScreenshotWatermark
    v-if="privateModeActive"
    :user-id="currentUserId"
    :user-name="currentUserName"
    :enabled="privateModeActive" />

  <!-- 粘性事件横幅 -->
  <StickyEventBanner
    :events="stickyEvents"
    :can-set-sticky="canSetSticky"
    @set-sticky="$emit('setSticky')"
    @view="(eventId: string) => $emit('viewStickyEvent', eventId)" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BurnAfterReadToggle from '@/components/burn/BurnAfterReadToggle.vue'
import E2EEBanner from '@/components/chat/E2EEBanner.vue'
import PrivateModeBanner from '@/components/common/PrivateModeBanner.vue'
import ScreenshotWatermark from '@/components/common/ScreenshotWatermark.vue'
import StickyEventBanner from '@/components/rightBox/renderMessage/StickyEventBanner.vue'
import { isMobile } from '@/utils/PlatformConstants'

// BurnAfterReadToggle is not used in this component but kept for potential future use
void BurnAfterReadToggle

const { t } = useI18n()
const isAnnouncementHover = ref<boolean>(false)

const isMobileRef = computed(() => isMobile())

interface StickyEventItem {
  eventId: string
  sender: string
  body: string
  timestamp: number
}

defineProps<{
  networkBannerText: string | null
  isAnnouncementLoading: boolean
  isGroup: boolean
  topAnnouncement: { content: string } | null
  currentRoomId: string | null
  privateModeActive: boolean
  burnEnabled: boolean
  currentUserId: string
  currentUserName: string
  stickyEvents: StickyEventItem[]
  canSetSticky: boolean
}>()

defineEmits<{
  togglePrivateMode: []
  viewAnnouncement: []
  setSticky: []
  viewStickyEvent: [eventId: string]
}>()
</script>

<style scoped lang="scss">
// 私密模式 S 按钮
.private-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--tjg-radius-full, 50%);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  font-size: var(--tjg-font-size-sm, 14px);
  font-weight: var(--tjg-font-weight-semibold, 600);
  transition: all var(--tjg-motion-duration-fast, 0.15s) var(--tjg-motion-ease-standard, ease);

  &:hover {
    background: var(--tjg-surface-panel-muted, rgba(0, 0, 0, 0.04));
    color: var(--tjg-text-primary);
  }

  &--active {
    color: var(--tjg-color-danger-500);
    background: var(--tjg-color-danger-100, rgba(255, 77, 79, 0.1));

    &:hover {
      background: var(--tjg-color-danger-200, rgba(255, 77, 79, 0.2));
    }
  }

  &__letter {
    pointer-events: none;
  }
}
</style>
