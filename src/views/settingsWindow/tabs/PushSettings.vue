<template>
  <div :class="['push-settings', { 'push-settings--embedded': embedded }]">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.push.devices') }}</h3>
      <n-spin :show="loading">
        <div v-if="pushers.length > 0" class="device-list">
          <div v-for="pusher in pushers" :key="pusher.pushkey" class="device-item">
            <div class="device-info">
              <Icon :icon="getDeviceIcon(pusher.kind)" :width="24" />
              <div class="device-details">
                <div class="device-name">{{ pusher.device_display_name || t('setting.push.noDevices') }}</div>
                <div class="device-meta">
                  <span v-if="pusher.app_display_name">{{ pusher.app_display_name }}</span>
                  <span v-if="pusher.kind" class="device-type-badge">{{ getDeviceTypeLabel(pusher.kind) }}</span>
                  <span v-if="pusher.pushkey" class="device-pushkey" :title="pusher.pushkey">
                    {{ truncatePushKey(pusher.pushkey) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="device-actions">
              <n-button size="tiny" type="error" @click="handleDeletePusher(pusher)">
                {{ t('setting.push.delete.confirm') }}
              </n-button>
            </div>
          </div>
        </div>
        <n-empty v-else :description="t('setting.push.noDevices')" />
      </n-spin>
      <div class="add-pusher-section">
        <n-button size="small" @click="showAddPusherModal = true">
          {{ t('setting.push.add_pusher.label') }}
        </n-button>
      </div>
    </div>

    <n-modal v-model:show="showAddPusherModal" preset="dialog" :title="t('setting.push.add_pusher.title')">
      <n-form label-placement="left" label-width="auto">
        <n-form-item :label="t('setting.push.add_pusher.kind_label')">
          <n-select v-model:value="newPusher.kind" :options="pusherKindOptions" />
        </n-form-item>
        <n-form-item :label="t('setting.push.add_pusher.app_id_label')">
          <n-input v-model:value="newPusher.app_id" :placeholder="t('setting.push.add_pusher.app_id_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('setting.push.add_pusher.app_display_name_label')">
          <n-input
            v-model:value="newPusher.app_display_name"
            :placeholder="t('setting.push.add_pusher.app_display_name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('setting.push.add_pusher.device_display_name_label')">
          <n-input
            v-model:value="newPusher.device_display_name"
            :placeholder="t('setting.push.add_pusher.device_display_name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('setting.push.add_pusher.pushkey_label')">
          <n-input v-model:value="newPusher.pushkey" :placeholder="t('setting.push.add_pusher.pushkey_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('setting.push.add_pusher.lang_label')">
          <n-input v-model:value="newPusher.lang" placeholder="en" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddPusherModal = false">{{ t('setting.push.add_pusher.cancel') }}</n-button>
        <n-button type="primary" @click="handleAddPusher">{{ t('setting.push.add_pusher.confirm') }}</n-button>
      </template>
    </n-modal>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.push.rules') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.push.master.label') }}</span>
          <span class="setting-desc">{{ t('setting.push.master.desc') }}</span>
        </div>
        <n-switch v-model:value="masterEnabled" @update:value="handleMasterToggle" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.push.message.label') }}</span>
          <span class="setting-desc">{{ t('setting.push.message.desc') }}</span>
        </div>
        <n-switch v-model:value="messagePushEnabled" @update:value="handleMessagePushToggle" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.push.invite.label') }}</span>
          <span class="setting-desc">{{ t('setting.push.invite.desc') }}</span>
        </div>
        <n-switch v-model:value="invitePushEnabled" @update:value="handleInvitePushToggle" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.push.rules_by_kind.title') }}</h3>
      <p class="section-desc">{{ t('setting.push.rules_by_kind.desc') }}</p>
      <n-spin :show="rulesLoading">
        <div v-for="kind in ruleKinds" :key="kind" class="rule-kind-group">
          <h4 class="rule-kind-title">{{ t(`setting.push.rules_by_kind.kinds.${kind}`) }}</h4>
          <div v-if="getRulesByKind(kind).length > 0">
            <div v-for="rule in getRulesByKind(kind)" :key="rule.rule_id" class="setting-item">
              <div class="setting-info">
                <span class="setting-label">{{ formatRuleId(rule.rule_id) }}</span>
                <span v-if="rule.pattern" class="setting-desc">
                  {{ t('setting.push.rules_by_kind.pattern') }}: {{ rule.pattern }}
                </span>
              </div>
              <n-switch
                :value="rule.enabled !== false"
                @update:value="(v: boolean) => handleRuleToggle(kind, rule, v)" />
            </div>
          </div>
          <div v-else class="rule-empty">{{ t('setting.push.rules_by_kind.empty') }}</div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.push.dnd.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.push.dnd.label') }}</span>
          <span class="setting-desc">{{ t('setting.push.dnd.desc') }}</span>
        </div>
        <n-switch v-model:value="dndEnabled" @update:value="handleDndToggle" />
      </div>
      <div v-if="dndEnabled" class="time-range">
        <div class="time-item">
          <span class="time-label">{{ t('setting.push.dnd.startTime') }}</span>
          <n-time-picker v-model:value="dndStartTime" format="HH:mm" clearable @update:value="handleDndTimeChange" />
        </div>
        <div class="time-item">
          <span class="time-label">{{ t('setting.push.dnd.endTime') }}</span>
          <n-time-picker v-model:value="dndEndTime" format="HH:mm" clearable @update:value="handleDndTimeChange" />
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.push.history.title') }}</h3>
      <p class="section-desc">{{ t('setting.push.history.desc') }}</p>
      <n-spin :show="historyLoading">
        <div v-if="notifications.length > 0" class="notification-list">
          <div v-for="(notif, idx) in notifications" :key="idx" class="notification-item">
            <div class="notification-info">
              <div class="notification-content">
                {{ getNotificationContent(notif) }}
              </div>
              <div class="notification-meta">
                <span v-if="notif.room_id" class="notification-room">{{ notif.room_id }}</span>
                <span v-if="notif.ts" class="notification-time">{{ formatTimestamp(notif.ts as number) }}</span>
              </div>
            </div>
          </div>
        </div>
        <n-empty v-else :description="t('setting.push.history.empty')" />
      </n-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  NButton,
  NDivider,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  NTimePicker,
  useDialog
} from 'naive-ui'
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import { matrixPushService } from '@/services/matrix/notifications/MatrixPushService'
import type { IPusher, IPushRule, IPushRules, PushRuleKind } from '@/types/matrix-services'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PushSettings')

