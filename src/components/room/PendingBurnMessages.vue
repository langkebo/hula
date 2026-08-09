<template>
  <div class="pending-burn-messages" data-testid="pending-burn-messages">
    <div class="pending-burn-messages__header">
      <span class="pending-burn-messages__title">{{ t('room.burn.pending_title') }}</span>
    </div>

    <n-spin :show="loading">
      <div v-if="pendingList.length === 0" data-testid="pending-empty" class="pending-burn-messages__empty">
        {{ t('room.burn.pending_empty') }}
      </div>
      <ul v-else class="pending-burn-messages__list">
        <li
          v-for="item in pendingList"
          :key="item.eventId"
          :data-testid="`pending-item-${item.eventId}`"
          class="pending-burn-messages__item">
          <div class="pending-burn-messages__info">
            <span class="pending-burn-messages__event-id">{{ shortenEventId(item.eventId) }}</span>
            <span class="pending-burn-messages__created">{{ formatTime(item.createdAt) }}</span>
            <span class="pending-burn-messages__remaining">{{ formatRemaining(item.deleteAt) }}</span>
          </div>
          <n-button
            size="tiny"
            type="warning"
            :data-testid="`pending-cancel-${item.eventId}`"
            @click="handleCancel(item.eventId)">
            {{ t('room.burn.cancel') }}
          </n-button>
        </li>
      </ul>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSpin } from 'naive-ui'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import type { BurnPendingEvent } from '@/services/matrix/messaging/MatrixBurnAfterReadService'

const props = defineProps<{ roomId: string }>()
const { t } = useI18n()
const burn = useBurnAfterRead()

const loading = ref(false)
const pendingList = ref<BurnPendingEvent[]>([])

async function loadList() {
  loading.value = true
  try {
    pendingList.value = await burn.getPendingBurns(props.roomId)
  } finally {
    loading.value = false
  }
}

async function handleCancel(eventId: string) {
  const ok = await burn.cancelBurn(props.roomId, eventId)
  if (ok) {
    pendingList.value = pendingList.value.filter((p) => p.eventId !== eventId)
  }
}

function shortenEventId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatRemaining(deleteAt: number): string {
  const remain = Math.max(0, deleteAt - Date.now())
  const seconds = Math.floor(remain / 1000)
  if (seconds < 60) return t('room.burn.remaining_seconds', { count: seconds })
  return t('room.burn.remaining_minutes', { count: Math.floor(seconds / 60) })
}

onMounted(loadList)
watch(() => props.roomId, loadList)
</script>

<style scoped>
.pending-burn-messages {
  padding: var(--tjg-space-2) var(--tjg-space-4);
}

.pending-burn-messages__header {
  margin-bottom: var(--tjg-space-2);
}

.pending-burn-messages__title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.pending-burn-messages__empty {
  padding: var(--tjg-space-4);
  text-align: center;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-quaternary);
}

.pending-burn-messages__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.pending-burn-messages__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-2);
  background: var(--tjg-surface-subtle);
  border-radius: var(--tjg-radius-sm);
}

.pending-burn-messages__info {
  display: flex;
  flex-direction: column;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-secondary);
}
</style>
