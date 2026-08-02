// =============================================================================
// 类型转换工具函数
// =============================================================================
// 提供安全的类型转换工具，用于在不同类型之间进行转换
// 与 typeGuard.ts 配合使用，形成完整的类型处理工具链
// =============================================================================

import { isArray, isBoolean, isEmpty, isNullOrUndefined, isNumber, isObject, isString } from './typeGuard'

// =============================================================================
// 基础类型转换
// =============================================================================

/**
 * 将未知值转换为字符串
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换后的字符串
 */
export function toString(value: unknown, defaultValue = ''): string {
  if (isString(value)) return value
  if (isNumber(value) || isBoolean(value)) return String(value)
  if (isNullOrUndefined(value)) return defaultValue
  try {
    return String(value)
  } catch {
    return defaultValue
  }
}

/**
 * 将未知值转换为数字
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换后的数字
 */
export function toNumber(value: unknown, defaultValue = 0): number {
  if (isNumber(value)) return value
  if (isString(value)) {
    const trimmed = value.trim()
    if (trimmed === '') return defaultValue
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }
  if (isBoolean(value)) return value ? 1 : 0
  return defaultValue
}

/**
 * 将未知值转换为整数
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换后的整数
 */
export function toInteger(value: unknown, defaultValue = 0): number {
  const num = toNumber(value, NaN)
  if (Number.isNaN(num)) return defaultValue
  return Math.trunc(num)
}

/**
 * 将未知值转换为布尔值
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换后的布尔值
 */
export function toBoolean(value: unknown, defaultValue = false): boolean {
  if (isBoolean(value)) return value
  if (isString(value)) {
    const lower = value.toLowerCase().trim()
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off' || lower === '') return false
    return defaultValue
  }
  if (isNumber(value)) return value !== 0
  return defaultValue
}

// =============================================================================
// 数组转换
// =============================================================================

/**
 * 将值转换为数组
 * @param value - 要转换的值
 * @param options - 转换选项
 * @returns 转换后的数组
 */
export function toArray<T = unknown>(
  value: unknown,
  options: { defaultValue?: T[]; splitString?: boolean; delimiter?: string } = {}
): T[] {
  const { defaultValue = [], splitString = false, delimiter = ',' } = options

  if (isArray(value)) return value as T[]

  if (splitString && isString(value) && value.length > 0) {
    return value.split(delimiter).map((s) => s.trim()) as unknown as T[]
  }

  return defaultValue
}

/**
 * 将值转换为特定类型的数组（映射转换）
 * @param value - 要转换的值
 * @param mapper - 映射函数
 * @param options - 转换选项
 * @returns 转换后的数组
 */
export function toTypedArray<T>(
  value: unknown,
  mapper: (item: unknown, index: number) => T | null | undefined,
  options: { defaultValue?: T[]; filterNull?: boolean } = {}
): T[] {
  const { defaultValue = [], filterNull = true } = options

  if (!isArray(value)) return defaultValue

  const mapped = value.map(mapper)

  if (filterNull) {
    return mapped.filter((item): item is T => item !== null && item !== undefined)
  }

  return mapped as T[]
}

// =============================================================================
// 对象转换
// =============================================================================

/**
 * 将值转换为对象
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 转换后的对象
 */
export function toObject<T extends Record<string, unknown>>(value: unknown, defaultValue: T | null = null): T | null {
  if (isObject(value)) return value as T

  if (isString(value)) {
    try {
      const parsed = JSON.parse(value)
      return isObject(parsed) ? (parsed as T) : defaultValue
    } catch {
      return defaultValue
    }
  }

  return defaultValue
}

/**
 * 将对象映射为新类型的对象
 * @param obj - 源对象
 * @param mapper - 属性映射函数
 * @returns 转换后的对象
 */
export function mapObject<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  obj: T,
  mapper: (key: keyof T, value: T[keyof T]) => [string, unknown] | null | undefined
): U {
  const result: Record<string, unknown> = {}

  for (const key in obj) {
    const mapped = mapper(key, obj[key])
    if (mapped) {
      const [newKey, newValue] = mapped
      result[newKey] = newValue
    }
  }

  return result as U
}

/**
 * 将对象转换为键值对数组
 * @param obj - 要转换的对象
 * @returns 键值对数组
 */
export function objectToEntries<T extends Record<string, unknown>>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

/**
 * 将键值对数组转换为对象
 * @param entries - 键值对数组
 * @returns 转换后的对象
 */
export function entriesToObject<K extends string, V>(entries: Array<[K, V]>): Record<K, V> {
  const result = {} as Record<K, V>
  for (const [key, value] of entries) {
    result[key] = value
  }
  return result
}

