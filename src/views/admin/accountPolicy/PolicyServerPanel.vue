<template>
  <n-space vertical size="large">
    <n-alert :bordered="false" type="info">{{ t('admin.accountPolicy.policy.hint') }}</n-alert>

    <n-alert
      v-if="policyError"
      data-testid="account-policy-policy-error"
      type="error"
      closable
      @close="policyError = null">
      {{ policyError }}
    </n-alert>

    <n-space>
      <n-button data-testid="account-policy-policy-refresh" :loading="policyLoading" @click="loadPolicyStatus">
        {{ t('admin.accountPolicy.policy.refresh') }}
      </n-button>
    </n-space>

    <n-card
      v-if="policyStatus"
      data-testid="account-policy-policy-status"
      :title="t('admin.accountPolicy.policy.statusTitle')">
      <n-descriptions :column="2" bordered size="small" label-placement="left">
        <n-descriptions-item :label="t('admin.accountPolicy.policy.enabled')">
          {{ policyStatus.enabled ? t('admin.accountPolicy.policy.on') : t('admin.accountPolicy.policy.off') }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.policy.endpoint')">
          {{ policyStatus.endpoint || '-' }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.policy.failMode')">
          {{
            policyStatus.fail_mode === 'fail_closed'
              ? t('admin.accountPolicy.policy.failClosed')
              : t('admin.accountPolicy.policy.failOpen')
          }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>

    <n-card :title="t('admin.accountPolicy.policy.checkTitle')">
      <n-space vertical>
        <n-input
          v-model:value="policyRoomId"
          data-testid="account-policy-policy-room"
          :placeholder="t('admin.accountPolicy.policy.roomIdPlaceholder')" />
        <n-input
          v-model:value="policyUserId"
          data-testid="account-policy-policy-user"
          :placeholder="t('admin.accountPolicy.policy.userIdPlaceholder')" />
        <n-space align="center">
          <n-select
            v-model:value="policyAction"
            data-testid="account-policy-policy-action"
            :options="policyActionOptions"
            class="w-[200px]" />
          <n-button
            data-testid="account-policy-policy-check"
            type="primary"
            :loading="policyChecking"
            @click="handlePolicyCheck">
            {{ t('admin.accountPolicy.policy.check') }}
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-alert
      v-if="policyResult"
      data-testid="account-policy-policy-result"
      :type="policyResult.allowed ? 'success' : 'warning'"
      :bordered="false">
      {{ policyResult.allowed ? t('admin.accountPolicy.policy.allowed') : t('admin.accountPolicy.policy.denied') }}
      <span v-if="policyResult.reason">- {{ policyResult.reason }}</span>
    </n-alert>
  </n-space>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCard, NDescriptions, NDescriptionsItem, NInput, NSelect, NSpace } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminAccountPolicy } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { PolicyCheckAction } from '@/services/matrix/admin'

defineOptions({ name: 'PolicyServerPanel' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { policyStatus, policyLoading, policyChecking, policyError, policyResult, loadPolicyStatus, runPolicyCheck } =
  useAdminAccountPolicy()

const policyRoomId = ref('')
const policyUserId = ref('')
const policyAction = ref<PolicyCheckAction>('join')

const policyActionOptions = computed(() => [
  { label: t('admin.accountPolicy.policy.actions.create'), value: 'create' },
  { label: t('admin.accountPolicy.policy.actions.join'), value: 'join' },
  { label: t('admin.accountPolicy.policy.actions.invite'), value: 'invite' },
  { label: t('admin.accountPolicy.policy.actions.send'), value: 'send' }
])

async function handlePolicyCheck(): Promise<void> {
  const roomId = policyRoomId.value.trim()
  const userId = policyUserId.value.trim()
  if (!roomId || !userId) {
    showFeedback(t('admin.accountPolicy.policy.required'), 'error')
    return
  }
  const ok = await runPolicyCheck({ room_id: roomId, user_id: userId, action: policyAction.value })
  if (!ok) {
    showFeedback(t('admin.accountPolicy.policy.checkFailed'), 'error')
  }
}

onMounted(() => {
  void loadPolicyStatus()
})
</script>
