import { describe, expect, it, vi } from 'vitest'
import { formatMatrixErrorDetail, getMatrixErrorHint, normalizeSdkMatrixError } from '../authErrors'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

describe('getMatrixErrorHint', () => {
  it('returns Chinese hint for known errcodes', () => {
    expect(getMatrixErrorHint('M_FORBIDDEN')).toBe('认证信息无效或当前操作无权限')
    expect(getMatrixErrorHint('M_USER_IN_USE')).toBe('用户名已被占用')
    expect(getMatrixErrorHint('M_INVALID_USERNAME')).toBe('用户名格式无效')
    expect(getMatrixErrorHint('M_THREEPID_IN_USE')).toBe('邮箱已被使用')
    expect(getMatrixErrorHint('M_THREEPID_NOT_FOUND')).toBe('邮箱未绑定账号')
    expect(getMatrixErrorHint('M_LIMIT_EXCEEDED')).toBe('请求过于频繁，请稍后重试')
    expect(getMatrixErrorHint('M_TOKEN_EXPIRED')).toBe('验证码已过期')
    expect(getMatrixErrorHint('M_TOKEN_ALREADY_USED')).toBe('验证码已被使用')
  })

  it('returns empty string for unknown errcode', () => {
    expect(getMatrixErrorHint('M_UNKNOWN')).toBe('')
    expect(getMatrixErrorHint('')).toBe('')
  })
})

describe('formatMatrixErrorDetail', () => {
  it('returns empty string for empty input', () => {
    expect(formatMatrixErrorDetail('')).toBe('')
  })

  it('parses JSON with error and errcode, includes hint', () => {
    const text = JSON.stringify({ error: 'Bad request', errcode: 'M_INVALID_PARAM' })
    expect(formatMatrixErrorDetail(text)).toBe('Bad request [M_INVALID_PARAM] (请求参数无效)')
  })

  it('parses JSON with error and errcode but unknown errcode has no hint', () => {
    const text = JSON.stringify({ error: 'Something', errcode: 'M_CUSTOM' })
    expect(formatMatrixErrorDetail(text)).toBe('Something [M_CUSTOM]')
  })

  it('parses JSON with only error field', () => {
    const text = JSON.stringify({ error: 'Network failure' })
    expect(formatMatrixErrorDetail(text)).toBe('Network failure')
  })

  it('parses JSON with only errcode (known)', () => {
    const text = JSON.stringify({ errcode: 'M_FORBIDDEN' })
    expect(formatMatrixErrorDetail(text)).toBe('[M_FORBIDDEN] (认证信息无效或当前操作无权限)')
  })

  it('parses JSON with only errcode (unknown)', () => {
    const text = JSON.stringify({ errcode: 'M_WEIRD' })
    expect(formatMatrixErrorDetail(text)).toBe('[M_WEIRD]')
  })

  it('falls back to raw text when JSON parse fails', () => {
    expect(formatMatrixErrorDetail('not json at all')).toBe('not json at all')
    expect(formatMatrixErrorDetail('<html>Server Error</html>')).toBe('<html>Server Error</html>')
  })

  it('returns raw text when JSON has non-string error/errcode fields', () => {
    const text = JSON.stringify({ error: 123, errcode: null })
    expect(formatMatrixErrorDetail(text)).toBe(text)
  })
})

describe('normalizeSdkMatrixError', () => {
  it('wraps non-Error values with just the failure label', () => {
    const result = normalizeSdkMatrixError('string error', '登录失败')
    expect(result.message).toBe('登录失败')
    expect(result).toBeInstanceOf(Error)
  })

  it('wraps null with just the failure label', () => {
    const result = normalizeSdkMatrixError(null, '注册失败')
    expect(result.message).toBe('注册失败')
  })

  it('uses error.message when no errcode/error fields present', () => {
    const original = new Error('connection timeout')
    const result = normalizeSdkMatrixError(original, '请求失败')
    expect(result.message).toContain('请求失败')
    expect(result.message).toContain('connection timeout')
  })

  it('extracts errcode and error from Matrix error properties', () => {
    const original = Object.assign(new Error('forbidden'), {
      errcode: 'M_FORBIDDEN',
      error: '账号或密码错误',
      httpStatus: 403
    })
    const result = normalizeSdkMatrixError(original, '登录失败')
    expect(result.message).toContain('登录失败')
    expect(result.message).toContain('403')
    expect(result.message).toContain('M_FORBIDDEN')
    expect(result.message).toContain('账号或密码错误')
    expect(result.message).toContain('认证信息无效或当前操作无权限')
  })

  it('includes httpStatus when present', () => {
    const original = Object.assign(new Error('rate limited'), {
      errcode: 'M_LIMIT_EXCEEDED',
      httpStatus: 429
    })
    const result = normalizeSdkMatrixError(original, '请求失败')
    expect(result.message).toContain('429')
    expect(result.message).toContain('M_LIMIT_EXCEEDED')
    expect(result.message).toContain('请求过于频繁')
  })

  it('omits httpStatus when absent', () => {
    const original = Object.assign(new Error('user taken'), {
      errcode: 'M_USER_IN_USE'
    })
    const result = normalizeSdkMatrixError(original, '注册失败')
    expect(result.message).not.toContain('NaN')
    expect(result.message).toContain('M_USER_IN_USE')
    expect(result.message).toContain('用户名已被占用')
  })
})
