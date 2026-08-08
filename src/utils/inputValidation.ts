import { escapeHtml } from './escapeHtml'

const MATRIX_USER_ID_REGEX = /^@[a-z0-9._=/+-]+:[a-zA-Z0-9.-]+$/
const MATRIX_ROOM_ID_REGEX = /^![a-zA-Z0-9]+:[a-zA-Z0-9.-]+$/
const MATRIX_EVENT_ID_REGEX = /^\$[a-zA-Z0-9/+_-]+$/
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const URL_REGEX = /^https?:\/\/[^\s<>]+$/

export function isValidMatrixUserId(value: string): boolean {
  return MATRIX_USER_ID_REGEX.test(value)
}

export function isValidMatrixRoomId(value: string): boolean {
  return MATRIX_ROOM_ID_REGEX.test(value)
}

export function isValidMatrixEventId(value: string): boolean {
  return MATRIX_EVENT_ID_REGEX.test(value)
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value)
}

export function isValidUrl(value: string): boolean {
  return URL_REGEX.test(value)
}

export function sanitizeHtml(input: string): string {
  return escapeHtml(input)
}

export function sanitizeForLog(input: string, maxLength = 200): string {
  const trimmed = input.length > maxLength ? input.slice(0, maxLength) + '...' : input
  return trimmed.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ')
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function sanitizeDisplayName(name: string, maxLength = 50): string {
  return name.trim().slice(0, maxLength)
}

export function validatePagination(params: { limit?: number; offset?: number }): {
  limit: number
  offset: number
} {
  return {
    limit: clampNumber(params.limit ?? 50, 1, 1000),
    offset: clampNumber(params.offset ?? 0, 0, Number.MAX_SAFE_INTEGER)
  }
}
