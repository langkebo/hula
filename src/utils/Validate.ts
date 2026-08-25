/**
 * 密码校验规则须与服务端（synapse-rust validation.rs）保持一致：
 * - 长度 8-128
 * - 至少一个大写字母、一个小写字母、一个数字
 * - 至少一个特殊字符（服务端字符集 !@#$%^&*()_+-=[]{}|;:,.<>?）
 */
export const validateSpecialChar = (value: string, patten = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/) => patten.test(value)

export const validateAlphaNumeric = (value: string) => {
  const hasUppercase = /[A-Z]/.test(value)
  const hasLowercase = /[a-z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  return hasUppercase && hasLowercase && hasNumber
}

export const validatePasswordMinLength = (value: string) => value.length >= 8

/**
 * 用户名（昵称）校验须与服务端（synapse-rust validation.rs）保持一致：
 * 仅允许小写字母、数字以及 . _ = - 符号，长度 1-255。
 */
export const validateUsername = (value: string) => /^[a-z0-9._=-]+$/.test((value || '').trim())
