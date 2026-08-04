<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_notifications.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--tjg-text-secondary)] mb-8px">
            {{ t('mobile_notifications.global_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.enable_notifications')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:bell" :width="20" color="var(--tjg-color-info-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="notificationsEnabled" @change="handleNotificationsToggle" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.enable_sound')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-success-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:volume-high" :width="20" color="var(--tjg-color-success-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="soundEnabled" :disabled="!notificationsEnabled" @change="handleSoundToggle" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_notifications.room_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.all_messages')">
              <template #right-icon>
                <van-radio-group v-model="roomNotifyMode" direction="horizontal">
                  <van-radio name="all">{{ t('mobile_notifications.notify') }}</van-radio>
                  <van-radio name="mention">{{ t('mobile_notifications.mention_only') }}</van-radio>
                  <van-radio name="none">{{ t('mobile_notifications.mute') }}</van-radio>
                </van-radio-group>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.group_messages')">
              <template #right-icon>
                <van-radio-group v-model="groupNotifyMode" direction="horizontal">
                  <van-radio name="all">{{ t('mobile_notifications.notify') }}</van-radio>
                  <van-radio name="mention">{{ t('mobile_notifications.mention_only') }}</van-radio>
                  <van-radio name="none">{{ t('mobile_notifications.mute') }}</van-radio>
                </van-radio-group>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_notifications.advanced_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.push_notifications')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:cellphone-message" :width="20" color="var(--tjg-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="pushNotifications" :disabled="!notificationsEnabled" @change="handlePushToggle" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.email_notifications')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:email-outline" :width="20" color="var(--tjg-color-info-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="emailNotifications"
                  :disabled="!notificationsEnabled"
                  @change="handleEmailToggle" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.encrypted_rooms')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-lock-outline" :width="20" color="var(--tjg-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="encryptedRoomNotifications"
                  :disabled="!notificationsEnabled"
                  @change="handleEncryptedRoomToggle" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="mt-16px px-16px">
            <van-button type="primary" block :loading="saving" @click="handleSave">
              {{ t('mobile_notifications.save') }}
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IPushRule } from '@/services/matrix/notifications/MatrixPushService'
import { matrixPushService } from '@/services/matrix/notifications/MatrixPushService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('NotificationSettings')

const { t } = useI18n()

const notificationsEnabled = ref(true)
const soundEnabled = ref(true)
const roomNotifyMode = ref('all')
const groupNotifyMode = ref('mention')
const pushNotifications = ref(true)
const emailNotifications = ref(false)
const encryptedRoomNotifications = ref(true)
const saving = ref(false)

onMounted(async () => {
  await loadPushRules()
})

async function loadPushRules() {
  try {
    const rules = await matrixPushService.getPushRules()

    const overrideRules = matrixPushService.getOverrideRules(rules)
    const roomRules = matrixPushService.getRoomRules(rules)

    const masterRule = overrideRules?.find((r: IPushRule) => r.rule_id === '.m.rule.master')
    if (masterRule && !masterRule.enabled) {
      notificationsEnabled.value = true
    }

    const dmRule = roomRules?.find((r: IPushRule) => r.rule_id === '.m.rule.room_one_to_one')
    if (dmRule) {
      roomNotifyMode.value = dmRule.enabled ? 'all' : 'none'
    }

    const messageRule = roomRules?.find((r: IPushRule) => r.rule_id === '.m.rule.message')
    if (messageRule) {
      if (
        messageRule.actions?.some((a) => {
          const action = a as { set_tweak?: string } | string
          return typeof action === 'string' ? action === 'notify' : action.set_tweak === 'highlight'
        })
      ) {
        groupNotifyMode.value = 'all'
      }
    }
  } catch (error) {
    logger.error('Failed to load push rules', error)
  }
}

async function handleNotificationsToggle(enabled: boolean) {
  try {
    await matrixPushService.setMasterRuleEnabled(enabled)
  } catch (error) {
    logger.error('Failed to update notification toggle', error)
    notificationsEnabled.value = !enabled
  }
}

async function handleSoundToggle(enabled: boolean) {
  try {
    const ruleIds = ['.m.rule.room_one_to_one', '.m.rule.message']
    for (const ruleId of ruleIds) {
      await matrixPushService.setRoomSoundEnabled(ruleId, enabled)
    }
  } catch (error) {
    logger.error('Failed to update notification sound', error)
    soundEnabled.value = !enabled
  }
}

function handlePushToggle(enabled: boolean) {
  localStorage.setItem('tjg-push-notifications', enabled.toString())
}

function handleEmailToggle(enabled: boolean) {
  localStorage.setItem('tjg-email-notifications', enabled.toString())
}

function handleEncryptedRoomToggle(enabled: boolean) {
  localStorage.setItem('tjg-encrypted-room-notifications', enabled.toString())
}

async function handleSave() {
  saving.value = true
  try {
    const dmEnabled = roomNotifyMode.value !== 'none'
    const msgEnabled = groupNotifyMode.value !== 'none'

    await matrixPushService.setRoomRuleEnabled('.m.rule.room_one_to_one', dmEnabled)
    await matrixPushService.setRoomRuleEnabled('.m.rule.message', msgEnabled)

    showToast({
      type: 'success',
      message: t('mobile_notifications.save_success')
    })
  } catch (error) {
    logger.error('Failed to save notification settings', error)
    showToast({
      type: 'fail',
      message: t('mobile_notifications.save_failed')
    })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped></style>
