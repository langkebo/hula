<template>
  <div
    v-if="mode === 'auto'"
    class="text-14px grid grid-cols-[1fr_auto_1fr] items-center gap-x-12px w-full"
    id="bottomBar">
    <div
      class="color-[--color-primary] cursor-pointer justify-self-end text-right"
      :title="cancelLoginTitle"
      @click="emit('cancel-auto-login')">
      {{ cancelLoginLabel }}
    </div>
    <div class="w-1px h-14px bg-[--login-divider-color] justify-self-center"></div>
    <div
      class="color-[--color-primary] cursor-pointer justify-self-start text-left"
      :title="removeAccountTitle"
      @click="emit('remove-account')">
      {{ removeAccountLabel }}
    </div>
  </div>
  <div v-else class="text-14px grid grid-cols-[1fr_auto_1fr] items-center gap-x-12px w-full" id="bottomBar">
    <div
      class="color-[--color-primary] cursor-pointer justify-self-end text-right"
      :title="qrCodeTitle"
      @click="emit('switch-to-qr')">
      {{ qrCodeLabel }}
    </div>
    <div class="w-1px h-14px bg-[--login-divider-color] justify-self-center"></div>
    <div class="justify-self-start text-left">
      <n-popover
        trigger="click"
        id="moreShow"
        class="bg-[--login-dropdown-bg]! backdrop-blur-sm"
        v-model:show="moreShow"
        :show-checkmark="false"
        :show-arrow="false">
        <template #trigger>
          <div class="color-[--color-primary] cursor-pointer" :title="moreTitle">{{ moreLabel }}</div>
        </template>
        <n-flex vertical :size="2">
          <div
            class="register text-14px cursor-pointer hover:bg-[--hula-text-tertiary]30 hover:rounded-6px p-8px"
            @click="emit('open-register')">
            {{ t('login.register') }}
          </div>
          <div
            class="text-14px cursor-pointer hover:bg-[--hula-text-tertiary]30 hover:rounded-6px p-8px"
            data-test="guest-login-btn"
            @click="emit('guest-login')">
            {{ t('login.guest') }}
          </div>
          <div
            class="text-14px cursor-pointer hover:bg-[--hula-text-tertiary]30 hover:rounded-6px p-8px"
            @click="emit('open-forget-password')">
            {{ t('login.option.items.forget') }}
          </div>
          <div
            v-if="!isCompatibility()"
            @click="emit('open-server-config')"
            :class="{ network: isMac() }"
            class="text-14px cursor-pointer hover:bg-[--hula-text-tertiary]30 hover:rounded-6px p-8px">
            {{ t('login.option.items.network_setting') }}
          </div>
        </n-flex>
      </n-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatBottomText } from '@/utils/Formatting'
import { isCompatibility, isMac } from '@/utils/PlatformConstants'

defineProps<{
  mode: 'manual' | 'auto'
}>()

const emit = defineEmits<{
  'switch-to-qr': []
  'cancel-auto-login': []
  'remove-account': []
  'open-register': []
  'open-forget-password': []
  'open-server-config': []
  'guest-login': []
}>()

const { t } = useI18n()
const moreShow = ref(false)

const MAX_BOTTOM_TEXT_LEN = 6
const qrCodeText = computed(() => t('login.button.qr_code'))
const moreText = computed(() => t('login.option.more'))
const removeAccountText = computed(() => t('login.button.remove_account'))
const cancelLoginText = computed(() => t('login.button.cancel_login'))
const qrCodeLabel = computed(() => formatBottomText(qrCodeText.value, MAX_BOTTOM_TEXT_LEN))
const moreLabel = computed(() => formatBottomText(moreText.value, MAX_BOTTOM_TEXT_LEN))
const removeAccountLabel = computed(() => formatBottomText(removeAccountText.value, MAX_BOTTOM_TEXT_LEN))
const cancelLoginLabel = computed(() => formatBottomText(cancelLoginText.value, MAX_BOTTOM_TEXT_LEN))
const qrCodeTitle = computed(() => (qrCodeLabel.value !== qrCodeText.value ? qrCodeText.value : undefined))
const moreTitle = computed(() => (moreLabel.value !== moreText.value ? moreText.value : undefined))
const removeAccountTitle = computed(() =>
  removeAccountLabel.value !== removeAccountText.value ? removeAccountText.value : undefined
)
const cancelLoginTitle = computed(() =>
  cancelLoginLabel.value !== cancelLoginText.value ? cancelLoginText.value : undefined
)
</script>
