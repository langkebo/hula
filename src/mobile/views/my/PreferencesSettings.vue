<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_preferences.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--tjg-text-secondary)] mb-8px">
            {{ t('mobile_preferences.message_section') }}
          </div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_preferences.send_key')"
              :value="sendKeyLabel"
              is-link
              @click="showSendKeyPicker = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:keyboard-return" :width="20" color="var(--tjg-color-info-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.message_confirm')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-success-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:check-circle" :width="20" color="var(--tjg-color-success-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="messageConfirm" size="22px" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.link_preview')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:link-variant" :width="20" color="var(--tjg-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="linkPreview" size="22px" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.emoji_convert')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:emoticon" :width="20" color="var(--tjg-color-warning-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="emojiConvert" size="22px" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_preferences.burn_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.burn_default')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:timer-outline" :width="20" color="var(--tjg-color-warning-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="burnDefaultEnabled" size="22px" />
              </template>
            </van-cell>

            <van-cell
              v-if="burnDefaultEnabled"
              :title="t('mobile_preferences.burn_duration')"
              :value="burnDurationLabel"
              is-link
              @click="showBurnDurationPicker = true" />

            <van-cell :title="t('mobile_preferences.burn_countdown')">
              <template #right-icon>
                <van-switch v-model="burnShowCountdown" size="22px" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_preferences.thread_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.thread_auto_subscribe')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:forum" :width="20" color="var(--tjg-color-info-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="threadAutoSubscribe" size="22px" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.thread_show_in_room')">
              <template #right-icon>
                <van-switch v-model="threadShowInRoom" size="22px" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_preferences.privacy_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.send_read_receipts')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:eye-check" :width="20" color="var(--tjg-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="sendReadReceipts" size="22px" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.send_typing')">
              <template #right-icon>
                <van-switch v-model="sendTypingNotifications" size="22px" />
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>

      <van-popup v-model:show="showSendKeyPicker" position="bottom" round>
        <van-picker :columns="sendKeyColumns" @confirm="handleSendKeyConfirm" @cancel="showSendKeyPicker = false" />
      </van-popup>

      <van-popup v-model:show="showBurnDurationPicker" position="bottom" round>
        <van-picker
          :columns="burnDurationColumns"
          @confirm="handleBurnDurationConfirm"
          @cancel="showBurnDurationPicker = false" />
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBurnDurationOptions, useSendKeyOptions } from '@/composables/settings/settingsOptions'
import { usePreferenceSettings } from '@/composables/settings/usePreferenceSettings'

const { t } = useI18n()

// 开关状态与写回统一走共享 composable（settingStore 为唯一数据源），移动端只保留 Vant 呈现
const {
  messageConfirm,
  linkPreview,
  emojiConvert,
  sendKey,
  burnDefaultEnabled,
  burnDefaultDuration,
  burnShowCountdown,
  threadAutoSubscribe,
  threadShowInRoom,
  sendReadReceipts,
  sendTypingNotifications
} = usePreferenceSettings()

const showSendKeyPicker = ref(false)
const showBurnDurationPicker = ref(false)

// 选项文案与桌面端同源（settingsOptions），移动端只做 Vant 列格式转换
const sendKeyOptions = useSendKeyOptions()
const burnDurationOptions = useBurnDurationOptions()

const sendKeyColumns = computed(() => sendKeyOptions.value.map((o) => ({ text: o.label, value: o.value })))

const sendKeyLabel = computed(() => {
  return sendKeyOptions.value.find((o) => o.value === sendKey.value)?.label || 'Enter'
})

const burnDurationColumns = computed(() => burnDurationOptions.value.map((o) => ({ text: o.label, value: o.value })))

const burnDurationLabel = computed(() => {
  return burnDurationOptions.value.find((o) => o.value === burnDefaultDuration.value)?.label || ''
})

function handleSendKeyConfirm({ selectedValues }: { selectedValues: string[] }) {
  const val = selectedValues[0]
  if (val) {
    sendKey.value = val
  }
  showSendKeyPicker.value = false
}

function handleBurnDurationConfirm({ selectedValues }: { selectedValues: number[] }) {
  const val = selectedValues[0] as 30 | 60 | 300 | 3600 | 86400
  if (val) {
    burnDefaultDuration.value = val
  }
  showBurnDurationPicker.value = false
}
</script>
