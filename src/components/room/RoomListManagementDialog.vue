<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('room_advanced.allowlist.title') + ' / ' + t('room_advanced.denylist.title')"
    :style="{ width: '480px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <div class="list-management-dialog">
      <n-tabs v-model:value="activeTab" type="line" animated>
        <!-- 邀请白名单 -->
        <n-tab-pane name="allowlist" :tab="`${t('room_advanced.allowlist.title')} (${flow.allowlistCount.value})`">
          <div class="add-row">
            <n-input
              v-model:value="allowlistInput"
              :placeholder="t('room_advanced.allowlist.input_placeholder')"
              :disabled="flow.adding.value"
              @keydown.enter="handleAddAllowlist" />
            <n-button type="primary" :loading="flow.adding.value" @click="handleAddAllowlist">
              {{ t('room_advanced.allowlist.add_user') }}
            </n-button>
          </div>

          <n-spin :show="flow.loading.value">
            <div class="member-list" v-if="flow.allowlist.value.length > 0">
              <div v-for="m in flow.allowlist.value" :key="m.userId" class="member-item">
                <n-avatar round :size="32" :src="m.avatarUrl" />
                <div class="member-info">
                  <span class="member-name">{{ m.name }}</span>
                  <span class="member-id">{{ m.userId }}</span>
                </div>
                <n-button
                  size="tiny"
                  type="error"
                  ghost
                  :loading="flow.removing.value[m.userId]"
                  @click="handleRemoveAllowlist(m.userId)">
                  {{ t('room_advanced.allowlist.remove') }}
                </n-button>
              </div>
            </div>
            <n-empty v-else :description="t('room_advanced.allowlist.empty')" />
          </n-spin>
        </n-tab-pane>

        <!-- 禁止名单 -->
        <n-tab-pane name="denylist" :tab="`${t('room_advanced.denylist.title')} (${flow.denylistCount.value})`">
          <div class="add-row">
            <n-input
              v-model:value="denylistInput"
              :placeholder="t('room_advanced.denylist.input_placeholder')"
              :disabled="flow.adding.value" />
            <n-input
              v-model:value="denylistReason"
              :placeholder="t('room_advanced.denylist.reason_placeholder')"
              :disabled="flow.adding.value"
              style="width: 140px" />
            <n-button type="primary" :loading="flow.adding.value" @click="handleAddDenylist">
              {{ t('room_advanced.denylist.add_user') }}
            </n-button>
          </div>

          <n-spin :show="flow.loading.value">
            <div class="member-list" v-if="flow.denylist.value.length > 0">
              <div v-for="m in flow.denylist.value" :key="m.userId" class="member-item">
                <n-avatar round :size="32" :src="m.avatarUrl" />
                <div class="member-info">
                  <span class="member-name">{{ m.name }}</span>
                  <span class="member-id">
                    {{ m.userId }}
                    <span v-if="m.reason" class="member-reason">· {{ m.reason }}</span>
                  </span>
                </div>
                <n-button
                  size="tiny"
                  type="warning"
                  ghost
                  :loading="flow.removing.value[m.userId]"
                  @click="handleRemoveDenylist(m.userId)">
                  {{ t('room_advanced.denylist.remove') }}
                </n-button>
              </div>
            </div>
            <n-empty v-else :description="t('room_advanced.denylist.empty')" />
          </n-spin>
        </n-tab-pane>
      </n-tabs>

      <div v-if="flow.errorMessage.value" class="error-text">
        {{ flow.errorMessage.value }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="$emit('update:visible', false)">{{ t('common.close') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomListManagement } from '@/composables/room/useRoomListManagement'

const props = defineProps<{
  visible: boolean
  roomId: string
  canManage?: boolean
}>()

defineEmits<(e: 'update:visible', value: boolean) => void>()

const { t } = useI18n()

const flow = useRoomListManagement({
  roomId: props.roomId,
  canManage: props.canManage !== false
})

const activeTab = ref<'allowlist' | 'denylist'>('allowlist')
const allowlistInput = ref('')
const denylistInput = ref('')
const denylistReason = ref('')

const handleAddAllowlist = async () => {
  const ok = await flow.addToAllowlist(allowlistInput.value)
  if (ok) allowlistInput.value = ''
}

const handleRemoveAllowlist = async (userId: string) => {
  await flow.removeFromAllowlist(userId)
}

const handleAddDenylist = async () => {
  const ok = await flow.addToDenylist(denylistInput.value, denylistReason.value)
  if (ok) {
    denylistInput.value = ''
    denylistReason.value = ''
  }
}

const handleRemoveDenylist = async (userId: string) => {
  await flow.removeFromDenylist(userId)
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
.list-management-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 6px;
  transition: background 0.15s;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-size: 13px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-id {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-reason {
  color: var(--hula-text-tertiary);
  font-style: italic;
}

.error-text {
  font-size: 12px;
  color: var(--hula-color-danger-500, #f56c6c);
  padding: 4px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
