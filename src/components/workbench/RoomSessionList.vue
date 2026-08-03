<template>
  <n-scrollbar ref="msg-scrollbar" class="h-full">
    <div v-if="syncLoading" class="flex-center gap-10px py-12px text-[var(--text-xs)] text-[--hula-text-primary]">
      <n-spin :size="14" />
      <span>{{ t('message.message_list.sync_loading') }}</span>
    </div>

    <div
      v-if="networkBanner && !syncLoading && !globalStore.currentSessionRoomId"
      class="room-session-list__network-banner"
      style="position: sticky; top: 8px; z-index: 999">
      <svg class="size-16px flex-shrink-0">
        <use href="#cloudError"></use>
      </svg>
      <span class="leading-tight">{{ networkBanner.text }}</span>
      <button
        v-if="showRetryAction"
        type="button"
        class="ml-auto rounded-full border border-[--hula-color-danger-500] bg-transparent px-10px py-2px text-[var(--text-xs)] leading-tight color-[--hula-color-danger-500] transition-opacity hover:opacity-80"
        data-test="network-retry"
        @click="onRetryNetwork">
        {{ t('common.retry') }}
      </button>
    </div>

    <div
      v-if="sessionList.length > 0"
      role="list"
      :aria-label="t('space.session_list_label')"
      :aria-busy="syncLoading"
      class="room-session-list__body h-full">
      <RecycleScroller
        class="scroller h-full"
        :items="sessionList"
        :item-size="84"
        key-field="roomId"
        v-slot="{ item }">
        <HulaRoomListItem
          :item="item"
          :classes="getItemClasses(item)"
          :menu="visibleMenu(item)"
          :special-menu="visibleSpecialMenu(item)"
          :batch-mode="batchMode"
          :batch-selected="resolvedBatchIds.has(item.roomId)"
          @click="onMsgClick(item)"
          @dblclick="onMsgDblclick(item)"
          @select="(e: any) => handleSelect(item as SessionItem, e)"
          @accept-invite="onAcceptInvite?.($event)"
          @reject-invite="onRejectInvite?.($event)"
          @batch-toggle="handleBatchToggle"
          @menu-show="onMenuShow as unknown as () => void" />
      </RecycleScroller>
    </div>

    <n-flex v-else-if="sessionLoading" vertical :size="8" class="room-session-list__body relative h-full box-border">
      <div v-for="i in 5" :key="i" class="room-session-list__skeleton">
        <n-skeleton circle style="width: 44px; height: 44px" :sharp="false" />
        <n-flex vertical :size="4" class="flex-1 min-w-0">
          <n-flex align="center" justify="space-between">
            <n-skeleton height="14px" width="60%" :sharp="false" style="border-radius: 4px" />
            <n-skeleton height="10px" width="30px" :sharp="false" style="border-radius: 4px" />
          </n-flex>
          <n-skeleton height="12px" width="80%" :sharp="false" style="border-radius: 4px" />
        </n-flex>
      </div>
    </n-flex>

    <div v-else class="h-full flex-center text-[var(--text-xs)] color-[--hula-text-tertiary]" role="status">
      <n-empty :description="emptyDescription" size="large">
        <template #icon>
          <svg class="size-48px opacity-50 color-[--hula-text-quaternary]">
            <use href="#chat"></use>
          </svg>
        </template>
      </n-empty>
    </div>
  </n-scrollbar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RecycleScroller } from 'vue-virtual-scroller'
import HulaRoomListItem from '@/components/workbench/HulaRoomListItem.vue'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'

type SessionListItem = SessionItem & {
  lastMsg?: string
  lastMsgTime?: string
  isAtMe?: boolean
  highlightCount?: number
  notificationCount?: number
  isTombstoned?: boolean
  membership?: 'join' | 'leave' | 'invite' | 'ban'
}

const { t } = useI18n()
const globalStore = useGlobalStore()
const msgScrollbar = useTemplateRef<HTMLElement>('msg-scrollbar')
const props = defineProps<{
  sessionList: SessionListItem[]
  syncLoading: boolean
  sessionLoading: boolean
  networkBanner: { text: string; retryable?: boolean } | null
  emptyDescription: string
  getItemClasses: (item: SessionItem) => Record<string, boolean>
  visibleMenu: (item: SessionItem) => OPT.RightMenu[]
  visibleSpecialMenu: (item: SessionItem) => OPT.RightMenu[]
  onMsgClick: (item: SessionItem) => void | Promise<void>
  onMsgDblclick: (item: SessionItem) => void
  onMenuShow: (roomId: string, isShow: boolean) => void
  onRetryNetwork?: () => void | Promise<void>
  onAcceptInvite?: (item: SessionListItem) => void | Promise<void>
  onRejectInvite?: (item: SessionListItem) => void | Promise<void>
  batchMode?: boolean
  batchSelectedIds?: Set<string>
}>()

const emit = defineEmits<{
  batchToggle: [roomId: string]
  batchSelectAll: []
  batchClear: []
}>()

const resolvedBatchIds = computed(() => props.batchSelectedIds ?? new Set<string>())

const handleBatchToggle = (roomId: string) => {
  emit('batchToggle', roomId)
}
const showRetryAction = computed(() => Boolean(props.networkBanner?.retryable && props.onRetryNetwork))

const handleSelect = (item: SessionItem, menuItem: OPT.RightMenu<SessionItem>) => {
  menuItem.click?.(item)
}

const scrollToIndex = async (index: number) => {
  if (index < 0) return

  await nextTick()
  msgScrollbar.value?.scrollTo({
    top: index * (76 + 8) - 264,
    behavior: 'smooth'
  })
}

defineExpose({
  scrollToIndex
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/message';

.room-session-list__body {
  padding: 8px 8px 0;
}

.room-session-list__network-banner {
  margin: 8px 12px 0;
  border: 1px solid var(--hula-color-danger-500);
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 12px;
  background: var(--hula-color-danger-100);
  padding: 10px 12px;
  font-size: 12px;
  color: var(--hula-color-danger-500);
}

.room-session-list__skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  margin: 0 8px 4px;
  padding: 12px;
  border-radius: 12px;
}
</style>
