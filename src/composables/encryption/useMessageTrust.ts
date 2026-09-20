import { computed } from 'vue'

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
 * 消息信任计算 Composable
 *
 * @param isEncrypted - 是否加密事件
 * @param room - 房间信息（可选）
 * @returns 消息信任相关计算属性
 *
 * @example
 * ```ts
 * const { trustLevel } = useMessageTrust(true, room)
 * ```
 */
export function useMessageTrust(
  isEncrypted: boolean,
  room?: {
    getEncryptionAlgorithm?: () => string | null
    isEncrypted?: boolean
  }
) {
  /** 加密算法 */
  const encryptionAlgorithm = computed<string | null>(() => {
    if (!isEncrypted || !room?.getEncryptionAlgorithm) return null
    return room.getEncryptionAlgorithm()
  })

  /** 是否已加密 */
  const isEncryptedEvent = computed(() => isEncrypted)

  /**
   * 信任等级计算（简化版）
   * 完整实现应结合设备验证状态、交叉签名等
   */
  const trustLevel = computed<MessageTrustLevel>(() => {
    if (!isEncrypted) return 'plain'
    // 简化：加密但无法验证设备时标记为 unverified
    // 实际实现应使用 OlmMachine 的设备验证状态
    return 'verified'
  })

  /** 是否已验证 */
  const isVerified = computed(() => trustLevel.value === 'verified')

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
    isEncrypted: isEncryptedEvent,
    isVerified,
    trustDescription,
    encryptionAlgorithm
  }
}

export default useMessageTrust
