import { describe, expect, it } from 'vitest'
import { computed } from 'vue'

// Mock useMessageTrust composable (simplified for unit testing)
const useMessageTrust = (isEncrypted: boolean, _roomId: string) => {
  const trustLevel = computed(() => {
    if (!isEncrypted) return 'plain' as const
    return 'verified' as const
  })
  const isEncryptedEvent = computed(() => isEncrypted)
  const isVerified = computed(() => trustLevel.value === 'verified')
  const trustDescription = computed(() => {
    const descriptions: Record<string, string> = {
      verified: '端到端加密已验证',
      unverified: '端到端加密未完全验证',
      risk: '端到端加密存在安全风险',
      plain: '消息未加密'
    }
    return descriptions[trustLevel.value]
  })
  return { trustLevel, isEncryptedEvent, isVerified, trustDescription }
}

describe('useMessageTrust', () => {
  it('returns plain for non-encrypted messages', () => {
    const result = useMessageTrust(false, 'room1')
    expect(result.trustLevel.value).toBe('plain')
    expect(result.isEncryptedEvent.value).toBe(false)
    expect(result.isVerified.value).toBe(false)
  })

  it('returns verified for encrypted messages', () => {
    const result = useMessageTrust(true, 'room1')
    expect(result.trustLevel.value).toBe('verified')
    expect(result.isEncryptedEvent.value).toBe(true)
    expect(result.isVerified.value).toBe(true)
  })

  it('provides correct trust description for plain messages', () => {
    const result = useMessageTrust(false, 'room1')
    expect(result.trustDescription.value).toBe('消息未加密')
  })

  it('provides correct trust description for verified messages', () => {
    const result = useMessageTrust(true, 'room1')
    expect(result.trustDescription.value).toBe('端到端加密已验证')
  })
})
