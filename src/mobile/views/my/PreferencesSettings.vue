<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_preferences.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_preferences.message_section') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_preferences.send_key')"
              :value="sendKeyLabel"
              is-link
              @click="showSendKeyPicker = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:keyboard-return" :width="20" color="#1890ff" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.message_confirm')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:check-circle" :width="20" color="#52c41a" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="messageConfirm"
                  size="22px"
                  @change="handleToggle('hula-message-confirm', messageConfirm)" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.link_preview')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-purple-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:link-variant" :width="20" color="#722ed1" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="linkPreview"
                  size="22px"
                  @change="handleToggle('hula-link-preview', linkPreview)" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.emoji_convert')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-yellow-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:emoticon" :width="20" color="#faad14" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="emojiConvert"
                  size="22px"
                  @change="handleToggle('hula-emoji-convert', emojiConvert)" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_preferences.burn_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.burn_default')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-orange-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:timer-outline" :width="20" color="#fa8c16" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="burnDefaultEnabled"
                  size="22px"
                  @change="handleToggle('hula-burn-default-enabled', burnDefaultEnabled)" />
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
                <van-switch
                  v-model="burnShowCountdown"
                  size="22px"
                  @change="handleToggle('hula-burn-show-countdown', burnShowCountdown)" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_preferences.thread_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.thread_auto_subscribe')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-cyan-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:forum" :width="20" color="#13c2c2" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="threadAutoSubscribe"
                  size="22px"
                  @change="handleToggle('hula-thread-auto-subscribe', threadAutoSubscribe)" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.thread_show_in_room')">
              <template #right-icon>
                <van-switch
                  v-model="threadShowInRoom"
                  size="22px"
                  @change="handleToggle('hula-thread-show-in-room', threadShowInRoom)" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_preferences.privacy_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_preferences.send_read_receipts')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-indigo-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:eye-check" :width="20" color="#597ef7" />
                </div>
              </template>
              <template #right-icon>
                <van-switch
                  v-model="sendReadReceipts"
                  size="22px"
                  @change="handleToggle('hula-send-read-receipts', sendReadReceipts)" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_preferences.send_typing')">
              <template #right-icon>
                <van-switch
                  v-model="sendTypingNotifications"
                  size="22px"
                  @change="handleToggle('hula-send-typing-notifications', sendTypingNotifications)" />
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useSettingStore } from '@/stores/domains/settings/setting'

const { t } = useI18n()
const settingStore = useSettingStore()

const messageConfirm = ref(false)
const linkPreview = ref(true)
const emojiConvert = ref(true)
const sendKey = ref('Enter')

const burnDefaultEnabled = ref(false)
const burnDefaultDuration = ref(60)
const burnShowCountdown = ref(true)

const threadAutoSubscribe = ref(true)
const threadShowInRoom = ref(true)

const sendReadReceipts = ref(true)
const sendTypingNotifications = ref(true)

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

const burnDurationOptions = [
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '1小时', value: 3600 },
  { label: '24小时', value: 86400 }
]

const burnDurationColumns = burnDurationOptions.map((o) => ({ text: o.label, value: o.value }))

const burnDurationLabel = computed(() => {
  return burnDurationOptions.find((o) => o.value === burnDefaultDuration.value)?.label || '1分钟'
})

onMounted(() => {
  loadSetting('hula-message-confirm', messageConfirm)
  loadSetting('hula-link-preview', linkPreview)
  loadSetting('hula-emoji-convert', emojiConvert)
  loadSetting('hula-burn-default-enabled', burnDefaultEnabled)
  loadSetting('hula-burn-show-countdown', burnShowCountdown)
  loadSetting('hula-thread-auto-subscribe', threadAutoSubscribe)
  loadSetting('hula-thread-show-in-room', threadShowInRoom)
  loadSetting('hula-send-read-receipts', sendReadReceipts)
  loadSetting('hula-send-typing-notifications', sendTypingNotifications)

  const savedDuration = localStorage.getItem('hula-burn-default-duration')
  if (savedDuration) burnDefaultDuration.value = parseInt(savedDuration, 10)

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
  const val = selectedValues[0]
  if (val) {
    burnDefaultDuration.value = val
    localStorage.setItem('hula-burn-default-duration', val.toString())
  }
  showBurnDurationPicker.value = false
}
</script>
