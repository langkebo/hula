<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_notifications.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_notifications.global_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.enable_notifications')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:bell" :width="20" color="#1989fa" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="notificationsEnabled" @change="handleNotificationsToggle" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.enable_sound')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:volume-high" :width="20" color="#52c41a" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="soundEnabled" :disabled="!notificationsEnabled" @change="handleSoundToggle" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_notifications.room_section') }}</div>

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

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_notifications.advanced_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.desktop_notifications')">
              <template #right-icon>
                <van-switch v-model="desktopNotifications" :disabled="!notificationsEnabled" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.email_notifications')">
              <template #right-icon>
                <van-switch v-model="emailNotifications" :disabled="!notificationsEnabled" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.encrypted_rooms')">
              <template #right-icon>
                <van-switch v-model="encryptedRoomNotifications" :disabled="!notificationsEnabled" />
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
import { ref, onMounted } from 'vue'
import { showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { matrixPushService } from '@/services/matrix'
import type { IPushRule } from '@/types/matrix-js-sdk'
import { PushRuleKind, TweakName } from 'matrix-js-sdk'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const notificationsEnabled = ref(true)
const soundEnabled = ref(true)
const roomNotifyMode = ref('all')
const groupNotifyMode = ref('mention')
const desktopNotifications = ref(true)
const emailNotifications = ref(false)
const encryptedRoomNotifications = ref(true)
const saving = ref(false)

onMounted(async () => {
  await loadPushRules()
})

async function loadPushRules() {
  try {
    const rules = await matrixPushService.getPushRules()

    const globalRules = rules.global

    const overrideRules: IPushRule[] | undefined = globalRules[PushRuleKind.Override]
    const roomRules: IPushRule[] | undefined = globalRules[PushRuleKind.RoomSpecific]

    const masterRule = overrideRules?.find((r) => r.rule_id === '.m.rule.master')
    if (masterRule && !masterRule.enabled) {
      notificationsEnabled.value = true
    }

    const dmRule = roomRules?.find((r) => r.rule_id === '.m.rule.room_one_to_one')
    if (dmRule) {
      roomNotifyMode.value = dmRule.enabled ? 'all' : 'none'
    }

    const messageRule = roomRules?.find((r) => r.rule_id === '.m.rule.message')
    if (messageRule) {
      if (messageRule.actions?.some((a) => {
        const action = a as { set_tweak?: string } | string
        return typeof action === 'string' ? action === 'notify' : action.set_tweak === 'highlight'
      })) {
        groupNotifyMode.value = 'all'
      }
    }
  } catch (error) {
    console.error('[MobileNotifications] 加载推送规则失败:', error)
  }
}

async function handleNotificationsToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', PushRuleKind.Override, '.m.rule.master', !enabled)
  } catch (error) {
    console.error('[MobileNotifications] 设置通知开关失败:', error)
    notificationsEnabled.value = !enabled
  }
}

async function handleSoundToggle(enabled: boolean) {
  try {
    const ruleIds = ['.m.rule.room_one_to_one', '.m.rule.message']
    for (const ruleId of ruleIds) {
      await matrixPushService.setPushRuleActions('global', PushRuleKind.RoomSpecific, ruleId, [
        { set_tweak: { tweak: TweakName.Sound, value: enabled ? 'default' : 'none' } }
      ])
    }
  } catch (error) {
    console.error('[MobileNotifications] 设置声音失败:', error)
    soundEnabled.value = !enabled
  }
}

async function handleSave() {
  saving.value = true
  try {
    const dmEnabled = roomNotifyMode.value !== 'none'
    const msgEnabled = groupNotifyMode.value !== 'none'

    await matrixPushService.setPushRuleEnabled(
      'global',
      PushRuleKind.RoomSpecific,
      '.m.rule.room_one_to_one',
      dmEnabled
    )
    await matrixPushService.setPushRuleEnabled('global', PushRuleKind.RoomSpecific, '.m.rule.message', msgEnabled)

    showToast({
      type: 'success',
      message: t('mobile_notifications.save_success')
    })
  } catch (error) {
    console.error('[MobileNotifications] 保存设置失败:', error)
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
