/**
 * 通用类型转换工具 - 替代 any 的安全方案
 */

import { isObject, isString, isNumber, isArray, isBoolean } from './typeGuard'

// ==================== 通用转换 ====================

/**
 * 安全转换为字符串
 */
export function toStringValue(value: unknown, fallback = ''): string {
  if (isString(value)) return value
  if (isNumber(value)) return String(value)
  if (isBoolean(value)) return String(value)
  if (value === null || value === undefined) return fallback
  return String(value)
}

/**
 * 安全转换为数字
 */
export function toNumberValue(value: unknown, fallback = 0): number {
  if (isNumber(value)) return value
  if (isString(value)) {
    const num = Number(value)
    return Number.isNaN(num) ? fallback : num
  }
  return fallback
}

/**
 * 安全转换为布尔值
 */
export function toBooleanValue(value: unknown): boolean {
  if (isBoolean(value)) return value
  if (isString(value)) return value === 'true' || value === '1'
  return Boolean(value)
}

/**
 * 安全转换为数组
 */
export function toArray<T>(value: unknown): T[] {
  if (isArray(value)) return value as T[]
  if (value === null || value === undefined) return []
  return [value] as T[]
}

/**
 * 安全转换为对象
 */
export function toObject<T extends Record<string, unknown>>(value: unknown, fallback = {} as T): T {
  if (isObject(value)) return value as T
  return fallback
}

// ==================== 索引访问 ====================

/**
 * 安全获取数组元素
 */
export function getArrayItem<T>(arr: unknown[], index: number, fallback?: T): T | undefined {
  if (!isArray(arr)) return fallback
  const item = arr[index]
  return (item as T) ?? fallback
}

/**
 * 安全获取对象属性
 */
export function getObjectProp<T, K extends keyof T>(obj: T, key: K, fallback?: T[K]): T[K] | undefined {
  if (!isObject(obj)) return fallback
  return obj[key] ?? fallback
}

/**
 * 安全获取嵌套属性
 */
export function getNestedValue<T = unknown>(obj: unknown, path: string, fallback?: T): T | undefined {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (!isObject(current)) return fallback
    current = (current as Record<string, unknown>)[part]
  }

  return (current as T) ?? fallback
}

// ==================== 类型断言替代 ====================

/**
 * 安全类型断言 - 返回推断类型
 */
export function as<T>(value: unknown): asserts value is T {
  // 仅在开发环境警告
  if (import.meta.env.DEV && value === undefined) {
    console.warn('[typeGuard] as() received undefined')
  }
}

/**
 * 强制类型转换（慎用）
 */
export function cast<T>(value: unknown, _target: T): T {
  return value as T
}

/**
 * 默认值提供
 */
export function defaultValue<T>(value: unknown, defaultVal: T): T {
  if (value === null || value === undefined) return defaultVal
  return value as T
}

// ==================== 事件/回调类型 ====================

/**
 * 安全的事件处理器
 */
export type EventHandler<T = unknown> = (data: T) => void

/**
 * 创建安全的事件处理器
 */
export function createEventHandler<T>(handler: (data: T) => void): EventHandler<T> {
  return (data: T) => {
    try {
      handler(data)
    } catch (error) {
      console.error('[EventHandler] Error:', error)
    }
  }
}

/**
 * 安全调用回调
 */
export function safeCall<T>(callback: ((...args: T[]) => void) | undefined, ...args: T[]): void {
  if (typeof callback === 'function') {
    callback(...args)
  }
}

// ==================== JSON 安全 ====================

/**
 * 安全解析 JSON
 */
export function safeJsonParse<T = unknown>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * 安全序列化
 */
export function safeJsonStringify(obj: unknown, fallback = ''): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return fallback
  }
}

// ==================== 函数类型 ====================

/**
 * 安全的函数调用
 */
export function callFn<T>(fn: (() => T) | undefined, fallback: T): T {
  if (typeof fn === 'function') {
    try {
      return fn()
    } catch {
      return fallback
    }
  }
  return fallback
}

/**
 * 防抖函数调用
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * 节流函数调用
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
