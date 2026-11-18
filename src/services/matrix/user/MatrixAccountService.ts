import {
  addThreePid,
  bindThreePid,
  deleteThreePid,
  fetchThreePids,
  requestAddEmailToken as requestThreePidEmailToken,
  submitEmailToken as submitThreePidEmailToken,
  type ThreePidEmailChallenge,
  type ThreePidsResponse,
  unbindThreePid
} from './accountThreePids'
import { MatrixAccountDataMethods } from './MatrixAccountDataMethods'

export type { MyRoomEntry } from './MatrixAccountDataMethods'
// 类型原定义随方法片段一起下沉；此处 re-export 保持既有 import 点不变。
export type { AuthData, DeviceInfo } from './MatrixAccountProfileDeviceMethods'

/** 生成 3PID 验证会话的 client_secret（Web Crypto 不可用时回退随机串）。 */
function createClientSecret(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

/**
 * 账号服务门面：3PID 绑定入口 + 本实例导出。
 *
 * 资料 / 密码 / 设备方法见 `MatrixAccountProfileDeviceMethods`；
 * 账号数据 / 邀请策略 / 能力表 / 房间列表 / 事件流见 `MatrixAccountDataMethods`。
 * 三者通过继承链合并为同一实例，公开方法签名保持不变。
 */
class MatrixAccountService extends MatrixAccountDataMethods {
  /** 获取已绑定的第三方标识（3PID）列表；`pending3pids` 当前恒为空。 */
  async getThreePids(): Promise<ThreePidsResponse> {
    return fetchThreePids(() => this.getClient())
  }

  /**
   * 请求向邮箱发送「绑定 3PID」验证码。
   *
   * 返回的 `clientSecret` 需在 submit / add 阶段原样回传（服务端用它校验同一会话）。
   */
  async requestThreePidEmailToken(
    email: string,
    sendAttempt = 1
  ): Promise<ThreePidEmailChallenge & { clientSecret: string }> {
    const clientSecret = createClientSecret()
    const challenge = await requestThreePidEmailToken(() => this.getClient(), email, clientSecret, sendAttempt)
    return { ...challenge, clientSecret }
  }

  /** 提交邮箱验证码（SDK 未封装 submitToken，见 accountThreePids 注释）。 */
  async submitThreePidEmailToken(sid: string, clientSecret: string, token: string): Promise<void> {
    return submitThreePidEmailToken(() => this.getClient(), sid, clientSecret, token)
  }

  /**
   * 完成邮箱 3PID 绑定：`/account/3pid/add` 强制 UIA，
   * 这里用当前账号密码拼出 `m.login.password` 阶段一并提交。
   */
  async addThreePidWithPassword(sid: string, clientSecret: string, password: string): Promise<void> {
    const client = this.getClient()
    const userId = client.getUserId()
    if (!userId) {
      throw new Error(this.t('matrix_error.account.cannot_get_user_id'))
    }

    const authData = {
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: userId
      },
      password
    }

    return addThreePid(() => client, sid, clientSecret, authData)
  }

  /** 添加第三方标识（3PID）；`_bind` 为历史遗留参数，后端 add/bind 同 handler，已忽略。 */
  async addThreePid(sid: string, clientSecret: string, _bind?: boolean): Promise<void> {
    return addThreePid(() => this.getClient(), sid, clientSecret)
  }

  /** 绑定第三方标识（3PID）；后端与 add 同 handler，medium/address 仅用于日志。 */
  async bindThreePid(sid: string, clientSecret: string, medium: string, address: string): Promise<void> {
    return bindThreePid(() => this.getClient(), sid, clientSecret, medium, address)
  }

  /** 删除已绑定的第三方标识（3PID）。 */
  async deleteThreePid(medium: string, address: string): Promise<void> {
    return deleteThreePid(() => this.getClient(), medium, address)
  }

  /** 解绑已绑定的第三方标识（3PID）。 */
  async unbindThreePid(medium: string, address: string): Promise<void> {
    return unbindThreePid(() => this.getClient(), medium, address)
  }
}

export const matrixAccountService = new MatrixAccountService()
