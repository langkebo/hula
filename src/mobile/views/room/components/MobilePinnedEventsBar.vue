<template>
  <Transition name="slide-down">
    <div v-if="visible && pinnedEvents.length > 0" class="mobile-pinned-bar">
      <div class="pinned-header">
        <div class="header-left">
          <Icon icon="mdi:pin" :width="14" color="#fa8c16" />
          <span class="pin-count">{{ pinnedEvents.length }}</span>
          <span class="pin-label">{{ t('pinned.messages') }}</span>
        </div>
        <div class="header-actions">
          <van-icon name="arrow-down" size="16" @click="showList = !showList" />
          <van-icon name="cross" size="16" @click="handleClose" />
        </div>
      </div>

      <Transition name="van-slide-down">
        <div v-if="showList" class="pinned-list">
          <van-loading v-if="loading" size="20px" class="loading-container" />
          <template v-else>
            <div
              v-for="event in pinnedEvents"
              :key="event.event_id"
              class="pinned-item"
              @click="handleJumpToMessage(event)">
              <div class="item-header">
                <van-avatar round size="18" class="mr-8px">
                  {{ getDisplayName(event.sender).charAt(0).toUpperCase() }}
                </van-avatar>
                <span class="sender-name">{{ getDisplayName(event.sender) }}</span>
                <span class="message-time">{{ formatTime(event.origin_server_ts) }}</span>
              </div>
              <div class="item-content">
                {{ getContentPreview(event) }}
              </div>
              <van-icon
                name="close"
                size="14"
                class="unpin-icon"
                @click.stop="handleUnpin(event)" />
            </div>
          </template>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import matrixPinnedEventsService, { type PinnedEvent } from '@/services/matrix/MatrixPinnedEventsService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobilePinnedEventsBar')
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
  if (content.msgtype === 'm.image') return '[图片]'
  if (content.msgtype === 'm.video') return '[视频]'
  if (content.msgtype === 'm.audio') return '[语音]'
  if (content.msgtype === 'm.file') return '[文件]'
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
      showToast(t('pinned.unpin_success'))
    }
  } catch (err) {
    logger.error('取消置顶失败:', err)
    showToast(t('pinned.unpin_failed'))
  }
}

const handleClose = () => {
  visible.value = false
}

watch(
  () => props.roomId,
  (val) => {
    if (val) loadPinnedEvents()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.mobile-pinned-bar {
  background: var(--van-background-2, #f7f8fa);
  border-bottom: 1px solid var(--van-border-color, #ebedf0);
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
  gap: 4px;
}

.pin-count {
  font-size: 14px;
  font-weight: 500;
  color: #fa8c16;
}

.pin-label {
  font-size: 12px;
  color: #909090;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909090;
}

.pinned-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.pinned-item {
  position: relative;
  padding: 8px;
  background: var(--van-background, #fff);
  border-radius: 8px;
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
}

.item-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.sender-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--van-text-color, #323233);
}

.message-time {
  font-size: 10px;
  color: #909090;
  margin-left: 8px;
}

.item-content {
  font-size: 13px;
  color: var(--van-text-color-2, #969799);
  line-height: 1.4;
  padding-right: 20px;
}

.unpin-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  color: #909090;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
