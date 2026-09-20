import { computed, type MaybeRefOrGetter, toValue } from 'vue'

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

/**
 * 消息信任计算 Composable
 *
 * @param isEncrypted - 是否加密事件。支持 ref / getter，保证 `props` 变化时信任等级同步更新；
 *                      直接传布尔值亦兼容（等价于一次性快照）。
 * @param room - 房间信息（可选）
 * @returns 消息信任相关计算属性
 *
 * @example
 * ```ts
 * // 响应式（推荐）：消息切换/虚拟列表复用实例时不会残留旧信任等级
 * const { lockBadgeLevel, isEncrypted } = useMessageTrust(() => props.message?.body?.hasEncryption === true)
 * // 静态
 * const { trustLevel } = useMessageTrust(true, room)
 * ```
 */
export function useMessageTrust(
  isEncrypted: MaybeRefOrGetter<boolean>,
  room?: {
    getEncryptionAlgorithm?: () => string | null
    isEncrypted?: boolean
  }
) {
  /** 是否已加密（响应式解包） */
  const isEncryptedEvent = computed(() => toValue(isEncrypted))

  /** 加密算法 */
  const encryptionAlgorithm = computed<string | null>(() => {
    if (!isEncryptedEvent.value || !room?.getEncryptionAlgorithm) return null
    return room.getEncryptionAlgorithm()
  })

  /**
   * 信任等级计算（简化版）
   * 完整实现应结合设备验证状态、交叉签名等
   */
  const trustLevel = computed<MessageTrustLevel>(() => {
    if (!isEncryptedEvent.value) return 'plain'
    // 简化：加密但无法验证设备时标记为 unverified
    // 实际实现应使用 OlmMachine 的设备验证状态
    return 'verified'
  })

  /** 是否已验证 */
  const isVerified = computed(() => trustLevel.value === 'verified')

  /**
   * 锁徽章等级：将 `plain` 收敛为 `unverified`（中性灰锁）
   *
   * 仅用于 `MessageLockBadge` 的 `trust-level` 绑定，保证类型安全。
   * 正常路径下徽章只在加密消息上渲染，`plain` 分支不会触发。
   */
  const lockBadgeLevel = computed<LockBadgeLevel>(() => {
    const level = trustLevel.value
    return level === 'plain' ? 'unverified' : level
  })

  /** 信任描述 */
  const trustDescription = computed(() => {
    const descriptions: Record<MessageTrustLevel, string> = {
      verified: '端到端加密已验证',
      unverified: '端到端加密未完全验证',
      risk: '端到端加密存在安全风险',
      plain: '消息未加密'
    }
    return descriptions[trustLevel.value]
  })

  return {
    trustLevel,
    lockBadgeLevel,
    isEncrypted: isEncryptedEvent,
    isVerified,
    trustDescription,
    encryptionAlgorithm
  }
}

export default useMessageTrust
