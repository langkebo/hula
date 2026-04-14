<template>
  <Transition name="slide-down">
    <div v-if="visible && pinnedEvents.length > 0" class="pinned-events-bar">
      <div class="pinned-header">
        <div class="header-left">
          <Icon icon="mdi:pin" :width="16" class="pin-icon" />
          <span class="pin-count">{{ pinnedEvents.length }}</span>
          <span class="pin-label">{{ t('pinned.messages') }}</span>
        </div>
        <div class="header-actions">
          <n-button quaternary size="tiny" @click="showList = !showList">
            <template #icon>
              <Icon :icon="showList ? 'mdi:chevron-up' : 'mdi:chevron-down'" :width="16" />
            </template>
          </n-button>
          <n-button quaternary size="tiny" @click="handleClose">
            <template #icon>
              <Icon icon="mdi:close" :width="16" />
            </template>
          </n-button>
        </div>
      </div>

      <Transition name="expand">
        <div v-if="showList" class="pinned-list">
          <n-scrollbar style="max-height: 200px">
            <div
              v-for="event in pinnedEvents"
              :key="event.event_id"
              class="pinned-item"
              @click="handleJumpToMessage(event)">
              <div class="item-header">
                <n-avatar :size="20" round :src="getAvatarUrl(event.sender)" />
                <span class="sender-name">{{ getDisplayName(event.sender) }}</span>
                <span class="message-time">{{ formatTime(event.origin_server_ts) }}</span>
              </div>
              <div class="item-content">
                {{ getContentPreview(event) }}
              </div>
              <n-button
                quaternary
                size="tiny"
                class="unpin-btn"
                @click.stop="handleUnpin(event)">
                <template #icon>
                  <Icon icon="mdi:pin-off" :width="14" />
                </template>
              </n-button>
            </div>
          </n-scrollbar>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import matrixPinnedEventsService, { type PinnedEvent } from '@/services/matrix/MatrixPinnedEventsService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PinnedEventsBar')
const { t } = useI18n()
const userStore = useUserStore()

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<(e: 'jumpToMessage', eventId: string) => void>()

const visible = defineModel<boolean>('show', { default: true })

const pinnedEvents = ref<PinnedEvent[]>([])
const showList = ref(false)
const loading = ref(false)

const getAvatarUrl = (userId: string): string | undefined => {
  const user = userStore.getUserById(userId)
  return AvatarUtils.getAvatarUrl(user?.avatarUrl)
}

const getDisplayName = (userId: string): string => {
  const user = userStore.getUserById(userId)
  return user?.displayName || user?.name || userId.split(':')[0].substring(1)
}

const formatTime = (timestamp: number): string => {
  return dayjs(timestamp).format('MM-DD HH:mm')
}

const getContentPreview = (event: PinnedEvent): string => {
  const content = event.content
  if (content.msgtype === 'm.text' || content.body) {
    const body = content.body || content.text || ''
    return body.length > 50 ? body.substring(0, 50) + '...' : body
  }
  if (content.msgtype === 'm.image') {
    return '[图片]'
  }
  if (content.msgtype === 'm.video') {
    return '[视频]'
  }
  if (content.msgtype === 'm.audio') {
    return '[语音]'
  }
  if (content.msgtype === 'm.file') {
    return '[文件]'
  }
  return '[消息]'
}

const loadPinnedEvents = async () => {
  if (!props.roomId) return

  loading.value = true
  try {
    const events = await matrixPinnedEventsService.getPinnedEvents(props.roomId)
    pinnedEvents.value = events
  } catch (err) {
    logger.error('加载置顶消息失败:', err)
    pinnedEvents.value = []
  } finally {
    loading.value = false
  }
}

const handleJumpToMessage = (event: PinnedEvent) => {
  emit('jumpToMessage', event.event_id)
  showList.value = false
}

const handleUnpin = async (event: PinnedEvent) => {
  if (!props.roomId) return

  try {
    const success = await matrixPinnedEventsService.unpinEvent(props.roomId, event.event_id)
    if (success) {
      pinnedEvents.value = pinnedEvents.value.filter((e) => e.event_id !== event.event_id)
      window.$message?.success(t('pinned.unpin_success'))
    }
  } catch (err) {
    logger.error('取消置顶失败:', err)
    window.$message?.error(t('pinned.unpin_failed'))
  }
}

const handleClose = () => {
  visible.value = false
}

watch(
  () => props.roomId,
  (val) => {
    if (val) {
      loadPinnedEvents()
    } else {
      pinnedEvents.value = []
    }
  },
  { immediate: true }
)

defineExpose({
  refresh: loadPinnedEvents
})
</script>

<style scoped lang="scss">
.pinned-events-bar {
  background: var(--bg-color-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 8px 12px;
}

.pinned-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pin-icon {
  color: var(--primary-color);
}

.pin-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
  background: var(--primary-color-suppl);
  padding: 2px 6px;
  border-radius: 10px;
}

.pin-label {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.pinned-list {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.pinned-item {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: var(--bg-color);
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;

  &:hover {
    background: var(--bg-color-hover);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.sender-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color);
}

.message-time {
  font-size: 11px;
  color: var(--text-color-3);
  margin-left: auto;
}

.item-content {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.4;
  padding-right: 24px;
}

.unpin-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s;
}

.pinned-item:hover .unpin-btn {
  opacity: 1;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 220px;
}
</style>
