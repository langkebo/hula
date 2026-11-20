/**
 * crypto 域 · 脱水设备（MSC3814）测试夹具。
 *
 * 类型全部从 `MatrixClient.getDehydratedDeviceManager()` 的 SDK 契约推导：
 * - `createDevice` / `updateDeviceData` / `deleteDevice` → `{ device_id }`（同形）；
 * - `getDevice` → `DeviceInfo`；
 * - `getDevices` → `{ devices }`；
 * - `claimDevice` → `{ events, next_batch?, [key: string]: unknown }`。
 *
 * 修正的假结构：`claimDevice` 响应的 `events` 是必填数组（旧 mock 只有
 * `access_token` / `device_id`）；`deleteDevice` 响应必须带 `device_id`
 * （旧 mock 用 `{}`）；`DeviceInfo.device_data` 若给值必须是
 * `{ algorithm, account }`（旧 mock 用 `{}`）。
 */
import type { MatrixClient } from 'matrix-js-sdk'

type DeviceManagerWire = ReturnType<MatrixClient['getDehydratedDeviceManager']>
/** `createDevice` / `updateDeviceData` / `deleteDevice` 共用的响应形状 */
type DehydratedDeviceIdResponseWire = Awaited<ReturnType<DeviceManagerWire['createDevice']>>
/** `getDevice` 返回的单台设备信息 */
type DehydratedDeviceInfoWire = Awaited<ReturnType<DeviceManagerWire['getDevice']>>
/** `getDevices` 返回的分页容器 */
type DehydratedDevicesResponseWire = Awaited<ReturnType<DeviceManagerWire['getDevices']>>
/** `claimDevice` 返回的 to-device 事件分页 */
type ClaimDehydratedDeviceResponseWire = Awaited<ReturnType<DeviceManagerWire['claimDevice']>>
/** `DeviceInfo.device_data` 的 wire 结构 */
type DehydratedDeviceDataWire = NonNullable<DehydratedDeviceInfoWire['device_data']>

/** 脱水设备密钥数据（`algorithm` + `account` 均为服务端必需） */
export function makeDehydratedDeviceData(overrides: Partial<DehydratedDeviceDataWire> = {}): DehydratedDeviceDataWire {
  return { algorithm: 'm.dehydration.v1.olm', account: 'account', ...overrides }
}

/** `createDevice` / `updateDeviceData` / `deleteDevice` 的响应 */
export function makeDehydratedDeviceIdResponse(
  overrides: Partial<DehydratedDeviceIdResponseWire> = {}
): DehydratedDeviceIdResponseWire {
  return { device_id: 'DEVID123', ...overrides }
}

/** `getDevice` 的单台设备信息（默认只有必填的 `device_id`） */
export function makeDehydratedDeviceInfo(overrides: Partial<DehydratedDeviceInfoWire> = {}): DehydratedDeviceInfoWire {
  return { device_id: 'DEVID123', ...overrides }
}

/** `getDevices` 的设备列表容器 */
export function makeDehydratedDevicesResponse(
  devices: DehydratedDeviceInfoWire[] = [],
  overrides: Partial<DehydratedDevicesResponseWire> = {}
): DehydratedDevicesResponseWire {
  return { devices, ...overrides }
}

/** `claimDevice` 的 to-device 事件分页（`events` 必填，游标缺省） */
export function makeClaimDehydratedDeviceResponse(
  overrides: Partial<ClaimDehydratedDeviceResponseWire> = {}
): ClaimDehydratedDeviceResponseWire {
  return { events: [], ...overrides }
}
