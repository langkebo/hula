import type { IContent } from '@/services/matrix/sdk'
import type { GeneratedSecretStorageKey, VerificationRequest } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { cryptoSDKAdapter } from './CryptoSDKAdapter'
import type { DeviceInfo, DeviceVerificationResult, RoomEncryptionState } from './cryptoAdapterTypes'

const logger = createLogger('MatrixCryptoService')

export type EncryptionAlgorithm = 'm.megolm.v1.aes-sha2' | 'm.olm.v1.curve25519-aes-sha2'

/**
 * 加密核心服务（CryptoCore）。
 *
 * 2026-08 拆分说明：本类原为 1096 行的上帝服务，其中约 700 行是与
 * MatrixKeyBackupService / MatrixVerificationService 重复的死代码
 * （备份 CRUD、SAS/QR 验证流、设备密钥 REST 封装——零外部调用、零内部引用，
 * 调用方早已切到上述专职服务）。拆分将这些死代码整体删除而非再次搬运，
 * 消除双重维护。保留的 15 个方法均有真实调用方：
 * - 初始化/状态：initializeCrypto、getCryptoStatus
 * - 设备信任：getDevices、verifyDevice、unverifyDevice、getDeviceVerificationStatus、requestDeviceVerification
 * - 备份流程：setupKeyBackup、exportKeys、createRecoveryKeyFromPassphrase、createSecureBackup
 * - 房间加密：isRoomEncrypted、getRoomEncryptionState、enableEncryption
 * - 密钥请求：createRoomKeyRequest
 */
class MatrixCryptoService extends BaseMatrixService {
  /**
   * 失效 crypto 缓存并重新获取 crypto 实例；SDK 未启用时只告警不抛错。
   */
  async initializeCrypto(): Promise<void> {
    try {
      cryptoSDKAdapter.invalidateCryptoCache()
      const crypto = cryptoSDKAdapter.getCrypto()
      if (crypto) {
        logger.info('[MatrixCrypto] 加密模块初始化成功')
      } else {
        logger.warn('[MatrixCrypto] 加密模块未启用')
      }
    } catch (err) {
      logger.error(`[MatrixCrypto] 加密模块初始化失败: ${err}`)
      throw err
    }
  }

  /**
   * 取跨签名与密钥备份的就绪状态；异常时返回 null。
   */
  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    try {
      const result = await cryptoSDKAdapter.getCryptoStatus()
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取加密状态失败: ${err}`)
      return null
    }
  }

  /**
   * 列出指定用户的设备。查**他人**设备只能走 `POST /keys/query`。
   */
  async getDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      return await cryptoSDKAdapter.getDevices(userId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 把设备标记为已验证。
   * 只写**本地 crypto store**，不上报服务端；其他设备看不到该判定。
   */
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.verifyDevice(userId, deviceId)
      logger.info(`[MatrixCrypto] 设备验证成功: ${userId}:${deviceId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 设备验证失败: ${err}`)
      throw err
    }
  }

  /**
   * 取消设备的已验证标记（同样只作用于本地 crypto store）。
   */
  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.unverifyDevice(userId, deviceId)
      logger.info(`[MatrixCrypto] 取消设备验证: ${userId}:${deviceId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 取消设备验证失败: ${err}`)
      throw err
    }
  }

  /**
   * 读设备验证状态。
   * 唯一事实源是本地 crypto store —— `/keys/query` 响应里没有信任字段。
   */
  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationResult> {
    try {
      return await cryptoSDKAdapter.getDeviceVerificationStatus(userId, deviceId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取设备验证状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 发起设备验证请求；返回 `null` 表示 SDK 拒绝或不可用。
   * SAS 需**对端接受后**才产生，不能把「请求已发」当成「已完成」。
   */
  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    try {
      const result = await cryptoSDKAdapter.requestDeviceVerification(userId, deviceId)
      if (result) {
        logger.info(`[MatrixCrypto] 设备验证请求已发送: ${userId}:${deviceId}`)
      }
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 请求设备验证失败: ${err}`)
      throw err
    }
  }

  /**
   * 用口令初始化密钥备份（创建备份版本）。
   */
  async setupKeyBackup(passphrase: string): Promise<void> {
    try {
      await cryptoSDKAdapter.setupKeyBackup(passphrase)
      logger.info('[MatrixCrypto] 设置密钥备份成功')
    } catch (err) {
      logger.error(`[MatrixCrypto] 设置密钥备份失败: ${err}`)
      throw err
    }
  }

  /**
   * 导出房间密钥；口令校验失败时抛专用错误（而非笼统的 SDK 异常）。
   */
  async exportKeys(passphrase: string): Promise<string> {
    try {
      const result = await cryptoSDKAdapter.exportKeys(passphrase)
      logger.info('[MatrixCrypto] 导出密钥成功')
      return result.data
    } catch (err) {
      if (err instanceof Error && err.message === '密码验证失败') {
        throw new Error(this.t('matrix_error.crypto.passphrase_verification_failed'))
      }
      logger.error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      throw err
    }
  }

