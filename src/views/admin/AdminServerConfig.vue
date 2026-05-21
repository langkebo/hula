<template>
  <div class="admin-server-config">
    <n-page-header :title="t('admin.server_config.title')" :subtitle="t('admin.server_config.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="loadConfig" :loading="loading">{{ t('common.refresh') }}</n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-spin :show="loading">
      <div class="config-sections">
        <!-- General -->
        <n-card :title="t('admin.server_config.general.title')" size="small" class="mt-16px">
          <n-form label-placement="left" label-width="180" :show-feedback="false">
            <n-form-item :label="t('admin.server_config.general.server_name')">
              <n-input v-model:value="form.serverName" :placeholder="t('admin.server_config.general.server_name')" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.general.registration_enabled')">
              <n-switch v-model:value="form.registrationEnabled" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.general.max_upload_size')">
              <n-input-number v-model:value="form.maxUploadSize" :min="0" :step="1" style="width: 200px">
                <template #suffix>MB</template>
              </n-input-number>
            </n-form-item>
            <n-form-item :label="t('admin.server_config.general.presence_enabled')">
              <n-switch v-model:value="form.presenceEnabled" />
            </n-form-item>
          </n-form>
        </n-card>

        <!-- Security -->
        <n-card :title="t('admin.server_config.security.title')" size="small" class="mt-16px">
          <n-form label-placement="left" label-width="180" :show-feedback="false">
            <n-form-item :label="t('admin.server_config.security.admin_mfa_required')">
              <n-switch v-model:value="form.adminMfaRequired" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.security.rbac_enabled')">
              <n-switch v-model:value="form.rbacEnabled" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.security.login_lockout_threshold')">
              <n-input-number v-model:value="form.loginLockoutThreshold" :min="0" :max="100" style="width: 200px" />
            </n-form-item>
          </n-form>
        </n-card>

        <!-- Federation -->
        <n-card :title="t('admin.server_config.federation.title')" size="small" class="mt-16px">
          <n-form label-placement="left" label-width="180" :show-feedback="false">
            <n-form-item :label="t('admin.server_config.federation.enabled')">
              <n-switch v-model:value="form.federationEnabled" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.federation.admission_mode')">
              <n-select
                v-model:value="form.federationAdmissionMode"
                :options="federationAdmissionOptions"
                style="width: 200px" />
            </n-form-item>
          </n-form>
        </n-card>

        <!-- Rate Limiting -->
        <n-card :title="t('admin.server_config.rate_limit.title')" size="small" class="mt-16px">
          <n-form label-placement="left" label-width="180" :show-feedback="false">
            <n-form-item :label="t('admin.server_config.rate_limit.enabled')">
              <n-switch v-model:value="form.rateLimitEnabled" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.rate_limit.requests_per_second')">
              <n-input-number v-model:value="form.rateLimitRps" :min="0" :step="1" style="width: 200px" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.rate_limit.burst_count')">
              <n-input-number v-model:value="form.rateLimitBurst" :min="0" :step="1" style="width: 200px" />
            </n-form-item>
          </n-form>
        </n-card>

        <!-- Translation -->
        <n-card :title="t('admin.server_config.translation.title')" size="small" class="mt-16px">
          <n-form label-placement="left" label-width="180" :show-feedback="false">
            <n-form-item :label="t('admin.server_config.translation.enabled')">
              <n-switch v-model:value="form.translationEnabled" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.translation.provider')">
              <n-select
                v-model:value="form.translationProvider"
                :options="translationProviderOptions"
                style="width: 200px" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.translation.target_language')">
              <n-select
                v-model:value="form.translationTargetLanguage"
                :options="targetLanguageOptions"
                style="width: 200px"
                filterable />
            </n-form-item>
          </n-form>
        </n-card>

        <!-- Push Notifications -->
        <n-card :title="t('admin.server_config.push.title')" size="small" class="mt-16px">
          <n-form label-placement="left" label-width="180" :show-feedback="false">
            <n-form-item :label="t('admin.server_config.push.enabled')">
              <n-switch v-model:value="form.pushEnabled" />
            </n-form-item>
            <n-form-item :label="t('admin.server_config.push.apns_status')">
              <n-tag :type="form.pushApnsStatus === 'active' ? 'success' : 'warning'" size="small">
                {{ form.pushApnsStatus || t('admin.server_config.push.unconfigured') }}
              </n-tag>
            </n-form-item>
            <n-form-item :label="t('admin.server_config.push.fcm_status')">
              <n-tag :type="form.pushFcmStatus === 'active' ? 'success' : 'warning'" size="small">
                {{ form.pushFcmStatus || t('admin.server_config.push.unconfigured') }}
              </n-tag>
            </n-form-item>
            <n-form-item :label="t('admin.server_config.push.webpush_status')">
              <n-tag :type="form.pushWebpushStatus === 'active' ? 'success' : 'warning'" size="small">
                {{ form.pushWebpushStatus || t('admin.server_config.push.unconfigured') }}
              </n-tag>
            </n-form-item>
          </n-form>
        </n-card>
      </div>

      <!-- Actions -->
      <div class="config-actions mt-16px">
        <n-space>
          <n-button type="primary" :loading="saving" :disabled="!hasChanges" @click="handleSave">
            {{ t('common.save') }}
          </n-button>
          <n-button :disabled="!hasChanges" @click="handleRevert">
            {{ t('admin.server_config.revert') }}
          </n-button>
        </n-space>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NPageHeader,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  useDialog
} from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminService } from '@/services/matrix/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const dialog = useDialog()
const { handleAdminError } = useAdminErrorHandler()

