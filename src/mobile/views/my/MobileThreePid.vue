<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_three_pid.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_three_pid.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col p-16px gap-12px">
          <p class="text-14px text-[--tjg-text-secondary] m-0">{{ t('mobile_three_pid.intro') }}</p>

          <MobileAsyncState v-if="isEmpty" state="empty" :empty-text="t('mobile_three_pid.empty')" min-height="200px" />

          <van-cell-group v-else inset>
            <van-cell
              v-for="pid in threepids"
              :key="entryKey(pid)"
              :title="pid.address"
              :label="
                pid.medium === 'msisdn' ? t('mobile_three_pid.medium_msisdn') : t('mobile_three_pid.medium_email')
              "
              data-testid="three-pid-row">
              <template #right-icon>
                <div class="flex items-center gap-8px">
                  <van-tag :type="pid.validated ? 'success' : 'warning'">
                    {{ pid.validated ? t('mobile_three_pid.validated') : t('mobile_three_pid.unverified') }}
                  </van-tag>
                  <van-button
                    size="mini"
                    plain
                    type="danger"
                    :loading="removingKey === entryKey(pid)"
                    data-testid="three-pid-unbind"
                    @click="confirmUnbind(pid)">
                    {{ t('mobile_three_pid.unbind') }}
                  </van-button>
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <van-button type="primary" block data-testid="three-pid-add" @click="openForm">
            {{ t('mobile_three_pid.add_email') }}
          </van-button>

          <!--
            手机号流程对齐桌面端取舍：SDK 只有 `requestAdd3pidMsisdnToken`，
            没有对应的 submitToken 封装，后端也没有 msisdn 提交端点，
            做不出「发码 → 校验 → add」闭环，因此这里只做邮箱并显式说明。
          -->
          <p class="text-12px text-[--tjg-text-tertiary] m-0">{{ t('mobile_three_pid.msisdn_unavailable') }}</p>
        </div>
      </div>
    </template>

    <van-popup :show="showForm" position="bottom" round closeable @update:show="onFormVisibilityChange">
      <div class="flex flex-col gap-12px p-16px pb-24px">
        <div class="text-16px text-[--tjg-text-primary] font-600">{{ t('mobile_three_pid.add_email') }}</div>

        <van-field
          v-model="form.email"
          :label="t('mobile_three_pid.email_label')"
          :placeholder="t('mobile_three_pid.email_placeholder')"
          :disabled="Boolean(challenge)"
          data-testid="three-pid-email" />

        <van-field
          v-model="form.password"
          type="password"
          :label="t('mobile_three_pid.password_label')"
          :placeholder="t('mobile_three_pid.password_placeholder')"
          data-testid="three-pid-password" />

        <template v-if="challenge">
          <van-field
            v-model="form.token"
            :label="t('mobile_three_pid.code_label')"
            :placeholder="t('mobile_three_pid.code_placeholder')"
            data-testid="three-pid-code" />
          <p class="text-12px text-[--tjg-text-tertiary] m-0">
            {{ t('mobile_three_pid.code_hint', { email: form.email }) }}
          </p>
        </template>

        <p v-if="formError" class="text-12px text-[--tjg-color-danger-500] m-0" role="alert">
          {{ formError }}
        </p>

        <div class="flex gap-12px">
          <van-button block data-testid="three-pid-cancel" @click="closeForm">
            {{ t('mobile_three_pid.cancel') }}
          </van-button>
          <van-button
            v-if="!challenge"
            block
            type="primary"
            :loading="sending"
            data-testid="three-pid-send-code"
            @click="handleSendCode">
            {{ t('mobile_three_pid.send_code') }}
          </van-button>
          <van-button v-else block type="primary" :loading="binding" data-testid="three-pid-bind" @click="handleBind">
            {{ t('mobile_three_pid.bind') }}
          </van-button>
        </div>
      </div>
    </van-popup>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { matrixAccountService } from '@/services/matrix'
import type { ThreePidEntry } from '@/services/matrix/user/accountThreePids'
import { createLogger } from '@/utils/Logger'

