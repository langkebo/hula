<template>
  <div class="room-metadata-panel" data-testid="room-metadata-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.metadata.title') }}</span>
      </template>

      <n-spin :show="loading" size="small">
        <p class="panel-subtitle">{{ t('room.metadata.subtitle') }}</p>

        <div v-if="loadFailed" data-test="room-metadata-error">
          <ErrorState compact :title="t('common.load_failed')" :retry-text="t('common.retry')" @retry="loadMetadata" />
        </div>

        <template v-else-if="hasData">
          <n-descriptions bordered :column="1" label-placement="left" size="small">
            <n-descriptions-item
              v-for="(val, key) in metadata"
              :key="key"
              :label="t(`room.metadata.fields.${key}`, String(key))">
              {{ formatValue(key, val) }}
            </n-descriptions-item>
          </n-descriptions>
        </template>

        <n-empty v-else :description="t('room.metadata.empty')" size="small" />
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ErrorState from '@/components/common/ErrorState.vue'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const loading = ref(true)
const metadata = ref<Record<string, unknown>>({})
// 读取失败不能落成 {}：那会把「读不到元数据」渲染成「本群没有元数据」
const loadFailed = ref(false)

const hasData = computed(() => metadata.value && Object.keys(metadata.value).length > 0)

const TIMESTAMP_KEYS = new Set(['created_ts', 'updated_ts', 'origin_server_ts'])

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '-'
  if (TIMESTAMP_KEYS.has(key) && typeof val === 'number') {
    try {
      return new Date(val).toLocaleString()
    } catch {
      return String(val)
    }
  }
  return String(val)
}

async function loadMetadata() {
  loading.value = true
  loadFailed.value = false
  try {
    const result = await matrixRoomReadFacade.getRoomMetadata(props.roomId)
    metadata.value = { ...result }
  } catch {
    metadata.value = {}
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadMetadata)
</script>

<style scoped>
.room-metadata-panel {
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
</style>
