import { useI18nGlobal } from '@/services/i18n'

export const validateSpecialChar = (value: string, patten = /[!@#¥$%.&*^()_+=\-~]/) => patten.test(value)

export const validateAlphaNumeric = (value: string) => {
  const hasLetter = /[a-zA-Z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  return hasLetter && hasNumber
}

export const validateUsername = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value || value.length < 3) {
    return { valid: false, message: t('validation.username_min_length') }
  }
  if (value.length > 20) {
    return { valid: false, message: t('validation.username_max_length') }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    return { valid: false, message: t('validation.username_invalid_chars') }
  }
  return { valid: true }
}

export const validatePassword = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value || value.length < 8) {
    return { valid: false, message: t('validation.password_min_length') }
  }
  if (value.length > 128) {
    return { valid: false, message: t('validation.password_max_length') }
  }
  const hasUpperCase = /[A-Z]/.test(value)
  const hasLowerCase = /[a-z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)

  const strength = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length

  if (strength < 2) {
    return { valid: false, message: t('validation.password_strength') }
  }
  return { valid: true }
}

export const validateEmail = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value) {
    return { valid: false, message: t('validation.email_required') }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return { valid: false, message: t('validation.email_invalid') }
  }
  return { valid: true }
}

export const validatePhone = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value) {
    return { valid: false, message: t('validation.phone_required') }
  }
  const phoneRegex = /^[\d\s\-+()]{7,20}$/
  if (!phoneRegex.test(value)) {
    return { valid: false, message: t('validation.phone_invalid') }
  }
  return { valid: true }
}

export const validateUrl = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value) {
    return { valid: false, message: t('validation.url_required') }
  }
  try {
    new URL(value)
    return { valid: true }
  } catch {
    return { valid: false, message: t('validation.url_invalid') }
  }
}

export const validateMatrixId = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value) {
    return { valid: false, message: t('validation.matrix_id_required') }
  }
  const matrixIdRegex = /^@[\w\-.]+:[\w\-.]+(\.[\w\-.]+)+$/
  if (!matrixIdRegex.test(value)) {
    return { valid: false, message: t('validation.matrix_id_invalid') }
  }
  return { valid: true }
}

export const validateRoomId = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value) {
    return { valid: false, message: t('validation.room_id_required') }
  }
  const roomIdRegex = /^![\w\-.]+:[\w\-.]+(\.[\w\-.]+)+$/
  if (!roomIdRegex.test(value)) {
    return { valid: false, message: t('validation.room_id_invalid') }
  }
  return { valid: true }
}

export const validateRoomAlias = (value: string): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value) {
    return { valid: false, message: t('validation.room_alias_required') }
  }
  const aliasRegex = /^#[\w\-.]+:[\w\-.]+(\.[\w\-.]+)+$/
  if (!aliasRegex.test(value)) {
    return { valid: false, message: t('validation.room_alias_invalid') }
  }
  return { valid: true }
}

export const sanitizeInput = (value: string): string => {
  if (!value) return ''
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export const validateFileType = (value: string, allowedTypes: string[]): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  if (!value) {
    return { valid: false, message: t('validation.file_type_required') }
  }
  const ext = value.split('.').pop()?.toLowerCase() || ''
  if (!allowedTypes.includes(ext)) {
    return { valid: false, message: t('validation.file_type_unsupported', { types: allowedTypes.join(', ') }) }
  }
  return { valid: true }
}

export const validateFileSize = (size: number, maxSizeInMB: number): { valid: boolean; message?: string } => {
  const { t } = useI18nGlobal()
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024
  if (size > maxSizeInBytes) {
    return { valid: false, message: t('validation.file_size_exceeded', { maxSize: maxSizeInMB }) }
  }
  return { valid: true }
}
