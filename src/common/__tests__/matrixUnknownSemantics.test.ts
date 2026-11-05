import { describe, expect, it } from 'vitest'
import { notImplementedError, resolveUnknownErrcodeSemantics } from '../matrixUnknownSemantics'

/**
 * BE-7 客户端侧：`M_UNKNOWN` 按 HTTP 状态消歧。
 *
 * 后端 `M_UNKNOWN_MEANINGS` 给的判别口径是「结合 HTTP 状态」——
 * 400 请求内容问题 / 409 状态冲突 / 500 服务端缺陷 / 501 未实现 / 503 暂不可用。
 * 本模块只负责前三类里**能给出更贴切 kind** 的那些；500/503 交给调用方的
 * 「5xx 一律 retryable」分支（重试有意义）。
 */
describe('resolveUnknownErrcodeSemantics', () => {
  it('400 → validation，走 bad_request 文案', () => {
    const result = resolveUnknownErrcodeSemantics('M_UNKNOWN', 400, 'field not supported')
    expect(result).toEqual({
      kind: 'validation',
      code: 'M_UNKNOWN',
      message: 'field not supported',
      i18nKey: 'error.matrix.bad_request'
    })
  })

  it('409 → validation + M_CONFLICT，且**不套** generic 文案（保留后端原因）', () => {
    const result = resolveUnknownErrcodeSemantics('M_UNKNOWN', 409, 'Already friends')
    expect(result).toEqual({ kind: 'validation', code: 'M_CONFLICT', message: 'Already friends' })
    expect(result && 'i18nKey' in result ? result.i18nKey : undefined).toBeUndefined()
  })

  it('501 → not_implemented（重试无意义）', () => {
    expect(resolveUnknownErrcodeSemantics('M_UNKNOWN', 501, 'Not supported')).toEqual({
      kind: 'not_implemented',
      message: 'Not supported'
    })
  })

  it('500 / 503 不接管（交给「5xx 一律 retryable」分支）', () => {
    expect(resolveUnknownErrcodeSemantics('M_UNKNOWN', 500, 'boom')).toBeNull()
    expect(resolveUnknownErrcodeSemantics('M_UNKNOWN', 503, 'maintenance')).toBeNull()
  })

  it('非 M_UNKNOWN 的 errcode 一律不接管', () => {
    expect(resolveUnknownErrcodeSemantics('M_FORBIDDEN', 400, 'nope')).toBeNull()
    expect(resolveUnknownErrcodeSemantics('M_LIMIT_EXCEEDED', 429, 'slow down')).toBeNull()
    expect(resolveUnknownErrcodeSemantics(undefined, 400, 'no code')).toBeNull()
  })

  it('缺 httpStatus 时返回 null（不猜）', () => {
    expect(resolveUnknownErrcodeSemantics('M_UNKNOWN', undefined, 'who knows')).toBeNull()
  })

  it('缺 message 时回落到 errcode，保证 message 恒非空', () => {
    const result = resolveUnknownErrcodeSemantics('M_UNKNOWN', 400)
    expect(result?.message).toBe('M_UNKNOWN')
  })
})

describe('notImplementedError', () => {
  it('组装成 fatal 并透传 correlationId（与其它 fatal 同口径）', () => {
    expect(notImplementedError('Not supported', 'corr-42')).toEqual({
      kind: 'fatal',
      code: 'M_NOT_IMPLEMENTED',
      message: 'Not supported',
      correlationId: 'corr-42'
    })
  })
})
