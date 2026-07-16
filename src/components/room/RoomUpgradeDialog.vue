<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('room_advanced.room_upgrade.title')"
    :style="{ width: '420px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <div class="upgrade-dialog">
      <p class="description">{{ t('room_advanced.room_upgrade.description') }}</p>

      <n-spin :show="flow.loading.value">
        <div class="form-grid">
          <div class="form-item">
            <span class="form-label">{{ t('room_advanced.room_upgrade.current_version') }}</span>
            <div class="form-value">
              <n-tag :type="currentVersion ? 'info' : 'default'" size="small" round>
                {{ currentVersion ?? '—' }}
              </n-tag>
            </div>
          </div>

          <div class="form-item">
            <span class="form-label">{{ t('room_advanced.room_upgrade.target_version') }}</span>
            <div class="form-value">
              <n-select
                v-model:value="flow.targetVersion.value"
                :options="versionOptions"
                :placeholder="t('room_advanced.room_upgrade.target_version')"
                :disabled="flow.upgrading.value || !flow.hasVersions.value"
                size="small"
                style="width: 140px" />
            </div>
          </div>
        </div>
      </n-spin>

      <n-alert type="warning" :show-icon="true" class="warning">
        {{ t('room_advanced.room_upgrade.warning') }}
      </n-alert>

      <div v-if="flow.errorMessage.value" class="error-text">
        {{ flow.errorMessage.value }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
        <n-button
          type="primary"
          :loading="flow.upgrading.value"
          :disabled="!canSubmit"
          @click="handleSubmit">
          {{ t('room_advanced.room_upgrade.submit') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomUpgradeFlow } from '@/composables/room/useRoomUpgradeFlow'

const props = defineProps<{
  visible: boolean
  roomId: string
  /** 是否具备升级权限 */
  canUpgrade?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'upgraded', replacementRoomId: string): void
}>()

const { t } = useI18n()

const flow = useRoomUpgradeFlow({
  roomId: props.roomId,
  canUpgrade: props.canUpgrade !== false
})

const currentVersion = computed(() => flow.currentVersion.value)

const versionOptions = computed(() =>
  flow.availableVersions.value.map((v) => ({
    label: v.status ? `${v.version} (${v.status})` : v.version,
    value: v.version
  }))
)

const canSubmit = computed(
  () => flow.hasVersions.value && !!flow.resolveTargetVersion() && !flow.upgrading.value && !flow.loading.value
)

const handleClose = () => {
  emit('update:visible', false)
}

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSubmit = async () => {
  const target = flow.resolveTargetVersion()
  if (!target) return
  const replacementRoomId = await flow.upgrade(target)
  if (replacementRoomId) {
    emit('upgraded', replacementRoomId)
    handleClose()
  }
}

watch(
  () => [props.visible, props.roomId] as const,
  ([visible, roomId]) => {
    if (visible && roomId) {
      flow.load()
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.upgrade-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description {
  font-size: 13px;
  color: var(--hula-text-secondary);
  line-height: 1.5;
  margin: 0;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.form-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.form-label {
  font-size: 13px;
  color: var(--hula-text-secondary);
  flex-shrink: 0;
}

.form-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-hint {
  font-size: 11px;
  color: var(--hula-text-tertiary);
}

.warning {
  font-size: 12px;
}

.error-text {
  font-size: 12px;
  color: var(--hula-color-danger-500, #f56c6c);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
