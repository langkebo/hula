/**
 * Matrix 认证服务
 *
 * 使用 SDK Manager 实现认证功能，并提供降级策略
 * 优先级：SDK Manager → Tauri invoke → 直接 HTTP
 */

import { info, warn } from '@tauri-apps/plugin-log'
import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'

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

export class MatrixAuthService extends BaseManager {
  private static generateClientSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 43; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * 登录（使用 SDK Manager，带降级策略）
   */
  static async login(
    username: string,
    password: string,
    deviceId?: string,
    deviceName?: string
  ): Promise<MatrixLoginResult> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK Manager 登录')

        const accountManager = client.getAccountManager()
        const result = await accountManager.loginRequest({
          type: 'm.login.password',
          identifier: {
            type: 'm.id.user',
            user: username
          },
          password,
          device_id: deviceId,
          initial_device_display_name: deviceName || 'HuLa Client'
        })

        info(`[MatrixAuth] SDK Manager 登录成功: ${result.user_id}`)

        return {
          user_id: result.user_id,
          access_token: result.access_token,
          device_id: result.device_id,
          home_server: result.home_server,
          refresh_token: result.refresh_token,
          expires_in: result.expires_in_ms
        }
      } catch (err) {
        warn(`[MatrixAuth] SDK Manager 登录失败，尝试降级: ${err}`)
      }
    }
    info('[MatrixAuth] 尝试使用 MatrixClientService 登录')
    const loginResult = await matrixClientService.login(username, password, deviceName)

    if (loginResult.success && loginResult.accessToken) {
      return {
        user_id: loginResult.userId!,
        access_token: loginResult.accessToken,
        device_id: loginResult.deviceId!,
        home_server: matrixClientService.getConfig()?.homeserverUrl
      }
    }

    throw new Error(loginResult.error || '登录失败')
  }

  /**
   * 注册（使用 SDK Manager，带降级策略）
   */
  static async register(
    username: string,
    password: string,
    session?: string,
    authType?: string,
    authToken?: string
  ): Promise<MatrixRegisterResult> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK Manager 注册')

        const authData: any = {}
        if (session) authData.session = session
        if (authType && authToken) {
          authData.type = authType
          authData[authType] = authToken
        }

        const result = await client.register(username, password, undefined, authData)

        info(`[MatrixAuth] SDK Manager 注册成功: ${result.user_id}`)

        return {
          user_id: result.user_id,
          access_token: result.access_token,
          device_id: result.device_id,
          refresh_token: result.refresh_token,
          expires_in_ms: result.expires_in_ms
        }
      } catch (err) {
        warn(`[MatrixAuth] SDK Manager 注册失败，尝试降级: ${err}`)
      }
    }
    info('[MatrixAuth] 尝试使用 MatrixClientService 注册')
    const registerResult = await matrixClientService.register(username, password, session)

    if (registerResult.success && registerResult.accessToken) {
      return {
        user_id: registerResult.userId!,
        access_token: registerResult.accessToken,
        device_id: registerResult.deviceId!
      }
    }

    throw new Error(registerResult.error || '注册失败')
  }

  /**
   * 请求邮箱验证 Token（使用 SDK）
   */
  static async requestEmailToken(email: string, sendAttempt: number = 1): Promise<MatrixEmailTokenResult> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 请求邮箱验证')

        const clientSecret = MatrixAuthService.generateClientSecret()
        const result = await client.requestRegisterEmailToken(email, clientSecret, sendAttempt)

        info('[MatrixAuth] SDK 请求邮箱验证成功')

        return {
          sid: result.sid,
          submit_url: result.submit_url,
          expires_in: result.expires_in
        }
      } catch (err) {
        warn(`[MatrixAuth] SDK 请求邮箱验证失败: ${err}`)
        throw err
      }
    }

    throw new Error('客户端未初始化')
  }

  /**
   * 提交邮箱验证 Token（使用 SDK）
   */
  static async submitEmailToken(token: string, clientSecret: string, sid: string): Promise<any> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 提交邮箱验证')

        const accountManager = client.getAccountManager()
        const result = await accountManager.submitEmailToken(sid, clientSecret, token)

        info('[MatrixAuth] SDK 提交邮箱验证成功')

        return result
      } catch (err) {
        warn(`[MatrixAuth] SDK 提交邮箱验证失败: ${err}`)
        throw err
      }
    }

    throw new Error('客户端未初始化')
  }

  /**
   * 获取验证码（自定义实现，SDK 不支持）
   */
  static async getCaptcha(): Promise<MatrixCaptchaResult> {
    warn('[MatrixAuth] getCaptcha 是自定义实现，SDK 不支持此功能')
    throw new Error('验证码功能需要自定义实现')
  }

  /**
   * 忘记密码（使用 SDK）
   */
  static async forgetPassword(email: string): Promise<any> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 忘记密码')

        const clientSecret = MatrixAuthService.generateClientSecret()
        const result = await client.requestPasswordEmailToken(email, clientSecret, 1)

        info('[MatrixAuth] SDK 忘记密码成功')

        return result
      } catch (err) {
        warn(`[MatrixAuth] SDK 忘记密码失败: ${err}`)
        throw err
      }
    }

    throw new Error('客户端未初始化')
  }

  /**
   * 重置密码（使用 SDK）
   */
  static async resetPassword(
    newPassword: string,
    oldPassword?: string,
    authSession?: string,
    authType?: string,
    authToken?: string
  ): Promise<any> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 重置密码')

        const authData: any = {}
        if (authSession) authData.session = authSession
        if (authType && authToken) {
          authData.type = authType
          authData[authType] = authToken
        }

        if (oldPassword) {
          const userId = client.getUserId()
          authData.type = 'm.login.password'
          authData.user = userId
          authData.password = oldPassword
        }

        await client.setPassword(authData, newPassword, false)

        info('[MatrixAuth] SDK 重置密码成功')

        return { success: true }
      } catch (err) {
        warn(`[MatrixAuth] SDK 重置密码失败: ${err}`)
        throw err
      }
    }

    throw new Error('客户端未初始化')
  }

  /**
   * 登出（使用 SDK）
   */
  static async logout(): Promise<void> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 登出')

        const accountManager = client.getAccountManager()
        await accountManager.logout(true)

        info('[MatrixAuth] SDK 登出成功')
      } catch (err) {
        warn(`[MatrixAuth] SDK 登出失败: ${err}`)
        throw err
      }
    }
  }

  /**
   * 登出所有设备（使用 SDK）
   */
  static async logoutAll(): Promise<void> {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 登出所有设备')

        const accountManager = client.getAccountManager()
        await accountManager.logoutAll(true)

        info('[MatrixAuth] SDK 登出所有设备成功')
      } catch (err) {
        warn(`[MatrixAuth] SDK 登出所有设备失败: ${err}`)
        throw err
      }
    }
  }

  /**
   * 获取支持的登录流程（使用 SDK）
   */
  static async getSupportedLoginFlows() {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 获取登录流程')

        const authManager = client.getAuthManager()
        const flows = await authManager.getSupportedLoginFlows()

        info('[MatrixAuth] SDK 获取登录流程成功')

        return flows
      } catch (err) {
        warn(`[MatrixAuth] SDK 获取登录流程失败: ${err}`)
        throw err
      }
    }

    throw new Error('客户端未初始化')
  }

  /**
   * 获取支持的注册流程（使用 SDK）
   */
  static async getRegisterFlows() {
    const client = matrixClientService.getClient()

    if (client) {
      try {
        info('[MatrixAuth] 尝试使用 SDK 获取注册流程')

        const authManager = client.getAuthManager()
        const flows = await authManager.getRegisterFlows()

        info('[MatrixAuth] SDK 获取注册流程成功')

        return flows
      } catch (err) {
        warn(`[MatrixAuth] SDK 获取注册流程失败: ${err}`)
        throw err
      }
    }

    throw new Error('客户端未初始化')
  }
}

export default MatrixAuthService
