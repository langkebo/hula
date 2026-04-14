import type { Room, RoomMember, MatrixEvent } from 'matrix-js-sdk'

export function isRoom(value: unknown): value is Room {
  return (
    value !== null && typeof value === 'object' && 'roomId' in (value as object) && 'getMember' in (value as object)
  )
}

export function isRoomMember(value: unknown): value is RoomMember {
  return value !== null && typeof value === 'object' && 'userId' in (value as object) && 'roomId' in (value as object)
}

export function isMatrixEvent(value: unknown): value is MatrixEvent {
  return value !== null && typeof value === 'object' && 'event' in (value as object) && 'getType' in (value as object)
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  if (isObject(value)) return Object.keys(value).length === 0
  return false
}

export function hasProperty<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return isObject(value) && key in value
}

export function getProperty<T = unknown>(value: unknown, key: string, defaultValue?: T): T {
  if (isObject(value) && key in value) {
    return (value as Record<string, unknown>)[key] as T
  }
  return defaultValue as T
}

export function safeGet<T = unknown>(obj: unknown, path: string, defaultValue?: T): T {
  if (!isObject(obj)) return defaultValue as T

  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (!isObject(current) || !(key in current)) {
      return defaultValue as T
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current as T
}