// =============================================================================
// 日期时间转换
// =============================================================================

/**
 * 将值转换为 Date 对象
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns Date 对象
 */
export function toDate(value: unknown, defaultValue: Date | null = null): Date | null {
  if (value instanceof Date) return value

  if (isNumber(value)) {
    // 处理 Unix 时间戳（秒）和毫秒时间戳
    const ts = value < 1e10 ? value * 1000 : value
    const date = new Date(ts)
    return Number.isNaN(date.getTime()) ? defaultValue : date
  }

  if (isString(value)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? defaultValue : date
  }

  return defaultValue
}

/**
 * 将值转换为 ISO 8601 日期字符串
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns ISO 8601 格式的日期字符串
 */
export function toISODateString(value: unknown, defaultValue = ''): string {
  const date = toDate(value, null)
  return date ? date.toISOString() : defaultValue
}

/**
 * 将值转换为 Unix 时间戳（毫秒）
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns Unix 时间戳（毫秒）
 */
export function toTimestamp(value: unknown, defaultValue = 0): number {
  const date = toDate(value, null)
  return date ? date.getTime() : defaultValue
}

// =============================================================================
// URL 和路径转换
// =============================================================================

/**
 * 将值转换为 URL 对象
 * @param value - 要转换的值
 * @param base - 基础 URL
 * @returns URL 对象或 null
 */
export function toURL(value: unknown, base?: string): URL | null {
  if (value instanceof URL) return value
  if (!isString(value)) return null

  try {
    return base ? new URL(value, base) : new URL(value)
  } catch {
    return null
  }
}

/**
 * 将值转换为 URL 字符串（规范化）
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值
 * @returns 规范化后的 URL 字符串
 */
export function toURLString(value: unknown, defaultValue = ''): string {
  const url = toURL(value)
  return url ? url.toString() : defaultValue
}

// =============================================================================
// 枚举转换
// =============================================================================

/**
 * 将字符串转换为枚举值（大小写不敏感）
 * @param value - 要转换的值
 * @param enumObj - 枚举对象
 * @param defaultValue - 转换失败时的默认值
 * @returns 枚举值
 */
export function toEnumValue<T extends Record<string, string | number>>(
  value: unknown,
  enumObj: T,
  defaultValue: T[keyof T]
): T[keyof T] {
  if (!isString(value) && !isNumber(value)) return defaultValue

  // 直接匹配
  const values = Object.values(enumObj)
  if (values.includes(value as T[keyof T])) return value as T[keyof T]

  // 字符串大小写不敏感匹配
  if (isString(value)) {
    const lowerValue = value.toLowerCase()
    const match = values.find((v) => isString(v) && v.toLowerCase() === lowerValue)
    if (match !== undefined) return match as T[keyof T]
  }

  return defaultValue
}

// =============================================================================
// 集合转换
// =============================================================================

/**
 * 将数组转换为 Set
 * @param value - 要转换的值
 * @returns Set 对象
 */
export function toSet<T>(value: unknown): Set<T> {
  const arr = toArray<T>(value)
  return new Set(arr)
}

/**
 * 将值转换为 Map
 * @param value - 要转换的值（可以是对象、数组的键值对、或 Map）
 * @returns Map 对象
 */
export function toMap<K extends string | number | symbol, V>(value: unknown): Map<K, V> {
  if (value instanceof Map) return value as Map<K, V>

  const result = new Map<K, V>()

  if (isObject(value)) {
    for (const [key, val] of Object.entries(value)) {
      result.set(key as K, val as V)
    }
  } else if (isArray(value)) {
    for (const item of value) {
      if (isArray(item) && item.length >= 2) {
        result.set(item[0] as K, item[1] as V)
      }
    }
  }

  return result
}

// =============================================================================
// 格式化转换
// =============================================================================

/**
 * 将字节数转换为人类可读的字符串
 * @param bytes - 字节数
 * @param decimals - 小数位数
 * @returns 格式化后的字符串（如 "1.5 MB"）
 */
export function bytesToHumanReadable(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  if (!isNumber(bytes) || bytes < 0) return 'Unknown'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const index = Math.min(i, sizes.length - 1)

  return `${parseFloat((bytes / k ** index).toFixed(decimals))} ${sizes[index]}`
}

/**
 * 将毫秒数转换为人类可读的时间字符串
 * @param ms - 毫秒数
 * @param options - 格式化选项
 * @returns 格式化后的时间字符串
 */
