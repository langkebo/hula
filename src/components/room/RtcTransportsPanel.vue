<template>
  <div class="rtc-transports-panel" data-testid="rtc-transports-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.rtc_transports.title') }}</span>
      </template>

      <n-spin :show="loading" size="small">
        <p class="panel-subtitle">{{ t('room.rtc_transports.subtitle') }}</p>

        <template v-if="transports.length > 0">
          <div class="transport-list">
            <div
              v-for="(item, idx) in transports"
              :key="`${item.transport}-${idx}`"
              class="rtc-transport-item"
              data-testid="rtc-transport-item">
              <div class="transport-row">
                <span class="transport-label">{{ t('room.rtc_transports.transport') }}:</span>
                <n-tag size="small" type="info">{{ item.transport }}</n-tag>
              </div>
              <div v-if="item.version" class="transport-row">
                <span class="transport-label">{{ t('room.rtc_transports.version') }}:</span>
                <span class="transport-value">{{ item.version }}</span>
              </div>
              <div v-if="item.description" class="transport-row">
                <span class="transport-label">{{ t('room.rtc_transports.description') }}:</span>
                <span class="transport-value">{{ item.description }}</span>
              </div>
            </div>
          </div>
        </template>

        <n-empty v-else :description="t('room.rtc_transports.empty')" size="small" />
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixVoiceService } from '@/services/matrix/media/MatrixVoiceService'

interface RtcTransport {
  transport: string
  version?: string
  description?: string
}

const { t } = useI18n()

const loading = ref(true)
const transportsData = ref<Record<string, unknown>>({})

const transports = computed<RtcTransport[]>(() => {
  const list = transportsData.value?.transports
  return Array.isArray(list) ? (list as RtcTransport[]) : []
})

async function loadTransports() {
  loading.value = true
  try {
    transportsData.value = await matrixVoiceService.getRtcTransports()
  } catch {
    transportsData.value = {}
  } finally {
    loading.value = false
  }
}

onMounted(loadTransports)
</script>

<style scoped>
.rtc-transports-panel {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
}

.panel-subtitle {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  line-height: 1.5;
}

.transport-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rtc-transport-item {
  padding: 8px 12px;
  background: var(--tjg-surface-search);
  border-radius: 6px;
  font-size: 12px;
}

.transport-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.transport-row:last-child {
  margin-bottom: 0;
}

.transport-label {
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.transport-value {
  color: var(--tjg-text-primary);
  word-break: break-word;
}
</style>
