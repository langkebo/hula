/**
 * Widget 域测试夹具。
 *
 * 响应形状全部从 SDK `WidgetManager` 方法签名推导（`Awaited<ReturnType<...>>`），
 * 不在测试里手抄字段。此前测试手写的 `{ widgets: [{ type }] }`、`{ ok: true }`、
 * `{ session_id }`、`{ conf_id }`、`{ url }` 均与真实契约不一致（见下方注释）。
 */
import type { WidgetManager } from '@/services/matrix/sdk-compat'
import type { Widget } from '../../MatrixWidgetService'

/** 单条 widget 响应（`WidgetApiResponse`：扁平、`type`、含 `user_id`/`creator`/`active`） */
export type SdkWidgetApiResponse = Awaited<ReturnType<WidgetManager['createWidget']>>
/** 房间 widget 列表响应（`WidgetListResponse`：条目为 `WidgetListItem`，且**有 `total`**） */
export type SdkRoomWidgetsResponse = Awaited<ReturnType<WidgetManager['getRoomWidgets']>>
export type SdkWidgetListItem = SdkRoomWidgetsResponse['widgets'][number]
/** 能力位响应 */
export type SdkWidgetCapabilities = Awaited<ReturnType<WidgetManager['setWidgetCapabilities']>>
/** 单条会话响应（`{ session: WidgetSessionItem }`，**不是**扁平 `session_id`） */
export type SdkWidgetSessionResponse = Awaited<ReturnType<WidgetManager['createWidgetSession']>>
/** 会话列表响应（`{ sessions, total }`） */
export type SdkWidgetSessionsResponse = Awaited<ReturnType<WidgetManager['getWidgetSessions']>>
/** Jitsi 配置（5 项必填，非仅 `conf_id`） */
export type SdkJitsiConfig = Awaited<ReturnType<WidgetManager['getJitsiConfig']>>
/** widget 配置（6 项必填，非仅 `url`） */
export type SdkWidgetConfig = Awaited<ReturnType<WidgetManager['getWidgetConfig']>>
/** 设置权限响应（`{ success, permission_id }`，**不是** `{ ok }`） */
export type SdkSetPermissionResponse = Awaited<ReturnType<WidgetManager['setWidgetPermissions']>>
/** 权限列表响应（`{ permissions: WidgetPermissionItem[] }`） */
export type SdkWidgetPermissionsResponse = Awaited<ReturnType<WidgetManager['getWidgetPermissions']>>
/** 单条权限（`{ id, widget_id, user_id, permissions, created_ts }`，此前测试只写了后两项） */
export type SdkWidgetPermissionItem = SdkWidgetPermissionsResponse['permissions'][number]

const CREATED_TS = 1_700_000_000_000

/**
 * 服务层门面 `Widget`（`matrixWidgetService.getWidgets()` / `createWidget()` 的返回元素）。
 * 注意与 SDK 扁平的 `WidgetApiResponse` 不同：门面只保留 `id/type/url` + 可选 `name/data`。
 */
export function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'widget-1',
    type: 'jitsi',
    url: 'https://meet.example.com',
    name: 'Meeting',
    data: {},
    ...overrides
  }
}

/** 单条 widget：`POST/GET/PUT /widgets/{id}` 的扁平响应 */
export function makeSdkWidget(overrides: Partial<SdkWidgetApiResponse> = {}): SdkWidgetApiResponse {
  return {
    widget_id: 'widget-1',
    room_id: '!room:example.com',
    user_id: '@user:example.com',
    type: 'jitsi',
    url: 'https://meet.example.com',
    name: 'Meeting',
    data: {},
    creator: '@user:example.com',
    active: true,
    ...overrides
  }
}

