<template>
  <div>
    <div class="tab-header">
      <n-space align="center">
        <n-input
          v-model:value="validityUserId"
          data-testid="account-policy-validity-user-id"
          :placeholder="t('admin.accountPolicy.validity.userIdPlaceholder')"
          clearable
          class="w-[300px]" />
        <n-button
          data-testid="account-policy-validity-load"
          type="primary"
          :loading="validityLoading"
          @click="handleLoadValidity">
          {{ t('admin.accountPolicy.validity.load') }}
        </n-button>
      </n-space>
    </div>

    <n-alert
      v-if="validityError"
      data-testid="account-policy-validity-error"
      type="error"
      closable
      @close="validityError = null">
      {{ validityError }}
    </n-alert>

    <n-card v-if="validity" data-testid="account-policy-validity-card" :title="validity.user_id" class="mb-16px">
      <n-descriptions :column="2" bordered size="small" label-placement="left">
        <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldExpiration')">
          {{ formatTs(validity.expiration_ts) }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldLastCheck')">
          {{ formatTs(validity.last_check_at) }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldIsValid')">
          {{ validity.is_valid ? t('admin.accountPolicy.validity.valid') : t('admin.accountPolicy.validity.invalid') }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldUpdatedAt')">
          {{ formatTs(validity.updated_ts) }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>
    <n-empty
      v-else-if="validityUserId && !validityLoading"
      data-testid="account-policy-validity-empty"
      :description="t('admin.accountPolicy.validity.empty')" />

    <n-card :title="t('admin.accountPolicy.validity.setTitle')" class="mb-16px">
      <n-space align="center">
        <n-date-picker
          v-model:value="setExpiration"
          data-testid="account-policy-validity-expiration"
          type="datetime"
          clearable />
        <n-button
          data-testid="account-policy-validity-set"
          type="primary"
          :loading="validitySaving"
          @click="handleSetValidity">
          {{ t('admin.accountPolicy.validity.set') }}
        </n-button>
      </n-space>
    </n-card>

    <n-card :title="t('admin.accountPolicy.validity.renewTitle')">
      <n-space align="center" :wrap="true">
        <n-input
          v-model:value="renewalToken"
          data-testid="account-policy-validity-renew-token"
          :placeholder="t('admin.accountPolicy.validity.renewalTokenPlaceholder')"
          class="w-[240px]" />
        <n-date-picker
          v-model:value="renewExpiration"
          data-testid="account-policy-validity-renew-expiration"
          type="datetime"
          clearable />
        <n-button data-testid="account-policy-validity-renew" :loading="validitySaving" @click="handleRenewValidity">
          {{ t('admin.accountPolicy.validity.renew') }}
        </n-button>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCard, NDatePicker, NDescriptions, NDescriptionsItem, NEmpty, NInput, NSpace } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminAccountPolicy } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

defineOptions({ name: 'AccountValidityPanel' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { validity, validityLoading, validitySaving, validityError, loadValidity, setValidity, renewValidity } =
  useAdminAccountPolicy()

const validityUserId = ref('')
const setExpiration = ref<number | null>(null)
const renewalToken = ref('')
const renewExpiration = ref<number | null>(null)

function formatTs(ts: number | null | undefined): string {
  return ts ? new Date(ts).toLocaleString() : '-'
}

async function handleLoadValidity(): Promise<void> {
  const userId = validityUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.accountPolicy.validity.userIdRequired'), 'error')
    return
  }
  await loadValidity(userId)
}

async function handleSetValidity(): Promise<void> {
  const userId = validityUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.accountPolicy.validity.userIdRequired'), 'error')
    return
  }
  if (!setExpiration.value) {
    showFeedback(t('admin.accountPolicy.validity.expirationRequired'), 'error')
    return
  }
  const ok = await setValidity(userId, setExpiration.value)
  showFeedback(
    ok ? t('admin.accountPolicy.validity.setSuccess') : t('admin.accountPolicy.validity.setFailed'),
    ok ? 'success' : 'error'
  )
}

async function handleRenewValidity(): Promise<void> {
  const userId = validityUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.accountPolicy.validity.userIdRequired'), 'error')
    return
  }
  if (!renewalToken.value.trim()) {
    showFeedback(t('admin.accountPolicy.validity.renewalTokenRequired'), 'error')
    return
  }
  if (!renewExpiration.value) {
    showFeedback(t('admin.accountPolicy.validity.expirationRequired'), 'error')
    return
  }
  const ok = await renewValidity(userId, renewalToken.value.trim(), renewExpiration.value)
  showFeedback(
    ok ? t('admin.accountPolicy.validity.renewSuccess') : t('admin.accountPolicy.validity.renewFailed'),
    ok ? 'success' : 'error'
  )
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

@include responsive.down('md') {
  .tab-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
