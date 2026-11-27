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
              :value="sendKeyPicker.label"
              is-link
              @click="sendKeyPicker.show = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <svg class="w-20px h-20px color-[--tjg-color-info-500]" aria-hidden="true">
                    <use href="#Enter" />
                  </svg>
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.message_confirm')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-success-100)] mr-12px flex items-center justify-center">
                  <svg class="w-20px h-20px color-[--tjg-color-success-500]" aria-hidden="true">
                    <use href="#check-one" />
                  </svg>
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="messageConfirm" size="22px" />
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_preferences.recall_time')"
              :label="t('mobile_preferences.recall_time_desc')"
              :value="recallTimePicker.label"
              is-link
              @click="recallTimePicker.show = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <svg class="w-20px h-20px color-[--tjg-color-info-500]" aria-hidden="true">
                    <use href="#history" />
                  </svg>
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.link_preview')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <svg class="w-20px h-20px color-[--tjg-color-primary-500]" aria-hidden="true">
                    <use href="#link" />
                  </svg>
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
                  <svg class="w-20px h-20px color-[--tjg-color-warning-500]" aria-hidden="true">
                    <use href="#smiling-face" />
                  </svg>
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="emojiConvert" size="22px" />
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_preferences.emoji_size')"
              :label="t('mobile_preferences.emoji_size_desc')"
              :value="emojiSizePicker.label"
              is-link
              @click="emojiSizePicker.show = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-warning-100)] mr-12px flex items-center justify-center">
                  <svg class="w-20px h-20px color-[--tjg-color-warning-500]" aria-hidden="true">
                    <use href="#font-size" />
                  </svg>
                </div>
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
                  <svg class="w-20px h-20px color-[--tjg-color-warning-500]" aria-hidden="true">
                    <use href="#timer" />
                  </svg>
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="burnDefaultEnabled" size="22px" />
              </template>
            </van-cell>

            <van-cell
              v-if="burnDefaultEnabled"
              :title="t('mobile_preferences.burn_duration')"
              :value="burnDurationPicker.label"
              is-link
              @click="burnDurationPicker.show = true" />

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
                  <svg class="w-20px h-20px color-[--tjg-color-info-500]" aria-hidden="true">
                    <use href="#message" />
                  </svg>
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
            <!-- 在线状态可见性：与桌面「安全设置 → 隐私设置」同源，均走 settingStore -->
            <van-cell
              :title="t('mobile_preferences.show_online_status')"
              :label="t('mobile_preferences.show_online_status_desc')">
              <template #right-icon>
                <van-switch v-model="showOnlineStatus" size="22px" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.send_read_receipts')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <svg class="w-20px h-20px color-[--tjg-color-primary-500]" aria-hidden="true">
                    <use href="#preview-open" />
                  </svg>
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

      <van-popup v-model:show="sendKeyPicker.show" position="bottom" round>
        <van-picker
          :columns="sendKeyPicker.columns"
          @confirm="sendKeyPicker.confirm"
          @cancel="sendKeyPicker.show = false" />
      </van-popup>

      <van-popup v-model:show="burnDurationPicker.show" position="bottom" round>
        <van-picker
          :columns="burnDurationPicker.columns"
          @confirm="burnDurationPicker.confirm"
          @cancel="burnDurationPicker.show = false" />
      </van-popup>

      <van-popup v-model:show="recallTimePicker.show" position="bottom" round>
        <van-picker
          :columns="recallTimePicker.columns"
          @confirm="recallTimePicker.confirm"
          @cancel="recallTimePicker.show = false" />
      </van-popup>

      <van-popup v-model:show="emojiSizePicker.show" position="bottom" round>
        <van-picker
          :columns="emojiSizePicker.columns"
          @confirm="emojiSizePicker.confirm"
          @cancel="emojiSizePicker.show = false" />
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  useBurnDurationOptions,
  useEmojiSizeOptions,
  useRecallTimeOptions,
  useSendKeyOptions,
  useSettingPicker
} from '@/composables/settings/settingsOptions'
import { usePreferenceSettings } from '@/composables/settings/usePreferenceSettings'

const { t } = useI18n()

// 开关状态与写回统一走共享 composable（settingStore 为唯一数据源），移动端只保留 Vant 呈现
const {
  messageConfirm,
  linkPreview,
  emojiConvert,
  emojiSize,
  recallTime,
  sendKey,
  burnDefaultEnabled,
  burnDefaultDuration,
  burnShowCountdown,
  threadAutoSubscribe,
  threadShowInRoom,
  showOnlineStatus,
  sendReadReceipts,
  sendTypingNotifications
} = usePreferenceSettings()

// 选项文案与桌面端同源（settingsOptions），picker 的列 / 当前值文案 / 写回统一由共享件处理
const sendKeyPicker = useSettingPicker(useSendKeyOptions(), sendKey)
const burnDurationPicker = useSettingPicker(useBurnDurationOptions(), burnDefaultDuration)
const recallTimePicker = useSettingPicker(useRecallTimeOptions(), recallTime)
const emojiSizePicker = useSettingPicker(useEmojiSizeOptions(), emojiSize)
</script>
