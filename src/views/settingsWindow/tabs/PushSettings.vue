<template>
  <div class="push-settings">
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
import { ref, onMounted, onUnmounted } from 'vue'
import { NSpin, NEmpty, NButton, NSwitch, NDivider, NTimePicker, useMessage, useDialog } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { matrixPushService, PushRuleKind } from '@/services/matrix'
import { matrixClientService } from '@/services/matrix'
import type { IPusher, IPushRules } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PushSettings')

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

onMounted(async () => {
  await Promise.all([fetchPushers(), fetchPushRules()])
  loadDndSettings()

  matrixClientService.on('pushRules', handlePushRulesUpdate)
})

onUnmounted(() => {
  matrixClientService.off('pushRules', handlePushRulesUpdate)
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
    const rules = await matrixPushService.getRawPushRules()
    pushRules.value = rules
    updateUIFromRules(rules)
  } catch (error) {
    logger.error('获取推送规则失败:', error)
    loadSavedSettings()
  } finally {
    rulesLoading.value = false
  }
}

function updateUIFromRules(rules: IPushRules) {
  if (rules.global) {
    const masterRule = rules.global.override?.find((r) => r.rule_id === '.m.rule.master')
    masterEnabled.value = !masterRule?.enabled

    const messageRule = rules.global.content?.find((r) => r.rule_id === '.m.rule.contains_user_name')
    messagePushEnabled.value = messageRule?.enabled !== false

    const inviteRule = rules.global.override?.find((r) => r.rule_id === '.m.rule.invite_for_me')
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

function loadDndSettings() {
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
        pushers.value = pushers.value.filter((p) => p.pushkey !== pusher.pushkey)
        message.success(t('setting.push.delete.success'))
      } catch (error) {
        message.error(t('setting.push.delete.failed'))
      }
    }
  })
}

async function handleMasterToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', PushRuleKind.Override, '.m.rule.master', !enabled)
    message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
  } catch (error) {
    logger.error('设置主规则失败:', error)
    message.error('设置失败')
    masterEnabled.value = !enabled
  }
}

async function handleMessagePushToggle(enabled: boolean) {
  try {
    const rules = pushRules.value?.global?.content || []
    const messageRule = rules.find((r) => r.rule_id === '.m.rule.contains_user_name')

    if (messageRule) {
      await matrixPushService.setPushRuleEnabled(
        'global',
        PushRuleKind.ContentSpecific,
        '.m.rule.contains_user_name',
        enabled
      )
    }
    message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
  } catch (error) {
    logger.error('设置消息规则失败:', error)
    message.error('设置失败')
    messagePushEnabled.value = !enabled
  }
}

async function handleInvitePushToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', PushRuleKind.Override, '.m.rule.invite_for_me', enabled)
    message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
  } catch (error) {
    logger.error('设置邀请规则失败:', error)
    message.error('设置失败')
    invitePushEnabled.value = !enabled
  }
}

function handleDndToggle(enabled: boolean) {
  localStorage.setItem('hula-push-dnd', enabled.toString())
  message.success(enabled ? t('setting.push.enabled') : t('setting.push.disabled'))
}

function handleDndTimeChange() {
  if (dndStartTime.value !== null) {
    localStorage.setItem('hula-push-dnd-start', dndStartTime.value.toString())
  }
  if (dndEndTime.value !== null) {
    localStorage.setItem('hula-push-dnd-end', dndEndTime.value.toString())
  }
}
</script>

<style scoped>
.push-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .device-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.device-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.device-details {
  display: flex;
  flex-direction: column;
}

.device-name {
  font-size: 14px;
  font-weight: 500;
}

.device-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.device-actions {
  display: flex;
  gap: 8px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.time-range {
  display: flex;
  gap: 24px;
  margin-top: 12px;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .time-range {
  background-color: rgba(255, 255, 255, 0.05);
}

.time-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-label {
  font-size: 14px;
  color: #666;
}

:deep(.dark) .time-label {
  color: #aaa;
}
</style>
