const MATRIX_USER_ID_REGEX = /^@[a-z0-9._=/+-]+:[a-zA-Z0-9.-]+$/
const MATRIX_ROOM_ID_REGEX = /^![a-zA-Z0-9]+:[a-zA-Z0-9.-]+$/

export function isValidMatrixUserId(value: string): boolean {
  return MATRIX_USER_ID_REGEX.test(value)
}

export function isValidMatrixRoomId(value: string): boolean {
  return MATRIX_ROOM_ID_REGEX.test(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
