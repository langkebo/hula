<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_deactivate.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full p-16px gap-16px">
        <van-steps :active="stepIndex" data-testid="deactivate-steps">
          <van-step>{{ t('mobile_deactivate.step.consequences') }}</van-step>
          <van-step>{{ t('mobile_deactivate.step.verify') }}</van-step>
          <van-step>{{ t('mobile_deactivate.step.final') }}</van-step>
        </van-steps>

        <!-- 第 1 步：后果说明 + 显式确认 -->
        <template v-if="step === 'consequences'">
          <van-cell-group inset :title="t('mobile_deactivate.consequences.title')">
            <van-cell
              v-for="item in consequenceKeys"
              :key="item"
              :title="t(`mobile_deactivate.consequences.items.${item}`)"
              :label="t(`mobile_deactivate.consequences.hints.${item}`)" />
          </van-cell-group>

          <van-cell-group inset>
            <van-cell data-testid="deactivate-ack">
              <template #title>
                <van-checkbox v-model="acknowledged" data-testid="deactivate-ack-box">
                  {{ t('mobile_deactivate.consequences.acknowledge') }}
                </van-checkbox>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="flex flex-col gap-8px px-4px">
            <van-button type="danger" block data-testid="deactivate-continue" @click="handleConsequencesNext">
              {{ t('mobile_deactivate.consequences.continue') }}
            </van-button>
            <van-button block plain @click="handleCancel">{{ t('mobile_deactivate.consequences.cancel') }}</van-button>
          </div>
        </template>

        <!-- 第 2 步：输入自己的 MXID -->
        <template v-else-if="step === 'verify'">
          <van-cell-group inset :title="t('mobile_deactivate.verify.title')">
            <van-cell :title="t('mobile_deactivate.verify.instruction')" :label="currentUserId" />
            <van-field
              v-model="confirmationInput"
              data-testid="deactivate-input"
              :label="t('mobile_deactivate.verify.field')"
              :placeholder="currentUserId"
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              :spellcheck="false"
              @keyup.enter="handleVerifyNext" />
          </van-cell-group>

          <div class="flex flex-col gap-8px px-4px">
            <van-button type="danger" block data-testid="deactivate-verify" @click="handleVerifyNext">
              {{ t('mobile_deactivate.verify.continue') }}
            </van-button>
            <van-button block plain @click="handleBack">{{ t('mobile_deactivate.back') }}</van-button>
          </div>
        </template>

        <!-- 第 3 步：最终确认 + 是否抹除数据 -->
        <template v-else>
          <van-cell-group inset :title="t('mobile_deactivate.final.title')">
            <van-cell :title="t('mobile_deactivate.final.warning')" :label="currentUserId" />
            <van-cell data-testid="deactivate-erase">
              <template #title>
                <van-checkbox v-model="eraseData" data-testid="deactivate-erase-box">
                  {{ t('mobile_deactivate.final.erase') }}
                </van-checkbox>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="flex flex-col gap-8px px-4px">
            <van-button
              type="danger"
              block
              :loading="submitting"
              data-testid="deactivate-confirm"
              @click="handleFinalConfirm">
              {{ t('mobile_deactivate.final.confirm') }}
            </van-button>
            <van-button block plain :disabled="submitting" @click="handleCancel">
              {{ t('mobile_deactivate.final.keep') }}
            </van-button>
          </div>
        </template>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog, showFailToast, showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { matrixAccountService } from '@/services/matrix'
import { useLoginFlow } from '@/shared/composables/useLoginFlow'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileDeactivateAccount')

const { t } = useI18n()
const router = useRouter()
const matrixStore = useMatrixStore()
const { logout } = useLoginFlow()

type Step = 'consequences' | 'verify' | 'final'

const CONSEQUENCE_KEYS = ['profile', 'rooms', 'devices', 'backup'] as const

const step = ref<Step>('consequences')
const acknowledged = ref(false)
const confirmationInput = ref('')
const eraseData = ref(false)
const submitting = ref(false)

const currentUserId = computed(() => matrixStore.userId ?? '')
const consequenceKeys = CONSEQUENCE_KEYS
const stepIndex = computed(() => (step.value === 'consequences' ? 0 : step.value === 'verify' ? 1 : 2))

function handleConsequencesNext() {
  if (!acknowledged.value) {
    return
  }
  step.value = 'verify'
}

function isConfirmationMatching(): boolean {
  const expected = currentUserId.value.trim()
  // 会话异常（拿不到 MXID）时不得继续：没有可比对的值就等于没有确认
  return expected.length > 0 && confirmationInput.value.trim() === expected
}

function handleVerifyNext() {
  if (!isConfirmationMatching()) {
    showFailToast(t('mobile_deactivate.verify.mismatch'))
    return
  }
  step.value = 'final'
}

function handleBack() {
  confirmationInput.value = ''
  step.value = 'consequences'
}

function handleCancel() {
  router.replace('/mobile/mobileMy/securityPrivacy')
}

async function handleFinalConfirm() {
  if (submitting.value) {
    return
  }

  try {
    await showConfirmDialog({
      title: t('mobile_deactivate.final.dialog_title'),
      message: t('mobile_deactivate.final.dialog_message'),
      confirmButtonText: t('mobile_deactivate.final.dialog_confirm'),
      cancelButtonText: t('mobile_deactivate.final.dialog_cancel'),
      theme: 'round-button'
    })
  } catch {
    // 用户取消：停在当前步，不清空已完成的确认
    return
  }

  submitting.value = true
  try {
    await matrixAccountService.deactivateAccount(undefined, eraseData.value)
    showToast({ type: 'success', message: t('mobile_deactivate.success') })
    await logout()
    router.replace('/mobile/login')
  } catch (error) {
    logger.error('Failed to deactivate account', error)
    showFailToast(t('mobile_deactivate.failed'))
  } finally {
    submitting.value = false
  }
}
</script>
