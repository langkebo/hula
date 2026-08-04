<template>
  <van-popup
    :show="visible"
    position="bottom"
    round
    closeable
    close-on-click-overlay
    teleport="body"
    :style="{ maxHeight: '75vh' }"
    @update:show="handleUpdateShow"
    @close="handleClose">
    <div class="mobile-forward-dialog">
      <!-- 顶部标题 -->
      <div class="mobile-forward-dialog__header">
        <span class="mobile-forward-dialog__title">{{ t('message.forward.title') }}</span>
      </div>

      <!-- 源消息预览 -->
      <div class="mobile-forward-dialog__preview">
        <div v-if="loadingEvent" class="mobile-forward-dialog__loading">
          <van-loading size="16px" />
        </div>
        <template v-else-if="sourcePreview">
          <span class="mobile-forward-dialog__preview-label">{{ t('message_container.long_press.forward') }}:</span>
          <span class="mobile-forward-dialog__preview-text">{{ sourcePreview }}</span>
        </template>
      </div>

      <!-- 搜索框 -->
      <van-search v-model="searchQuery" :placeholder="t('message.forward.search_placeholder')" shape="round" />

      <!-- 房间列表 -->
      <div class="mobile-forward-dialog__list">
        <div v-if="filteredRooms.length === 0" class="mobile-forward-dialog__empty">
          {{ t('message.forward.no_rooms') }}
        </div>
        <SmartVirtualList
          v-else
          class="h-full overflow-y-auto"
          :items="filteredRooms"
          :item-height="56"
          :buffer="6"
          key-field="roomId">
          <template #default="{ item: room }">
            <van-cell
              clickable
              data-test="forward-room-item"
              :data-room-id="room.roomId"
              @click="handleToggleRoom(room.roomId)">
              <template #icon>
                <van-checkbox
                  :model-value="flow.isRoomSelected(room.roomId)"
                  shape="round"
                  class="mobile-forward-dialog__checkbox" />
              </template>
              <template #title>
                <div class="mobile-forward-dialog__room-info">
                  <van-image round width="36" height="36" :src="room.avatar || defaultAvatar" fit="cover" />
                  <span class="mobile-forward-dialog__room-name">{{ room.name }}</span>
                </div>
              </template>
            </van-cell>
          </template>
        </SmartVirtualList>
      </div>

      <!-- 底部操作栏 -->
      <div class="mobile-forward-dialog__footer">
        <span class="mobile-forward-dialog__count" data-test="forward-selected-count">
          {{ t('message.forward.selected_count', { count: flow.targetRoomIds.value.length }) }}
        </span>
        <van-button
          type="primary"
          size="small"
          :disabled="flow.targetRoomIds.value.length === 0 || flow.forwarding.value"
          :loading="flow.forwarding.value"
          data-test="forward-submit-btn"
          @click="handleSubmit">
          {{ t('message.forward.send') }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessageForward } from '@/composables/messaging/useMessageForward'
import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { createLogger } from '@/utils/Logger'

defineOptions({ name: 'MobileForwardDialog' })

const logger = createLogger('MobileForwardDialog')

const props = defineProps<{
  visible: boolean
  /** 源消息 eventId */
  eventId: string
  /** 源消息所在 roomId */
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'forwarded', roomIds: string[]): void
}>()

const { t } = useI18n()

// 默认头像
const defaultAvatar = '/logoD.png'

// 通过服务返回类型推断源消息事件类型,避免组件直接依赖 matrix-js-sdk
type SourceEvent = NonNullable<Awaited<ReturnType<typeof matrixMessageService.getRoomMessage>>>

// 使用转发 composable,初始 sourceEvent 为 null,后续异步加载注入
const flow = useMessageForward({ sourceEvent: null })

// 源消息事件加载状态
const loadingEvent = ref(false)
// 源消息事件引用
const sourceEvent = ref<SourceEvent | null>(null)
// 搜索关键字
const searchQuery = ref('')

/**
 * 源消息预览文本
 * - 文本消息: 显示 body 内容(截断)
 * - 其他类型: 显示占位文本
 */
const sourcePreview = computed<string>(() => {
  const event = sourceEvent.value
  if (!event) return ''
  const content = event.getContent() as { body?: string; msgtype?: string }
  if (content?.body) {
    const body = String(content.body)
    return body.length > 60 ? `${body.slice(0, 60)}...` : body
  }
  return t('message.multi_choose.non_text_message')
})

/**
 * 根据搜索关键字过滤房间列表
 */
const filteredRooms = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return flow.recentRooms.value
  return flow.recentRooms.value.filter((room) => room.name.toLowerCase().includes(query))
})

/**
 * 加载源消息事件
 */
const loadSourceEvent = async (): Promise<void> => {
  if (!props.roomId || !props.eventId) {
    sourceEvent.value = null
    flow.setSourceEvent(null)
    return
  }

  loadingEvent.value = true
  try {
    const event = await matrixMessageService.getRoomMessage(props.roomId, props.eventId)
    sourceEvent.value = event
    flow.setSourceEvent(event)
  } catch (err) {
    logger.error('加载源消息事件失败:', err)
    sourceEvent.value = null
    flow.setSourceEvent(null)
  } finally {
    loadingEvent.value = false
  }
}

/**
 * 切换房间选中状态
 */
const handleToggleRoom = (roomId: string): void => {
  flow.toggleRoom(roomId)
}

/**
 * 提交转发
 */
const handleSubmit = async (): Promise<void> => {
  const selectedRoomIds = [...flow.targetRoomIds.value]
  if (selectedRoomIds.length === 0) return

  const successCount = await flow.forward()
  if (successCount > 0) {
    emit('forwarded', selectedRoomIds)
    emit('update:visible', false)
  }
}

/**
 * 关闭弹窗时重置状态
 */
const handleClose = (): void => {
  emit('update:visible', false)
}

const handleUpdateShow = (value: boolean): void => {
  emit('update:visible', value)
}

// 监听 visible 和 eventId 变化,打开时加载源消息并重置选择
watch(
  () => [props.visible, props.eventId, props.roomId] as const,
  ([visible, eventId, roomId]) => {
    if (visible && eventId && roomId) {
      void loadSourceEvent()
      flow.reset()
      searchQuery.value = ''
    } else if (!visible) {
      flow.reset()
      searchQuery.value = ''
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.mobile-forward-dialog {
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  background: var(--tjg-surface-panel);

  &__header {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 48px;
    border-bottom: 1px solid var(--tjg-border-default);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--tjg-text-primary);
  }

  &__preview {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--tjg-surface-panel-muted);
    font-size: 13px;
    color: var(--tjg-text-secondary);
    min-height: 40px;
  }

  &__preview-label {
    flex-shrink: 0;
    color: var(--tjg-text-tertiary);
  }

  &__preview-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  &__list {
    flex: 1;
    min-height: 200px;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    font-size: 14px;
    color: var(--tjg-text-tertiary);
  }

  &__checkbox {
    margin-right: 12px;
  }

  &__room-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__room-name {
    font-size: 14px;
    color: var(--tjg-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--tjg-border-default);
  }

  &__count {
    font-size: 13px;
    color: var(--tjg-text-secondary);
  }
}
</style>
