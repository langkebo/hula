<template>
  <div class="room-key-requests-section">
    <div class="section-header">
      <h3 class="section-title">{{ t('setting.encryption.room_key_requests_section') }}</h3>
      <n-button size="small" :loading="loading" data-testid="room-key-requests-refresh" @click="loadRequests">
        {{ t('setting.encryption.room_key_requests_refresh') }}
      </n-button>
    </div>
    <div class="section-desc">{{ t('setting.encryption.room_key_requests_desc') }}</div>

    <div v-if="requests.length > 0" class="request-list">
      <div
        v-for="request in requests"
        :key="request.requestId"
        class="request-item"
        data-testid="room-key-request"
        :data-request-id="request.requestId">
        <div class="request-info">
          <div class="request-room">{{ request.roomId || request.requestId }}</div>
          <div class="request-meta">{{ request.senderKey || request.deviceId || request.algorithm }}</div>
        </div>
        <n-button
          size="small"
          type="primary"
          :loading="fulfillingId === request.requestId"
          data-testid="room-key-request-fulfill"
          @click="handleFulfill(request)">
          {{ t('setting.encryption.room_key_requests_fulfill') }}
        </n-button>
      </div>
    </div>
    <div v-else-if="!loading" class="request-empty" data-testid="room-key-requests-empty">
      {{ t('setting.encryption.room_key_requests_empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'

defineOptions({
  name: 'RoomKeyRequestsSection'
})

interface RoomKeyRequestItem {
  requestId: string
  roomId: string
  senderKey: string
  deviceId: string
  algorithm: string
}

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const requests = ref<RoomKeyRequestItem[]>([])
const fulfillingId = ref<string | null>(null)

onMounted(() => {
  void loadRequests()
})

/**
 * 拉取待处理密钥请求。
 *
 * SDK 没有对应的 CryptoEvent，只能在进入设置页时主动轮询一次（R1：能力已在
 * `MatrixDeviceService.getRoomKeyRequests`，此处不重复实现请求逻辑）。
 */
async function loadRequests() {
  if (loading.value) return
  loading.value = true
  try {
    const raw = await matrixDeviceService.getRoomKeyRequests()
    requests.value = raw.map(toRequestItem).filter((item): item is RoomKeyRequestItem => item !== null)
  } finally {
    loading.value = false
  }
}

function toRequestItem(raw: Record<string, unknown>): RoomKeyRequestItem | null {
  const requestId = typeof raw.request_id === 'string' ? raw.request_id : ''
  if (!requestId) return null
  // listRoomKeyRequests() 不传 status 时后端会把 fulfilled / cancelled 一并返回，
  // 只保留待处理项，避免兑现后刷新又“复活”。
  if (typeof raw.status === 'string' && raw.status !== 'pending') return null
  return {
    requestId,
    roomId: typeof raw.room_id === 'string' ? raw.room_id : '',
    senderKey: typeof raw.sender_key === 'string' ? raw.sender_key : '',
    deviceId: typeof raw.device_id === 'string' ? raw.device_id : '',
    algorithm: typeof raw.algorithm === 'string' ? raw.algorithm : ''
  }
}

/** 兑现成功后立即把条目移出列表，避免用户重复点击已完成的请求 */
async function handleFulfill(request: RoomKeyRequestItem) {
  if (fulfillingId.value) return
  fulfillingId.value = request.requestId
  try {
    const ok = await matrixDeviceService.fulfillRoomKeyRequest(request.requestId)
    if (!ok) {
      showFeedback(t('setting.encryption.room_key_requests_failed'), 'error')
      return
    }
    requests.value = requests.value.filter((item) => item.requestId !== request.requestId)
    showFeedback(t('setting.encryption.room_key_requests_fulfilled'), 'success')
  } finally {
    fulfillingId.value = null
  }
}
</script>

<style scoped>
.room-key-requests-section {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
}

.section-title {
  margin: 0;
  font-size: var(--tjg-font-size-lg);
  font-weight: 600;
  color: var(--tjg-text-primary);
}

.section-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-2) var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1);
  min-width: 0;
}

.request-room {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.request-meta {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  word-break: break-all;
}

.request-empty {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}
</style>