withDefaults(
  defineProps<{
    embedded?: boolean
  }>(),
  {
    embedded: false
  }
)

defineOptions({
  name: 'PushSettings'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

const loading = ref(false)
const rulesLoading = ref(false)
const historyLoading = ref(false)
const pushers = ref<IPusher[]>([])
const pushRules = ref<IPushRules | null>(null)
const masterEnabled = ref(true)
const messagePushEnabled = ref(true)
const invitePushEnabled = ref(true)
const dndEnabled = ref(false)
const dndStartTime = ref<number | null>(null)
const dndEndTime = ref<number | null>(null)
const notifications = ref<Array<Record<string, unknown>>>([])
let unsubscribePushRules: (() => void) | null = null

const showAddPusherModal = ref(false)
const newPusher = reactive({
  kind: 'http',
  app_id: '',
  app_display_name: '',
  device_display_name: '',
  pushkey: '',
  lang: 'en'
})

const pusherKindOptions = [
  { label: 'Web (HTTP)', value: 'http' },
  { label: 'APNs (iOS)', value: 'apns' },
  { label: 'FCM (Android)', value: 'fcm' }
]

const ruleKinds = ['override', 'content', 'room', 'sender', 'underride'] as const

onMounted(async () => {
  await Promise.allSettled([fetchPushers(), fetchPushRules(), fetchNotifications()])
  await loadDndSettings()
  try {
    unsubscribePushRules = matrixPushService.subscribePushRules(handlePushRulesUpdate)
  } catch {
    // 客户端未初始化时订阅会失败，设置页打开时可能客户端尚未就绪
  }
})

onUnmounted(() => {
  unsubscribePushRules?.()
  unsubscribePushRules = null
})

function handlePushRulesUpdate(rules: IPushRules) {
  pushRules.value = rules
  updateUIFromRules(rules)
}

async function fetchPushers() {
  loading.value = true
  try {
    pushers.value = await matrixPushService.getPushers()
  } catch (error) {
    showFeedback(t('setting.push.fetchFailed'), 'error')
  } finally {
    loading.value = false
  }
}

async function fetchPushRules() {
  rulesLoading.value = true
  try {
    const rules = await matrixPushService.getPushRules()
    pushRules.value = rules
    updateUIFromRules(rules)
  } catch (error) {
    logger.warn('Failed to fetch push rules', error)
    loadSavedSettings()
  } finally {
    rulesLoading.value = false
  }
}

async function fetchNotifications() {
  historyLoading.value = true
  try {
    const result = await matrixNotificationService.getNotifications(undefined, 20)
    notifications.value = (result as { notifications?: Array<Record<string, unknown>> })?.notifications ?? []
  } catch (error) {
    logger.warn('Failed to fetch notifications', error)
  } finally {
    historyLoading.value = false
  }
}

function updateUIFromRules(rules: IPushRules) {
  if (rules.global) {
    const masterRule = rules.global.override?.find((r: IPushRule) => r.rule_id === '.m.rule.master')
    masterEnabled.value = !masterRule?.enabled

    const messageRule = rules.global.content?.find((r: IPushRule) => r.rule_id === '.m.rule.contains_user_name')
    messagePushEnabled.value = messageRule?.enabled !== false

    const inviteRule = rules.global.override?.find((r: IPushRule) => r.rule_id === '.m.rule.invite_for_me')
    invitePushEnabled.value = inviteRule?.enabled !== false
  }
}

function loadSavedSettings() {
  const savedMaster = localStorage.getItem('hula-push-master')
  if (savedMaster !== null) {
    masterEnabled.value = savedMaster === 'true'
  }

  const savedMessagePush = localStorage.getItem('hula-push-message')
  if (savedMessagePush !== null) {
    messagePushEnabled.value = savedMessagePush === 'true'
  }

  const savedInvitePush = localStorage.getItem('hula-push-invite')
  if (savedInvitePush !== null) {
    invitePushEnabled.value = savedInvitePush === 'true'
  }
}

async function loadDndSettings() {
  const serverDnd = await matrixNotificationService.syncDndFromAccountData()
  if (serverDnd) {
    dndEnabled.value = serverDnd.enabled
    dndStartTime.value = serverDnd.startTime
    dndEndTime.value = serverDnd.endTime
    return
  }

  const savedDnd = localStorage.getItem('hula-push-dnd')
  if (savedDnd !== null) {
    dndEnabled.value = savedDnd === 'true'
  }

  const savedDndStart = localStorage.getItem('hula-push-dnd-start')
  if (savedDndStart) {
    dndStartTime.value = parseInt(savedDndStart, 10)
  }

  const savedDndEnd = localStorage.getItem('hula-push-dnd-end')
  if (savedDndEnd) {
    dndEndTime.value = parseInt(savedDndEnd, 10)
  }
}

function getRulesByKind(kind: string): IPushRule[] {
  if (!pushRules.value?.global) return []
  const globalRules = pushRules.value.global as unknown as Record<string, IPushRule[] | undefined>
  return globalRules[kind] ?? []
}

function formatRuleId(ruleId: string): string {
  if (ruleId.startsWith('.m.rule.')) {
    return ruleId.replace('.m.rule.', '')
  }
  return ruleId
}

async function handleRuleToggle(kind: string, rule: IPushRule, enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', kind as PushRuleKind, rule.rule_id, enabled)
    showFeedback(enabled ? t('setting.push.enabled') : t('setting.push.disabled'), 'success')
    await fetchPushRules()
  } catch (error) {
    logger.error('Failed to toggle push rule', error)
    showFeedback(t('setting.push.updateFailed'), 'error')
  }
}

function handleDeletePusher(pusher: IPusher) {
  dialog.warning({
    title: t('setting.push.delete.title'),
    content: t('setting.push.delete.content', { name: pusher.device_display_name || pusher.pushkey }),
    positiveText: t('setting.push.delete.confirm'),
    negativeText: t('setting.push.delete.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixPushService.unregisterPusher(pusher.pushkey, pusher.app_id)
        pushers.value = pushers.value.filter((p: IPusher) => p.pushkey !== pusher.pushkey)
        showFeedback(t('setting.push.delete.success'), 'success')
      } catch (error) {
        showFeedback(t('setting.push.delete.failed'), 'error')
      }
    }
  })
}