/** 列表条目：`GET /rooms/{id}/widgets` 用的是 `widget_type` */
export function makeSdkWidgetListItem(overrides: Partial<SdkWidgetListItem> = {}): SdkWidgetListItem {
  return {
    id: 1,
    widget_id: 'widget-1',
    room_id: '!room:example.com',
    user_id: '@user:example.com',
    widget_type: 'jitsi',
    url: 'https://meet.example.com',
    name: 'Meeting',
    data: {},
    created_ts: CREATED_TS,
    is_active: true,
    ...overrides
  }
}

/** 房间 widget 列表（`total` 必填） */
export function makeRoomWidgetsResponse(widgets: SdkWidgetListItem[] = []): SdkRoomWidgetsResponse {
  return { widgets, total: widgets.length }
}

/** 能力位 */
export function makeWidgetCapabilities(overrides: Partial<SdkWidgetCapabilities> = {}): SdkWidgetCapabilities {
  return {
    widget_id: 'widget-1',
    room_id: '!room:example.com',
    capabilities: ['m.text'],
    ...overrides
  }
}

/** 会话条目 */
export function makeWidgetSessionItem(
  overrides: Partial<SdkWidgetSessionResponse['session']> = {}
): SdkWidgetSessionResponse['session'] {
  return {
    id: 1,
    session_id: 's-1',
    widget_id: 'widget-1',
    user_id: '@user:example.com',
    created_ts: CREATED_TS,
    is_active: true,
    ...overrides
  }
}

/** 单条会话响应 */
export function makeWidgetSessionResponse(
  session: SdkWidgetSessionResponse['session'] = makeWidgetSessionItem()
): SdkWidgetSessionResponse {
  return { session }
}

/** 会话列表（`total` 必填） */
export function makeWidgetSessionsResponse(
  sessions: SdkWidgetSessionsResponse['sessions'] = []
): SdkWidgetSessionsResponse {
  return { sessions, total: sessions.length }
}

/** Jitsi 配置 */
export function makeJitsiConfig(overrides: Partial<SdkJitsiConfig> = {}): SdkJitsiConfig {
  return {
    conf_id: 'c-1',
    name: 'Meeting',
    domain: 'meet.example.com',
    app_id: null,
    jwt: null,
    ...overrides
  }
}

/** widget 配置 */
export function makeWidgetConfig(overrides: Partial<SdkWidgetConfig> = {}): SdkWidgetConfig {
  return {
    widget_id: 'widget-1',
    room_id: '!room:example.com',
    url: 'https://example.com',
    name: 'Meeting',
    data: {},
    type: 'custom',
    ...overrides
  }
}

/** 设置权限响应 */
export function makeSetPermissionResponse(overrides: Partial<SdkSetPermissionResponse> = {}): SdkSetPermissionResponse {
  return { success: true, permission_id: 1, ...overrides }
}

/** 单条权限 */
export function makeWidgetPermissionItem(overrides: Partial<SdkWidgetPermissionItem> = {}): SdkWidgetPermissionItem {
  return {
    id: 1,
    widget_id: 'widget-1',
    user_id: '@user:example.com',
    permissions: ['read'],
    created_ts: CREATED_TS,
    ...overrides
  }
}

/** 权限列表响应 */
export function makeWidgetPermissionsResponse(
  overrides: Partial<SdkWidgetPermissionsResponse> = {}
): SdkWidgetPermissionsResponse {
  return { permissions: [], ...overrides }
}

/**
 * 房间 state 测试桩：仅覆盖 `getWidgetsFromRoomState` 回退路径读取的
 * `currentState.getStateEvents(type)` 及事件的 `getContent` / `getStateKey`。
 */
export interface RoomStateEventInput {
  stateKey: string
  content: Record<string, unknown>
}

export function makeRoomStateStub(eventsByType: Record<string, RoomStateEventInput[]>) {
  return {
    currentState: {
      getStateEvents: (eventType: string) =>
        (eventsByType[eventType] ?? []).map((entry) => ({
          getContent: () => entry.content,
          getStateKey: () => entry.stateKey,
          getId: () => `$state-${entry.stateKey}`,
          getType: () => eventType
        }))
    }
  }
}
