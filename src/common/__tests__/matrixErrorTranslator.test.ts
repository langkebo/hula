import { describe, expect, it } from 'vitest'
import { getErrorAction, isRecoverableError, translateMatrixError } from '../matrixErrorTranslator'

describe('matrixErrorTranslator', () => {
  it('translates M_FORBIDDEN', () => {
    const result = translateMatrixError({ errcode: 'M_FORBIDDEN' })
    expect(result.userMessage).toBe('error.matrix.forbidden')
    expect(result.recoverable).toBe(false)
  })

  it('translates login M_FORBIDDEN as invalid credentials', () => {
    const result = translateMatrixError({ errcode: 'M_FORBIDDEN' }, { context: 'login' })
    expect(result.userMessage).toBe('error.matrix.invalid_credentials')
    expect(result.recoverable).toBe(false)
  })

  it('translates M_UNKNOWN_TOKEN with relogin action', () => {
    const result = translateMatrixError({ errcode: 'M_UNKNOWN_TOKEN' })
    expect(result.action).toBe('relogin')
    expect(result.level).toBe('dialog')
  })

  it('translates M_LIMIT_EXCEEDED with retry_after_ms', () => {
    const result = translateMatrixError({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 3000 })
    expect(result.retryAfterMs).toBe(3000)
    expect(result.action).toBe('retry')
  })

  it('translates network errors', () => {
    const result = translateMatrixError(new TypeError('Failed to fetch'))
    expect(result.action).toBe('check_network')
    expect(result.recoverable).toBe(true)
  })

  it('translates HTTP 429 status', () => {
    const result = translateMatrixError({ httpStatus: 429 })
    expect(result.action).toBe('retry')
  })

  it('translates HTTP 503 as server unavailable', () => {
    const result = translateMatrixError({ httpStatus: 503 })
    expect(result.userMessage).toBe('error.matrix.server_unavailable')
  })

  it('returns unknown for unrecognized errors', () => {
    const result = translateMatrixError({ some: 'random error' })
    expect(result.userMessage).toBe('error.matrix.unknown')
  })

  it('returns unknown for null/undefined', () => {
    expect(translateMatrixError(null).userMessage).toBe('error.matrix.unknown')
    expect(translateMatrixError(undefined).userMessage).toBe('error.matrix.unknown')
  })

  it('isRecoverableError works correctly', () => {
    expect(isRecoverableError({ errcode: 'M_LIMIT_EXCEEDED' })).toBe(true)
    expect(isRecoverableError({ errcode: 'M_FORBIDDEN' })).toBe(false)
  })

  it('getErrorAction works correctly', () => {
    expect(getErrorAction({ errcode: 'M_UNKNOWN_TOKEN' })).toBe('relogin')
    expect(getErrorAction({ errcode: 'M_NOT_FOUND' })).toBe('none')
  })

  it('translates friend-specific errors', () => {
    expect(translateMatrixError({ errcode: 'FRIEND_ALREADY_EXISTS' }).userMessage).toBe('error.matrix.friend_exists')
    expect(translateMatrixError({ errcode: 'FRIEND_REQUEST_PENDING' }).userMessage).toBe('error.matrix.friend_pending')
  })
})
