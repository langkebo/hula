<template>
  <div class="mjolnir-settings">
    <!-- 二次门控：即使深链或其他入口绕过壳层过滤，admin-api 不可用时也不渲染操作区 -->
    <PermissionGuard :require="'admin-api'">
      <!-- 本地规则读取失败：不得渲染成「暂无屏蔽规则」，也不允许用空列表覆盖损坏数据 -->
      <ErrorState
        v-if="loadFailed"
        compact
        :title="t('common.load_failed')"
        :message="t('setting.mjolnir.storage_corrupted')"
        :retry-text="t('setting.mjolnir.reset_storage')"
        @retry="resetBanLists" />

      <template v-else>
        <div class="settings-section">
          <n-alert type="info" :show-icon="true" class="mjolnir-alert">
            {{ t('setting.mjolnir.alert_info') }}
          </n-alert>
        </div>

        <div class="settings-section">
          <h3 class="section-title">{{ t('setting.mjolnir.room_bans') }}</h3>
          <n-spin :show="loadingRooms">
            <EmptyState v-if="roomBanList.length === 0" compact :description="t('setting.mjolnir.no_room_bans')" />
            <div v-else class="ban-list">
              <div v-for="item in roomBanList" :key="item.entity" class="ban-item">
                <div class="ban-info">
                  <span class="ban-entity">{{ item.entity }}</span>
                  <span v-if="item.reason" class="ban-reason">
                    {{ t('setting.mjolnir.reason') }}: {{ item.reason }}
                  </span>
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
            <EmptyState v-if="userBanList.length === 0" compact :description="t('setting.mjolnir.no_user_bans')" />
            <div v-else class="ban-list">
              <div v-for="item in userBanList" :key="item.entity" class="ban-item">
                <div class="ban-info">
                  <span class="ban-entity">{{ item.entity }}</span>
                  <span v-if="item.reason" class="ban-reason">
                    {{ t('setting.mjolnir.reason') }}: {{ item.reason }}
                  </span>
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
            <EmptyState v-if="serverBanList.length === 0" compact :description="t('setting.mjolnir.no_server_bans')" />
            <div v-else class="ban-list">
              <div v-for="item in serverBanList" :key="item.entity" class="ban-item">
                <div class="ban-info">
                  <span class="ban-entity">{{ item.entity }}</span>
                  <span v-if="item.reason" class="ban-reason">
                    {{ t('setting.mjolnir.reason') }}: {{ item.reason }}
                  </span>
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

        <n-drawer v-model:show="showAddRoomBan" placement="right" :width="380">
          <n-drawer-content :title="t('setting.mjolnir.add_room_rule')" closable>
            <n-form ref="roomBanFormRef">
              <n-form-item :label="t('setting.mjolnir.room_id')">
                <n-input v-model:value="newRoomBan.entity" placeholder="#room:example.com" />
              </n-form-item>
              <n-form-item :label="t('setting.mjolnir.reason')">
                <n-input v-model:value="newRoomBan.reason" :placeholder="t('setting.mjolnir.reason_optional')" />
              </n-form-item>
            </n-form>
            <template #footer>
              <div class="flex justify-end gap-12px">
                <n-button @click="showAddRoomBan = false">{{ t('setting.mjolnir.cancel') }}</n-button>
                <n-button type="primary" @click="submitRoomBan">{{ t('setting.mjolnir.add') }}</n-button>
              </div>
            </template>
          </n-drawer-content>
        </n-drawer>

        <n-drawer v-model:show="showAddUserBan" placement="right" :width="380">
          <n-drawer-content :title="t('setting.mjolnir.add_user_rule')" closable>
            <n-form ref="userBanFormRef">
              <n-form-item :label="t('setting.mjolnir.user_id')">
                <n-input v-model:value="newUserBan.entity" placeholder="@user:example.com" />
              </n-form-item>
              <n-form-item :label="t('setting.mjolnir.reason')">
                <n-input v-model:value="newUserBan.reason" :placeholder="t('setting.mjolnir.reason_optional')" />
              </n-form-item>
            </n-form>
            <template #footer>
              <div class="flex justify-end gap-12px">
                <n-button @click="showAddUserBan = false">{{ t('setting.mjolnir.cancel') }}</n-button>
                <n-button type="primary" @click="submitUserBan">{{ t('setting.mjolnir.add') }}</n-button>
              </div>
            </template>
          </n-drawer-content>
        </n-drawer>

        <n-drawer v-model:show="showAddServerBan" placement="right" :width="380">
          <n-drawer-content :title="t('setting.mjolnir.add_server_rule')" closable>
            <n-form ref="serverBanFormRef">
              <n-form-item :label="t('setting.mjolnir.server_name')">
                <n-input v-model:value="newServerBan.entity" placeholder="example.com" />
              </n-form-item>
              <n-form-item :label="t('setting.mjolnir.reason')">
                <n-input v-model:value="newServerBan.reason" :placeholder="t('setting.mjolnir.reason_optional')" />
              </n-form-item>
            </n-form>
            <template #footer>
              <div class="flex justify-end gap-12px">
                <n-button @click="showAddServerBan = false">{{ t('setting.mjolnir.cancel') }}</n-button>
                <n-button type="primary" @click="submitServerBan">{{ t('setting.mjolnir.add') }}</n-button>
              </div>
            </template>
          </n-drawer-content>
        </n-drawer>
      </template>
    </PermissionGuard>
  </div>