/**
 * 移动端「邮箱 / 手机号」绑定页（3PID）。
 *
 * 与桌面 `src/components/settings/ThreePidSection.vue` 共用同一组账号服务的 3PID 方法，
 * 绑定是三步流程：发码（拿到 sid + clientSecret）→ 用户填验证码 submitToken → 带密码 add。
 * `clientSecret` 由 `requestThreePidEmailToken` 内部生成并回传，本页只负责保管到 add 时回传。
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const logger = createLogger('MobileThreePid')

const { t } = useI18n()

const loading = ref(false)
const threepids = ref<ThreePidEntry[]>([])
const removingKey = ref('')

const showForm = ref(false)
const sending = ref(false)
const binding = ref(false)
const formError = ref('')
const challenge = ref<{ sid: string; clientSecret: string } | null>(null)

const form = reactive({
  email: '',
  password: '',
  token: ''
})

const isEmpty = computed(() => threepids.value.length === 0)

function entryKey(pid: ThreePidEntry): string {
  return `${pid.medium}:${pid.address}`
}

async function loadThreePids(): Promise<void> {
  loading.value = true
  try {
    const response = await matrixAccountService.getThreePids()
    threepids.value = response.threepids
  } catch (error) {
    logger.error('Failed to load three pids', error)
    showToast({ type: 'fail', message: t('mobile_three_pid.load_failed') })
  } finally {
    loading.value = false
  }
}

async function confirmUnbind(pid: ThreePidEntry): Promise<void> {
  try {
    await showConfirmDialog({
      title: t('mobile_three_pid.unbind_confirm_title'),
      message: t('mobile_three_pid.unbind_confirm_content', { address: pid.address }),
      confirmButtonText: t('mobile_three_pid.unbind'),
      cancelButtonText: t('mobile_three_pid.cancel')
    })
  } catch {
    return
  }

  removingKey.value = entryKey(pid)
  try {
    await matrixAccountService.deleteThreePid(pid.medium, pid.address)
    threepids.value = threepids.value.filter((item) => entryKey(item) !== entryKey(pid))
    showToast(t('mobile_three_pid.unbind_success'))
  } catch (error) {
    logger.error('Failed to unbind three pid', error)
    showToast({ type: 'fail', message: t('mobile_three_pid.unbind_failed') })
  } finally {
    removingKey.value = ''
  }
}

function openForm(): void {
  resetForm()
  showForm.value = true
}

function closeForm(): void {
  showForm.value = false
  resetForm()
}

/** 蒙层点击 / 关闭按钮也走 reset，避免下次打开残留上一次的验证码与错误提示 */
function onFormVisibilityChange(visible: boolean): void {
  if (visible) {
    showForm.value = true
    return
  }
  closeForm()
}

function resetForm(): void {
  form.email = ''
  form.password = ''
  form.token = ''
  formError.value = ''
  challenge.value = null
}

async function handleSendCode(): Promise<void> {
  formError.value = ''

  const email = form.email.trim()
  if (!EMAIL_PATTERN.test(email)) {
    formError.value = t('mobile_three_pid.err_invalid_email')
    return
  }
  if (!form.password) {
    formError.value = t('mobile_three_pid.err_password_required')
    return
  }

  sending.value = true
  try {
    const result = await matrixAccountService.requestThreePidEmailToken(email)
    challenge.value = { sid: result.sid, clientSecret: result.clientSecret }
    form.token = ''
    showToast(t('mobile_three_pid.request_success'))
  } catch (error) {
    logger.error('Failed to request three pid email token', error)
    formError.value = t('mobile_three_pid.request_failed')
  } finally {
    sending.value = false
  }
}

async function handleBind(): Promise<void> {
  formError.value = ''

  const current = challenge.value
  if (!current) {
    return
  }

  const token = form.token.trim()
  if (!token) {
    formError.value = t('mobile_three_pid.err_code_required')
    return
  }
  if (!form.password) {
    formError.value = t('mobile_three_pid.err_password_required')
    return
  }

  binding.value = true
  try {
    await matrixAccountService.submitThreePidEmailToken(current.sid, current.clientSecret, token)
    await matrixAccountService.addThreePidWithPassword(current.sid, current.clientSecret, form.password)
    closeForm()
    await loadThreePids()
    showToast(t('mobile_three_pid.bind_success'))
  } catch (error) {
    logger.error('Failed to bind three pid email', error)
    formError.value = t('mobile_three_pid.bind_failed')
  } finally {
    binding.value = false
  }
}

onMounted(async () => {
  await loadThreePids()
})
</script>
