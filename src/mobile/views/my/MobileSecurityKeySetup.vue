<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_security_key.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full p-16px gap-16px">
        <!-- 分步引导（方案 4.2：渐进式披露） -->
        <van-steps :active="stepIndex" active-color="var(--tjg-color-primary-500)">
          <van-step>{{ t('mobile_security_key.step_intro') }}</van-step>
          <van-step>{{ t('mobile_security_key.step_generate') }}</van-step>
          <van-step>{{ t('mobile_security_key.step_save') }}</van-step>
        </van-steps>

        <!-- intro -->
        <template v-if="step === 'intro'">
          <p class="text-14px text-[--tjg-text-secondary] m-0">{{ t('mobile_security_key.intro') }}</p>
          <van-notice-bar wrapable :scrollable="false" :text="t('mobile_security_key.trust_notice')" />
          <van-button type="primary" block @click="step = 'passphrase'">
            {{ t('mobile_security_key.begin') }}
          </van-button>
        </template>

        <!-- passphrase（可选） -->
        <template v-else-if="step === 'passphrase'">
          <p class="text-14px text-[--tjg-text-secondary] m-0">{{ t('mobile_security_key.passphrase_hint') }}</p>
          <van-cell-group inset>
            <van-field
              v-model="passphrase"
              type="password"
              autocomplete="new-password"
              :aria-label="t('mobile_security_key.passphrase_label')"
              :label="t('mobile_security_key.passphrase_label')"
              :placeholder="t('mobile_security_key.passphrase_placeholder')" />
          </van-cell-group>
          <van-button type="primary" block :loading="generating" @click="startGenerate">
            {{ t('mobile_security_key.generate') }}
          </van-button>
        </template>

        <!-- generating -->
        <div v-else-if="step === 'generating'" class="flex justify-center py-40px">
          <van-loading size="24px" vertical>{{ t('mobile_security_key.generating') }}</van-loading>
        </div>

        <!-- showKey：大字 + 4 字符分组，便于手抄 -->
        <template v-else-if="step === 'showKey'">
          <van-notice-bar wrapable :scrollable="false" :text="t('mobile_security_key.no_screenshot_hint')" />
          <div class="p-16px rounded-12px bg-[--tjg-surface-panel] text-center" data-testid="recovery-key">
            <p class="text-12px text-[--tjg-text-tertiary] m-0 mb-8px">
              {{ t('mobile_security_key.recovery_key_label') }}
            </p>
            <p class="text-18px font-mono break-all m-0 text-[--tjg-text-primary]">{{ formattedKey }}</p>
          </div>
          <van-cell-group inset>
            <van-checkbox v-model="acknowledged" class="px-16px py-12px">
              {{ t('mobile_security_key.acknowledge') }}
            </van-checkbox>
          </van-cell-group>
          <van-button type="primary" block :disabled="!acknowledged" @click="confirmWritten">
            {{ t('mobile_security_key.confirm') }}
          </van-button>
        </template>

        <!-- success -->
        <template v-else-if="step === 'success'">
          <van-notice-bar wrapable :scrollable="false" :text="t('mobile_security_key.success_desc')" />
          <van-button type="primary" block @click="handleDone">{{ t('common.done') }}</van-button>
        </template>

        <!-- failed -->
        <template v-else-if="step === 'failed'">
          <van-notice-bar wrapable :scrollable="false" :text="t('mobile_security_key.failed_desc')" />
          <van-button block @click="step = 'passphrase'">{{ t('mobile_security_key.retry') }}</van-button>
        </template>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { createLogger } from '@/utils/Logger'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from './settingsRoutes'

const logger = createLogger('MobileSecurityKeySetup')

const { t } = useI18n()
const router = useRouter()

type Step = 'intro' | 'passphrase' | 'generating' | 'showKey' | 'success' | 'failed'

const step = ref<Step>('intro')
const passphrase = ref('')
const recoveryKey = ref('')
/** 用户已确认抄写——未勾选不得进入完成态，防止跳过记录密钥 */
const acknowledged = ref(false)
const generating = ref(false)

/** 步骤 → 步骤条索引 */
const stepIndex = computed(() => {
  switch (step.value) {
    case 'intro':
    case 'passphrase':
      return 0
    case 'generating':
    case 'showKey':
      return 1
    default:
      return 2
  }
})

/** 恢复密钥按 4 字符分组，便于用户手抄（与桌面端一致） */
const formattedKey = computed(() => {
  if (!recoveryKey.value) return ''
  // 先剔除 SDK 可能自带的空格，再按 4 字符分组——否则会按单字符切分
  const compact = recoveryKey.value.replace(/\s+/g, '')
  return compact.match(/.{1,4}/g)?.join(' ') ?? compact
})

async function startGenerate(): Promise<void> {
  generating.value = true
  step.value = 'generating'
  try {
    const encoded = await cryptoSDKAdapter.setupKeyBackupWithOptions(
      passphrase.value ? { password: passphrase.value } : undefined
    )
    if (!encoded) {
      throw new Error('setupKeyBackupWithOptions 未返回恢复密钥')
    }
    recoveryKey.value = encoded
    step.value = 'showKey'
  } catch (error) {
    logger.error('Failed to generate security key', error)
    step.value = 'failed'
    recoveryKey.value = ''
    showToast({ type: 'fail', message: t('mobile_security_key.failed') })
  } finally {
    generating.value = false
  }
}

function confirmWritten(): void {
  if (!acknowledged.value) return
  step.value = 'success'
}

function reset(): void {
  step.value = 'intro'
  passphrase.value = ''
  recoveryKey.value = ''
  acknowledged.value = false
}

function handleDone(): void {
  reset()
  router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
}
</script>
