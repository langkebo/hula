import { createLogger } from '@/utils/Logger'
import { type AdminApiAvailability, classifyAdminApiProbe, describeAdminApiAvailability } from './adminApiAvailability'

const logger = createLogger('AdminApiProbe')

/**
 * 探测所需的最小客户端能力（**结构化**类型，不 import `matrix-js-sdk`）。
 *
 * 为什么不直接用 `MatrixClient`：`scripts/check-sdk-boundary.mjs` 禁止在
 * 边界层之外裸引 `matrix-js-sdk`（新文件会直接判红）。探测只需要 `whoami`，
 * 用最小接口反而更清晰，也让本服务不携带 SDK 版本耦合。
 */
interface AdminApiProbeClient {
  getAdminManager(): { whoami(): Promise<unknown> }
}

/**
 * Admin API 可用性探测（含错误分类与**如实**日志）。
 *
 * 为什么单独成服务：`AdminFacadeService.ts` 属 `check:file-size` 的体积基线受管文件
 * （只许缩不许增），内联这段逻辑会把它顶红；且在门面里就地写死布尔返回值，
 * 正是 2026-10-13 那次"403 被报成后端不可用"的温床。
 *
 * 探测方式：调用 Admin API 的 `whoami`。**失败不等于"后端没有 Admin API"** ——
 * 403（无权限）恰恰证明 API 可达。分类细节见 `adminApiAvailability.ts`。
 */
export class AdminApiProbeService {
  constructor(private readonly getClient: () => AdminApiProbeClient) {}

  /**
   * 探测并按错误分类。
   *
   * @returns 五态之一：`available` / `forbidden` / `unauthorized` / `unsupported` / `unavailable`
   */
  async probe(): Promise<AdminApiAvailability> {
    try {
      await this.getClient().getAdminManager().whoami()
      return classifyAdminApiProbe(null)
    } catch (err) {
      const availability = classifyAdminApiProbe(err)
      // 无权限 / 凭证失效 / 该 homeserver 未提供 Admin API 都是**业务事实**，不是异常 ⇒ debug；
      // 只有真正无法判定（网络 / 5xx）才值得 warn。
      if (availability.status === 'unavailable') {
        logger.warn(`Admin API 探测失败: ${describeAdminApiAvailability(availability)}`, err)
      } else {
        logger.debug(`[Admin] Admin API 探测: ${describeAdminApiAvailability(availability)}`)
      }
      return availability
    }
  }

  /**
   * 布尔可用性（与历史 `checkAdminApiAvailability()` 语义一致：**仅** `available` 为 true）。
   *
   * 注意：`forbidden`（403 无权限）同样返回 false —— 表示"当前用户不能走 Admin API"，
   * 但**不代表**后端没有 Admin API。需要区分请直接用 `probe()`。
   */
  async isAvailable(): Promise<boolean> {
    return (await this.probe()).status === 'available'
  }
}
