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

    <AddPusherDialog v-model:show="showAddPusherModal" @added="fetchPushers" />

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
  NInput,
  NSpin,
  NSwitch,
  NTimePicker,
  useDialog
} from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import { matrixPushService } from '@/services/matrix/notifications/MatrixPushService'
import type { IPusher, IPushRule, IPushRules, PushRuleKind } from '@/types/matrix-services'
import { createLogger } from '@/utils/Logger'
import AddPusherDialog from './AddPusherDialog.vue'

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

const ruleKinds = ['override', 'content', 'room', 'sender', 'underride'] as const

onMounted(async () => {
  // P0-#3：设置类服务依赖 MatrixClient，冷启动时客户端尚未就绪会导致
  // 「客户端未初始化 / 未就绪」批量报错。先等待客户端就绪再发请求。
  try {
    await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
  } catch {
    logger.warn('[PushSettings] 客户端未在超时内就绪，使用本地缓存设置')
  }
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
  const savedMaster = localStorage.getItem('tjg-push-master')
  if (savedMaster !== null) {
    masterEnabled.value = savedMaster === 'true'
  }

  const savedMessagePush = localStorage.getItem('tjg-push-message')
  if (savedMessagePush !== null) {
    messagePushEnabled.value = savedMessagePush === 'true'
  }

  const savedInvitePush = localStorage.getItem('tjg-push-invite')
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

  const savedDnd = localStorage.getItem('tjg-push-dnd')
  if (savedDnd !== null) {
    dndEnabled.value = savedDnd === 'true'
  }

  const savedDndStart = localStorage.getItem('tjg-push-dnd-start')
  if (savedDndStart) {
    dndStartTime.value = parseInt(savedDndStart, 10)
  }

  const savedDndEnd = localStorage.getItem('tjg-push-dnd-end')
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
  localStorage.setItem('tjg-push-dnd', enabled.toString())
  matrixNotificationService.syncDndToAccountData({
    enabled,
    startTime: dndStartTime.value,
    endTime: dndEndTime.value
  })
  showFeedback(enabled ? t('setting.push.enabled') : t('setting.push.disabled'), 'success')
}

function handleDndTimeChange() {
  if (dndStartTime.value !== null) {
    localStorage.setItem('tjg-push-dnd-start', dndStartTime.value.toString())
  }
  if (dndEndTime.value !== null) {
    localStorage.setItem('tjg-push-dnd-end', dndEndTime.value.toString())
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
  padding: 0 var(--tjg-space-2);
}

.push-settings--embedded {
  padding: 0;
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.section-desc {
  margin: calc(var(--tjg-space-2) * -1) 0 var(--tjg-space-4);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.device-info {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-3);
}

.device-details {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.device-meta {
  display: flex;
  gap: var(--tjg-space-3);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.device-type-badge {
  padding: 0 var(--tjg-space-1);
  background-color: var(--tjg-settings-divider);
  border-radius: var(--tjg-radius-sm);
  font-size: var(--tjg-font-size-xs);
}

.device-pushkey {
  font-family: monospace;
  font-size: var(--tjg-font-size-xs);
}

.device-actions {
  display: flex;
  gap: var(--tjg-space-2);
}

.add-pusher-section {
  margin-top: var(--tjg-space-3);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.rule-kind-group {
  margin-bottom: var(--tjg-space-3);
}

.rule-kind-title {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin-bottom: var(--tjg-space-2);
  padding: var(--tjg-space-1) var(--tjg-space-2);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.rule-empty {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  padding: var(--tjg-space-2) 0;
}

.time-range {
  display: flex;
  gap: 24px;
  margin-top: var(--tjg-space-3);
  padding: var(--tjg-space-3) var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.time-item {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-3);
}

.time-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-secondary);
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.notification-item {
  padding: var(--tjg-space-3) var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.notification-info {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1);
}

.notification-content {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  word-break: break-word;
}

.notification-meta {
  display: flex;
  gap: var(--tjg-space-3);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
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
