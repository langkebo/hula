<template>
  <n-drawer
    v-model:show="visible"
    :width="compact ? '100%' : 450"
    placement="right"
    :trap-focus="false"
    :block-scroll="false">
    <n-drawer-content :title="t('chatHistory.title')" closable :native-scrollbar="false">
      <div class="chat-history-drawer-content flex flex-col h-full">
        <!-- 搜索栏 -->
        <div class="search-section pb-12px select-none">
          <n-input
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            v-model:value="searchKeyword"
            size="small"
            :placeholder="t('chatHistory.search.placeholder')"
            clearable
            @input="handleSearch">
            <template #prefix>
              <svg class="w-14px h-14px color-[--tjg-text-tertiary]"><use href="#search"></use></svg>
            </template>
          </n-input>
        </div>

        <!-- Tab 选项卡 -->
        <div class="tab-section mb-12px select-none">
          <n-tabs v-model:value="activeTab" type="segment" size="small" @update:value="resetAndReload">
            <n-tab-pane name="all" :tab="t('chatHistory.tabs.all')" />
            <n-tab-pane name="image" :tab="t('chatHistory.tabs.imageVideo')" />
            <n-tab-pane name="file" :tab="t('chatHistory.tabs.file')" />
          </n-tabs>
        </div>

        <!-- 日期选择 -->
        <div class="date-section mb-16px select-none">
          <n-date-picker
            v-model:value="dateRange"
            type="daterange"
            :placeholder="t('chatHistory.datePicker.placeholder')"
            clearable
            size="small"
            @update:value="handleDateChange"
            format="yyyy-MM-dd"
            value-format="timestamp" />
        </div>

        <!-- 消息列表 -->
        <div class="flex-1 overflow-auto">
          <n-infinite-scroll :distance="10" @load="loadMore">
            <div v-if="messages.length === 0 && !loading" class="flex-center h-200px">
              <n-empty :description="t('chatHistory.empty.noData')" />
            </div>

            <div v-else class="history-list">
              <div v-for="(group, date) in groupedMessages" :key="date">
                <div class="sticky top-0 z-10 py-8px bg-[--tjg-surface-panel]">
                  <n-tag :bordered="false" type="warning" size="small" class="rounded-8px">
                    {{ formatDateGroupLabel(group.timestamp) }}
                  </n-tag>
                </div>

                <div v-for="item in group.messages" :key="item.message.id" class="history-item mb-16px">
                  <div class="flex items-start">
                    <n-avatar
                      round
                      :size="32"
                      :src="AvatarUtils.getAvatarUrl(item.fromUser.avatar)"
                      class="mr-10px flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between mb-4px">
                        <span class="text-12px color-[--tjg-text-tertiary] truncate">
                          {{ getUserDisplayName(item.fromUser.uid, item.fromUser.username) }}
                        </span>
                        <span class="text-11px color-[--tjg-text-quaternary] flex-shrink-0">
                          {{ formatTimestamp(item.message.sendTime ?? 0) }}
                        </span>
                      </div>
                      <div class="history-message-body">
                        <RenderMessage
                          :message="item"
                          :from-user="item.fromUser"
                          :is-group="isGroup"
                          :on-image-click="handleImageClick"
                          :on-video-click="handleVideoClick"
                          :search-keyword="searchKeyword"
                          :history-mode="true" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="loading" class="flex-center py-10px">
              <n-spin size="small" />
            </div>
          </n-infinite-scroll>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RenderMessage from '@/components/rightBox/renderMessage/index.vue'
import { useImageViewer } from '@/composables/common/useImageViewer'
import { useVideoViewer } from '@/composables/common/useVideoViewer'
import { MsgEnum, TauriCommand } from '@/enums'
import { useChatStore } from '@/stores/domains/chat/chat'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatDateGroupLabel, formatTimestamp } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'

const logger = createLogger('ChatHistoryDrawer')

