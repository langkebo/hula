import { createLogger } from '@/utils/Logger'

const logger = createLogger('StrictDeviceReplay')

/**
 * 重放持久化的「严格模式」偏好（R-1）——**带环规避的调用点**。
 *
 * ## 为什么单独成模块（而不是在 `MatrixCryptoStateTracker` 里直接调）
 *
 * 两个约束同时成立：
 *
 * 1. **必须用动态 `import()`**。静态导入会形成环：
 *    ```
 *    MatrixCryptoStateTracker
 *      → strictDevicePolicyBootstrap
 *      → strictDevicePolicy
 *      → CryptoSDKAdapter
 *      → MatrixClientService
 *      → new MatrixCryptoStateTracker()   ← 类字段初始化，模块求值期即执行
 *    ```
 *    环上最后一跳发生在 `MatrixClientService` 的**类字段初始化**处，此时
 *    `MatrixCryptoStateTracker` 尚未求值完成 ⇒ 读到未初始化的绑定（TDZ），
 *    抛 `MatrixCryptoStateTracker is not a constructor`，**整个测试文件无法加载**
 *    （2026-10-13 修复；已在 HEAD 上用独立工作树复现）。
 *    动态导入把这条边从静态图里去掉，环即消失。
 *
 * 2. **不能把这段逻辑留在 `MatrixCryptoStateTracker.ts`**。该文件属
 *    `check:file-size` 的体积基线受管文件（只许缩不许增），塞进去会让它顶红。
 *
 * ## 语义
 *
 * **尽力而为**：任何失败都不得影响 crypto 初始化本身的结论（调用方只在
 * `ensureCrypto` 末尾"顺手"重放用户的偏好），故整体吞错并只记 warn。
 * crypto 未就绪时 `reapplyPersistedStrictness` 内部会计为"暂不可应用"而不抛错；
 * 进入加密房间时房间内横幅（`useRoomStrictness`）还会再施加一次。
 *
 * @returns 无返回值；失败只记录日志（调用方无需区分成功与失败）
 */
export async function replayPersistedStrictness(): Promise<void> {
  try {
    const { reapplyPersistedStrictness } = await import('@/services/matrix/crypto/strictDevicePolicyBootstrap')
    reapplyPersistedStrictness()
  } catch (err) {
    logger.warn(`严格模式偏好重放失败（不影响 crypto 初始化）: ${err instanceof Error ? err.message : String(err)}`)
  }
}
