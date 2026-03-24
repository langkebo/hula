/**
 * 类型守卫工具 - 替代 any 的安全方案
 */

/**
 * 检查值是否为对象
 */
export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * 检查值是否为字符串
 */
export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

/**
 * 检查值是否为数字
 */
export function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val)
}

/**
 * 检查值是否为布尔值
 */
export function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean'
}

/**
 * 检查值是否为数组
 */
export function isArray<T>(val: unknown): val is T[] {
  return Array.isArray(val)
}

/**
 * 检查值是否为 undefined
 */
export function isUndefined(val: unknown): val is undefined {
  return val === undefined
}

/**
 * 检查值是否为 null
 */
export function isNull(val: unknown): val is null {
  return val === null
}

/**
 * 检查值是否为空（null, undefined, '', [], {}）
 */
export function isEmpty(val: unknown): boolean {
  if (isNull(val) || isUndefined(val)) return true
  if (isString(val)) return val === ''
  if (isArray(val)) return val.length === 0
  if (isObject(val)) return Object.keys(val).length === 0
  return false
}

/**
 * 安全获取对象属性
 */
export function getProp<T, K extends string>(obj: T, key: K): unknown {
  return (obj as Record<string, unknown>)?.[key]
}

/**
 * 安全获取嵌套属性
 */
export function getNestedProp<T>(obj: T, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    return isObject(acc) ? (acc as Record<string, unknown>)[part] : undefined
  }, obj)
}
