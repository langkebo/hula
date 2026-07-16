<template>
  <van-popup
    :show="visible"
    position="bottom"
    round
    closeable
    :style="{ height: '70%' }"
    @update:show="$emit('update:visible', $event)">
    <div class="list-management">
      <div class="header">
        {{ t('room_advanced.allowlist.title') }} / {{ t('room_advanced.denylist.title') }}
      </div>

      <van-tabs v-model:active="activeTab" sticky>
        <!-- 邀请白名单 -->
        <van-tab :title="`${t('room_advanced.allowlist.title')} (${flow.allowlistCount.value})`">
          <div class="add-row">
            <van-field
              v-model="allowlistInput"
              :placeholder="t('room_advanced.allowlist.input_placeholder')"
              :disabled="flow.adding.value"
              class="add-input" />
            <van-button
              size="small"
              type="primary"
              :loading="flow.adding.value"
              @click="handleAddAllowlist">
              {{ t('room_advanced.allowlist.add_user') }}
            </van-button>
          </div>

          <van-loading v-if="flow.loading.value" class="loading" />

          <template v-else>
            <div v-if="flow.allowlist.value.length > 0" class="member-list">
              <van-swipe-cell v-for="m in flow.allowlist.value" :key="m.userId">
                <div class="member-item">
                  <van-image round :width="36" :height="36" :src="m.avatarUrl" />
                  <div class="member-info">
                    <div class="member-name">{{ m.name }}</div>
                    <div class="member-id">{{ m.userId }}</div>
                  </div>
                </div>
                <template #right>
                  <van-button
                    square
                    type="danger"
                    :loading="flow.removing.value[m.userId]"
                    :text="t('room_advanced.allowlist.remove')"
                    @click="handleRemoveAllowlist(m.userId)" />
                </template>
              </van-swipe-cell>
            </div>
            <van-empty v-else :description="t('room_advanced.allowlist.empty')" />
          </template>
        </van-tab>

        <!-- 禁止名单 -->
        <van-tab :title="`${t('room_advanced.denylist.title')} (${flow.denylistCount.value})`">
          <div class="add-row">
            <van-field
              v-model="denylistInput"
              :placeholder="t('room_advanced.denylist.input_placeholder')"
              :disabled="flow.adding.value"
              class="add-input" />
            <van-field
              v-model="denylistReason"
              :placeholder="t('room_advanced.denylist.reason_placeholder')"
              :disabled="flow.adding.value"
              class="reason-input" />
            <van-button
              size="small"
              type="primary"
              :loading="flow.adding.value"
              @click="handleAddDenylist">
              {{ t('room_advanced.denylist.add_user') }}
            </van-button>
          </div>

          <van-loading v-if="flow.loading.value" class="loading" />

          <template v-else>
            <div v-if="flow.denylist.value.length > 0" class="member-list">
              <van-swipe-cell v-for="m in flow.denylist.value" :key="m.userId">
                <div class="member-item">
                  <van-image round :width="36" :height="36" :src="m.avatarUrl" />
                  <div class="member-info">
                    <div class="member-name">{{ m.name }}</div>
                    <div class="member-id">
                      {{ m.userId }}
                      <span v-if="m.reason" class="member-reason">· {{ m.reason }}</span>
                    </div>
                  </div>
                </div>
                <template #right>
                  <van-button
                    square
                    type="warning"
                    :loading="flow.removing.value[m.userId]"
                    :text="t('room_advanced.denylist.remove')"
                    @click="handleRemoveDenylist(m.userId)" />
                </template>
              </van-swipe-cell>
            </div>
            <van-empty v-else :description="t('room_advanced.denylist.empty')" />
          </template>
        </van-tab>
      </van-tabs>

      <div v-if="flow.errorMessage.value" class="error-text">
        {{ flow.errorMessage.value }}
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomListManagement } from '@/composables/room/useRoomListManagement'

const props = defineProps<{
  visible: boolean
  roomId: string
  canManage?: boolean
  initialTab?: 'allowlist' | 'denylist'
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
      if (props.initialTab) {
        activeTab.value = props.initialTab
      }
      flow.load()
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.list-management {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 0 0;
}

.header {
  padding: 0 16px 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-primary);
  border-bottom: 1px solid var(--hula-border-default);
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

.add-input {
  flex: 1;
}

.reason-input {
  flex: 0 0 100px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.member-list {
  padding: 0 16px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--hula-border-default);
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 14px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-id {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  font-family: monospace;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-reason {
  color: var(--hula-text-tertiary);
  font-style: italic;
}

.error-text {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--hula-color-danger-500, #ee0a24);
}
</style>