async function handleAddPusher() {
  if (!newPusher.app_id || !newPusher.pushkey) {
    showFeedback(t('setting.push.add_pusher.required'), 'warning')
    return
  }
  try {
    await matrixNotificationService.setPusherByBody({
      kind: newPusher.kind,
      app_id: newPusher.app_id,
      app_display_name: newPusher.app_display_name,
      device_display_name: newPusher.device_display_name,
      pushkey: newPusher.pushkey,
      lang: newPusher.lang || 'en',
      data: {}
    })
    showFeedback(t('setting.push.add_pusher.success'), 'success')
    showAddPusherModal.value = false
    resetNewPusher()
    await fetchPushers()
  } catch (error) {
    logger.error('Failed to add pusher', error)
    showFeedback(t('setting.push.add_pusher.failed'), 'error')
  }
}

function resetNewPusher() {
  newPusher.kind = 'http'
  newPusher.app_id = ''
  newPusher.app_display_name = ''
  newPusher.device_display_name = ''
  newPusher.pushkey = ''
  newPusher.lang = 'en'
}

function getDeviceIcon(kind?: string): string {
  switch (kind) {
    case 'apns':
      return 'mdi:apple'
    case 'fcm':
      return 'mdi:android'
    default:
      return 'mdi:bell-ring'
  }
}

