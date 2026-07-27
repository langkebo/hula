import { describe, expect, it } from 'vitest'
import type { AppError } from '@/common/errors'
import { type ErrorLocale, getLocalizedMessageFromAppError, resolveErrorMessage } from '@/locales/errors'

describe('locales/errors — 错误文案中心化 (§9.3.5)', () => {
  describe('resolveErrorMessage', () => {
    it('已知 errcode 返回对应中文文案（默认 zh）', () => {
      expect(resolveErrorMessage('M_FORBIDDEN')).toBe('权限不足，无法执行此操作')
      expect(resolveErrorMessage('M_UNKNOWN_TOKEN')).toBe('会话已过期，请重新登录')
      expect(resolveErrorMessage('M_LIMIT_EXCEEDED')).toBe('请求过于频繁，请稍后重试')
    })

    it('locale=en 返回英文文案', () => {
      expect(resolveErrorMessage('M_FORBIDDEN', 'en')).toBe('You do not have permission to perform this action')
      expect(resolveErrorMessage('M_UNKNOWN_TOKEN', 'en')).toBe('Your session has expired, please log in again')
    })

    it('未知 errcode 返回 fallback 文案', () => {
      expect(resolveErrorMessage('M_SOMETHING_NEW', 'zh', '默认提示')).toBe('默认提示')
    })

    it('未知 errcode 无 fallback 时返回 errcode 本身', () => {
      expect(resolveErrorMessage('M_SOMETHING_NEW')).toBe('M_SOMETHING_NEW')
    })

    it('空 errcode 返回 fallback 或空串', () => {
      expect(resolveErrorMessage('', 'zh', '操作失败')).toBe('操作失败')
    })

    it('所有核心 errcode 在两种语言下都有文案', () => {
      const coreErrcodes = [
        'M_FORBIDDEN',
        'M_UNKNOWN_TOKEN',
        'M_MISSING_TOKEN',
        'M_LIMIT_EXCEEDED',
        'M_NOT_FOUND',
        'M_BAD_JSON',
        'M_NOT_JSON',
        'M_USER_IN_USE',
        'M_INVALID_USERNAME',
        'M_WEAK_PASSWORD',
        'M_EXCLUSIVE',
        'M_GUEST_ACCESS_FORBIDDEN',
        'M_THREEPID_IN_USE',
        'M_THREEPID_NOT_FOUND',
        'M_ROOM_IN_USE',
        'FRIEND_ALREADY_EXISTS',
        'FRIEND_REQUEST_PENDING',
        'NETWORK_ERROR',
        'TIMEOUT',
        'UNAUTHORIZED'
      ]
      for (const code of coreErrcodes) {
        expect(resolveErrorMessage(code, 'zh')).not.toBe(code)
        expect(resolveErrorMessage(code, 'en')).not.toBe(code)
      }
    })

    it('支持大小写不敏感的 errcode 查询', () => {
      expect(resolveErrorMessage('m_forbidden')).toBe('权限不足，无法执行此操作')
      expect(resolveErrorMessage('m_Forbidden')).toBe('权限不足，无法执行此操作')
    })
  })

  describe('getLocalizedMessageFromAppError', () => {
    it('从 auth AppError 的 code 解析文案', () => {
      const err: AppError = {
        kind: 'auth',
        code: 'M_FORBIDDEN',
        recoverable: false,
        message: '原始消息'
      }
      expect(getLocalizedMessageFromAppError(err)).toBe('权限不足，无法执行此操作')
    })

    it('从 retryable AppError 的 code 解析文案', () => {
      const err: AppError = {
        kind: 'retryable',
        code: 'M_LIMIT_EXCEEDED',
        message: '原始消息'
      }
      expect(getLocalizedMessageFromAppError(err)).toBe('请求过于频繁，请稍后重试')
    })

    it('从 fatal AppError 的 code 解析文案', () => {
      const err: AppError = {
        kind: 'fatal',
        code: 'NETWORK_ERROR',
        message: '原始消息',
        correlationId: 'corr-1'
      }
      expect(getLocalizedMessageFromAppError(err)).toBe('网络连接中断，请检查网络设置')
    })

    it('未解析到文案时回退到 AppError.message', () => {
      const err: AppError = {
        kind: 'fatal',
        code: 'UNKNOWN_CUSTOM_CODE',
        message: '自定义错误消息',
        correlationId: 'corr-2'
      }
      expect(getLocalizedMessageFromAppError(err)).toBe('自定义错误消息')
    })

    it('指定 locale 返回对应语言文案', () => {
      const err: AppError = {
        kind: 'auth',
        code: 'M_UNKNOWN_TOKEN',
        recoverable: true,
        message: '原始消息'
      }
      expect(getLocalizedMessageFromAppError(err, 'en' as ErrorLocale)).toBe(
        'Your session has expired, please log in again'
      )
    })
  })
})
