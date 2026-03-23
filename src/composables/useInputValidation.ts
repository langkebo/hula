import { ref, computed } from 'vue'
import DOMPurify from 'dompurify'

export interface ValidationRule {
  type:
    | 'required'
    | 'minLength'
    | 'maxLength'
    | 'email'
    | 'url'
    | 'pattern'
    | 'custom'
    | 'xss'
    | 'number'
    | 'integer'
    | 'range'
  message?: string
  value?: number | RegExp
  validator?: (value: unknown) => boolean | Promise<boolean>
}

export interface ValidationResult {
  valid: boolean
  message?: string
}

export interface UseInputValidationOptions {
  rules?: ValidationRule[]
  sanitize?: boolean
  trim?: boolean
}

/**
 * Input Validation Composable
 * 提供通用的输入验证功能，包括 XSS 防护
 */
export function useInputValidation(initialValue = '', options: UseInputValidationOptions = {}) {
  const { rules = [], sanitize = true, trim = true } = options

  const value = ref(initialValue)
  const touched = ref(false)
  const errors = ref<string[]>([])

  // XSS 防护 sanitization
  const sanitizeInput = (input: string): string => {
    if (!sanitize) return input
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    })
  }

  // 验证单个规则
  const validateRule = async (rule: ValidationRule, val: string): Promise<ValidationResult> => {
    const trimmed = trim ? val.trim() : val

    switch (rule.type) {
      case 'required':
        if (!trimmed || trimmed.length === 0) {
          return { valid: false, message: rule.message || '此字段为必填项' }
        }
        break

      case 'minLength':
        if (trimmed.length < (rule.value as number)) {
          return { valid: false, message: rule.message || `最少需要 ${rule.value} 个字符` }
        }
        break

      case 'maxLength':
        if (trimmed.length > (rule.value as number)) {
          return { valid: false, message: rule.message || `最多允许 ${rule.value} 个字符` }
        }
        break

      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmed)) {
          return { valid: false, message: rule.message || '请输入有效的邮箱地址' }
        }
        break
      }

      case 'url':
        try {
          new URL(trimmed)
        } catch {
          return { valid: false, message: rule.message || '请输入有效的 URL' }
        }
        break

      case 'pattern':
        if (rule.value instanceof RegExp && !rule.value.test(trimmed)) {
          return { valid: false, message: rule.message || '格式不正确' }
        }
        break

      case 'xss': {
        const sanitized = sanitizeInput(trimmed)
        if (sanitized !== trimmed) {
          return { valid: false, message: rule.message || '输入包含不安全的内容' }
        }
        break
      }

      case 'number':
        if (isNaN(Number(trimmed))) {
          return { valid: false, message: rule.message || '请输入有效的数字' }
        }
        break

      case 'integer':
        if (!Number.isInteger(Number(trimmed))) {
          return { valid: false, message: rule.message || '请输入整数' }
        }
        break

      case 'range':
        if (rule.value && Array.isArray(rule.value)) {
          const num = Number(trimmed)
          const [min, max] = rule.value
          if (num < min || num > max) {
            return { valid: false, message: rule.message || `请输入 ${min} 到 ${max} 之间的数值` }
          }
        }
        break

      case 'custom':
        if (rule.validator) {
          const result = await rule.validator(trimmed)
          if (!result) {
            return { valid: false, message: rule.message || '验证失败' }
          }
        }
        break
    }

    return { valid: true }
  }

  // 验证所有规则
  const validate = async (): Promise<boolean> => {
    touched.value = true
    const currentValue = value.value
    const validationResults = await Promise.all(rules.map((rule) => validateRule(rule, currentValue)))

    errors.value = validationResults.filter((result) => !result.valid).map((result) => result.message || '验证失败')

    return errors.value.length === 0
  }

  // 快速验证（不设置 touched 状态）
  const quickValidate = async (val: string): Promise<boolean> => {
    const validationResults = await Promise.all(rules.map((rule) => validateRule(rule, val)))
    return validationResults.every((result) => result.valid)
  }

  // 重置
  const reset = () => {
    value.value = initialValue
    touched.value = false
    errors.value = []
  }

  // 设置值
  const setValue = (newValue: string) => {
    value.value = sanitize ? sanitizeInput(newValue) : newValue
  }

  const isValid = computed(() => errors.value.length === 0)

  return {
    value,
    touched,
    errors,
    isValid,
    validate,
    quickValidate,
    reset,
    setValue,
    sanitizeInput
  }
}

/**
 * 常用验证规则预设
 */
export const validationPresets = {
  username: [
    { type: 'required', message: '请输入用户名' },
    { type: 'minLength', value: 3, message: '用户名至少 3 个字符' },
    { type: 'maxLength', value: 20, message: '用户名最多 20 个字符' },
    { type: 'pattern', value: /^[a-zA-Z0-9_-]+$/, message: '只允许字母、数字、下划线和连字符' }
  ],
  password: [
    { type: 'required', message: '请输入密码' },
    { type: 'minLength', value: 8, message: '密码至少 8 个字符' }
  ],
  email: [
    { type: 'required', message: '请输入邮箱' },
    { type: 'email', message: '请输入有效的邮箱地址' }
  ],
  url: [{ type: 'url', message: '请输入有效的 URL' }],
  message: [
    { type: 'xss', message: '输入包含不安全的内容' },
    { type: 'maxLength', value: 10000, message: '消息最多 10000 个字符' }
  ]
}
