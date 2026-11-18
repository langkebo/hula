/** 消息加载失败的归类：决定错误态的插图与文案，不改变重试路径 */
export type MessageLoadFailureCategory = 'network' | 'permission' | 'server' | 'unknown'

/** 消息加载失败的可见信号 */
export type MessageLoadFailure = {
  /** 'history'=翻页失败(游标保留可重试) / 'initial'=首屏失败(显示错误态而非空态) / 'live'=单帧实时处理失败 */
  scope: 'history' | 'initial' | 'live'
  /** 失败原因：优先服务端 errcode（如 M_FORBIDDEN），其次 Error.message */
  reason: string
  /** 失败归类（见 classifyLoadFailure），用于按网络/权限/服务端分级展示 */
  category: MessageLoadFailureCategory
}

/** 从异常里压出可留存的原因文本：服务端 errcode 优先，便于按网络 / 权限 / 服务端分级 */
export const describeLoadFailure = (err: unknown): string => {
  if (err && typeof err === 'object') {
    const { errcode, message } = err as { errcode?: unknown; message?: unknown }
    if (typeof errcode === 'string' && errcode) return errcode
    if (typeof message === 'string' && message) return message
  }
  return typeof err === 'string' && err ? err : 'unknown'
}

/** 表示「认证/授权不足」的服务端 errcode */
const PERMISSION_ERRCODES = new Set(['M_FORBIDDEN', 'M_UNAUTHORIZED', 'M_MISSING_TOKEN', 'M_UNKNOWN_TOKEN'])

/** 网络层失败的特征（fetch/XHR 在无响应时只有 message，没有 errcode 与状态码） */
const NETWORK_FAILURE_HINT = /network|fetch|timeout|timed out|offline|econn|enotfound|load failed/i

/**
 * 把加载异常归类为网络 / 权限 / 服务端 / 未知。
 *
 * 判定只依赖可核实的证据，顺序为：服务端 errcode → HTTP 状态码 → 网络层特征。
 * 拿不到任何证据时返回 unknown，由 UI 回落到通用文案，避免猜错原因误导用户。
 */
export const classifyLoadFailure = (err: unknown): MessageLoadFailureCategory => {
  if (err && typeof err === 'object') {
    const { errcode, status, httpStatus, message } = err as {
      errcode?: unknown
      status?: unknown
      httpStatus?: unknown
      message?: unknown
    }
    if (typeof errcode === 'string' && errcode) {
      return PERMISSION_ERRCODES.has(errcode) ? 'permission' : 'server'
    }
    const httpCode = typeof status === 'number' ? status : httpStatus
    if (typeof httpCode === 'number' && httpCode > 0) {
      return httpCode === 401 || httpCode === 403 ? 'permission' : 'server'
    }
    if (err instanceof TypeError) return 'network'
    if (typeof message === 'string' && NETWORK_FAILURE_HINT.test(message)) return 'network'
  }
  if (typeof err === 'string' && NETWORK_FAILURE_HINT.test(err)) return 'network'
  return 'unknown'
}
