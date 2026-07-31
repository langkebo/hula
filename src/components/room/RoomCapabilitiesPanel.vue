<template>
  <div class="room-capabilities-panel" data-testid="room-capabilities-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.capabilities.title') }}</span>
      </template>

      <n-spin :show="loading" size="small">
        <p class="panel-subtitle">{{ t('room.capabilities.subtitle') }}</p>

        <template v-if="hasData">
          <n-descriptions bordered :column="1" label-placement="left" size="small">
            <n-descriptions-item :label="t('room.capabilities.room_version')">
              {{ capabilities?.room_version ?? '-' }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('room.capabilities.join_rule')">
              {{ capabilities?.join_rule ?? '-' }}
            </n-descriptions-item>
          </n-descriptions>

          <div v-if="capabilities?.capabilities" class="cap-section">
            <div class="section-label">{{ t('room.capabilities.capabilities_section') }}</div>
            <div class="cap-grid">
              <div v-for="(val, key) in capabilities.capabilities" :key="key" class="cap-item">
                <span class="cap-name">{{ key }}</span>
                <n-tag :type="val?.enabled === false ? 'default' : 'success'" size="small" round>
                  {{ val?.enabled === false ? t('room.capabilities.disabled') : t('room.capabilities.enabled') }}
                </n-tag>
              </div>
            </div>
          </div>

          <div v-if="capabilities?.features" class="cap-section">
            <div class="section-label">{{ t('room.capabilities.features_section') }}</div>
            <div class="cap-grid">
              <div v-for="(val, key) in capabilities.features" :key="key" class="cap-item">
                <span class="cap-name">{{ key }}</span>
                <n-tag :type="val?.enabled === false ? 'default' : 'success'" size="small" round>
                  {{ val?.enabled === false ? t('room.capabilities.disabled') : t('room.capabilities.enabled') }}
                </n-tag>
              </div>
            </div>
          </div>

          <div v-if="permissions && Object.keys(permissions).length > 0" class="cap-section">
            <div class="section-label">{{ t('room.capabilities.permissions_section') }}</div>
            <n-descriptions bordered :column="2" label-placement="left" size="small">
              <n-descriptions-item v-for="(val, key) in permissions" :key="key" :label="String(key)">
                {{ val }}
              </n-descriptions-item>
            </n-descriptions>
          </div>
        </template>

        <n-empty v-else :description="t('room.capabilities.empty')" size="small" />
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixRoomMetadataService } from '@/services/matrix/room/MetadataService'
import { roomCapabilitiesService } from '@/services/matrix/room/RoomCapabilitiesService'

interface RoomCapabilitiesPayload {
  room_id: string
  room_version?: string
  capabilities?: Record<string, { enabled?: boolean }>
  features?: Record<string, { enabled?: boolean }>
  join_rule?: string
}

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const loading = ref(true)
const capabilities = ref<RoomCapabilitiesPayload | null>(null)
const permissions = ref<Record<string, unknown>>({})

const hasData = computed(() => {
  if (capabilities.value?.room_version || capabilities.value?.join_rule) return true
  if (capabilities.value?.capabilities && Object.keys(capabilities.value.capabilities).length > 0) return true
  if (capabilities.value?.features && Object.keys(capabilities.value.features).length > 0) return true
  if (permissions.value && Object.keys(permissions.value).length > 0) return true
  return false
})

onMounted(async () => {
  loading.value = true
  try {
    const [caps, perms] = await Promise.all([
      roomCapabilitiesService.fetch(props.roomId).catch(() => null),
      matrixRoomMetadataService.getRoomPermissions(props.roomId).catch(() => ({}))
    ])
    capabilities.value = caps as RoomCapabilitiesPayload | null
    permissions.value = (perms as Record<string, unknown>) ?? {}
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.room-capabilities-panel {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
}

.panel-subtitle {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--hula-text-tertiary);
  line-height: 1.5;
}

.cap-section {
  margin-top: 12px;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--hula-text-secondary);
  margin-bottom: 8px;
}

.cap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.cap-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--hula-surface-search);
}

.cap-name {
  font-size: 12px;
  color: var(--hula-text-secondary);
}
</style>
