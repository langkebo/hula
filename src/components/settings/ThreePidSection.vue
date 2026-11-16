<template>
  <div class="three-pid-section" role="region" :aria-label="t('setting.security.three_pid_title')">
    <div class="three-pid-section__header">
      <h3 class="three-pid-section__title">{{ t('setting.security.three_pid_title') }}</h3>
      <n-button
        size="tiny"
        quaternary
        :loading="loading"
        :aria-label="t('setting.security.three_pid_refresh')"
        data-test="three-pid-refresh"
        @click="loadThreePids">
        <template #icon>
          <Icon icon="mdi:refresh" :width="16" />
        </template>
      </n-button>
    </div>

    <p class="three-pid-section__desc">{{ t('setting.security.three_pid_desc') }}</p>

    <div v-if="isInitialLoading" class="three-pid-section__loading" data-test="three-pid-loading">
      <n-spin size="small" />
    </div>

    <EmptyState
      v-else-if="isEmpty"
      compact
      data-test="three-pid-empty"
      :description="t('setting.security.three_pid_empty')" />

    <ul v-else class="three-pid-list" data-test="three-pid-list">
      <li
        v-for="pid in threepids"
        :key="entryKey(pid)"
        class="three-pid-item"
        :data-test="`three-pid-item-${pid.address}`">
        <div class="three-pid-item__info">
          <span class="three-pid-item__address">{{ pid.address }}</span>
          <span class="three-pid-item__meta">
            <span>
              {{
                pid.medium === 'msisdn' ? t('setting.security.three_pid_msisdn') : t('setting.security.three_pid_email')
              }}
            </span>
            <span
              class="three-pid-item__status"
              :class="pid.validated ? 'is-validated' : 'is-unverified'"
              data-test="three-pid-status">
              <Icon :icon="pid.validated ? 'mdi:shield-check' : 'mdi:clock-outline'" :width="14" />
              {{
                pid.validated ? t('setting.security.three_pid_validated') : t('setting.security.three_pid_unverified')
              }}
            </span>
          </span>
        </div>
        <n-button
          size="tiny"
          :loading="removingKey === entryKey(pid)"
          :data-test="`three-pid-unbind-${pid.address}`"
          @click="confirmUnbind(pid)">
          {{ t('setting.security.three_pid_unbind') }}
        </n-button>
      </li>
    </ul>

    <div class="three-pid-section__actions">
      <n-button size="small" type="primary" secondary data-test="three-pid-add" @click="openAddDialog">
        {{ t('setting.security.three_pid_add_email') }}
      </n-button>
      <span class="three-pid-section__hint">{{ t('setting.security.three_pid_msisdn_unavailable') }}</span>
    </div>

    <n-modal
      v-model:show="showAddDialog"
      preset="card"
      class="three-pid-dialog"
      :title="t('setting.security.three_pid_add_email')"
      :mask-closable="false"
      data-test="three-pid-dialog">
      <div class="three-pid-form">
        <label class="three-pid-form__label" for="three-pid-email">
          {{ t('setting.security.three_pid_email_label') }}
        </label>
        <n-input
          id="three-pid-email"
          v-model:value="form.email"
          data-test="three-pid-email-input"
          :placeholder="t('setting.security.three_pid_email_placeholder')"
          :disabled="Boolean(challenge)"
          @keyup.enter="handleSendCode" />

        <label class="three-pid-form__label" for="three-pid-password">
          {{ t('setting.security.three_pid_password_label') }}
        </label>
        <n-input
          id="three-pid-password"
          v-model:value="form.password"
          type="password"
          show-password-on="click"
          data-test="three-pid-password-input"
          :placeholder="t('setting.security.three_pid_password_placeholder')" />

        <template v-if="challenge">
          <label class="three-pid-form__label" for="three-pid-token">
            {{ t('setting.security.three_pid_code_label') }}
          </label>
          <n-input
            id="three-pid-token"
            v-model:value="form.token"
            data-test="three-pid-token-input"
            :placeholder="t('setting.security.three_pid_code_placeholder')"
            @keyup.enter="handleBind" />
          <p class="three-pid-form__hint">
            {{ t('setting.security.three_pid_code_hint', { email: form.email }) }}
          </p>
        </template>

        <p v-if="formError" class="three-pid-form__error" role="alert" data-test="three-pid-form-error">
          {{ formError }}
        </p>
      </div>

      <template #footer>
        <div class="three-pid-form__footer">
          <n-button data-test="three-pid-cancel" @click="closeAddDialog">{{ t('setting.common.cancel') }}</n-button>
          <n-button
            v-if="!challenge"
            type="primary"
            :loading="sending"
            data-test="three-pid-send-code"
            @click="handleSendCode">
            {{ t('setting.security.three_pid_send_code') }}
          </n-button>
          <n-button v-else type="primary" :loading="binding" data-test="three-pid-bind" @click="handleBind">
            {{ t('setting.security.three_pid_bind') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NInput, NModal, NSpin, useDialog } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useOperationFeedback } from '@/composables/common/useOperationFeedback'
import { matrixAccountService } from '@/services/matrix'
import type { ThreePidEntry } from '@/services/matrix/user/accountThreePids'
import { createLogger } from '@/utils/Logger'

/**
 * 桌面「邮箱 / 手机号」绑定区块（3PID）。
 *
 * 手机号（msisdn）流程暂不开放：SDK 只有 `requestAdd3pidMsisdnToken`，
 * 没有 `submitToken` 封装，synapse-rust 也没有可用的 msisdn 提交端点，
 * 无法完成「发码 → 校验 → add」闭环，因此这里只实现邮箱并显式提示。
 */
