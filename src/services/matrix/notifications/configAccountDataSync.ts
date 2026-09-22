import { createLogger } from '@/utils/Logger'
import {
  NOTIFICATION_CONFIG_ACCOUNT_DATA_TYPE,
  type NotificationConfig,
  type NotificationConfigStore
} from './notificationConfig'

const logger = createLogger('NotificationConfigSync')

/**
 * 账号数据同步只需要 `setAccountData` / `getAccountData`，因此不引用完整 `MatrixClient`：
 * 结构化的最小接口既避免 SDK 边界扩散，也让测试可以直接传桩对象。
 */
export interface NotificationAccountDataClient {
  setAccountData(type: string, content: Record<string, unknown>): Promise<unknown>
  getAccountData(type: string): { getContent(): unknown } | undefined
}

/**
 * 把通知展示配置写入账号数据 `io.hula.notification_settings`。
 *
 * **展示配置是设备本地偏好**（桌面是否显示内容、是否显示发送者等语义随屏幕与场景变化），
 * 因此这里是**只写不读**的服务端备份：本地写入后 fire-and-forget 同步一份，
 * 但启动 / 写入后都不会用它覆盖本地。冷启动水合只读 localStorage。
 *
 * @param client 已就绪的矩阵客户端
 * @param config 要同步的配置快照
 */
export async function pushConfigToAccountData(
  client: NotificationAccountDataClient,
  config: NotificationConfig
): Promise<void> {
  try {
    await client.setAccountData(NOTIFICATION_CONFIG_ACCOUNT_DATA_TYPE, config as unknown as Record<string, unknown>)
    logger.info('[MatrixNotification] 通知配置已同步到服务端')
  } catch (err) {
    logger.error(`[MatrixNotification] 同步通知配置到服务端失败: ${err}`)
  }
}

/**
 * 从账号数据读回展示配置并写入本地存储。
 *
 * **生产零调用方，且刻意不接线**：展示配置是设备本地偏好（见 `pushConfigToAccountData`），
 * 跨设备同步会引入设备语义冲突与冲突判定成本。保留该方法只作为将来的显式恢复入口：
 * 若要接线，必须先定义「哪些字段算账号级」与「服务端/本地谁赢」，不能直接整份覆盖本地。
 *
 * 读回时先本地重载（观察其它窗口的改动），再让服务端字段覆盖同名字段。
 *
 * @param client 已就绪的矩阵客户端
 * @param store 本地配置存储（负责迁移、持久化与逐字段校验）
 * @returns 是否成功从服务端读回配置
 */
export async function pullConfigFromAccountData(
  client: NotificationAccountDataClient,
  store: NotificationConfigStore
): Promise<boolean> {
  const event = client.getAccountData(NOTIFICATION_CONFIG_ACCOUNT_DATA_TYPE)
  if (!event) {
    return false
  }

  const serverConfig = event.getContent() as Partial<NotificationConfig>
  if (!serverConfig || typeof serverConfig !== 'object') {
    return false
  }

  store.loadConfig()
  store.setConfig({ ...store.getConfig(), ...serverConfig })
  logger.info('[MatrixNotification] 从服务端同步通知配置成功')
  return true
}
