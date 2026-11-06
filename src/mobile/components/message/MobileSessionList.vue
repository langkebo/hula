<template>
  <div class="px-16px mt-5px">
    <div class="py-5px shrink-0">
      <van-field
        id="search"
        class="search-field rounded-8px w-full relative text-[length:var(--tjg-font-size-md)]"
        maxlength="20"
        clearable
        autocomplete="off"
        :spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        :model-value="searchText"
        :placeholder="t('mobile_home.input.search')"
        @update:model-value="(value: string) => emit('update:searchText', value)"
        @focus="emit('lock-scroll')"
        @blur="emit('unlock-scroll')">
        <template #left-icon>
          <svg class="w-14px h-14px color-[--tjg-text-tertiary]">
            <use href="#search"></use>
          </svg>
        </template>
      </van-field>
    </div>
    <div class="m-0 p-0 mt-10px border-b border-[--tjg-border-layout-divider]"></div>
  </div>

  <van-pull-refresh
    class="flex-1"
    :pull-distance="100"
    :disabled="!isEnablePullRefresh"
    :model-value="loading"
    @update:model-value="(value: boolean) => emit('update:loading', value)"
    @refresh="emit('refresh')">
    <div class="flex flex-col h-full">
      <!-- 首屏加载中：不要把「还没拉到」显示成「没有会话」 -->
      <div
        v-if="listState === 'loading'"
        class="flex-1 flex flex-col items-center justify-center gap-8px min-h-200px"
        data-test="session-list-loading">
        <van-loading size="24px" />
        <span class="text-[length:var(--tjg-font-size-md)] text-[--tjg-text-tertiary]">{{ t('common.loading') }}</span>
      </div>
      <!-- 拉取失败：给原因 + 重试，而不是让用户以为真没有会话 -->
      <div
        v-else-if="listState === 'error'"
        class="flex-1 flex items-center justify-center min-h-200px"
        data-test="session-list-error">
        <van-empty :description="t('mobile_home.session_load_failed')">
          <p class="mt-4px text-[length:var(--tjg-font-size-sm)] text-[--tjg-text-tertiary] break-all">
            {{ loadError }}
          </p>
          <van-button size="small" type="primary" plain class="mt-12px" @click="emit('refresh')">
            {{ t('common.retry') }}
          </van-button>
        </van-empty>
      </div>
      <!-- 真空态:确实没有任何会话 -->
      <div v-else-if="listState === 'empty'" class="flex-1 flex items-center justify-center min-h-200px">
        <van-empty :description="t('mobile_home.empty_session')" />
      </div>
      <SmartVirtualList
        v-else
        class="mobile-session-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        :items="filteredSessionList"
        :item-height="72"
        :buffer="6"
        key-field="roomId"
        @scroll="emit('scroll', $event)">
        <template #default="{ item, index }">
          <!-- 置顶分组标签：仅在首个置顶项前显示 -->
          <div v-if="isFirstPinned(item, index)" class="pinned-group-label">{{ t('mobile_home.chat.pintop') }}</div>
          <van-swipe-cell
            @open="emit('swipe-open')"
            @close="emit('swipe-close')"
            v-on-long-press="[(e: PointerEvent) => emit('long-press', e, item), longPressOption]"
            class="session-row"
            :class="item.top ? 'session-row--pinned' : ''">
            <!-- 长按项 -->
            <div
              @click.stop="emit('into-room', item)"
              class="grid grid-cols-[48px_1fr_max-content] items-center px-4 py-2.5 gap-3">
              <div class="flex-shrink-0">
                <van-badge
                  :offset="[-6, 6]"
                  :color="
                    item.muteNotification === NotificationTypeEnum.NOT_DISTURB
                      ? 'var(--tjg-text-tertiary)'
                      : 'var(--tjg-color-danger-500)'
                  "
                  :content="item.unreadCount"
                  :max="99">
                  <img
                    class="session-avatar size-48px rounded-8px object-cover"
                    :src="AvatarUtils.getAvatarUrl(item.avatar, 96)"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                </van-badge>
              </div>
              <!-- 中间:两行内容 -->
              <div class="truncate flex gap-10px leading-tight flex-col min-w-0">
                <span
                  class="text-[length:var(--tjg-font-size-2lg)] font-medium flex-1 truncate text-[--tjg-text-primary]">
                  {{ item.name }}
                </span>
                <div
                  class="text-[length:var(--tjg-font-size-md)] text-[--tjg-text-secondary] dark:text-[--tjg-text-tertiary] truncate">
                  {{ item.lastMsg }}
                </div>
              </div>

              <!-- 时间:靠顶 -->
              <div
                class="text-[length:var(--tjg-font-size-2xs)] text-right flex flex-col gap-1 items-end justify-center text-[--tjg-text-tertiary]">
                <div class="flex items-center gap-1">
                  <span v-if="item.hotFlag === IsAllUserEnum.Yes">
                    <svg class="size-14px select-none outline-none cursor-pointer color-[--tjg-color-primary-500]">
                      <use href="#auth"></use>
                    </svg>
                  </span>
                  <span v-if="item.isFavorite">
                    <svg class="size-14px select-none outline-none cursor-pointer color-[--tjg-color-warning-500]">
                      <use href="#star"></use>
                    </svg>
                  </span>
                  <span class="whitespace-nowrap">
                    {{ formatChatTime(item?.activeTime) }}
                  </span>
                </div>
                <div v-if="item.muteNotification === NotificationTypeEnum.NOT_DISTURB">
                  <svg class="size-14px z-100 color-[--tjg-text-tertiary]">
                    <use href="#close-remind"></use>
                  </svg>
                </div>
              </div>
            </div>
            <template #right>
              <div class="flex w-auto flex-wrap h-full">
                <div
                  class="h-full text-[length:var(--tjg-font-size-base)] w-80px bg-[--tjg-color-primary-500] text-white flex items-center justify-center"
                  @click="emit('toggle-top', item)">
                  {{ item.top ? t('mobile_home.chat.unpin') : t('mobile_home.chat.pintop') }}
                </div>
                <div
                  :class="(item?.unreadCount ?? 0) > 0 ? 'bg-[--tjg-text-tertiary]' : 'bg-[--tjg-color-warning-500]'"
                  class="h-full text-[length:var(--tjg-font-size-base)] w-80px text-white flex items-center justify-center"
                  @click="emit('toggle-read', (item?.unreadCount ?? 0) > 0, item)">
                  {{
                    (item?.unreadCount ?? 0) > 0
                      ? t('mobile_home.chat.mark_as_read')
                      : t('mobile_home.chat.mark_as_unread')
                  }}
                </div>
                <div
                  class="h-full text-[length:var(--tjg-font-size-base)] w-80px bg-[--tjg-color-danger-500] text-white flex items-center justify-center"
                  @click="emit('delete', item)">
                  {{ t('mobile_home.chat.delete') }}
                </div>
              </div>
            </template>
          </van-swipe-cell>
        </template>
      </SmartVirtualList>
    </div>
  </van-pull-refresh>
