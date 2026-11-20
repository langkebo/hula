import type { CryptoLifecycleDiagnostics } from '@/services/matrix/crypto/cryptoLifecycleDiagnostics'

/**
 * crypto 生命周期诊断快照（`matrixClientService.getCryptoLifecycleDiagnostics()` 的返回值）。
 *
 * 默认即「无失配」：无拒绝记录、无成功解绑、无 A1 复发哨兵。
 */
export function makeCryptoLifecycleDiagnostics(
  overrides: Partial<CryptoLifecycleDiagnostics> = {}
): CryptoLifecycleDiagnostics {
  return {
    lastBindingReleaseRejection: null,
    stoppedBindingReleased: 0,
    staleCryptoReuseWarning: null,
    ...overrides
  }
}
