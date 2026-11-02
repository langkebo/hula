/**
 * 用户设备列表缓存。
 *
 * `useMessageTrust` 的 30s 全局节拍会让聊天页对同一发送者反复刷新信任状态；
 * 若每次都打 `/keys/query`，加密消息越多请求放大越严重。这里提供：
 * - TTL 60s 缓存（只缓存成功拿到设备的结果）；
 * - in-flight 去重（并发查询合并为一次请求）；
 * - `CryptoEvent.DevicesUpdated` 事件按 userId 失效；
 * - 客户端实例变化（登出 / 换账号）时清空全部缓存。
 */
import { CryptoEvent, type MatrixClient } from '@/services/matrix/sdk'
import type { Device } from './MatrixDeviceService'

const USER_DEVICES_CACHE_TTL_MS = 60_000

export class UserDevicesCache {
  private readonly cache = new Map<string, { devices: Device[]; expiresAt: number }>()
  private readonly inFlight = new Map<string, Promise<Device[]>>()
  private observedClient: MatrixClient | null = null

  constructor(private readonly fetcher: (userId: string) => Promise<Device[]>) {}

  /** crypto store 设备列表更新 → 失效对应用户缓存。 */
  private readonly handleDevicesUpdated = (userIds: string[]): void => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      this.invalidate()
      return
    }
    userIds.forEach((userId) => this.invalidate(userId))
  }

  /**
   * 绑定当前客户端的 `CryptoEvent.DevicesUpdated`。
   *
   * 客户端实例变化（登出 / 重登 / 换账号）时同时清空缓存——旧账号的设备列表
   * 绝不能在新账号下命中。
   */
  private ensureSubscription(client: MatrixClient): void {
    if (this.observedClient === client) return
    if (this.observedClient) {
      this.observedClient.off(CryptoEvent.DevicesUpdated, this.handleDevicesUpdated as never)
    }
    this.observedClient = client
    this.cache.clear()
    this.inFlight.clear()
    client.on(CryptoEvent.DevicesUpdated, this.handleDevicesUpdated as never)
  }

  /** 失效设备列表缓存；省略 userId 时清空全部。 */
  invalidate(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
      return
    }
    this.cache.clear()
  }

  /** 读取用户设备列表（命中缓存 / 合并并发请求 / 否则走 fetcher）。 */
  get(userId: string, client: MatrixClient): Promise<Device[]> {
    this.ensureSubscription(client)

    const cached = this.cache.get(userId)
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.devices)

    const inFlight = this.inFlight.get(userId)
    if (inFlight) return inFlight

    const request = this.fetcher(userId)
      .then((devices) => {
        // 只有『拿到设备』才写缓存：空列表既可能是「用户确实没有设备」，
        // 也可能是临时故障，固化 60 秒会把后者伪装成前者。
        if (devices.length > 0 && this.observedClient === client) {
          this.cache.set(userId, {
            devices,
            expiresAt: Date.now() + USER_DEVICES_CACHE_TTL_MS
          })
        }
        return devices
      })
      .finally(() => {
        if (this.inFlight.get(userId) === request) {
          this.inFlight.delete(userId)
        }
      })
    this.inFlight.set(userId, request)
    return request
  }
}
