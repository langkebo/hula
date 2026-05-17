<template>
  <div class="workbench-history-pane">
    <div class="workbench-history-pane__header">
      <span class="text-13px font-600">{{ t('chatHistory.title') }}</span>
      <button type="button" class="workbench-history-pane__close" @click="emit('close')">
        {{ t('common.close') }}
      </button>
    </div>

    <div class="workbench-history-pane__search">
      <n-input
        v-model:value="searchKeyword"
        size="small"
        :placeholder="t('chatHistory.search.placeholder')"
        clearable
        @input="handleSearch">
        <template #prefix>
          <svg class="size-14px color-[--hula-text-tertiary]"><use href="#search" /></svg>
        </template>
      </n-input>
    </div>

    <div class="workbench-history-pane__tabs">
      <n-tabs v-model:value="activeTab" type="segment" size="small" @update:value="resetAndReload">
        <n-tab-pane name="all" :tab="t('chatHistory.tabs.all')" />
        <n-tab-pane name="image" :tab="t('chatHistory.tabs.imageVideo')" />
        <n-tab-pane name="file" :tab="t('chatHistory.tabs.file')" />
      </n-tabs>
    </div>

    <div class="workbench-history-pane__date">
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

    <div class="workbench-history-pane__content">
      <n-infinite-scroll :distance="10" @load="loadMore">
        <div v-if="messages.length === 0 && !loading" class="workbench-history-pane__empty">
          <n-empty size="small" :description="t('chatHistory.empty.noData')" />
        </div>

        <div v-else class="workbench-history-pane__list">
          <div v-for="(group, date) in groupedMessages" :key="date">
            <div class="workbench-history-pane__date-label">
              <n-tag :bordered="false" type="warning" size="small" class="rounded-8px">
                {{ formatDateGroupLabel(group.timestamp) }}
              </n-tag>
            </div>

            <div v-for="item in group.messages" :key="item.message.id" class="workbench-history-pane__item">
              <div class="flex items-start">
                <n-avatar
                  round
                  :size="24"
                  :src="AvatarUtils.getAvatarUrl(item.fromUser.avatar)"
                  class="mr-8px flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-2px">
                    <span class="text-11px color-[--hula-text-tertiary] truncate">
                      {{ getUserDisplayName(item.fromUser.uid, item.fromUser.username) }}
                    </span>
                    <span class="text-10px color-[--hula-text-quaternary] flex-shrink-0">
                      {{ formatTimestamp(item.message.sendTime ?? 0) }}
                    </span>
                  </div>
                  <div class="workbench-history-pane__body">
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
        <div v-if="loading" class="workbench-history-pane__loading">
          <n-spin size="small" />
        </div>
      </n-infinite-scroll>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RenderMessage from '@/components/rightBox/renderMessage/index.vue'
import { MsgEnum, TauriCommand } from '@/enums'
import { useImageViewer } from '@/hooks/useImageViewer'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import { useChatStore } from '@/stores/domains/chat/chat'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatDateGroupLabel, formatTimestamp } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'

const logger = createLogger('WorkbenchHistoryPane')

const props = defineProps<{
  roomId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const chatStore = useChatStore()
const groupStore = useGroupStore()
const { openImageViewer } = useImageViewer()
const { openVideoViewer } = useVideoViewer()

const isGroup = computed(() => chatStore.currentSessionInfo?.type === 2)
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
  () => props.roomId,
  (newRoomId) => {
    if (newRoomId) {
      resetAndReload()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.workbench-history-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.workbench-history-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.workbench-history-pane__close {
  border: 0;
  background: transparent;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }
}

.workbench-history-pane__search {
  margin-bottom: 8px;
}

.workbench-history-pane__tabs {
  margin-bottom: 8px;

  :deep(.n-tabs) {
    .n-tabs-tab {
      font-size: 11px;
    }
  }
}

.workbench-history-pane__date {
  margin-bottom: 12px;
}

.workbench-history-pane__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.workbench-history-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.workbench-history-pane__list {
  padding: 0 2px;
}

.workbench-history-pane__date-label {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 6px 0;
}

.workbench-history-pane__item {
  margin-bottom: 12px;
}

.workbench-history-pane__body {
  background: var(--hula-surface-panel-muted);
  padding: 6px 10px;
  border-radius: 10px;
  max-width: 100%;
  border: 1px solid var(--hula-border-default);
  transition: background-color 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--hula-color-primary-500) 5%, var(--hula-surface-panel-muted));
  }
}

.workbench-history-pane__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}
</style>
