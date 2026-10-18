import { type ComputedRef, computed } from 'vue'
import type { MessageTrustLevel } from '@/services/matrix/crypto/messageTrustCache'
import { useSettingStore } from '@/stores/domains/settings/setting'

/**
 * 信任门禁策略（F-1）
 *
 * ## 这是**视觉降级，不是安全边界**
 *
 * 消息在客户端早于本组件就已解密并进入 DOM，模糊只是降低「肩窥/误读」成本，
 * 挡不住任何人打开 DevTools 或改一行 CSS。因此：
 * - 文案不得暗示「内容被保护/已隐藏」；
 * - 不能把它当作访问控制，也不能据此说「这条消息是安全的」。
 *
 * ## 分级（对应方案 F-1 表）
 * - `verified`   → 永远正常渲染（不打扰已确认的对端）
 * - `unverified` → 默认正常渲染 + 灰锁；**仅严格模式**下模糊 + 点击展开
 * - `risk`（加密房间里的明文）→ 红锁；**严格模式**下默认模糊 + 警示条
 * - `plain`（未加密房间的明文）→ 与信任无关，不门禁
 */
export type TrustGateVisibility = 'open' | 'masked'

export interface TrustGatePolicy {
  /** 用户是否开启了严格模式（持久化在 setting store） */
  strict: ComputedRef<boolean>
  /** 该信任级在严格模式下是否需要默认模糊 */
  shouldMask: (level: MessageTrustLevel) => boolean
  /** 是否需要展示「加密房间里出现明文」警示条 */
  shouldWarnPlaintextInEncryptedRoom: (level: MessageTrustLevel) => boolean
  /** 取该信任级在当前策略下的初始可见性 */
  visibilityFor: (level: MessageTrustLevel) => TrustGateVisibility
}

export function useTrustGatePolicy(): TrustGatePolicy {
  const settingStore = useSettingStore()
  const strict = computed(() => settingStore.trustGateStrictEnabled)

  /**
   * `risk` 的语义是「**加密房间**里出现了明文」——它本身就是异常，
   * 即使不开严格模式也要有可见提示（红锁已在徽章上，警示条由 gate 决定）。
   */
  const shouldMask = (level: MessageTrustLevel): boolean => {
    if (!strict.value) return false
    return level === 'unverified' || level === 'risk'
  }

  // 只在严格模式下加警示条：默认状态保持既有 UX（红锁已足够提示），
  // 不能让策略一上线就改变所有既有会话的观感。
  const shouldWarnPlaintextInEncryptedRoom = (level: MessageTrustLevel): boolean => strict.value && level === 'risk'

  const visibilityFor = (level: MessageTrustLevel): TrustGateVisibility => (shouldMask(level) ? 'masked' : 'open')

  return { strict, shouldMask, shouldWarnPlaintextInEncryptedRoom, visibilityFor }
}
