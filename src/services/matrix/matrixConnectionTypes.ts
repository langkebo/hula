/**
 * Matrix 连接管理器对外契约类型。
 *
 * 从 `MatrixConnectionManager.ts` 拆出，供其它模块与状态机复用，避免实现文件膨胀。
 */

/** 连接状态类型 */
export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'CATCHUP' | 'ERROR'

/** 同步错误的最小形状（仅读取 errcode / name） */
export type SyncErrorLike = {
  errcode?: string
  name?: string
}

/** Matrix 客户端配置接口 */
export interface MatrixClientConfig {
  homeserverUrl: string
  identityServerUrl?: string
  deviceId?: string
  accessToken?: string
  userId?: string
  allowInsecureHttp?: boolean
  slidingSync?: {
    roomRangeEnd?: number
    timelineLimit?: number
    pollTimeout?: number
  }
}

/** 状态变更回调类型 */
export type ConnectionStateChangeCallback = (state: ConnectionState) => void

/** 同步状态映射结果 */
export type SyncStateMappingResult = {
  /** 映射后的连接状态（null 表示无需变更） */
  connectionState: ConnectionState | null
  /** 是否是 PREPARED/SYNCING（用于 markReady） */
  isReady: boolean
}
