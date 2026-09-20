<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_password.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <p class="text-14px text-[--tjg-text-secondary] m-0">{{ t('mobile_password.intro') }}</p>

          <van-cell-group inset>
            <!-- 旧密码 -->
            <van-field
              v-model="oldPassword"
              type="password"
              autocomplete="current-password"
              :aria-label="t('mobile_password.old_label')"
              :label="t('mobile_password.old_label')"
              :placeholder="t('mobile_password.old_placeholder')" />

            <!-- 新密码 -->
            <van-field
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              :aria-label="t('mobile_password.new_label')"
              :label="t('mobile_password.new_label')"
              :placeholder="t('mobile_password.new_placeholder')" />

            <!-- 确认密码 -->
            <van-field
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              :aria-label="t('mobile_password.confirm_label')"
              :label="t('mobile_password.confirm_label')"
              :placeholder="t('mobile_password.confirm_placeholder')" />
          </van-cell-group>

          <!-- 强度指示器：4 段色条 + 可读文案（不只靠颜色传达） -->
          <div class="px-16px flex flex-col gap-8px" role="status" aria-live="polite">
            <div class="flex gap-6px" aria-hidden="true">
              <span
                v-for="segment in 4"
                :key="segment"
                class="h-4px flex-1 rounded-full"
                :class="segment <= strengthLevel ? strengthBarClass : 'bg-[--tjg-surface-subtle]'" />
            </div>
            <div class="text-12px text-[--tjg-text-secondary]">
              {{ t('mobile_password.strength_label') }}：{{ strengthText }}
            </div>
            <!-- 逐条规则提示：满足渐进式披露 -->
            <ul v-if="newPassword" class="m-0 p-0 list-none flex flex-col gap-2px">
              <li
                v-for="rule in ruleResults"
                :key="rule.id"
                class="text-12px flex items-center gap-4px"
                :class="rule.passed ? 'text-[--tjg-color-success-500]' : 'text-[--tjg-text-tertiary]'">
                <span aria-hidden="true">{{ rule.passed ? '✓' : '·' }}</span>
                <span>{{ t(`mobile_password.rule_${rule.id}`) }}</span>
              </li>
            </ul>
          </div>

          <van-cell-group inset>
            <van-checkbox v-model="logoutOthers" class="px-16px py-12px">
              {{ t('mobile_password.logout_others') }}
            </van-checkbox>
          </van-cell-group>

          <div class="px-16px mt-8px">
            <van-button type="primary" block :disabled="!canSubmit" :loading="submitting" @click="handleSubmit">
              {{ t('mobile_password.submit') }}
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showLoadingToast, showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
import { useAccount } from '@/composables/user/useAccount'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { createLogger } from '@/utils/Logger'
import {
  evaluatePasswordRules,
  getPasswordStrengthLevel,
  validatePasswordStrengthRuleIds
} from '@/utils/passwordStrength'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from './settingsRoutes'

const logger = createLogger('MobilePasswordSettings')

const { t } = useI18n()
const router = useRouter()
const { changePassword } = useAccount()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const logoutOthers = ref(false)
const submitting = ref(false)

/** 4 段强度等级 */
const strengthLevel = computed(() => getPasswordStrengthLevel(newPassword.value))

/** 强度文案（不只靠颜色） */
const strengthText = computed(() => {
  const keys = ['strength_none', 'strength_weak', 'strength_fair', 'strength_good', 'strength_strong']
  return t(`mobile_password.${keys[strengthLevel.value]}`)
})

const strengthBarClass = computed(() => {
  if (strengthLevel.value <= 1) return 'bg-[--tjg-color-danger-500]'
  if (strengthLevel.value === 2) return 'bg-[--tjg-color-warning-500]'
  return 'bg-[--tjg-color-success-500]'
})

/** 逐条规则结果（供列表展示） */
const ruleResults = computed(() => evaluatePasswordRules(newPassword.value))

const canSubmit = computed(
  () => Boolean(oldPassword.value) && Boolean(newPassword.value) && Boolean(confirmPassword.value) && !submitting.value
)

async function handleSubmit(): Promise<void> {
  if (submitting.value) return

  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    showToast(t('mobile_password.incomplete'))
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    showToast(t('mobile_password.mismatch'))
    return
  }
  const violations = validatePasswordStrengthRuleIds(newPassword.value)
  if (violations.length > 0) {
    // 逐条提示第一条未满足的规则，便于用户定向修复
    showToast(t(`mobile_password.rule_${violations[0]}`))
    return
  }

  submitting.value = true
  const toast = showLoadingToast({ message: t('mobile_password.submitting'), forbidClick: true, duration: 0 })
  try {
    await changePassword(oldPassword.value, newPassword.value, logoutOthers.value)
    toast.close()
    showToast(t('mobile_password.success'))
    // 成功后清空敏感输入，避免停留在页面上
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
  } catch (error) {
    toast.close()
    logger.error('Change password failed', error)
    showToast({ type: 'fail', message: formatMatrixError(error) || t('mobile_password.failed') })
  } finally {
    submitting.value = false
  }
}
</script>
