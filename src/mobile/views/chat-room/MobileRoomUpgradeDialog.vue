<template>
  <van-dialog
    v-model:show="dialogVisible"
    :title="t('room_advanced.room_upgrade.title')"
    show-cancel-button
    :confirm-button-text="t('room_advanced.room_upgrade.submit')"
    :confirm-button-loading="flow.upgrading.value"
    :cancel-button-text="t('common.cancel')"
    :before-close="handleBeforeClose"
    @confirm="handleSubmit">
    <div class="upgrade-content">
      <p class="description">{{ t('room_advanced.room_upgrade.description') }}</p>

      <div v-if="flow.loading.value" class="loading-row">
        <van-loading size="20px" />
      </div>

      <template v-else>
        <div class="info-row">
          <span class="info-label">{{ t('room_advanced.room_upgrade.current_version') }}</span>
          <span class="info-value" :class="{ 'is-empty': !currentVersion }">
            {{ currentVersion ?? '—' }}
          </span>
        </div>

        <div class="info-row">
          <span class="info-label">{{ t('room_advanced.room_upgrade.target_version') }}</span>
          <van-dropdown-menu class="version-dropdown">
            <van-dropdown-item v-model="flow.targetVersion.value" :options="versionOptions" />
          </van-dropdown-menu>
        </div>

        <div v-if="flow.hasVersions.value" class="hint">
          {{ t('room_advanced.room_upgrade.warning') }}
        </div>

        <div v-if="flow.errorMessage.value" class="error-text">
          {{ flow.errorMessage.value }}
        </div>
      </template>
    </div>
  </van-dialog>
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

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const currentVersion = computed(() => flow.currentVersion.value)

const versionOptions = computed(() =>
  flow.availableVersions.value.map((v) => ({
    text: v.status ? `${v.version} (${v.status})` : v.version,
    value: v.version
  }))
)

const handleBeforeClose = (action: string): boolean => {
  // 升级中禁止关闭
  if (flow.upgrading.value) return false
  // 取消按钮:允许关闭
  if (action === 'cancel') return true
  // 确认按钮交由 @confirm 处理,不在此处关闭
  return false
}

const handleSubmit = async () => {
  const target = flow.resolveTargetVersion()
  if (!target) {
    return
  }
  const replacementRoomId = await flow.upgrade(target)
  if (replacementRoomId) {
    emit('upgraded', replacementRoomId)
    emit('update:visible', false)
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
.upgrade-content {
  padding: 12px 16px 8px;
}

.description {
  font-size: 13px;
  color: var(--hula-text-secondary);
  line-height: 1.5;
  margin: 0 0 12px;
}

.loading-row {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--hula-border-default);
}

.info-label {
  color: var(--hula-text-secondary);
}

.info-value {
  color: var(--hula-text-primary);

  &.is-empty {
    color: var(--hula-text-tertiary);
  }
}

.version-dropdown {
  flex: 1;
  max-width: 140px;

  :deep(.van-dropdown-menu__bar) {
    background: transparent;
    box-shadow: none;
    height: 28px;
  }
}

.hint {
  margin-top: 12px;
  padding: 8px 10px;
  background: var(--hula-color-warning-bg, rgba(255, 196, 0, 0.1));
  border-radius: 6px;
  font-size: 12px;
  color: var(--hula-color-warning-text, #b88600);
  line-height: 1.5;
}

.error-text {
  margin-top: 8px;
  font-size: 12px;
  color: var(--hula-color-danger-500, #ee0a24);
}
</style>
