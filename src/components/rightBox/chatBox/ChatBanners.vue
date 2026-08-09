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
    <!-- 公告 loading 只应在群聊显示：单聊本无公告，避免全局 isLoading 残留时每个会话都转圈 -->
    <div v-if="isAnnouncementLoading && isGroup" key="announcement-loading" class="p-[6px_12px_0_12px]">
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

  <!-- 私密模式提示（S 按钮由 ChatHeaderToolbar 提供，此处仅显示状态） -->
  <PrivateModeBanner v-if="privateModeActive" :burn-enabled="burnEnabled" />
  <div v-if="privateModeActive" class="flex-shrink-0 px-12px py-4px flex items-center gap-8px">
    <svg
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
    @cancel-sticky="(eventId: string) => $emit('cancelSticky', eventId)"
    @view="(eventId: string) => $emit('viewStickyEvent', eventId)" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import E2EEBanner from '@/components/chat/E2EEBanner.vue'
import PrivateModeBanner from '@/components/common/PrivateModeBanner.vue'
import ScreenshotWatermark from '@/components/common/ScreenshotWatermark.vue'
import StickyEventBanner from '@/components/rightBox/renderMessage/StickyEventBanner.vue'

const { t } = useI18n()
const isAnnouncementHover = ref<boolean>(false)

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
  viewAnnouncement: []
  setSticky: []
  cancelSticky: [eventId: string]
  viewStickyEvent: [eventId: string]
}>()
</script>
