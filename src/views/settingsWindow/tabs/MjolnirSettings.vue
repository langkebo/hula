<template>
  <div class="mjolnir-settings">
    <div class="settings-section">
      <n-alert type="info" :show-icon="true" class="mjolnir-alert">
        {{ t('setting.mjolnir.alert_info') }}
      </n-alert>
    </div>

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.mjolnir.room_bans') }}</h3>
      <n-spin :show="loadingRooms">
        <div v-if="roomBanList.length === 0" class="empty-list">
          <span class="empty-text">{{ t('setting.mjolnir.no_room_bans') }}</span>
        </div>
        <div v-else class="ban-list">
          <div v-for="item in roomBanList" :key="item.entity" class="ban-item">
            <div class="ban-info">
              <span class="ban-entity">{{ item.entity }}</span>
              <span v-if="item.reason" class="ban-reason">{{ t('setting.mjolnir.reason') }}: {{ item.reason }}</span>
            </div>
            <n-button size="small" type="error" quaternary @click="handleRemoveRoomBan(item)">
              {{ t('setting.mjolnir.remove') }}
            </n-button>
          </div>
        </div>
      </n-spin>
      <n-button size="small" class="add-ban-button" @click="showAddRoomBan = true">
        + {{ t('setting.mjolnir.add_room') }}
      </n-button>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.mjolnir.user_bans') }}</h3>
      <n-spin :show="loadingUsers">
        <div v-if="userBanList.length === 0" class="empty-list">
          <span class="empty-text">{{ t('setting.mjolnir.no_user_bans') }}</span>
        </div>
        <div v-else class="ban-list">
          <div v-for="item in userBanList" :key="item.entity" class="ban-item">
            <div class="ban-info">
              <span class="ban-entity">{{ item.entity }}</span>
              <span v-if="item.reason" class="ban-reason">{{ t('setting.mjolnir.reason') }}: {{ item.reason }}</span>
            </div>
            <n-button size="small" type="error" quaternary @click="handleRemoveUserBan(item)">
              {{ t('setting.mjolnir.remove') }}
            </n-button>
          </div>
        </div>
      </n-spin>
      <n-button size="small" class="add-ban-button" @click="showAddUserBan = true">
        + {{ t('setting.mjolnir.add_user') }}
      </n-button>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.mjolnir.server_bans') }}</h3>
      <n-spin :show="loadingServers">
        <div v-if="serverBanList.length === 0" class="empty-list">
          <span class="empty-text">{{ t('setting.mjolnir.no_server_bans') }}</span>
        </div>
        <div v-else class="ban-list">
          <div v-for="item in serverBanList" :key="item.entity" class="ban-item">
            <div class="ban-info">
              <span class="ban-entity">{{ item.entity }}</span>
              <span v-if="item.reason" class="ban-reason">{{ t('setting.mjolnir.reason') }}: {{ item.reason }}</span>
            </div>
            <n-button size="small" type="error" quaternary @click="handleRemoveServerBan(item)">
              {{ t('setting.mjolnir.remove') }}
            </n-button>
          </div>
        </div>
      </n-spin>
      <n-button size="small" class="add-ban-button" @click="showAddServerBan = true">
        + {{ t('setting.mjolnir.add_server') }}
      </n-button>
    </div>

    <n-modal
      v-model:show="showAddRoomBan"
      preset="dialog"
      :title="t('setting.mjolnir.add_room_rule')"
      :positive-text="t('setting.mjolnir.add')"
      :negative-text="t('setting.mjolnir.cancel')"
      @positive-click="handleAddRoomBan">
      <n-form ref="roomBanFormRef">
        <n-form-item :label="t('setting.mjolnir.room_id')">
          <n-input v-model:value="newRoomBan.entity" placeholder="#room:example.com" />
        </n-form-item>
        <n-form-item :label="t('setting.mjolnir.reason')">
          <n-input v-model:value="newRoomBan.reason" :placeholder="t('setting.mjolnir.reason_optional')" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal
      v-model:show="showAddUserBan"
      preset="dialog"
      :title="t('setting.mjolnir.add_user_rule')"
      :positive-text="t('setting.mjolnir.add')"
      :negative-text="t('setting.mjolnir.cancel')"
      @positive-click="handleAddUserBan">
      <n-form ref="userBanFormRef">
        <n-form-item :label="t('setting.mjolnir.user_id')">
          <n-input v-model:value="newUserBan.entity" placeholder="@user:example.com" />
        </n-form-item>
        <n-form-item :label="t('setting.mjolnir.reason')">
          <n-input v-model:value="newUserBan.reason" :placeholder="t('setting.mjolnir.reason_optional')" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal
      v-model:show="showAddServerBan"
      preset="dialog"
      :title="t('setting.mjolnir.add_server_rule')"
      :positive-text="t('setting.mjolnir.add')"
      :negative-text="t('setting.mjolnir.cancel')"
      @positive-click="handleAddServerBan">
      <n-form ref="serverBanFormRef">
        <n-form-item :label="t('setting.mjolnir.server_name')">
          <n-input v-model:value="newServerBan.entity" placeholder="example.com" />
        </n-form-item>
        <n-form-item :label="t('setting.mjolnir.reason')">
          <n-input v-model:value="newServerBan.reason" :placeholder="t('setting.mjolnir.reason_optional')" />
        </n-form-item>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NDivider, NForm, NFormItem, NInput, NModal, NSpin, useDialog } from 'naive-ui'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

