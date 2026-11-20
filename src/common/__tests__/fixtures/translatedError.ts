/**
 * `translateMatrixError` 返回值夹具。
 *
 * `TranslatedError` 未导出命名类型，故从函数签名派生；
 * 早前测试手写字面量只给 `recoverable / userMessage / level`，
 * 漏 `action` 等可选键不会被发现，改用本夹具后由 `vue-tsc` 兜住。
 */
import type { translateMatrixError } from '@/common/matrixErrorTranslator'

export type TranslatedErrorFixture = ReturnType<typeof translateMatrixError>

export function makeTranslatedError(overrides: Partial<TranslatedErrorFixture> = {}): TranslatedErrorFixture {
  return {
    userMessage: 'translated error',
    level: 'toast',
    recoverable: false,
    ...overrides
  }
}
