<template>
  <n-scrollbar ref="msg-scrollbar" class="h-full" style="max-height: calc(100vh / var(--page-scale, 1) - 70px)">
    <div v-if="syncLoading" class="flex-center gap-10px py-12px text-(12px [--hula-text-primary])">
      <n-spin :size="14" />
      <span>{{ t('message.message_list.sync_loading') }}</span>
    </div>

    <div
      v-if="networkBanner && !syncLoading && !globalStore.currentSessionRoomId"
      class="mx-10px mt-6px border-(1px solid [--hula-color-danger-500]) flex items-center gap-8px rounded-6px bg-[--hula-color-danger-100] px-12px py-10px text-(12px [--hula-color-danger-500])"
      style="position: sticky; top: 6px; z-index: 999">
      <svg class="size-16px flex-shrink-0">
        <use href="#cloudError"></use>
      </svg>
      <span class="leading-tight">{{ networkBanner.text }}</span>
      <button
        v-if="showRetryAction"
        type="button"
        class="ml-auto rounded-full border border-[--hula-color-danger-500] bg-transparent px-10px py-2px text-12px leading-tight color-[--hula-color-danger-500] transition-opacity hover:opacity-80"
        data-test="network-retry"
        @click="onRetryNetwork">
        {{ t('common.retry') }}
      </button>
    </div>

    <div v-if="sessionList.length > 0" class="p-[4px_10px_0px_8px] h-full">
      <RecycleScroller
        class="scroller h-full"
        :items="sessionList"
        :item-size="80"
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

    <n-flex
      v-else-if="sessionLoading"
      vertical
      :size="18"
      style="max-height: calc(100vh / var(--page-scale, 1) - 70px)"
      class="relative h-100vh box-border p-20px">
      <n-flex>
        <n-skeleton style="border-radius: 14px" height="60px" width="100%" :sharp="false" />
      </n-flex>

      <n-flex>
        <n-skeleton style="border-radius: 14px" height="40px" width="80%" :sharp="false" />
      </n-flex>

      <n-flex justify="end">
        <n-skeleton style="border-radius: 14px" height="40px" width="80%" :sharp="false" />
      </n-flex>

      <n-flex>
        <n-skeleton style="border-radius: 14px" height="60px" width="100%" :sharp="false" />
      </n-flex>
    </n-flex>

    <n-result v-else class="absolute-center" status="418" :description="emptyDescription" />
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
    top: index * (75 + 5) - 264,
    behavior: 'smooth'
  })
}

defineExpose({
  scrollToIndex
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/message';
</style>
