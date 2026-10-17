import { computed, effectScope, type MaybeRefOrGetter, onScopeDispose, toValue } from 'vue'
import {
  bumpTrustCacheVersion,
  type MessageTrustLevel,
  senderDeviceCache,
  trustCacheVersion
} from '@/services/matrix/crypto/messageTrustCache'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'

export type { MessageTrustLevel } from '@/services/matrix/crypto/messageTrustCache'
export { clearSenderDeviceCache, senderDeviceCache } from '@/services/matrix/crypto/messageTrustCache'

/**
 * 锁徽章等级（不含 `plain`）
 *
 * `MessageLockBadge` 只表达三种「已加密」的信任状态；未加密消息不展示徽章。
 * 收敛逻辑集中在此处，避免组件内联做锁态映射。
 */
export type LockBadgeLevel = 'verified' | 'unverified' | 'risk'

/** 计算缓存键（**账号维度**，避免换账号后沿用上一账号的绿锁判定）。 */
export function senderCacheKey(senderId: string): string {
  let accountUserId = 'anonymous'
  try {
    accountUserId = matrixClientService.getUserId() ?? 'anonymous'
  } catch {
    // 客户端未初始化：保持 anonymous，不与任何真实账号混用
  }
  return `${accountUserId}:${senderId}`
}

/**
 * 异步刷新信任等级（查设备列表 → 判定设备验证状态 → 更新缓存）
 *
 * 典型用法：消息渲染组件在 `onMounted` / senderId 变化时调用，
 * 将同步的 `trustLevel` 从安全默认值 'unverified' 升级到真实状态。
 *
 * ## 判定规则（2026-10-12 修正）
 *
 * `verified` 的判据是「发送者的**全部**设备都已被验证」——**不是**「任意一台被验证」。
 * 历史实现用 `devices.some(d => d.verified)`，于是「1 台已验证 + 3 台未验证」的发送者
 * 会拿到**绿锁**（已验证），而他的消息完全可能来自那 3 台未验证设备 —— 这是假安全信号。
 * 与 E2EE 规范对 cross-signing 的定位一致：信任应覆盖发送者的**设备集合**，
 * 而不是集合里最容易满足的那一台。
 *
 * @returns 刷新后的信任等级；失败时保持缓存原值（不抛错）
 */
export async function refreshTrustLevel(senderId: string): Promise<MessageTrustLevel> {
  if (!senderId) return 'unverified'
  const key = senderCacheKey(senderId)
  try {
    const devices = await matrixDeviceService.getUserDevices(senderId)
    // 设备列表为空 ⇒ 无法证认任何设备 ⇒ 未验证（绝不能因为"没有反对证据"就给绿锁）
    const level: MessageTrustLevel =
      devices.length > 0 && devices.every((d) => d.verified === true) ? 'verified' : 'unverified'
    senderDeviceCache.set(key, level)
    bumpTrustCacheVersion()
    return level
  } catch {
    // 设备查询失败 → 保持安全默认值，不抛错干扰渲染
    bumpTrustCacheVersion()
    return senderDeviceCache.get(key) ?? 'unverified'
  }
}

/**
 * 消息信任计算 Composable
 *
 * @param isEncrypted - 是否加密事件。支持 ref / getter，保证 `props` 变化时信任等级同步更新；
 *                      直接传布尔值亦兼容（等价于一次性快照）。
 * @param room - 房间信息（可选），可含 senderId 用于设备验证查询
 * @returns 消息信任相关计算属性
 *
 * @example
 * ```ts
 * // 响应式（推荐）：消息切换/虚拟列表复用组件实例时不会残留旧信任等级
 * const { lockBadgeLevel, isEncrypted } = useMessageTrust(() => props.message?.body?.hasEncryption === true)
 * // 含发送者ID：解锁真实设备验证查询
 * const { lockBadgeLevel } = useMessageTrust(() => props.message?.body?.hasEncryption === true, { senderId: props.fromUser?.uid })
 * ```
 */