  /**
   * 由口令派生恢复密钥（无口令则随机生成）；SDK 不可用时返回 null。
   */
  async createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey | null> {
    try {
      const result = await cryptoSDKAdapter.createRecoveryKeyFromPassphrase(password)
      if (!result) {
        logger.error('[MatrixCrypto] 创建恢复密钥失败: CryptoApi 不可用或方法不存在')
        return null
      }
      logger.info(`[MatrixCrypto] 创建恢复密钥成功${password ? '（使用短语）' : '（随机生成）'}`)
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建恢复密钥失败: ${err}`)
      throw err
    }
  }

  /**
   * 创建安全备份并返回恢复密钥。
   * 口令经 PBKDF2 在**客户端**派生，只上传公钥与密文，口令/私钥永不上送服务端。
   */
  async createSecureBackup(passphrase: string): Promise<{ recoveryKey: string } | null> {
    try {
      // ISSUE-6.3: 客户端派生，passphrase 经 PBKDF2 派生 recovery key，
      // 仅上传公钥 + 密文，口令/私钥永不上送服务端。
      const recoveryKey = await cryptoSDKAdapter.setupKeyBackupWithOptions(
        passphrase ? { password: passphrase } : undefined
      )
      logger.info('[MatrixCrypto] 创建安全备份成功(客户端派生)')
      return { recoveryKey }
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建安全备份失败: ${err}`)
      throw err
    }
  }

  /**
   * 判断房间是否加密；异常时按 `false` 处理（加密状态拿不到时不宣称已加密）。
   *
   * 注意：`unknown`（尚未同步 / 读取失败）与 `plaintext` 都会被折叠成 false，
   * 这是为 UI 展示保留的 fail-open 接口。安全决策（上传、发送）
   * 必须使用 {@link getRoomEncryptionState} 并对 `unknown` 做显式拒绝。
   */
  async isRoomEncrypted(roomId: string): Promise<boolean> {
    try {
      return await cryptoSDKAdapter.isRoomEncrypted(roomId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 检查房间加密状态失败: ${err}`)
      return false
    }
  }

  /**
   * 查询房间加密状态（三态透传）；异常时按 `unknown` 处理。
   *
   * 与 {@link isRoomEncrypted} 的布尔契约区分：需要区分「确认未加密」与
   * 「尚未同步/无法判定」的调用方必须走这里，避免把乐观冷启动当成明文。
   */
  async getRoomEncryptionState(roomId: string): Promise<RoomEncryptionState> {
    try {
      return await cryptoSDKAdapter.getRoomEncryptionState(roomId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 查询房间加密状态失败: ${err}`)
      return 'unknown'
    }
  }

  /**
   * 为房间开启加密；默认算法 `m.megolm.v1.aes-sha2`。
   */
  async enableEncryption(roomId: string, algorithm: EncryptionAlgorithm = 'm.megolm.v1.aes-sha2'): Promise<void> {
    try {
      await cryptoSDKAdapter.enableEncryption(roomId, algorithm)
      logger.info(`[MatrixCrypto] 启用房间加密: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 启用房间加密失败: ${err}`)
      throw err
    }
  }

  /**
   * 向本账号的其它设备请求房间密钥（标准 Matrix `m.room_key_request`，to-device）。
   *
   * ## 为什么必须走 to-device
   *
   * 持有该 Megolm session 的是**另一台设备**，只有它能把密钥转发过来。标准链路是：
   * 请求方发 `m.room_key_request`（to-device）→ 持有方的 rust-crypto 收到后自动回
   * `m.forwarded_room_key` → 本地解密自愈。
   *
   * 历史缺陷（P0-①）：这里曾调用 `DeviceKeysManager.createRoomKeyRequest`，即自建的
   * `POST /room_keys/request` 端点。那不是 Matrix 协议的一部分，其它设备（包括同账号的
   * Element/FluffyChat）根本不会感知，因此永远没有设备回传密钥——请求写进私有表后
   * 就悬空；而设置页的「兑现」只把状态改成 fulfilled，并不搬运任何密钥。
   *
   * @param roomId 房间 ID
   * @param sessionId 无法解密的 Megolm session
   * @param algorithm 加密算法（`m.megolm.v1.aes-sha2`）
   * @param senderKey 该消息发送设备的 curve25519 身份密钥（取自事件 wire content）
   */
  async createRoomKeyRequest(roomId: string, sessionId: string, algorithm: string, senderKey?: string): Promise<void> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()
      const deviceId = client.getDeviceId()
      if (!userId || !deviceId) {
        throw new Error('无法发起房间密钥请求：缺少当前用户或设备 ID')
      }

      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      // 同一 session 复用同一 request_id：接收方按 request_id 去重，重复巡检不会刷屏。
      const requestId = `mkr_${sessionId}`

      // `IContent.body` 在 SDK 里固定为消息正文（string），而 `m.room_key_request` 的
      // `body` 是协议载荷对象（spec 定义），两者语义不同。这里用 `Object.assign` 组合出
      // `IContent & { body: 载荷对象 }`：wire 上是对象，类型上仍可赋给 `IContent`，
      // 无需 `as unknown as` 这类双重断言。
      const base: IContent = {
        action: 'request',
        requesting_device_id: deviceId,
        request_id: requestId
      }
      const content = Object.assign(base, {
        body: {
          algorithm,
          room_id: roomId,
          session_id: sessionId,
          ...(senderKey ? { sender_key: senderKey } : {})
        }
      })

      await manager.sendToDevice('m.room_key_request', `${requestId}_${Date.now()}`, {
        // '*' = 本账号的所有设备；持有该 session 的那台会响应
        [userId]: { '*': content }
      })
      logger.info(`[MatrixCrypto] 已发送标准 m.room_key_request (to-device): ${roomId}/${sessionId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建房间密钥请求失败: ${err}`)
      throw err
    }
  }
}

const matrixCryptoService = new MatrixCryptoService()
export default matrixCryptoService
export { matrixCryptoService }