const props = defineProps<{
  show: boolean
  roomId: string
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const chatStore = useChatStore()
const groupStore = useGroupStore()
const { openImageViewer } = useImageViewer()
const { openVideoViewer } = useVideoViewer()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const isGroup = computed(() => chatStore.currentSessionInfo?.type === 2) // RoomTypeEnum.GROUP
const messages = ref<MessageType[]>([])
const loading = ref(false)
const hasMore = ref(true)
const currentPage = ref(1)
const searchKeyword = ref('')
const activeTab = ref<'all' | 'image' | 'file'>('all')
const dateRange = ref<[number, number] | null>(null)

const groupedMessages = computed(() => {
  const groups: Record<string, { messages: MessageType[]; timestamp: number }> = {}
  messages.value.forEach((i) => {
    if (
      i.message.sendTime &&
      i.message.type !== MsgEnum.BOT &&
      i.message.type !== MsgEnum.SYSTEM &&
      i.message.type !== MsgEnum.RECALL
    ) {
      const date = new Date(i.message.sendTime).toDateString()
      if (!groups[date]) {
        groups[date] = { messages: [], timestamp: i.message.sendTime }
      }
      groups[date].messages.push(i)
    }
  })
  return groups
})

const resetAndReload = () => {
  messages.value = []
  currentPage.value = 1
  hasMore.value = true
  loadMore()
}

const handleSearch = useDebounceFn(() => resetAndReload(), 300)
const handleDateChange = useDebounceFn(() => resetAndReload(), 300)

const loadMore = async () => {
  if (loading.value || !hasMore.value || !props.roomId) return

  loading.value = true
  try {
    const res = await invokeWithResult<{ messages: MessageType[]; hasMore: boolean }>(TauriCommand.QUERY_CHAT_HISTORY, {
      roomId: props.roomId,
      page: currentPage.value,
      pageSize: 30,
      keyword: searchKeyword.value,
      msgType:
        activeTab.value === 'all'
          ? undefined
          : activeTab.value === 'image'
            ? [MsgEnum.IMAGE, MsgEnum.VIDEO]
            : [MsgEnum.FILE],
      startTime: dateRange.value ? dateRange.value[0] : undefined,
      endTime: dateRange.value ? dateRange.value[1] : undefined
    })

    if (res.isOk() && res.value?.messages) {
      messages.value.push(...res.value.messages)
      hasMore.value = res.value.hasMore
      currentPage.value++
    } else {
      hasMore.value = false
    }
  } catch (error) {
    logger.error('Failed to load chat history:', error)
  } finally {
    loading.value = false
  }
}

const handleImageClick = (url: string) => {
  const imageUrls = messages.value.filter((m) => m.message.type === MsgEnum.IMAGE).map((m) => m.message.body.url!)
  openImageViewer(url, [MsgEnum.IMAGE, MsgEnum.VIDEO], imageUrls)
}

const handleVideoClick = (url: string) => {
  const videoUrls = messages.value.filter((m) => m.message.type === MsgEnum.VIDEO).map((m) => m.message.body.url!)
  openVideoViewer(url, [MsgEnum.VIDEO], videoUrls)
}

const getUserDisplayName = (uid: string, fallbackName?: string) => {
  const user = groupStore.getUserInfo(uid)
  return user?.myName || user?.name || fallbackName || uid
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) resetAndReload()
  }
)
</script>

<style scoped lang="scss">
.chat-history-drawer-content {
  background: var(--tjg-surface-panel);
}

.history-list {
  padding: 0 4px;
}

.history-item {
  transition: transform 0.2s ease;

  &:hover {
    .history-message-body {
      background: color-mix(in srgb, var(--tjg-color-indigo-500) 5%, var(--tjg-surface-panel-muted));
    }
  }
}

.history-message-body {
  background: var(--tjg-surface-panel-muted);
  padding: 8px 12px;
  border-radius: 12px;
  max-width: 100%;
  border: 1px solid var(--tjg-border-default);
  transition: background-color 0.2s ease;
}

:deep(.n-tabs) {
  .n-tabs-tab {
    font-size: 12px;
  }
}

:deep(.rounded-8px) {
  border-radius: 12px !important;
}
</style>
