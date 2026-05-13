<template>
  <div :class="['push-settings', { 'push-settings--embedded': embedded }]">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.push.devices') }}</h3>
      <n-spin :show="loading">
        <div v-if="pushers.length > 0" class="device-list">
          <div v-for="pusher in pushers" :key="pusher.pushkey" class="device-item">
            <div class="device-info">
              <Icon icon="mdi:bell-ring" :width="24" />
              <div class="device-details">
                <div class="device-name">{{ pusher.device_display_name || t('setting.push.noDevices') }}</div>
                <div class="device-meta">
                  <span>{{ pusher.app_display_name }}</span>
                  <span v-if="pusher.lang">{{ t('setting.push.dnd.startTime') }}: {{ pusher.lang }}</span>
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
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NDivider, NEmpty, NSpin, NSwitch, NTimePicker, useDialog, useMessage } from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import type { IPusher, IPushRule, IPushRules } from '@/services/matrix/notifications/MatrixPushService'
import { matrixPushService } from '@/services/matrix/notifications/MatrixPushService'
import type { PushRuleKind } from '@/services/matrix/sdk'
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
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const rulesLoading = ref(false)
const pushers = ref<IPusher[]>([])
const pushRules = ref<IPushRules | null>(null)
const masterEnabled = ref(true)
const messagePushEnabled = ref(true)
const invitePushEnabled = ref(true)
const dndEnabled = ref(false)
const dndStartTime = ref<number | null>(null)
const dndEndTime = ref<number | null>(null)
let unsubscribePushRules: (() => void) | null = null

onMounted(async () => {
  await Promise.allSettled([fetchPushers(), fetchPushRules()])
  await loadDndSettings()
  unsubscribePushRules = matrixPushService.subscribePushRules(handlePushRulesUpdate)
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
    message.error(t('setting.push.fetchFailed'))
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
    logger.error('Failed to fetch push rules', error)
    loadSavedSettings()
  } finally {
    rulesLoading.value = false
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
        message.success(t('setting.push.delete.success'))
      } catch (error) {
        message.error(t('setting.push.delete.failed'))
      }
    }
  })
}

async function handleMasterToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', 'override', '.m.rule.master', !enabled)
    message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
  } catch (error) {
    logger.error('Failed to update master push rule', error)
    message.error(t('setting.push.updateFailed'))
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
    message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
  } catch (error) {
    logger.error('Failed to update message push rule', error)
    message.error(t('setting.push.updateFailed'))
    messagePushEnabled.value = !enabled
  }
}

async function handleInvitePushToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', 'override' as PushRuleKind, '.m.rule.invite_for_me', enabled)
    message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
  } catch (error) {
    logger.error('Failed to update invite push rule', error)
    message.error(t('setting.push.updateFailed'))
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
  message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
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

.device-actions {
  display: flex;
  gap: var(--hula-space-2);
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
</style>