function getDeviceTypeLabel(kind?: string): string {
  switch (kind) {
    case 'apns':
      return 'APNs'
    case 'fcm':
      return 'FCM'
    case 'http':
      return 'Web'
    default:
      return kind ?? 'Web'
  }
}

function truncatePushKey(pushkey: string): string {
  if (pushkey.length <= 12) return pushkey
  return `${pushkey.slice(0, 6)}...${pushkey.slice(-6)}`
}

function getNotificationContent(notif: Record<string, unknown>): string {
  const content = notif.content as Record<string, unknown> | undefined
  if (content && typeof content === 'object' && 'body' in content) {
    return String(content.body)
  }
  return t('setting.push.history.no_content')
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

async function handleMasterToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', 'override', '.m.rule.master', !enabled)
    showFeedback(enabled ? t('setting.push.enabled') : t('setting.push.disabled'), 'success')
  } catch (error) {
    logger.error('Failed to update master push rule', error)
    showFeedback(t('setting.push.updateFailed'), 'error')
    masterEnabled.value = !enabled
  }
}

async function handleMessagePushToggle(enabled: boolean) {
  try {
    const rules = pushRules.value?.global?.content || []
    const messageRule = rules.find((r: { rule_id?: string }) => r.rule_id === '.m.rule.contains_user_name')

    if (messageRule) {
      await matrixPushService.setPushRuleEnabled(
        'global',
        'content' as PushRuleKind,
        '.m.rule.contains_user_name',
        enabled
      )
    }
    showFeedback(enabled ? t('setting.push.enabled') : t('setting.push.disabled'), 'success')
  } catch (error) {
    logger.error('Failed to update message push rule', error)
    showFeedback(t('setting.push.updateFailed'), 'error')
    messagePushEnabled.value = !enabled
  }
}

async function handleInvitePushToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', 'override' as PushRuleKind, '.m.rule.invite_for_me', enabled)
    showFeedback(enabled ? t('setting.push.enabled') : t('setting.push.disabled'), 'success')
  } catch (error) {
    logger.error('Failed to update invite push rule', error)
    showFeedback(t('setting.push.updateFailed'), 'error')
    invitePushEnabled.value = !enabled
  }
}

function handleDndToggle(enabled: boolean) {
  localStorage.setItem('hula-push-dnd', enabled.toString())
  matrixNotificationService.syncDndToAccountData({
    enabled,
    startTime: dndStartTime.value,
    endTime: dndEndTime.value
  })
  showFeedback(enabled ? t('setting.push.enabled') : t('setting.push.disabled'), 'success')
}

function handleDndTimeChange() {
  if (dndStartTime.value !== null) {
    localStorage.setItem('hula-push-dnd-start', dndStartTime.value.toString())
  }
  if (dndEndTime.value !== null) {
    localStorage.setItem('hula-push-dnd-end', dndEndTime.value.toString())
  }
  matrixNotificationService.syncDndToAccountData({
    enabled: dndEnabled.value,
    startTime: dndStartTime.value,
    endTime: dndEndTime.value
  })
}
</script>

<style scoped>
.push-settings {
  padding: 0 var(--hula-space-2);
}

.push-settings--embedded {
  padding: 0;
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.section-desc {
  margin: calc(var(--hula-space-2) * -1) 0 var(--hula-space-4);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-2);
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.device-info {
  display: flex;
  align-items: center;
  gap: var(--hula-space-3);
}

.device-details {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}

.device-meta {
  display: flex;
  gap: var(--hula-space-3);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}

.device-type-badge {
  padding: 0 var(--hula-space-1);
  background-color: var(--hula-settings-divider);
  border-radius: var(--hula-radius-sm);
  font-size: var(--hula-font-size-xs);
}

.device-pushkey {
  font-family: monospace;
  font-size: var(--hula-font-size-xs);
}

.device-actions {
  display: flex;
  gap: var(--hula-space-2);
}

.add-pusher-section {
  margin-top: var(--hula-space-3);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.rule-kind-group {
  margin-bottom: var(--hula-space-3);
}

.rule-kind-title {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-secondary);
  margin-bottom: var(--hula-space-2);
  padding: var(--hula-space-1) var(--hula-space-2);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.rule-empty {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  padding: var(--hula-space-2) 0;
}

.time-range {
  display: flex;
  gap: 24px;
  margin-top: var(--hula-space-3);
  padding: var(--hula-space-3) var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.time-item {
  display: flex;
  align-items: center;
  gap: var(--hula-space-3);
}

.time-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-secondary);
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-2);
}

.notification-item {
  padding: var(--hula-space-3) var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.notification-info {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-1);
}

.notification-content {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
  word-break: break-word;
}

.notification-meta {
  display: flex;
  gap: var(--hula-space-3);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}

.notification-room {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  white-space: nowrap;
}
</style>
