import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSettingsTabDirty } from '@/composables/settings/useSettingsDirtyRegistry'
import { useAccount } from '@/composables/user/useAccount'
import { firstPasswordRuleViolationKey } from '@/utils/passwordStrength'

/**
 * 账号设置页的密码修改表单与提交逻辑。
 * 从 `AccountSettings.vue` 下沉，组件只保留模板与跨区块组合。
 */
export function useAccountPassword() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { changePassword } = useAccount()

  const passwordLoading = ref(false)
  const logoutDevices = ref(false)

  const passwordForm = reactive({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const hasUnsavedPasswordChanges = computed(() => {
    return Boolean(passwordForm.oldPassword || passwordForm.newPassword || passwordForm.confirmPassword)
  })

  useSettingsTabDirty('account', hasUnsavedPasswordChanges)

  /**
   * 校验密码强度（与后端 synapse-rust 策略一致）。
   *
   * 规则实现已抽到 `@/utils/passwordStrength`，与移动端共用同一事实源；
   * 此处只负责把规则 id 映射到 i18n 文案。
   */
  function validatePasswordStrength(password: string): string | null {
    const key = firstPasswordRuleViolationKey(password)
    return key ? t(`setting.account.${key}`) : null
  }

  async function handlePasswordChange() {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      showFeedback(t('setting.account.password_incomplete'), 'warning')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showFeedback(t('setting.account.password_mismatch'), 'warning')
      return
    }

    const strengthError = validatePasswordStrength(passwordForm.newPassword)
    if (strengthError) {
      showFeedback(strengthError, 'warning')
      return
    }

    passwordLoading.value = true
    try {
      await changePassword(passwordForm.oldPassword, passwordForm.newPassword, logoutDevices.value)
      showFeedback(t('setting.account.password_changed'), 'success')
      passwordForm.oldPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
    } catch (error) {
      const errMsg = formatMatrixError(error)
      // 根据错误码提供更精确的提示
      const errObj = error as Record<string, unknown>
      const errcode = (errObj?.errcode as string) || (errObj?.code as string) || ''
      if (errcode === 'M_WEAK_PASSWORD') {
        showFeedback(t('setting.account.password_too_weak'), 'error')
      } else if (errcode === 'M_FORBIDDEN' || errMsg.includes('403')) {
        showFeedback(t('setting.account.password_wrong_current'), 'error')
      } else {
        showFeedback(t('setting.account.password_change_failed_with_hint'), 'error')
      }
    } finally {
      passwordLoading.value = false
    }
  }

  return {
    passwordLoading,
    logoutDevices,
    passwordForm,
    handlePasswordChange
  }
}
