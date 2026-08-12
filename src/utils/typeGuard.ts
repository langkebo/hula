// =============================================================================
// 类型守卫工具函数
// =============================================================================
// 提供安全的运行时类型检查，避免使用 any
// =============================================================================

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return value instanceof Promise || (isObject(value) && 'then' in value && 'catch' in value)
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

export function getProperty<T extends object, K extends string>(obj: T, key: K, defaultValue?: unknown): unknown {
  if (key in obj) {
    return (obj as Record<string, unknown>)[key]
  }
  return defaultValue
}

export function safeGet<T = unknown>(obj: unknown, path: string, defaultValue?: T): T | undefined {
  if (!isObject(obj)) return defaultValue

  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (!isObject(current) || !(key in current)) {
      return defaultValue
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current as T
}

export function typeGuard<T>(value: unknown, guard: (val: unknown) => val is T, defaultValue: T): T {
  return guard(value) ? value : defaultValue
}

export function unknownToString(value: unknown, _defaultValue = ''): string {
  if (isString(value)) return value
  if (isNumber(value)) return String(value)
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  return String(value)
}

export function unknownToNumber(value: unknown, defaultValue = 0): number {
  if (isNumber(value)) return value
  if (isString(value)) {
    const parsed = parseFloat(value)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }
  return defaultValue
}

export function unknownToBoolean(value: unknown, defaultValue = false): boolean {
  if (isBoolean(value)) return value
  if (isString(value)) return value.toLowerCase() === 'true'
  return defaultValue
}

export function unknownToArray<T = unknown>(value: unknown): T[] {
  if (isArray(value)) return value as T[]
  return []
}

export function unknownToObject<T = Record<string, unknown>>(value: unknown): T | null {
  return isObject(value) ? (value as T) : null
}

export function parseJSON<T = unknown>(json: string, defaultValue?: T): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return defaultValue ?? null
  }
}

export function safeJsonParse<T>(json: string, validator: (val: unknown) => val is T, defaultValue: T): T {
  try {
    const parsed: unknown = JSON.parse(json)
    return validator(parsed) ? parsed : defaultValue
  } catch {
    return defaultValue
  }
}

export function validateObject<T extends Record<string, unknown>>(
  value: unknown,
  requiredKeys: (keyof T)[],
  keyValidators?: Partial<Record<keyof T, (val: unknown) => boolean>>
): value is T {
  if (!isObject(value)) return false
  for (const key of requiredKeys) {
    if (!(key in value)) return false
    if (keyValidators?.[key] && !keyValidators[key]!((value as Record<string, unknown>)[key as string])) return false
  }
  return true
}

export function stringifyJSON(value: unknown, defaultValue = '{}'): string {
  try {
    return JSON.stringify(value)
  } catch {
    return defaultValue
  }
}

export function isEmptyObject(value: unknown): boolean {
  if (!isObject(value)) return false
  return Object.keys(value).length === 0
}

export function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return isObject(value) && Object.keys(value).length > 0
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (isString(value) && value === '') return true
  if (isArray(value) && value.length === 0) return true
  if (isObject(value) && Object.keys(value).length === 0) return true
  return false
}

export function isNonEmpty(value: unknown): boolean {
  return !isEmpty(value)
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  return result
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj }
  for (const key of keys) {
    delete result[key]
  }
  return result as Omit<T, K>
}

export function merge<T extends object, U extends object>(target: T, source: U): T & U {
  return { ...target, ...source }
}

export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (isArray(value)) return value.map((item) => deepClone(item)) as unknown as T
  if (isObject(value)) {
    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key in obj) {
      result[key] = deepClone(obj[key])
    }
    return result as T
  }
  return value
}

export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => isEqual(item, b[index]))
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a as Record<string, unknown>)
    const bKeys = Object.keys(b as Record<string, unknown>)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) => isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  }
  return false
}
