/**
 * 密码强度口径 —— 桌面端与移动端共用的唯一事实源。
 *
 * 规则与后端 synapse-rust 密码策略保持一致（6 条）：
 * 长度下限、长度上限、大写、小写、数字、特殊字符。
 *
 * 历史问题：这些规则原先内联在桌面端 `AccountSettings.vue`，
 * 移动端若要复用只能复制一份，两处极易漂移——移动端放过后端拒绝的密码，
 * 或反之。此处集中后，两端只消费同一实现。
 */

/** 与后端一致的长度下限 */
export const PASSWORD_MIN_LENGTH = 8

/** 与后端一致的长度上限 */
export const PASSWORD_MAX_LENGTH = 128

/** 特殊字符集合（与后端策略一致） */
const SPECIAL_CHARS_PATTERN = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/

/** 规则 id（供 i18n key 与测试断言使用） */
export type PasswordRuleId = 'minLength' | 'maxLength' | 'uppercase' | 'lowercase' | 'digit' | 'special'

export interface PasswordRuleResult {
  id: PasswordRuleId
  passed: boolean
}

/**
 * 逐条评估密码规则。
 *
 * @param password 待评估密码
 * @returns 6 条规则的通过状态，顺序固定
 */
export function evaluatePasswordRules(password: string): PasswordRuleResult[] {
  const value = password ?? ''
  return [
    { id: 'minLength', passed: value.length >= PASSWORD_MIN_LENGTH },
    { id: 'maxLength', passed: value.length <= PASSWORD_MAX_LENGTH },
    { id: 'uppercase', passed: /[A-Z]/.test(value) },
    { id: 'lowercase', passed: /[a-z]/.test(value) },
    { id: 'digit', passed: /[0-9]/.test(value) },
    { id: 'special', passed: SPECIAL_CHARS_PATTERN.test(value) }
  ]
}

/**
 * 返回未通过的规则 id 列表。
 *
 * @param password 待评估密码
 * @returns 未通过规则；空数组表示满足全部规则
 */
export function validatePasswordStrengthRuleIds(password: string): PasswordRuleId[] {
  return evaluatePasswordRules(password)
    .filter((rule) => !rule.passed)
    .map((rule) => rule.id)
}

/** 通过规则数 → 强度等级（0..4）的映射阈值 */
const LEVEL_THRESHOLDS: ReadonlyArray<number> = [2, 4, 5, 6]

/**
 * 计算密码强度等级，用于 4 段色条指示器。
 *
 * - 0：未输入 / 通过规则 ≤1
 * - 1：弱、2：一般、3：较强、4：强（全部 6 条通过）
 *
 * @param password 待评估密码
 * @returns 0..4
 */
export function getPasswordStrengthLevel(password: string): number {
  const value = password ?? ''
  if (!value) return 0

  const passed = evaluatePasswordRules(value).filter((rule) => rule.passed).length
  let level = 0
  for (const threshold of LEVEL_THRESHOLDS) {
    if (passed >= threshold) level += 1
  }
  return level
}

/**
 * 规则 id → i18n key 后缀（`setting.account.password_*`）。
 *
 * 两端共用，避免各自拼 key 造成漏配。
 */
export const PASSWORD_RULE_I18N_KEYS: Readonly<Record<PasswordRuleId, string>> = {
  minLength: 'password_too_short',
  maxLength: 'password_too_long',
  uppercase: 'password_need_uppercase',
  lowercase: 'password_need_lowercase',
  digit: 'password_need_digit',
  special: 'password_need_special'
}

/**
 * 返回第一条未通过规则对应的 i18n key 后缀。
 *
 * @param password 待评估密码
 * @returns i18n key 后缀，或 null（全部通过）
 */
export function firstPasswordRuleViolationKey(password: string): string | null {
  const [firstFailed] = validatePasswordStrengthRuleIds(password)
  return firstFailed ? PASSWORD_RULE_I18N_KEYS[firstFailed] : null
}
