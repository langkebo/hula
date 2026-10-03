import { createLogger } from '@/utils/Logger'
import type { DndWindow } from './dndWindow'

const logger = createLogger('DndAccountDataSync')

/** 账号数据里的勿扰时段类型（跨设备同步）。 */
export const DND_ACCOUNT_DATA_TYPE = 'io.hula.dnd_settings'

/** 账号数据同步只需要 `setAccountData`，不依赖完整客户端。 */
export interface DndAccountDataWriter {
  setAccountData(type: string, content: Record<string, unknown>): Promise<unknown>
}

/**
 * 把勿扰时段（含 `updatedAt`）写入账号数据 `io.hula.dnd_settings`
 * （`setDndSettings` 复用它，不复制实现）。
 *
 * 先 `waitForClientReady` 由调用方保证：否则冷启动 / 未就绪时会静默丢写，
 * 本地镜像还在、用户看不出来，另一台设备永远收不到。
 *
 * @param client 已就绪的矩阵客户端
 * @param settings 要同步的窗口
 */
export async function pushDndToAccountData(client: DndAccountDataWriter, settings: DndWindow): Promise<void> {
  try {
    await client.setAccountData(DND_ACCOUNT_DATA_TYPE, settings as unknown as Record<string, unknown>)
    logger.info('[MatrixNotification] DND 设置已同步到服务端')
  } catch (err) {
    logger.error(`[MatrixNotification] 同步 DND 设置到服务端失败: ${err}`)
  }
}

/**
 * 账号数据里的时间戳：只有有限数值才是有效边界；缺失 / NaN / 非法类型一律视为未设置。
 *
 * @param value 账号数据里的原始值
 */
export function normalizeDndTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * 把账号数据里的原始 DND 内容归一化成窗口：非法边界视为「未设置」，
 * 否则 `NaN` 会走跨午夜分支在上午误判为勿扰、静默吃掉正常通知。
 *
 * @param content 账号数据 `getContent()` 的原始对象
 */
export function normalizeDndWindow(content: {
  enabled?: boolean
  startTime?: unknown
  endTime?: unknown
  updatedAt?: unknown
}): DndWindow {
  return {
    enabled: content.enabled === true,
    startTime: normalizeDndTimestamp(content.startTime),
    endTime: normalizeDndTimestamp(content.endTime),
    updatedAt: normalizeDndTimestamp(content.updatedAt) ?? 0
  }
}
