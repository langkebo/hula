import { invoke } from '@tauri-apps/api/core'

export interface MatrixLoginResult {
  user_id: string
  access_token: string
  device_id: string
  home_server?: string
  refresh_token?: string
  expires_in?: number
}

export interface MatrixRegisterResult {
  user_id: string
  access_token?: string
  device_id?: string
  refresh_token?: string
  expires_in_ms?: number
}

export interface MatrixEmailTokenResult {
  sid: string
  submit_url?: string
  expires_in?: number
}

export interface MatrixCaptchaResult {
  session: string
  api_path: string
  mxc_url: string
}

export interface MatrixLoginRequest {
  username: string
  password: string
  device_id?: string
  device_name?: string
}

export interface MatrixRegisterRequest {
  username: string
  password: string
  session?: string
  auth_type?: string
  auth_token?: string
}

export interface MatrixEmailTokenRequest {
  email: string
  client_secret: string
  send_attempt: number
}

export interface MatrixSubmitTokenRequest {
  token: string
  client_secret: string
  sid: string
}

export interface MatrixForgetPasswordRequest {
  email: string
}

export interface MatrixResetPasswordRequest {
  old_password?: string
  new_password: string
  auth_session?: string
  auth_type?: string
  auth_token?: string
}

export async function matrixLogin(
  username: string,
  password: string,
  deviceId?: string,
  deviceName?: string
): Promise<MatrixLoginResult> {
  return invoke<MatrixLoginResult>('matrix_login', {
    username,
    password,
    deviceId,
    deviceName
  })
}

export async function matrixRegister(
  username: string,
  password: string,
  session?: string,
  authType?: string,
  authToken?: string
): Promise<MatrixRegisterResult> {
  return invoke<MatrixRegisterResult>('matrix_register', {
    username,
    password,
    session,
    authType,
    authToken
  })
}

export async function matrixRequestEmailToken(
  email: string,
  clientSecret: string,
  sendAttempt: number
): Promise<MatrixEmailTokenResult> {
  return invoke<MatrixEmailTokenResult>('matrix_request_email_token', {
    email,
    clientSecret,
    sendAttempt
  })
}

export async function matrixSubmitEmailToken(token: string, clientSecret: string, sid: string): Promise<any> {
  return invoke('matrix_submit_email_token', {
    token,
    clientSecret,
    sid
  })
}

export async function matrixGetCaptcha(): Promise<MatrixCaptchaResult> {
  return invoke<MatrixCaptchaResult>('matrix_get_captcha')
}

export async function matrixForgetPassword(email: string): Promise<any> {
  return invoke('matrix_forget_password', {
    email
  })
}

export async function matrixResetPassword(
  oldPassword: string | undefined,
  newPassword: string,
  authSession?: string,
  authType?: string,
  authToken?: string
): Promise<any> {
  return invoke('matrix_reset_password', {
    oldPassword,
    newPassword,
    authSession,
    authType,
    authToken
  })
}

export class MatrixAuthService {
  private static generateClientSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 43; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  static async login(
    username: string,
    password: string,
    deviceId?: string,
    deviceName?: string
  ): Promise<MatrixLoginResult> {
    return matrixLogin(username, password, deviceId, deviceName)
  }

  static async register(
    username: string,
    password: string,
    session?: string,
    authType?: string,
    authToken?: string
  ): Promise<MatrixRegisterResult> {
    return matrixRegister(username, password, session, authType, authToken)
  }

  static async requestEmailToken(email: string, sendAttempt: number = 1): Promise<MatrixEmailTokenResult> {
    const clientSecret = MatrixAuthService.generateClientSecret()
    return matrixRequestEmailToken(email, clientSecret, sendAttempt)
  }

  static async submitEmailToken(token: string, clientSecret: string, sid: string): Promise<any> {
    return matrixSubmitEmailToken(token, clientSecret, sid)
  }

  static async getCaptcha(): Promise<MatrixCaptchaResult> {
    return matrixGetCaptcha()
  }

  static async forgetPassword(email: string): Promise<any> {
    return matrixForgetPassword(email)
  }

  static async resetPassword(
    newPassword: string,
    oldPassword?: string,
    authSession?: string,
    authType?: string,
    authToken?: string
  ): Promise<any> {
    return matrixResetPassword(oldPassword, newPassword, authSession, authType, authToken)
  }
}