export function useMessageTrust(
  isEncrypted: MaybeRefOrGetter<boolean>,
  room?: {
    getEncryptionAlgorithm?: () => string | null
    /**
     * **房间**是否启用了加密。支持 getter，以便房间状态变化时信任等级同步重算。
     *
     * 用途：识别「加密房间里的明文消息」—— 这是 `risk`（红锁）的唯一可达来源，
     * 同时也是攻击面（有人把消息降级成明文以绕过 E2EE）。
     */
    isEncrypted?: MaybeRefOrGetter<boolean>
    senderId?: string
  }
) {
  // 用独立 effectScope，避免全局 effect 污染
  const scope = effectScope()

  /** 是否已加密（响应式解包） */
  const isEncryptedEvent = scope.run(() => computed(() => toValue(isEncrypted)))!

  /** 加密算法 */
  const encryptionAlgorithm = scope.run(() =>
    computed<string | null>(() => {
      if (!isEncryptedEvent.value || !room?.getEncryptionAlgorithm) return null
      return room.getEncryptionAlgorithm()
    })
  )!

  /**
   * 信任等级计算
   *
   * 分层策略：
   * - 房间**未**加密 + 消息未加密 → 'plain'（正常明文会话）
   * - 房间**已**加密 + 消息未加密 → 'risk'（红锁）
   *   —— 加密房间里的明文消息要么是攻击面（强行降级以绕过 E2EE），要么是发送端配置错误；
   *   两者都必须对用户可见。历史实现恒回 'plain'，于是 `risk` 这一档**永远不可达**。
   * - 已加密 + 有 senderId → 返回缓存值（默认 'unverified'，异步刷新后更新为真实状态）
   * - 已加密 + 无 senderId（无法定位发送者设备）→ 安全默认值 'unverified'
   *   （旧实现恒回 'verified'，造成假安全信号——已修复）
   */
  const trustLevel = scope.run(() =>
    computed<MessageTrustLevel>(() => {
      // 依赖 cacheVersion：refreshTrustLevel 更新缓存后触发重算
      void trustCacheVersion.value
      if (!isEncryptedEvent.value) {
        return toValue(room?.isEncrypted) ? 'risk' : 'plain'
      }

      const senderId = room?.senderId
      if (!senderId) return 'unverified'

      // 优先使用缓存（虚拟列表复用实例时缓存仍有效，senderId 不变则信任等级不变）
      const key = senderCacheKey(senderId)
      if (senderDeviceCache.has(key)) return senderDeviceCache.get(key)!

      // 无缓存 → 安全默认值 'unverified'（异步刷新会在 effect 中更新缓存）
      return 'unverified'
    })
  )!

  /** 是否已验证 */
  const isVerified = scope.run(() => computed(() => trustLevel.value === 'verified'))!

  /**
   * 锁徽章等级：将 `plain` 收敛为 `unverified'（中性灰锁）
   *
   * 仅用于 `MessageLockBadge` 的 `trust-level` 绑定，保证类型安全。
   * 正常路径下徽章只在加密消息上渲染，`plain` 分支不会触发。
   */
  const lockBadgeLevel = scope.run(() =>
    computed<LockBadgeLevel>(() => {
      const level = trustLevel.value
      return level === 'plain' ? 'unverified' : level
    })
  )!

  /**
   * 信任描述的 i18n key
   *
   * 返回 key 而不是文案：composable 层没有 i18n 上下文，硬编码中文会绕过
   * vue-i18n（英文界面下会漏出中文）。由调用方用 `t()` 渲染。
   */
  const trustDescriptionKey = scope.run(() =>
    computed(() => {
      const keys: Record<MessageTrustLevel, string> = {
        verified: 'chat.encryption.verified_title',
        unverified: 'chat.encryption.unverified_title',
        risk: 'chat.encryption.risk_title',
        plain: 'chat.encryption.plain_title'
      }
      return keys[trustLevel.value]
    })
  )!

  // senderId 变化时自动刷新设备验证缓存
  const senderId = room?.senderId
  if (senderId) {
    const stopWatch = scope.run(() => {
      const refreshEffect = () => {
        refreshTrustLevel(senderId)
          .then(() => {
            // 缓存更新后，trustLevel computed 自动重算（因为 senderDeviceCache 被读取）
          })
          .catch(() => {})
      }
      refreshEffect()
      // 定期刷新（每 30 秒），设备验证状态可能变化
      const timer = setInterval(refreshEffect, 30000)
      return () => clearInterval(timer)
    })
    if (stopWatch) scope.run(() => onScopeDispose(stopWatch))
  }

  scope.run(() => onScopeDispose(() => scope.stop()))

  return {
    trustLevel,
    lockBadgeLevel,
    isEncrypted: isEncryptedEvent,
    isVerified,
    trustDescriptionKey,
    encryptionAlgorithm
  }
}