export function msToHumanReadable(ms: number, options: { includeMs?: boolean; compact?: boolean } = {}): string {
  const { includeMs = false, compact = false } = options

  if (!isNumber(ms) || ms < 0) return compact ? '0s' : '0 seconds'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (compact) {
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    if (includeMs && ms < 1000) return `${ms}ms`
    return `${seconds}s`
  }

  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`)
  if (hours % 24 > 0) parts.push(`${hours % 24} hour${hours % 24 > 1 ? 's' : ''}`)
  if (minutes % 60 > 0) parts.push(`${minutes % 60} minute${minutes % 60 > 1 ? 's' : ''}`)
  if (seconds % 60 > 0 || parts.length === 0) parts.push(`${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}`)

  return parts.join(', ')
}

// =============================================================================
// 安全转换（带验证）
// =============================================================================

/**
 * 尝试转换并验证结果
 * @param value - 要转换的值
 * @param converter - 转换函数
 * @param validator - 验证函数
 * @param defaultValue - 验证失败时的默认值
 * @returns 转换并验证后的值
 */
export function tryConvert<T>(
  value: unknown,
  converter: (v: unknown) => T,
  validator: (v: T) => boolean,
  defaultValue: T
): T {
  try {
    const result = converter(value)
    return validator(result) ? result : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * 批量转换对象属性
 * @param source - 源对象
 * @param converters - 转换器映射
 * @returns 转换后的对象
 */
export function convertProperties<T extends Record<string, unknown>>(
  source: Record<string, unknown>,
  converters: { [K in keyof T]: (v: unknown) => T[K] }
): T {
  const result = {} as T

  for (const key in converters) {
    result[key] = converters[key](source[key as string])
  }

  return result
}

// =============================================================================
// 特殊转换
// =============================================================================

/**
 * 将值转换为查询参数字符串
 * @param params - 参数对象
 * @returns URL 查询字符串
 */
export function toQueryString(params: Record<string, unknown>): string {
  const pairs: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (isNullOrUndefined(value)) continue
    if (isArray(value)) {
      for (const item of value) {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(toString(item))}`)
      }
    } else {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(toString(value))}`)
    }
  }

  return pairs.join('&')
}

/**
 * 将查询字符串转换为对象
 * @param queryString - 查询字符串
 * @returns 解析后的对象
 */
export function fromQueryString(queryString: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}

  if (!isString(queryString) || queryString.length === 0) return result

  const params = queryString.replace(/^\?/, '').split('&')

  for (const param of params) {
    const [key, value] = param.split('=').map((s) => decodeURIComponent(s))
    if (!key) continue

    if (key in result) {
      const existing = result[key]
      if (isArray(existing)) {
        existing.push(value)
      } else {
        result[key] = [existing as string, value]
      }
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * 将值转换为 CSS 尺寸字符串
 * @param value - 要转换的值（数字或带单位的字符串）
 * @param unit - 默认单位
 * @returns CSS 尺寸字符串
 */
export function toCSSDimension(value: unknown, unit = 'px'): string {
  if (isNumber(value)) return `${value}${unit}`
  if (isString(value)) {
    const trimmed = value.trim()
    if (/^-?[\d.]+(px|em|rem|%|vh|vw|vmin|vmax|ex|ch|cm|mm|in|pt|pc)?$/i.test(trimmed)) {
      return trimmed
    }
  }
  return '0'
}

/**
 * 安全地访问嵌套属性并转换
 * @param obj - 源对象
 * @param path - 属性路径（点分隔）
 * @param converter - 转换函数
 * @param defaultValue - 默认值
 * @returns 转换后的值
 */
export function getAndConvert<T>(
  obj: Record<string, unknown>,
  path: string,
  converter: (v: unknown) => T,
  defaultValue: T
): T {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (!isObject(current) || !(key in current)) {
      return defaultValue
    }
    current = (current as Record<string, unknown>)[key]
  }

  try {
    return converter(current)
  } catch {
    return defaultValue
  }
}

/**
 * 将值转换为适合显示的形式
 * @param value - 要转换的值
 * @param options - 选项
 * @returns 格式化后的显示字符串
 */
export function toDisplayString(
  value: unknown,
  options: { nullLabel?: string; undefinedLabel?: string; emptyLabel?: string } = {}
): string {
  const { nullLabel = 'null', undefinedLabel = 'undefined', emptyLabel = '' } = options

  if (value === null) return nullLabel
  if (value === undefined) return undefinedLabel
  if (isEmpty(value)) return emptyLabel
  if (isString(value)) return value
  if (isNumber(value) || isBoolean(value)) return String(value)

  try {
    return JSON.stringify(value)
  } catch {
    return '[Object]'
  }
}
