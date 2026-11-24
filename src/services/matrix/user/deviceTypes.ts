/**
 * 设备域 DTO：设备列表变更。
 *
 * 从 `MatrixDeviceService.ts` 拆出，保持服务文件聚焦于调用逻辑。
 */

/** 设备列表变更响应 */
export interface DeviceListUpdatesResponse {
  changed: Array<{ user_id: string; device_id: string; device_data: unknown }>
  left: string[]
  deleted?: string[]
  stream_id?: number
}

/** 设备列表变更请求 */
export interface DeviceListUpdatesRequest {
  users: string[]
  since?: string | number
  from?: string | number
  to?: string | number
}
