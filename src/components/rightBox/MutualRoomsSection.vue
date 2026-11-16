<template>
  <div v-if="visible" class="mutual-rooms-section management-section" data-testid="mutual-rooms-section">
    <div class="management-header">
      <span class="management-label">{{ t('friend.detail.mutual_rooms_section') }}</span>
    </div>

    <p v-if="loading" class="mutual-rooms-hint">{{ t('friend.detail.mutual_rooms_loading') }}</p>

    <template v-else>
      <p v-if="error" class="mutual-rooms-error" data-testid="mutual-rooms-error">
        <span>{{ error }}</span>
        <n-button text size="tiny" @click="retry">{{ t('friend.detail.mutual_rooms_retry') }}</n-button>
      </p>

      <EmptyState
        v-if="roomIds.length === 0 && !error"
        compact
        variant="subtle"
        data-testid="mutual-rooms-empty"
        :description="t('friend.detail.mutual_rooms_empty')" />

      <ul v-if="roomIds.length > 0" class="mutual-rooms-list">
        <li v-for="roomId in roomIds" :key="roomId">
          <button
            type="button"
            class="mutual-rooms-item"
            data-testid="mutual-rooms-item"
            @click="emit('open-room', roomId)">
            <n-avatar round :size="28" :src="AvatarUtils.getAvatarUrl(roomOf(roomId)?.avatarUrl || '')" />
            <span class="mutual-rooms-item__name">{{ roomName(roomId) }}</span>
          </button>
        </li>
      </ul>

      <n-button
        v-if="nextBatchToken && roomIds.length > 0"
        text
        size="tiny"
        :loading="loadingMore"
        data-testid="mutual-rooms-load-more"
        @click="loadPage(true)">
        {{ t('friend.detail.mutual_rooms_load_more') }}
      </n-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { matrixRelationshipService } from '@/services/matrix/user/MatrixRelationshipService'
import { useRoomStore } from '@/stores/domains/chat/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const PAGE_SIZE = 20

const logger = createLogger('MutualRoomsSection')
const { t } = useI18n()
const { isCapabilityAvailable } = useServerCapability()

// 延迟到真正渲染/加载时再取 store，避免能力不可用时（如未登录、无 Pinia 上下文）触发副作用。
let roomStore: ReturnType<typeof useRoomStore> | null = null
const getRoomStore = () => (roomStore ??= useRoomStore())

const props = defineProps<{
  userId: string
}>()

const emit = defineEmits<(e: 'open-room', roomId: string) => void>()

// 查询自己会返回 403，能力不可用或对方是自己时整块不渲染。
const visible = computed(
  () =>
    isCapabilityAvailable('mutual-rooms') && Boolean(props.userId) && props.userId !== matrixClientService.getUserId()
)

const roomIds = ref<string[]>([])
const nextBatchToken = ref<string | undefined>()
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

const roomOf = (roomId: string) => getRoomStore().rooms.get(roomId)

const roomName = (roomId: string) => roomOf(roomId)?.name || t('friend.detail.mutual_rooms_untitled')

const loadPage = async (append: boolean) => {
  if (!visible.value) return
  if (append && (!nextBatchToken.value || loadingMore.value)) return

  const token = append ? nextBatchToken.value : undefined
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }
  error.value = ''

  try {
    const result = await matrixRelationshipService.getMutualRooms(props.userId, PAGE_SIZE, token)
    if (append) {
      const existing = new Set(roomIds.value)
      roomIds.value = [...roomIds.value, ...result.roomIds.filter((roomId) => !existing.has(roomId))]
    } else {
      roomIds.value = result.roomIds
    }
    nextBatchToken.value = result.nextBatchToken
  } catch (err) {
    logger.error('Failed to load mutual rooms', err)
    error.value = t('friend.detail.mutual_rooms_load_error')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const retry = () => {
  void loadPage(roomIds.value.length > 0 && Boolean(nextBatchToken.value))
}

watch(
  [() => props.userId, visible],
  ([userId, canShow]) => {
    if (!userId) return
    roomIds.value = []
    nextBatchToken.value = undefined
    error.value = ''
    if (canShow) void loadPage(false)
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.management-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.management-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.management-label {
  font-size: 13px;
  color: var(--tjg-text-secondary);
  font-weight: 500;
}

.mutual-rooms-hint,
.mutual-rooms-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
}

.mutual-rooms-hint {
  color: var(--tjg-text-tertiary);
}

.mutual-rooms-error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tjg-color-danger-500);
}

.mutual-rooms-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mutual-rooms-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: var(--tjg-surface-input);
  color: var(--tjg-text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 1px;
  }
}

.mutual-rooms-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .mutual-rooms-item {
    transition: none;
  }
}
</style>
