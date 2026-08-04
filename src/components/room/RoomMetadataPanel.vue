<template>
  <div class="room-metadata-panel" data-testid="room-metadata-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.metadata.title') }}</span>
      </template>

      <n-spin :show="loading" size="small">
        <p class="panel-subtitle">{{ t('room.metadata.subtitle') }}</p>

        <template v-if="hasData">
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
import { matrixRoomMetadataService } from '@/services/matrix/room/MetadataService'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const loading = ref(true)
const metadata = ref<Record<string, unknown>>({})

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

onMounted(async () => {
  loading.value = true
  try {
    const result = await matrixRoomMetadataService.getRoomMetadata(props.roomId)
    metadata.value = (result as Record<string, unknown>) ?? {}
  } catch {
    metadata.value = {}
  } finally {
    loading.value = false
  }
})
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
