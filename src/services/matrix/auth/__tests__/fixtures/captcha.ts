import type { MatrixCaptchaResult } from '@/services/matrix/auth/authHelpers'
import type { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'

/**
 * 注册验证码域测试夹具。
 *
 * 类型取自 auth 服务层真实签名：
 * - `getCaptcha` → `MatrixCaptchaResult`（`session` / `api_path` / `mxc_url` 三键全必填，
 *   其中 `api_path` 是后端返回的验证端点，不是前端常量）；
 * - `startRegistrationSession` → `{ session, flows }`（失败分支也会带 flows 抛出）；
 * - `verifyCaptcha` → `{ success }`。
 */

export type RegisterSessionFixture = Awaited<ReturnType<typeof MatrixAuthService.startRegistrationSession>>

export type CaptchaVerifyFixture = Awaited<ReturnType<typeof MatrixAuthService.verifyCaptcha>>

/** 生成验证码下发响应。 */
export function makeCaptchaResult(overrides: Partial<MatrixCaptchaResult> = {}): MatrixCaptchaResult {
  return {
    session: 'captcha-session-001',
    api_path: '/_matrix/client/v3/register/captcha/verify',
    mxc_url: 'mxc://localhost/abcdef',
    ...overrides
  }
}

/** 生成注册会话响应，默认走 dummy 流程。 */
export function makeRegisterSession(overrides: Partial<RegisterSessionFixture> = {}): RegisterSessionFixture {
  return {
    session: 'reg-session-001',
    flows: [{ type: 'm.login.dummy' }],
    ...overrides
  }
}

/** 生成验证码校验响应，默认通过。 */
export function makeCaptchaVerify(overrides: Partial<CaptchaVerifyFixture> = {}): CaptchaVerifyFixture {
  return { success: true, ...overrides }
}
