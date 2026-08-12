<template>
  <div class="px-16px mt-5px">
    <div class="py-5px shrink-0">
      <van-field
        id="search"
        class="search-field rounded-8px w-full relative text-13px"
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
      <!-- 空状态:会话列表为空时显示 -->
      <div v-if="filteredSessionList.length === 0" class="flex-1 flex items-center justify-center min-h-200px">
        <van-empty description="暂无会话" />
      </div>
      <SmartVirtualList
        v-else
        class="mobile-session-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        :items="filteredSessionList"
        :item-height="72"
        :buffer="6"
        key-field="roomId"
        @scroll="emit('scroll', $event)">
        <template #default="{ item }">
          <van-swipe-cell
            @open="emit('swipe-open')"
            @close="emit('swipe-close')"
            v-on-long-press="[(e: PointerEvent) => emit('long-press', e, item), longPressOption]"
            class="text-black"
            :class="item.top ? 'w-full bg-[--tjg-color-primary-100]' : ''">
            <!-- 长按项 -->
            <div
              @click.stop="emit('into-room', item)"
              class="grid grid-cols-[48px_1fr_max-content] items-center px-4 py-2.5 gap-3">
              <div class="flex-shrink-0">
                <van-badge
                  :offset="[-6, 6]"
                  :color="
                    item.muteNotification === NotificationTypeEnum.NOT_DISTURB ? 'grey' : 'var(--tjg-color-danger-500)'
                  "
                  :content="item.unreadCount"
                  :max="99">
                  <img
                    class="size-48px rounded-8px object-cover"
                    :src="AvatarUtils.getAvatarUrl(item.avatar)"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                </van-badge>
              </div>
              <!-- 中间:两行内容 -->
              <div class="truncate flex gap-10px leading-tight flex-col min-w-0">
                <span class="text-15px font-medium flex-1 truncate text-[--tjg-text-primary]">{{ item.name }}</span>
                <div class="text-13px text-[--tjg-text-secondary] dark:text-[--tjg-text-tertiary] truncate">
                  {{ item.lastMsg }}
                </div>
              </div>

              <!-- 时间:靠顶 -->
              <div class="text-11px text-right flex flex-col gap-1 items-end justify-center text-[--tjg-text-tertiary]">
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
                  class="h-full text-14px w-80px bg-[--tjg-color-primary-500] text-white flex items-center justify-center"
                  @click="emit('toggle-top', item)">
                  {{ item.top ? t('mobile_home.chat.unpin') : t('mobile_home.chat.pintop') }}
                </div>
                <div
                  :class="(item?.unreadCount ?? 0) > 0 ? 'bg-[--tjg-text-tertiary]' : 'bg-[--tjg-color-warning-500]'"
                  class="h-full text-14px w-80px text-white flex items-center justify-center"
                  @click="emit('toggle-read', (item?.unreadCount ?? 0) > 0, item)">
                  {{
                    (item?.unreadCount ?? 0) > 0
                      ? t('mobile_home.chat.mark_as_read')
                      : t('mobile_home.chat.mark_as_unread')
                  }}
                </div>
                <div
                  class="h-full text-14px w-80px bg-[--tjg-color-danger-500] text-white flex items-center justify-center"
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
import type { MobileSessionListItem } from '@/mobile/composables/useMobileSessionList'
import { IsAllUserEnum } from '@/services/types.ts'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatChatTime } from '@/utils/ComputedTime.ts'

defineOptions({ name: 'MobileSessionList' })

defineProps<{
  filteredSessionList: MobileSessionListItem[]
  searchText: string
  loading: boolean
  isEnablePullRefresh: boolean
  longPressOption: LongPressOption
}>()

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
</script>

<style scoped lang="scss">
:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--tjg-surface-search);
  border: 1px solid transparent;
  transition: border-color 0.15s ease;
}

:deep(.van-cell.van-field:focus-within) {
  border-color: var(--tjg-color-primary-500);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

::deep(#search) {
  position: relative;
  z-index: 1500;
}
</style>
