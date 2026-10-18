<template>
  <n-modal
    :show="visible"
    :mask-closable="false"
    :close-on-esc="false"
    preset="card"
    class="local-unlock-dialog"
    :title="needsConfigure ? t('setting.security.local_unlock_setup_title') : t('setting.security.local_unlock_title')">
    <div class="local-unlock-dialog__body">
      <p class="local-unlock-dialog__desc">
        {{ needsConfigure ? t('setting.security.local_unlock_setup_desc') : t('setting.security.local_unlock_desc') }}
      </p>

      <n-input
        v-model:value="password"
        type="password"
        show-password-on="click"
        :placeholder="t('setting.security.local_unlock_placeholder')"
        :disabled="submitting"
        data-test="local-unlock-input"
        @keyup.enter="onSubmit" />

      <p v-if="errorKey" class="local-unlock-dialog__error" data-test="local-unlock-error">
        {{ t(errorKey) }}
      </p>

      <!-- 不能承诺「内容已保护」：这是本机密钥保管方式，不是消息加密开关 -->
      <p class="local-unlock-dialog__hint">
        {{ t('setting.security.local_unlock_forgot_hint') }}
      </p>
    </div>

    <template #footer>
      <div class="local-unlock-dialog__footer">
        <n-button quaternary :disabled="submitting" data-test="local-unlock-skip" @click="skip">
          {{ t('setting.security.local_unlock_later') }}
        </n-button>
        <n-button type="primary" :loading="submitting" data-test="local-unlock-submit" @click="onSubmit">
          {{
            needsConfigure ? t('setting.security.local_unlock_setup_action') : t('setting.security.local_unlock_action')
          }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NInput, NModal } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalUnlockGate } from '@/composables/secure/useLocalUnlockGate'

defineOptions({ name: 'LocalUnlockDialog' })

const { t } = useI18n()
const { visible, submitting, errorKey, needsConfigure, submit, skip } = useLocalUnlockGate()

const password = ref('')

async function onSubmit(): Promise<void> {
  const ok = await submit(password.value)
  if (ok) password.value = ''
}
</script>

<style scoped lang="scss">
.local-unlock-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.local-unlock-dialog__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--tjg-text-secondary);
}

.local-unlock-dialog__error {
  margin: 0;
  font-size: 12px;
  color: var(--tjg-color-danger-500);
}

.local-unlock-dialog__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tjg-text-tertiary);
}

.local-unlock-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