const loading = ref(false)
const saving = ref(false)

interface ServerConfigForm {
  serverName: string
  registrationEnabled: boolean
  maxUploadSize: number | null
  presenceEnabled: boolean
  adminMfaRequired: boolean
  rbacEnabled: boolean
  loginLockoutThreshold: number | null
  federationEnabled: boolean
  federationAdmissionMode: string
  rateLimitEnabled: boolean
  rateLimitRps: number | null
  rateLimitBurst: number | null
  translationEnabled: boolean
  translationProvider: string
  translationTargetLanguage: string
  pushEnabled: boolean
  pushApnsStatus: string
  pushFcmStatus: string
  pushWebpushStatus: string
}

const defaultForm = (): ServerConfigForm => ({
  serverName: '',
  registrationEnabled: false,
  maxUploadSize: null,
  presenceEnabled: false,
  adminMfaRequired: false,
  rbacEnabled: false,
  loginLockoutThreshold: null,
  federationEnabled: false,
  federationAdmissionMode: 'open',
  rateLimitEnabled: false,
  rateLimitRps: null,
  rateLimitBurst: null,
  translationEnabled: false,
  translationProvider: 'google',
  translationTargetLanguage: 'zh',
  pushEnabled: false,
  pushApnsStatus: '',
  pushFcmStatus: '',
  pushWebpushStatus: ''
})

const form = reactive<ServerConfigForm>(defaultForm())
const originalForm = ref<ServerConfigForm>(defaultForm())

const hasChanges = computed(() => {
  return JSON.stringify(form) !== JSON.stringify(originalForm.value)
})

const federationAdmissionOptions = computed(() => [
  { label: t('admin.server_config.federation.mode_open'), value: 'open' },
  { label: t('admin.server_config.federation.mode_invite'), value: 'invite' },
  { label: t('admin.server_config.federation.mode_whitelist'), value: 'whitelist' }
])

const translationProviderOptions = computed(() => [
  { label: 'Google', value: 'google' },
  { label: 'DeepL', value: 'deepl' },
  { label: 'LibreTranslate', value: 'libretranslate' }
])

const targetLanguageOptions = computed(() => [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Español', value: 'es' },
  { label: 'Português', value: 'pt' },
  { label: 'Русский', value: 'ru' },
  { label: 'العربية', value: 'ar' }
])