</template>

<script setup lang="ts">
import {
  NAlert,
  NButton,
  NDivider,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NSpin,
  useDialog
} from 'naive-ui'
import { onMounted, type Ref, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PermissionGuard from '@/components/common/PermissionGuard.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'MjolnirSettings'
})

const logger = createLogger('MjolnirSettings')

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
const loadFailed = ref(false)

onMounted(() => {
  loadBanLists()
})

function loadBanLists() {
  loadFailed.value = false
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return

  try {
    const data = JSON.parse(saved)
    const rooms = data?.rooms
    const users = data?.users
    const servers = data?.servers
    if (![rooms, users, servers].every((list) => Array.isArray(list))) {
      throw new Error('invalid ban list payload')
    }
    roomBanList.value = rooms
    userBanList.value = users
    serverBanList.value = servers
  } catch (error) {
    logger.error('Failed to read local ban lists:', error)
    loadFailed.value = true
  }
}

/** 数据已损坏：显式重置后才能继续编辑，避免用空列表静默覆盖原始数据 */
function resetBanLists() {
  localStorage.removeItem(STORAGE_KEY)
  roomBanList.value = []
  userBanList.value = []
  serverBanList.value = []
  loadFailed.value = false
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
  return addBan(roomBanList, newRoomBan, 'room_id', 'setting.mjolnir.enter_room_id', 'setting.mjolnir.added_room_rule')
}

function handleAddUserBan() {
  return addBan(userBanList, newUserBan, 'user_id', 'setting.mjolnir.enter_user_id', 'setting.mjolnir.added_user_rule')
}

function handleAddServerBan() {
  return addBan(
    serverBanList,
    newServerBan,
    'server_name',
    'setting.mjolnir.enter_server_name',
    'setting.mjolnir.added_server_rule'
  )
}

function addBan(
  list: Ref<BanItem[]>,
  form: { entity: string; reason: string },
  type: BanItem['type'],
  emptyKey: string,
  addedKey: string
): boolean {
  if (!form.entity.trim()) {
    showFeedback(t(emptyKey), 'warning')
    return false
  }
  list.value.push({ entity: form.entity.trim(), reason: form.reason.trim(), type })
  form.entity = ''
  form.reason = ''
  saveBanLists()
  showFeedback(t(addedKey), 'success')
  return true
}

function submitRoomBan() {
  if (handleAddRoomBan() === false) return
  showAddRoomBan.value = false
}

function submitUserBan() {
  if (handleAddUserBan() === false) return
  showAddUserBan.value = false
}

function submitServerBan() {
  if (handleAddServerBan() === false) return
  showAddServerBan.value = false
}

function confirmRemove(list: Ref<BanItem[]>, item: BanItem, removedKey: string) {
  dialog.warning({
    title: t('setting.mjolnir.remove_rule_title'),
    content: t('setting.mjolnir.remove_rule_confirm', { entity: item.entity }),
    positiveText: t('setting.mjolnir.confirm'),
    negativeText: t('setting.mjolnir.cancel'),
    onPositiveClick: () => {
      list.value = list.value.filter((b) => b.entity !== item.entity)
      saveBanLists()
      showFeedback(t(removedKey), 'success')
    }
  })
}

function handleRemoveRoomBan(item: BanItem) {
  confirmRemove(roomBanList, item, 'setting.mjolnir.removed_room_rule')
}

function handleRemoveUserBan(item: BanItem) {
  confirmRemove(userBanList, item, 'setting.mjolnir.removed_user_rule')
}

function handleRemoveServerBan(item: BanItem) {
  confirmRemove(serverBanList, item, 'setting.mjolnir.removed_server_rule')
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
</style>
