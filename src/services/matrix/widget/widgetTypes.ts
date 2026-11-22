import type { WidgetManager } from '../sdk-compat'

/**
 * Matrix widget 相关 DTO。
 *
 * 从 `MatrixWidgetService.ts` 拆出：响应类型全部从 SDK `WidgetManager`
 * 方法签名派生，集中在类型文件便于契约演进时一眼对齐。
 */

/** SDK widget 数据载荷（后端 `serde_json::Value` ⇒ 任意 JSON 值，可能是 null/数组/标量）。 */
export type WidgetData = Awaited<ReturnType<WidgetManager['getWidgetConfig']>>['data']

/**
 * widget 数据对象：后端 `serde_json::Value` 的对象形态，字段随 widget 类型变化，
 * 属真·动态包（如 Jitsi 的 domain/conferenceId/auth），故以具名索引签名承载。
 */
export type WidgetDataObject = { [key: string]: unknown }

export interface Widget {
  id: string
  type: string
  url: string
  name?: string | undefined
  data?: WidgetDataObject | undefined
}

export interface WidgetSessionOptions {
  deviceId?: string
  expiresInMs?: number
}

/** 以下响应类型全部从 SDK `WidgetManager` 方法签名派生，不再手写空索引签名接口。 */
export type WidgetConfigResponse = Awaited<ReturnType<WidgetManager['getWidgetConfig']>>
export type JitsiConfigResponse = Awaited<ReturnType<WidgetManager['getJitsiConfig']>>
export type WidgetPermissionsResponse = Awaited<ReturnType<WidgetManager['getWidgetPermissions']>>
export type SetPermissionResponse = Awaited<ReturnType<WidgetManager['setWidgetPermissions']>>
export type SessionApiData = Awaited<ReturnType<WidgetManager['getWidgetSession']>>

/** Widget 会话条目（SDK `getWidgetSessions` 返回的 `sessions` 元素）。 */
export interface WidgetSessionEntry {
  session_id: string
  user_id?: string
  created_ts?: number | null
  created_at?: number | string
  last_active_ts?: number | null
  last_active?: number | string
}

/** Widget 会话列表响应（SDK 返回 `{ sessions, total }`；失败时服务层降级为 `[]`）。 */
export interface WidgetSessionsOutcome {
  sessions?: WidgetSessionEntry[]
  total?: number
}

/**
 * SDK 侧 widget 的**两种**真实形状（后端有意不统一，见 SDK `docs/api-contract/widget.md`）：
 * - 单条（`POST/GET/PUT /widgets/{id}`）：`WidgetApiResponse` —— 用 `type`，扁平，无 `{widget}` 信封；
 * - 列表（`GET /rooms/{id}/widgets`）：`Widget` 记录 —— 用 `widget_type`，另带 `id`/`is_active`。
 *
 * 写成一个宽松结构，是因为本服务的 facade 只关心 id/type/url/name/data；
 * `type` 缺失时由 `toWidgetFacade` 从 `widget_type` 归一化。
 */
export interface SdkWidget {
  widget_id: string
  room_id?: string | null
  type?: string
  widget_type?: string
  url: string
  name: string
  /**
   * 后端是 `serde_json::Value` ⇒ **任意 JSON**（可能是 null / 数组 / 标量），不是 `Record`。
   * 契约里对应 `WidgetJsonValue`；到 facade 时用 `unknownToObject` 归一成对象（非对象 ⇒ null）。
   */
  data?: WidgetData
}

export interface WidgetCapabilitiesResponse {
  capabilities: string[]
  widget_id: string
  room_id: string
}

export interface SendWidgetMessageRequest {
  type: string
  content: WidgetDataObject
}
