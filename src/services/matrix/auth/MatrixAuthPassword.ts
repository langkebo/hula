import {
  buildResetPasswordAuth,
  createTemporaryMatrixClient,
  generateClientSecret,
  type MatrixRequestedEmailTokenResult,
  matrixRequestPasswordEmailToken,
  matrixResetPassword,
  runSdkFirst,
  withClientSecret
} from './authHelpers'

/** 请求密码重置邮箱令牌
 */
export async function requestPasswordEmailToken(
  email: string,
  sendAttempt: number = 1,
  clientSecret?: string
): Promise<MatrixRequestedEmailTokenResult> {
  const resolvedClientSecret = clientSecret || generateClientSecret()
  return runSdkFirst(
    async () => {
      const result = await createTemporaryMatrixClient().requestPasswordEmailToken(
        email,
        resolvedClientSecret,
        sendAttempt
      )
      return withClientSecret(result, resolvedClientSecret)
    },
    async () => {
      const result = await matrixRequestPasswordEmailToken(email, resolvedClientSecret, sendAttempt)
      return withClientSecret(result, resolvedClientSecret)
    },
    '请求找回密码邮箱令牌失败'
  )
}

/** 发起忘记密码流程
 */
export async function forgetPassword(
  email: string,
  sendAttempt: number = 1,
  clientSecret?: string
): Promise<MatrixRequestedEmailTokenResult> {
  return requestPasswordEmailToken(email, sendAttempt, clientSecret)
}

/** 重置密码
 */
export async function resetPassword(
  newPassword: string,
  authSession?: string,
  authType?: string,
  authToken?: string,
  clientSecret?: string
): Promise<Record<string, unknown>> {
  const auth = buildResetPasswordAuth(authSession, authType, authToken, clientSecret)

  if (!auth) {
    return matrixResetPassword(newPassword, authSession, authType, authToken, clientSecret)
  }

  return runSdkFirst(
    () => createTemporaryMatrixClient().setPassword(auth, newPassword),
    () => matrixResetPassword(newPassword, authSession, authType, authToken, clientSecret),
    '重置密码失败'
  )
}