defineOptions({
  name: 'MjolnirSettings'
})

const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { t } = useI18n()

interface BanItem {
  entity: string
  reason: string
  type: 'room_id' | 'user_id' | 'server_name'
}

const loadingRooms = ref(false)
const loadingUsers = ref(false)
const loadingServers = ref(false)

const roomBanList = ref<BanItem[]>([])
const userBanList = ref<BanItem[]>([])
const serverBanList = ref<BanItem[]>([])

const showAddRoomBan = ref(false)
const showAddUserBan = ref(false)
const showAddServerBan = ref(false)

const newRoomBan = reactive({ entity: '', reason: '' })
const newUserBan = reactive({ entity: '', reason: '' })
const newServerBan = reactive({ entity: '', reason: '' })

const STORAGE_KEY = 'tjg-mjolnir-ban-lists'

onMounted(() => {
  loadBanLists()
})

function loadBanLists() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const data = JSON.parse(saved)
      roomBanList.value = data.rooms || []
      userBanList.value = data.users || []
      serverBanList.value = data.servers || []
    } catch {
      // ignore
    }
  }
}

function saveBanLists() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      rooms: roomBanList.value,
      users: userBanList.value,
      servers: serverBanList.value
    })
  )
}

function handleAddRoomBan() {
  if (!newRoomBan.entity.trim()) {
    showFeedback(t('setting.mjolnir.enter_room_id'), 'warning')
    return false
  }
  roomBanList.value.push({ entity: newRoomBan.entity.trim(), reason: newRoomBan.reason.trim(), type: 'room_id' })
  newRoomBan.entity = ''
  newRoomBan.reason = ''
  saveBanLists()
  showFeedback(t('setting.mjolnir.added_room_rule'), 'success')
}

function handleAddUserBan() {
  if (!newUserBan.entity.trim()) {
    showFeedback(t('setting.mjolnir.enter_user_id'), 'warning')
    return false
  }
  userBanList.value.push({ entity: newUserBan.entity.trim(), reason: newUserBan.reason.trim(), type: 'user_id' })
  newUserBan.entity = ''
  newUserBan.reason = ''
  saveBanLists()
  showFeedback(t('setting.mjolnir.added_user_rule'), 'success')
}

function handleAddServerBan() {
  if (!newServerBan.entity.trim()) {
    showFeedback(t('setting.mjolnir.enter_server_name'), 'warning')
    return false
  }
  serverBanList.value.push({
    entity: newServerBan.entity.trim(),
    reason: newServerBan.reason.trim(),
    type: 'server_name'
  })
  newServerBan.entity = ''
  newServerBan.reason = ''
  saveBanLists()
  showFeedback(t('setting.mjolnir.added_server_rule'), 'success')
}

function handleRemoveRoomBan(item: BanItem) {
  dialog.warning({
    title: t('setting.mjolnir.remove_rule_title'),
    content: t('setting.mjolnir.remove_rule_confirm', { entity: item.entity }),
    positiveText: t('setting.mjolnir.confirm'),
    negativeText: t('setting.mjolnir.cancel'),
    onPositiveClick: () => {
      roomBanList.value = roomBanList.value.filter((b) => b.entity !== item.entity)
      saveBanLists()
      showFeedback(t('setting.mjolnir.removed_room_rule'), 'success')
    }
  })
}

function handleRemoveUserBan(item: BanItem) {
  dialog.warning({
    title: t('setting.mjolnir.remove_rule_title'),
    content: t('setting.mjolnir.remove_rule_confirm', { entity: item.entity }),
    positiveText: t('setting.mjolnir.confirm'),
    negativeText: t('setting.mjolnir.cancel'),
    onPositiveClick: () => {
      userBanList.value = userBanList.value.filter((b) => b.entity !== item.entity)
      saveBanLists()
      showFeedback(t('setting.mjolnir.removed_user_rule'), 'success')
    }
  })
}

function handleRemoveServerBan(item: BanItem) {
  dialog.warning({
    title: t('setting.mjolnir.remove_rule_title'),
    content: t('setting.mjolnir.remove_rule_confirm', { entity: item.entity }),
    positiveText: t('setting.mjolnir.confirm'),
    negativeText: t('setting.mjolnir.cancel'),
    onPositiveClick: () => {
      serverBanList.value = serverBanList.value.filter((b) => b.entity !== item.entity)
      saveBanLists()
      showFeedback(t('setting.mjolnir.removed_server_rule'), 'success')
    }
  })
}
</script>

<style scoped>
.mjolnir-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-3);
  color: var(--tjg-text-primary);
}

.mjolnir-alert {
  margin-bottom: var(--tjg-space-4);
}

.add-ban-button {
  margin-top: var(--tjg-space-2);
}

.ban-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.ban-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.ban-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.ban-entity {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.ban-reason {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.empty-list {
  padding: 20px;
  text-align: center;
}

.empty-text {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}
</style>
