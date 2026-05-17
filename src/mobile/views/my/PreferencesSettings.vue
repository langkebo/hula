<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_preferences.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--hula-text-secondary)] mb-8px">
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
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:keyboard-return" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.message_confirm')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-success-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:check-circle" :width="20" color="var(--hula-color-success-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="messageConfirm" size="22px" @change="handleMessageConfirmChange" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.link_preview')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:link-variant" :width="20" color="var(--hula-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="linkPreview" size="22px" @change="handleLinkPreviewChange" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.emoji_convert')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:emoticon" :width="20" color="var(--hula-color-warning-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="emojiConvert" size="22px" @change="handleEmojiConvertChange" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_preferences.burn_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.burn_default')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:timer-outline" :width="20" color="var(--hula-color-warning-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="burnDefaultEnabled" size="22px" @change="handleBurnDefaultEnabledChange" />
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
                <van-switch v-model="burnShowCountdown" size="22px" @change="handleBurnShowCountdownChange" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_preferences.thread_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.thread_auto_subscribe')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:forum" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="threadAutoSubscribe" size="22px" @change="handleThreadAutoSubscribeChange" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.thread_show_in_room')">
              <template #right-icon>
                <van-switch v-model="threadShowInRoom" size="22px" @change="handleThreadShowInRoomChange" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_preferences.privacy_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.send_read_receipts')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:eye-check" :width="20" color="var(--hula-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="sendReadReceipts" size="22px" @change="handleReadReceiptsChange" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.send_typing')">
              <template #right-icon>
                <van-switch v-model="sendTypingNotifications" size="22px" @change="handleTypingNotificationsChange" />
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
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/domains/settings/setting'

const { t } = useI18n()
const settingStore = useSettingStore()

settingStore.migrateLegacyPreferenceSettings()

const messageConfirm = ref(settingStore.messageConfirmEnabled)
const linkPreview = ref(settingStore.linkPreviewEnabled)
const emojiConvert = ref(settingStore.emojiConvertEnabled)
const sendKey = ref('Enter')

const burnDefaultEnabled = ref(settingStore.burnDefaultEnabled)
const burnDefaultDuration = ref(settingStore.burnDefaultDuration)
const burnShowCountdown = ref(settingStore.burnShowCountdownEnabled)

const threadAutoSubscribe = ref(settingStore.threadAutoSubscribeEnabled)
const threadShowInRoom = ref(settingStore.threadShowInRoomEnabled)

const sendReadReceipts = ref(settingStore.sendReadReceiptsEnabled)
const sendTypingNotifications = ref(settingStore.sendTypingNotificationsEnabled)

const showSendKeyPicker = ref(false)
const showBurnDurationPicker = ref(false)

const sendKeyOptions = [
  { label: 'Enter', value: 'Enter' },
  { label: 'Ctrl + Enter', value: 'Ctrl+Enter' },
  { label: 'Shift + Enter', value: 'Shift+Enter' }
]

const sendKeyColumns = sendKeyOptions.map((o) => ({ text: o.label, value: o.value }))

const sendKeyLabel = computed(() => {
  return sendKeyOptions.find((o) => o.value === sendKey.value)?.label || 'Enter'
})

function formatBurnDuration(value: number): string {
  if (value < 60) return t('setting.burn_after_read.formats.seconds', { count: String(value) })
  if (value < 3600) return t('setting.burn_after_read.formats.minutes', { count: String(value / 60) })
  if (value < 86400) return t('setting.burn_after_read.formats.hours', { count: String(value / 3600) })
  return t('setting.burn_after_read.formats.days', { count: String(value / 86400) })
}

const burnDurationOptions = computed(() => [
  { label: formatBurnDuration(30), value: 30 },
  { label: formatBurnDuration(60), value: 60 },
  { label: formatBurnDuration(300), value: 300 },
  { label: formatBurnDuration(3600), value: 3600 },
  { label: formatBurnDuration(86400), value: 86400 }
])

const burnDurationColumns = computed(() => burnDurationOptions.value.map((o) => ({ text: o.label, value: o.value })))

const burnDurationLabel = computed(() => {
  return burnDurationOptions.value.find((o) => o.value === burnDefaultDuration.value)?.label || formatBurnDuration(60)
})

onMounted(() => {
  const savedSendKey = localStorage.getItem('hula-send-key')
  if (savedSendKey) sendKey.value = savedSendKey
})

function loadSetting(key: string, refVal: { value: boolean }) {
  const saved = localStorage.getItem(key)
  if (saved !== null) refVal.value = saved === 'true'
}

function handleToggle(key: string, val: boolean) {
  localStorage.setItem(key, val.toString())
}

function handleMessageConfirmChange(value: boolean) {
  settingStore.setMessageConfirmEnabled(value)
}

function handleLinkPreviewChange(value: boolean) {
  settingStore.setLinkPreviewEnabled(value)
}

function handleEmojiConvertChange(value: boolean) {
  settingStore.setEmojiConvertEnabled(value)
}

function handleBurnDefaultEnabledChange(value: boolean) {
  settingStore.setBurnDefaultEnabled(value)
}

function handleBurnShowCountdownChange(value: boolean) {
  settingStore.setBurnShowCountdownEnabled(value)
}

function handleThreadAutoSubscribeChange(value: boolean) {
  settingStore.setThreadAutoSubscribeEnabled(value)
}

function handleThreadShowInRoomChange(value: boolean) {
  settingStore.setThreadShowInRoomEnabled(value)
}

function handleReadReceiptsChange(value: boolean) {
  settingStore.setSendReadReceiptsEnabled(value)
}

function handleTypingNotificationsChange(value: boolean) {
  settingStore.setSendTypingNotificationsEnabled(value)
}

function handleSendKeyConfirm({ selectedValues }: { selectedValues: string[] }) {
  const val = selectedValues[0]
  if (val) {
    sendKey.value = val
    localStorage.setItem('hula-send-key', val)
    settingStore.setSendMessageShortcut(val)
  }
  showSendKeyPicker.value = false
}

function handleBurnDurationConfirm({ selectedValues }: { selectedValues: number[] }) {
  const val = selectedValues[0] as 30 | 60 | 300 | 3600 | 86400
  if (val) {
    burnDefaultDuration.value = val
    settingStore.setBurnDefaultDuration(val)
  }
  showBurnDurationPicker.value = false
}
</script>
