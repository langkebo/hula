/**
 * 设备域 DTO：密钥请求与设备列表变更。
 *
 * 从 `MatrixDeviceService.ts` 拆出，保持服务文件聚焦于调用逻辑。
 */

/** 房间密钥请求条目（GET /room_keys/request 原始响应元素）。 */
export interface RoomKeyRequestEntry {
  request_id: string
  status?: string
  room_id?: string
  sender_key?: string
  device_id?: string
  algorithm?: string
}

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
