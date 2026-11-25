<template>
  <van-dialog
    v-model:show="visible"
    :title="t('mobile_cross_signing.title')"
    :show-cancel-button="false"
    :show-confirm-button="false"
    :close-on-click-overlay="!loading"
    @closed="handleClosed">
    <div class="px-4 py-4">
      <!-- intro：说明 + 密码（UIA m.login.password） -->
      <div v-if="step === 'intro'" class="flex flex-col gap-3" data-test="cross-signing-intro">
        <p class="text-14px text-[--tjg-text-secondary] m-0">
          {{ t('mobile_cross_signing.intro_desc') }}
        </p>
        <van-notice-bar wrapable :scrollable="false" :text="t('mobile_cross_signing.password_notice')" />
        <van-field
          v-model="password"
          type="password"
          autocomplete="current-password"
          :label="t('mobile_cross_signing.password_label')"
          :placeholder="t('mobile_cross_signing.password_placeholder')"
          :aria-label="t('mobile_cross_signing.password_label')"
          @keyup.enter="handleSubmit" />
        <van-button block type="primary" :loading="loading" :disabled="loading" @click="handleSubmit">
          {{ t('mobile_cross_signing.submit') }}
        </van-button>
      </div>

      <!-- success -->
      <div
        v-else-if="step === 'success'"
        class="flex flex-col items-center gap-3 py-4"
        data-test="cross-signing-success">
        <van-icon name="success" size="48" :color="successColor" />
        <span class="text-center">{{ t('mobile_cross_signing.success_desc') }}</span>
        <!-- 私钥只在本机时不提示就等于埋雷：换机/清缓存后无法恢复 -->
        <van-notice-bar
          v-if="needsSecurityKey"
          wrapable
          :scrollable="false"
          :text="t('mobile_cross_signing.needs_security_key')" />
        <van-button
          v-if="needsSecurityKey"
          block
          type="primary"
          :loading="storingKeys"
          :disabled="storingKeys"
          @click="handleFinishRecoverySetup">
          {{ t('mobile_cross_signing.finish_recovery') }}
        </van-button>
        <van-button block :type="needsSecurityKey ? 'default' : 'primary'" @click="visible = false">
          {{ t('common.done') }}
        </van-button>
      </div>

      <!-- error -->
      <div v-else class="flex flex-col items-center gap-3 py-4" data-test="cross-signing-error">
        <van-icon name="warning" size="48" :color="dangerColor" />
        <span class="text-center">{{ errorMessage }}</span>
        <van-button block @click="step = 'intro'">{{ t('mobile_cross_signing.retry') }}</van-button>
        <van-button block type="default" @click="visible = false">{{ t('common.close') }}</van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { createLogger } from '@/utils/Logger'

defineOptions({ name: 'MobileCrossSigningSetup' })

const logger = createLogger('MobileCrossSigning')

const { t } = useI18n()
const encryptionStore = useEncryptionStore()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** 交叉签名已建立（父组件应刷新设备/状态） */
  completed: []
  /** 私钥未入 4S，建议继续设置安全密钥 */
  'needs-security-key': []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const successColor = 'var(--tjg-color-success-500)'
const dangerColor = 'var(--tjg-color-danger-500)'

type Step = 'intro' | 'success' | 'error'

const step = ref<Step>('intro')
const loading = ref(false)
const password = ref('')
const errorMessage = ref('')
/** 私钥是否只在本地（未入 4S）：决定成功后是否提示继续设置安全密钥 */
const needsSecurityKey = ref(false)
/** 「把私钥存入 4S」进行中 */
const storingKeys = ref(false)

/**
 * 密码只用于本次 UIA，不写任何持久化存储；成功后立刻清空。
 */
function resetForm(): void {
  step.value = 'intro'
  loading.value = false
  password.value = ''
  errorMessage.value = ''
  needsSecurityKey.value = false
  storingKeys.value = false
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm()
  }
)

/**
 * 把 SDK 抛出的错误翻译成可操作提示。
 *
 * `bootstrapCrossSigning` 走 UIA（`m.login.password`），密码错误会以
 * `M_FORBIDDEN` / 401 形式冒出；其余多半是网络或 crypto 未就绪，
 * 原样带上原因便于上报，但**不包含密码**。
 */
function formatError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/M_FORBIDDEN|invalid password|unauthori[sz]ed|\b401\b/i.test(message)) {
    return t('mobile_cross_signing.wrong_password')
  }
  const generic = t('mobile_cross_signing.failed')
  return message ? `${generic}: ${message}` : generic
}

async function handleSubmit(): Promise<void> {
  if (loading.value) return

  const trimmed = password.value.trim()
  if (!trimmed) {
    errorMessage.value = t('mobile_cross_signing.password_required')
    step.value = 'error'
    return
  }

  loading.value = true
  try {
    await cryptoSDKAdapter.setupCrossSigning({ password: trimmed })
    // 成功即清空，避免密码在组件生命周期内残留
    password.value = ''

    // 状态必须重新读：needsSecurityKey 决定「只差最后一步」的提示是否出现
    const status = await cryptoSDKAdapter.getCrossSigningStatus()
    needsSecurityKey.value = !status.privateKeysInSecretStorage
    step.value = 'success'
    emit('completed')
  } catch (err) {
    logger.error('setupCrossSigning failed:', err)
    errorMessage.value = formatError(err)
    step.value = 'error'
  } finally {
    loading.value = false
  }
}

/**
 * 收尾：把交叉签名私钥存进 4S。
 *
 * 4S 已存在时**直接存**（这才是真正解决问题）；只有 4S 尚未配置时才跳去设置页 ——
 * 否则「去设置安全密钥」会变成一个点了也解决不了问题的假按钮。
 */
async function handleFinishRecoverySetup(): Promise<void> {
  if (storingKeys.value) return
  storingKeys.value = true
  try {
    const result = await encryptionStore.storeCrossSigningKeysInSecretStorage()
    if (result === 'needs-setup') {
      emit('needs-security-key')
      return
    }
    if (result === 'failed') {
      errorMessage.value = t('mobile_cross_signing.store_keys_failed')
      step.value = 'error'
      return
    }
    // stored / already-stored 都算私钥已在 4S
    needsSecurityKey.value = false
    showToast(t('mobile_cross_signing.store_keys_success'))
  } catch (err) {
    logger.error('storeCrossSigningKeysInSecretStorage failed:', err)
    errorMessage.value = t('mobile_cross_signing.store_keys_failed')
    step.value = 'error'
  } finally {
    storingKeys.value = false
  }
}

function handleClosed(): void {
  // 关闭即清空密码，无论成功与否
  password.value = ''
  errorMessage.value = ''
}
</script>
