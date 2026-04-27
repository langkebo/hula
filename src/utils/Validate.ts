/**
 * 输入验证工具
 * 提供通用的输入验证函数，增强安全性
 */

/** 检查字符串是否包含特殊字符 */
export const validateSpecialChar = (value: string, patten = /[!@#¥$%.&*^()_+=\-~]/) => patten.test(value)

/** 检查字符是否包含英文和数字 */
export const validateAlphaNumeric = (value: string) => {
  const hasLetter = /[a-zA-Z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  return hasLetter && hasNumber
}

/** 验证用户名 */
export const validateUsername = (value: string): { valid: boolean; message?: string } => {
  if (!value || value.length < 3) {
    return { valid: false, message: '用户名至少需要3个字符' }
  }
  if (value.length > 20) {
    return { valid: false, message: '用户名不能超过20个字符' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    return { valid: false, message: '用户名只能包含字母、数字、下划线和连字符' }
  }
  return { valid: true }
}

/** 验证密码强度 */
export const validatePassword = (value: string): { valid: boolean; message?: string } => {
  if (!value || value.length < 8) {
    return { valid: false, message: '密码至少需要8个字符' }
  }
  if (value.length > 128) {
    return { valid: false, message: '密码不能超过128个字符' }
  }
  // 检查密码强度
  const hasUpperCase = /[A-Z]/.test(value)
  const hasLowerCase = /[a-z]/.test(value)
  const hasNumber = /[0-9]/.test(value)
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)

  const strength = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length

  if (strength < 2) {
    return { valid: false, message: '密码需要包含字母和数字' }
  }
  return { valid: true }
}

/** 验证邮箱格式 */
export const validateEmail = (value: string): { valid: boolean; message?: string } => {
  if (!value) {
    return { valid: false, message: '邮箱不能为空' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return { valid: false, message: '邮箱格式不正确' }
  }
  return { valid: true }
}

/** 验证手机号码 */
export const validatePhone = (value: string): { valid: boolean; message?: string } => {
  if (!value) {
    return { valid: false, message: '手机号码不能为空' }
  }
  // 简单验证：只允许数字和基本的分隔符
  const phoneRegex = /^[\d\s\-+()]{7,20}$/
  if (!phoneRegex.test(value)) {
    return { valid: false, message: '手机号码格式不正确' }
  }
  return { valid: true }
}

/** 验证 URL */
export const validateUrl = (value: string): { valid: boolean; message?: string } => {
  if (!value) {
    return { valid: false, message: 'URL不能为空' }
  }
  try {
    new URL(value)
    return { valid: true }
  } catch {
    return { valid: false, message: 'URL格式不正确' }
  }
}

/** 验证 Matrix ID (@user:server) */
export const validateMatrixId = (value: string): { valid: boolean; message?: string } => {
  if (!value) {
    return { valid: false, message: 'Matrix ID 不能为空' }
  }
  const matrixIdRegex = /^@[\w\-.]+:[\w\-.]+(\.[\w\-.]+)+$/
  if (!matrixIdRegex.test(value)) {
    return { valid: false, message: 'Matrix ID 格式不正确，格式应为 @user:server' }
  }
  return { valid: true }
}

/** 验证房间 ID (!room:server) */
export const validateRoomId = (value: string): { valid: boolean; message?: string } => {
  if (!value) {
    return { valid: false, message: '房间 ID 不能为空' }
  }
  const roomIdRegex = /^![\w\-.]+:[\w\-.]+(\.[\w\-.]+)+$/
  if (!roomIdRegex.test(value)) {
    return { valid: false, message: '房间 ID 格式不正确' }
  }
  return { valid: true }
}

/** 验证房间别名 (#room:server) */
export const validateRoomAlias = (value: string): { valid: boolean; message?: string } => {
  if (!value) {
    return { valid: false, message: '房间别名不能为空' }
  }
  const aliasRegex = /^#[\w\-.]+:[\w\-.]+(\.[\w\-.]+)+$/
  if (!aliasRegex.test(value)) {
    return { valid: false, message: '房间别名格式不正确' }
  }
  return { valid: true }
}

/** 清理输入字符串，防止 XSS */
export const sanitizeInput = (value: string): string => {
  if (!value) return ''
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/** 验证文件类型 */
export const validateFileType = (value: string, allowedTypes: string[]): { valid: boolean; message?: string } => {
  if (!value) {
    return { valid: false, message: '文件类型不能为空' }
  }
  const ext = value.split('.').pop()?.toLowerCase() || ''
  if (!allowedTypes.includes(ext)) {
    return { valid: false, message: `不支持的文件类型，允许的类型: ${allowedTypes.join(', ')}` }
  }
  return { valid: true }
}

/** 验证文件大小 */
export const validateFileSize = (size: number, maxSizeInMB: number): { valid: boolean; message?: string } => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024
  if (size > maxSizeInBytes) {
    return { valid: false, message: `文件大小不能超过 ${maxSizeInMB}MB` }
  }
  return { valid: true }
}