</template>

<script setup lang="ts">
import { vOnLongPress } from '@vueuse/components'
import { useI18n } from 'vue-i18n'
import { NotificationTypeEnum } from '@/enums'
import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'
import type { LongPressOption } from '@/mobile/composables/useMobileLongPress'
import { type MobileSessionListItem, resolveSessionListState } from '@/mobile/composables/useMobileSessionList'
import { IsAllUserEnum } from '@/services/types.ts'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatChatTime } from '@/utils/ComputedTime.ts'

defineOptions({ name: 'MobileSessionList' })

const props = defineProps<{
  filteredSessionList: MobileSessionListItem[]
  searchText: string
  loading: boolean
  /** 最近一次拉取失败的原因（null = 没失败） */
  loadError?: string | null
  /** 服务端是否仍在拉取 */
  isLoading?: boolean
  isEnablePullRefresh: boolean
  longPressOption: LongPressOption
}>()

/** 四态判定（loading / error / empty / list），逻辑在 composable 里可单测 */
const listState = computed(() =>
  resolveSessionListState({
    count: props.filteredSessionList.length,
    isLoading: props.isLoading ?? props.loading,
    loadError: props.loadError
  })
)

const emit = defineEmits<{
  (e: 'update:searchText', value: string): void
  (e: 'update:loading', value: boolean): void
  (e: 'refresh'): void
  (e: 'scroll', event: Event): void
  (e: 'into-room', item: SessionItem): void
  (e: 'swipe-open'): void
  (e: 'swipe-close'): void
  (e: 'long-press', event: PointerEvent, item: SessionItem): void
  (e: 'toggle-top', item: SessionItem): void
  (e: 'toggle-read', markAsRead: boolean, item: SessionItem): void
  (e: 'delete', item: SessionItem): void
  (e: 'lock-scroll'): void
  (e: 'unlock-scroll'): void
}>()

const { t } = useI18n()

/** 是否为置顶分组的第一项（用于渲染「置顶」分组标签） */
function isFirstPinned(item: MobileSessionListItem, index: number): boolean {
  if (!item.top) return false
  if (index <= 0) return true
  return !props.filteredSessionList[index - 1]?.top
}
</script>

<style scoped lang="scss">
:deep(.van-cell.van-field) {
  padding: 10px 14px;
  border-radius: var(--tjg-radius-xl);
  background: var(--tjg-glass-input-bg);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-soft)) saturate(var(--tjg-glass-saturate-soft));
  backdrop-filter: blur(var(--tjg-glass-blur-soft)) saturate(var(--tjg-glass-saturate-soft));
  border: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight);
  transition:
    border-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    box-shadow var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}

:deep(.van-cell.van-field:focus-within) {
  border-color: var(--tjg-color-primary-500);
  box-shadow: var(--tjg-glass-inner-highlight), var(--tjg-glass-shadow-soft);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

::deep(#search) {
  position: relative;
  z-index: 1500;
}

/* 会话行：半透明玻璃卡片 + 柔和圆角。
 * 不逐行加 backdrop-filter：长列表滚动时逐行模糊会显著掉帧，
 * 模糊留给导航、标签栏、输入坞这些数量恒定的面。 */
.session-row {
  margin: 0 10px;
  border-radius: var(--tjg-radius-lg);
  background: var(--tjg-glass-row-bg);
  box-shadow: var(--tjg-glass-inner-highlight);
  overflow: hidden;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}

.session-row:active {
  background-color: var(--tjg-glass-row-bg-pressed);
}

.session-row--pinned {
  background-color: var(--tjg-color-primary-100);
}

.session-row--pinned:active {
  filter: brightness(0.97);
}

.session-avatar {
  box-shadow: 0 0 0 1px var(--tjg-glass-border-color);
}

.pinned-group-label {
  padding: 8px 16px 4px;
  font-size: var(--tjg-font-size-sm);
  line-height: 1.2;
  color: var(--tjg-text-tertiary);
  background: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .session-row {
    transition: none;
  }
}
</style>
