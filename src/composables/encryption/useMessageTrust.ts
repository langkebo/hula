import { computed, effectScope, type MaybeRefOrGetter, onScopeDispose, shallowRef, toValue } from 'vue'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'
import { createLogger } from '@/utils/Logger'

/**
 * 消息级 E2EE 信任状态
 *
 * 基于 Matrix 事件加密状态推导消息级信任等级：
 * - `verified`: 已验证的端到端加密消息（绿锁）
 * - `unverified`: 未完全验证的加密消息（灰锁）
 * - `risk`: 存在安全风险的加密消息（红锁）
 * - `plain`: 未加密消息
 */
export type MessageTrustLevel = 'verified' | 'unverified' | 'risk' | 'plain'

/**
 * 锁徽章等级（不含 `plain`）
 *
 * `MessageLockBadge` 只表达三种「已加密」的信任状态；未加密消息不展示徽章。
 * 收敛逻辑集中在此处，避免组件内联做锁态映射。
 */
export type LockBadgeLevel = 'verified' | 'unverified' | 'risk'

const _logger = createLogger('useMessageTrust')

/**
 * 发送者设备验证状态缓存（模块级，避免每次消息渲染都去查设备列表）
 * key = senderId, value = 'verified' | 'unverified' | 'risk'
 *
 * 注意：测试代码可直接访问此导出用于缓存清理
 */
export const senderDeviceCache = new Map<string, MessageTrustLevel>()

/** 缓存版本计数器（用于触发 computed 重算） */
const cacheVersion = shallowRef(0)

/**
 * 异步刷新信任等级（查设备列表 → 交叉签名 → 更新缓存）
 *
 * 典型用法：消息渲染组件在 `onMounted` / senderId 变化时调用，
 * 将同步的 `trustLevel` 从安全默认值 'unverified' 升级到真实状态。
 *
 * @returns 刷新后的信任等级；失败时保持缓存原值（不抛错）
 */
export async function refreshTrustLevel(senderId: string): Promise<MessageTrustLevel> {
  if (!senderId) return 'unverified'
  try {
    const devices = await matrixDeviceService.getUserDevices(senderId)
    if (devices.length === 0) {
      senderDeviceCache.set(senderId, 'unverified')
      cacheVersion.value++
      return 'unverified'
    }
    // 任一设备交叉签名已验证 → 整体视为 verified
    const anyVerified = devices.some((d) => d.verified)
    if (anyVerified) {
      senderDeviceCache.set(senderId, 'verified')
      cacheVersion.value++
      return 'verified'
    }
    // 无交叉签名设备 → unverified（blocked 设备在 verified=false 时已落入此分支）
    senderDeviceCache.set(senderId, 'unverified')
    cacheVersion.value++
    return 'unverified'
  } catch {
    // 设备查询失败 → 保持安全默认值，不抛错干扰渲染
    cacheVersion.value++
    return senderDeviceCache.get(senderId) ?? 'unverified'
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
    isEncrypted?: boolean
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
   * - 未加密 → 'plain'
   * - 有 senderId → 返回缓存值（默认 'unverified'，异步刷新后更新为真实状态）
   * - 无 senderId（无法定位发送者设备）→ 安全默认值 'unverified'
   *   （旧实现恒回 'verified'，造成假安全信号——已修复）
   */
  const trustLevel = scope.run(() =>
    computed<MessageTrustLevel>(() => {
      // 依赖 cacheVersion：refreshTrustLevel 更新缓存后触发重算
      void cacheVersion.value
      if (!isEncryptedEvent.value) return 'plain'

      const senderId = room?.senderId
      if (!senderId) return 'unverified'

      // 优先使用缓存（虚拟列表复用实例时缓存仍有效，senderId 不变则信任等级不变）
      if (senderDeviceCache.has(senderId)) return senderDeviceCache.get(senderId)!

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

export default useMessageTrust