function applyConfigToForm(config: Record<string, unknown>) {
  const general = (config.general ?? config) as Record<string, unknown>
  const security = (config.security ?? {}) as Record<string, unknown>
  const federation = (config.federation ?? {}) as Record<string, unknown>
  const rateLimit = (config.rate_limit ?? config.rateLimit ?? {}) as Record<string, unknown>
  const translation = (config.translation ?? {}) as Record<string, unknown>
  const push = (config.push ?? config.push_notifications ?? {}) as Record<string, unknown>

  form.serverName = String(general.server_name ?? general.serverName ?? '')
  form.registrationEnabled = Boolean(general.enable_registration ?? general.registrationEnabled ?? false)
  form.maxUploadSize = Number(general.max_upload_size ?? general.maxUploadSize ?? 0) / (1024 * 1024) || null
  form.presenceEnabled = Boolean(general.presence_enabled ?? general.presenceEnabled ?? false)

  form.adminMfaRequired = Boolean(security.admin_mfa_required ?? security.adminMfaRequired ?? false)
  form.rbacEnabled = Boolean(security.rbac_enabled ?? security.rbacEnabled ?? false)
  form.loginLockoutThreshold = Number(security.login_lockout_threshold ?? security.loginLockoutThreshold ?? 0) || null

  form.federationEnabled = Boolean(federation.enabled ?? federation.federationEnabled ?? false)
  form.federationAdmissionMode = String(federation.admission_mode ?? federation.admissionMode ?? 'open')

  form.rateLimitEnabled = Boolean(rateLimit.enabled ?? rateLimit.rateLimitEnabled ?? false)
  form.rateLimitRps = Number(rateLimit.requests_per_second ?? rateLimit.rps ?? 0) || null
  form.rateLimitBurst = Number(rateLimit.burst_count ?? rateLimit.burst ?? 0) || null

  form.translationEnabled = Boolean(translation.enabled ?? translation.translationEnabled ?? false)
  form.translationProvider = String(translation.provider ?? translation.translationProvider ?? 'google')
  form.translationTargetLanguage = String(translation.target_language ?? translation.targetLanguage ?? 'zh')

  form.pushEnabled = Boolean(push.enabled ?? push.pushEnabled ?? false)
  form.pushApnsStatus = String(push.apns_status ?? push.apnsStatus ?? '')
  form.pushFcmStatus = String(push.fcm_status ?? push.fcmStatus ?? '')
  form.pushWebpushStatus = String(push.webpush_status ?? push.webpushStatus ?? '')

  originalForm.value = { ...form }
}

function buildConfigPayload(): Record<string, unknown> {
  return {
    general: {
      server_name: form.serverName,
      enable_registration: form.registrationEnabled,
      max_upload_size: (form.maxUploadSize ?? 0) * 1024 * 1024,
      presence_enabled: form.presenceEnabled
    },
    security: {
      admin_mfa_required: form.adminMfaRequired,
      rbac_enabled: form.rbacEnabled,
      login_lockout_threshold: form.loginLockoutThreshold
    },
    federation: {
      enabled: form.federationEnabled,
      admission_mode: form.federationAdmissionMode
    },
    rate_limit: {
      enabled: form.rateLimitEnabled,
      requests_per_second: form.rateLimitRps,
      burst_count: form.rateLimitBurst
    },
    translation: {
      enabled: form.translationEnabled,
      provider: form.translationProvider,
      target_language: form.translationTargetLanguage
    },
    push_notifications: {
      enabled: form.pushEnabled
    }
  }
}

async function loadConfig() {
  loading.value = true
  try {
    const config = await adminService.getServerConfig()
    if (config) {
      applyConfigToForm(config)
    }
  } catch (err) {
    handleAdminError(err)
  } finally {
    loading.value = false
  }
}

function handleSave() {
  dialog.warning({
    title: t('admin.server_config.confirm_title'),
    content: t('admin.server_config.confirm_content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      saving.value = true
      try {
        const payload = buildConfigPayload()
        await adminService.updateServerConfig(payload)
        originalForm.value = { ...form }
      } catch (err) {
        handleAdminError(err, t('admin.server_config.save_failed'))
      } finally {
        saving.value = false
      }
    }
  })
}

function handleRevert() {
  Object.assign(form, { ...originalForm.value })
}

onMounted(loadConfig)
</script>

<style scoped>
.admin-server-config {
  padding: 16px 24px;
  max-width: 900px;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