defineOptions({
  name: 'ThreePidSection'
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const logger = createLogger('ThreePidSection')
const dialog = useDialog()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { reportFailure } = useOperationFeedback()

const threepids = ref<ThreePidEntry[]>([])
const loading = ref(false)

/** 首屏加载中与空结果分离：已有数据时刷新不遮挡列表 */
const isInitialLoading = computed(() => loading.value && threepids.value.length === 0)
const isEmpty = computed(() => threepids.value.length === 0)
const removingKey = ref('')
const showAddDialog = ref(false)
const sending = ref(false)
const binding = ref(false)
const formError = ref('')
const challenge = ref<{ sid: string; clientSecret: string } | null>(null)

const form = reactive({
  email: '',
  password: '',
  token: ''
})

function entryKey(pid: ThreePidEntry): string {
  return `${pid.medium}:${pid.address}`
}

async function loadThreePids() {
  loading.value = true
  try {
    const response = await matrixAccountService.getThreePids()
    threepids.value = response.threepids
  } catch (error) {
    logger.error('Failed to load three pids', error)
    threepids.value = []
    reportFailure(error, 'setting.security.three_pid_load_failed')
  } finally {
    loading.value = false
  }
}

function confirmUnbind(pid: ThreePidEntry) {
  dialog.warning({
    title: t('setting.security.three_pid_unbind_confirm_title'),
    content: t('setting.security.three_pid_unbind_confirm_content', { address: pid.address }),
    positiveText: t('setting.security.three_pid_unbind'),
    negativeText: t('setting.common.cancel'),
    onPositiveClick: async () => {
      await unbind(pid)
    }
  })
}

async function unbind(pid: ThreePidEntry) {
  removingKey.value = entryKey(pid)
  try {
    await matrixAccountService.deleteThreePid(pid.medium, pid.address)
    threepids.value = threepids.value.filter((item) => entryKey(item) !== entryKey(pid))
    showFeedback(t('setting.security.three_pid_unbind_success'), 'success')
  } catch (error) {
    logger.error('Failed to unbind three pid', error)
    reportFailure(error, 'setting.security.three_pid_unbind_failed')
  } finally {
    removingKey.value = ''
  }
}

function openAddDialog() {
  resetAddForm()
  showAddDialog.value = true
}

function closeAddDialog() {
  showAddDialog.value = false
  resetAddForm()
}

function resetAddForm() {
  form.email = ''
  form.password = ''
  form.token = ''
  formError.value = ''
  challenge.value = null
}

async function handleSendCode() {
  formError.value = ''

  const email = form.email.trim()
  if (!EMAIL_PATTERN.test(email)) {
    formError.value = t('setting.security.three_pid_invalid_email')
    return
  }
  if (!form.password) {
    formError.value = t('setting.security.three_pid_password_required')
    return
  }

  sending.value = true
  try {
    const result = await matrixAccountService.requestThreePidEmailToken(email)
    challenge.value = { sid: result.sid, clientSecret: result.clientSecret }
    form.token = ''
    showFeedback(t('setting.security.three_pid_request_success'), 'success')
  } catch (error) {
    logger.error('Failed to request three pid email token', error)
    formError.value = t('setting.security.three_pid_request_failed')
    reportFailure(error, 'setting.security.three_pid_request_failed')
  } finally {
    sending.value = false
  }
}

async function handleBind() {
  formError.value = ''

  const current = challenge.value
  if (!current) {
    return
  }

  const token = form.token.trim()
  if (!token) {
    formError.value = t('setting.security.three_pid_code_required')
    return
  }
  if (!form.password) {
    formError.value = t('setting.security.three_pid_password_required')
    return
  }

  binding.value = true
  try {
    await matrixAccountService.submitThreePidEmailToken(current.sid, current.clientSecret, token)
    await matrixAccountService.addThreePidWithPassword(current.sid, current.clientSecret, form.password)
    closeAddDialog()
    await loadThreePids()
    showFeedback(t('setting.security.three_pid_bind_success'), 'success')
  } catch (error) {
    logger.error('Failed to bind three pid email', error)
    formError.value = t('setting.security.three_pid_bind_failed')
    reportFailure(error, 'setting.security.three_pid_bind_failed')
  } finally {
    binding.value = false
  }
}

onMounted(() => {
  void loadThreePids()
})
</script>

<style scoped>
.three-pid-section {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.three-pid-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.three-pid-section__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--tjg-text-primary);
}

.three-pid-section__desc,
.three-pid-section__hint {
  margin: 0;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

.three-pid-section__loading {
  display: flex;
  justify-content: center;
  padding: var(--tjg-space-2) 0;
}

.three-pid-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-md, 8px);
}

.three-pid-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-2);
  padding: 8px 12px;
}

.three-pid-item + .three-pid-item {
  border-top: 1px solid var(--tjg-border-muted);
}

.three-pid-item__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.three-pid-item__address {
  font-size: 13px;
  color: var(--tjg-text-primary);
  overflow-wrap: anywhere;
}

.three-pid-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.three-pid-item__status {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.three-pid-item__status.is-validated {
  color: var(--tjg-color-success-500);
}

.three-pid-item__status.is-unverified {
  color: var(--tjg-color-warning-500);
}

.three-pid-section__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tjg-space-2);
}

.three-pid-dialog {
  width: 440px;
  max-width: calc(100vw - 32px);
}

.three-pid-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.three-pid-form__label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--tjg-text-secondary);
}

.three-pid-form__hint {
  margin: 0;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

.three-pid-form__error {
  margin: 0;
  font-size: 12px;
  color: var(--tjg-color-danger-500);
}

.three-pid-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--tjg-space-2);
}
</style>
