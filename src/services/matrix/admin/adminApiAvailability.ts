/**
 * Admin API 可用性的**错误分类**（纯函数，无副作用，便于单测）。
 *
 * 背景（2026-10-13 实测 `pnpm td` 日志）：
 * `checkAdminApiAvailability()` 对**任何**异常都返回 `false`，调用方随即打印
 * `[AdminStore] 后端 Admin API 不可用，无法验证管理员身份`。而同一段日志里
 * 真实错误是 `{"errorCode":"M_FORBIDDEN","statusCode":403}` ——
 * **403 说明 Admin API 明明可达**，只是当前用户没有权限。把"无权限"报成
 * "后端不可用"会让排障追错方向（去查后端部署，而其实只需给用户加管理员）。
 *
 * 本模块把探测结果分成五类，并给出各自的处置含义，供日志与 UI 使用。
 */

export type AdminApiAvailabilityStatus =
  /** 探测成功（HTTP 200）：Admin API 在，且当前凭证可用 */
  | 'available'
  /** 403 / M_FORBIDDEN：Admin API **可达**，但当前用户无管理员权限 */
  | 'forbidden'
  /** 401 / M_UNKNOWN_TOKEN：Admin API 可达，但凭证无效或已过期 */
  | 'unauthorized'
  /** 404 / M_UNRECOGNIZED：该 homeserver 未提供 Admin API */
  | 'unsupported'
  /** 网络错误 / 5xx / 无法判定 */
  | 'unavailable'

export interface AdminApiAvailability {
  status: AdminApiAvailabilityStatus
  /** HTTP 状态码；无法取得时为 null */
  statusCode: number | null
  /** Matrix errcode；无法取得时为 null */
  errorCode: string | null
  /**
   * 服务端是否**确实提供** Admin API。
   * `null` = 无法判定（网络/5xx 等），此时**不得**下结论说"后端没有 Admin API"。
   */
  apiPresent: boolean | null
  /** 当前凭证是否被允许使用 Admin API */
  authorized: boolean
}

/** 无权限类 errcode（服务端可达，只是不许用） */
const FORBIDDEN_ERRCODES = new Set(['M_FORBIDDEN', 'M_UNAUTHORIZED'])
/** 凭证类 errcode（可达，但登录凭证有问题） */
const UNAUTHORIZED_ERRCODES = new Set(['M_UNKNOWN_TOKEN', 'M_MISSING_TOKEN'])
/** "该接口不存在"类 errcode */
const UNSUPPORTED_ERRCODES = new Set(['M_UNRECOGNIZED', 'M_NOT_FOUND'])

interface ErrorShape {
  statusCode?: unknown
  errorCode?: unknown
  httpStatus?: unknown
  message?: unknown
}

function readStatusCode(error: ErrorShape): number | null {
  for (const candidate of [error.statusCode, error.httpStatus]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate
    }
  }
  return null
}

function readErrorCode(error: ErrorShape): string | null {
  return typeof error.errorCode === 'string' && error.errorCode.length > 0 ? error.errorCode : null
}

/**
 * 对探测异常做分类。
 *
 * 判据优先级：**errCode 优先于状态码**（两侧都可取时以 errCode 为准，因为
 * 反向代理可能改写状态码而保留 errcode），其次按状态码，最后按错误文本兜底。
 */
export function classifyAdminApiProbe(error: unknown | null | undefined): AdminApiAvailability {
  if (error === null || error === undefined) {
    return { status: 'available', statusCode: 200, errorCode: null, apiPresent: true, authorized: true }
  }

  const shape = (typeof error === 'object' ? error : {}) as ErrorShape
  const statusCode = readStatusCode(shape)
  const errorCode = readErrorCode(shape)

  if (errorCode !== null && FORBIDDEN_ERRCODES.has(errorCode)) {
    return { status: 'forbidden', statusCode, errorCode, apiPresent: true, authorized: false }
  }
  if (errorCode !== null && UNAUTHORIZED_ERRCODES.has(errorCode)) {
    return { status: 'unauthorized', statusCode, errorCode, apiPresent: true, authorized: false }
  }
  if (errorCode !== null && UNSUPPORTED_ERRCODES.has(errorCode)) {
    return { status: 'unsupported', statusCode, errorCode, apiPresent: false, authorized: false }
  }

  if (statusCode !== null) {
    if (statusCode === 403) {
      // 403 一定意味着"服务端明确拒绝" ⇒ Admin API 存在，是人没有权限
      return { status: 'forbidden', statusCode, errorCode, apiPresent: true, authorized: false }
    }
    if (statusCode === 401) {
      return { status: 'unauthorized', statusCode, errorCode, apiPresent: true, authorized: false }
    }
    if (statusCode === 404 || statusCode === 405 || statusCode === 501) {
      return { status: 'unsupported', statusCode, errorCode, apiPresent: false, authorized: false }
    }
    if (statusCode < 500) {
      // 其它 4xx：服务端**确实回答了**（API 面可达），但探测请求被拒。
      // 不断言"没有 Admin API"，也不冒充"无权限"。
      return { status: 'unavailable', statusCode, errorCode, apiPresent: true, authorized: false }
    }
  }

  // 5xx / 无状态码 / 网络异常 ⇒ API 是否存在**无法判定**
  return { status: 'unavailable', statusCode, errorCode, apiPresent: null, authorized: false }
}

/**
 * 面向日志/UI 的说明文案。**不得**把 `forbidden` / `unauthorized` 说成"后端不可用"。
 */
export function describeAdminApiAvailability(availability: AdminApiAvailability): string {
  const suffix = [availability.statusCode !== null ? `${availability.statusCode}` : null, availability.errorCode]
    .filter((part): part is string => part !== null)
    .join(' ')
  const detail = suffix.length > 0 ? `（${suffix}）` : ''

  switch (availability.status) {
    case 'available':
      return 'Admin API 可用'
    case 'forbidden':
      return `Admin API 可达，但当前用户没有管理员权限${detail}`
    case 'unauthorized':
      return `Admin API 可达，但当前凭证无效或已过期${detail}`
    case 'unsupported':
      return `该 homeserver 未提供 Admin API${detail}`
    default:
      return availability.apiPresent === true
        ? `Admin API 可达，但探测请求被拒${detail}`
        : `无法判定 Admin API 是否可用${detail}`
  }
}

/**
 * 后台可选能力：只有当 homeserver 通过 `unstable_features` **明确发布**对应标志时，
 * 才能确定该能力可用。未发布视为"未知"，继续保留菜单（避免把现有页面整体隐藏）。
 */
export type AdminOptionalCapability = 'saml' | 'oidc' | 'worker' | 'modules'

const ADMIN_OPTIONAL_CAPABILITY_FLAGS: Record<AdminOptionalCapability, string> = {
  saml: 'io.hula.saml',
  oidc: 'io.hula.oidc',
  worker: 'io.hula.worker',
  modules: 'io.hula.modules'
}

/** 后台导航的五态 + 首次探测中 */
export type AdminNavState = 'loading' | 'ready' | 'forbidden' | 'unauthorized' | 'unsupported' | 'unavailable'

/** 导航项的能力门控声明 */
interface AdminNavItemGate {
  /** 依赖 Admin API 本身；未提供时由 `AdminNavState` 统一拦截 */
  requires?: 'admin-api'
  /** 依赖某个可选能力；服务端明确关闭时隐藏 */
  optionalCapability?: AdminOptionalCapability
}

/**
 * 由探测结果派生导航状态。
 * `loaded=false`（尚未探测完成）为 `loading`，与 `unavailable`（探测失败）严格区分。
 */
export function resolveAdminNavState(
  availability: AdminApiAvailability | null | undefined,
  loaded: boolean
): AdminNavState {
  if (!loaded) return 'loading'
  if (!availability) return 'unavailable'
  return availability.status === 'available' ? 'ready' : availability.status
}

/**
 * 读取可选能力标志。
 * 返回 `null` 表示服务端未发布该标志（未知），调用方应保留菜单而不是隐藏。
 */
export function readOptionalCapabilityFlag(
  capability: AdminOptionalCapability,
  unstableFeatures: Record<string, boolean> | null | undefined
): boolean | null {
  if (!unstableFeatures) return null
  const flag = ADMIN_OPTIONAL_CAPABILITY_FLAGS[capability]
  if (!Object.hasOwn(unstableFeatures, flag)) return null
  return unstableFeatures[flag] === true
}

interface AdminNavGroupLike<T> {
  label: string
  items: T[]
}

/**
 * 按导航状态与可选能力过滤菜单分组。
 * - 非 `ready` 状态不渲染任何业务菜单（由视图层展示空态/骨架）；
 * - 可选能力被明确关闭（`false`）的项移除；
 * - 过滤后为空的分组整组隐藏。
 */
export function filterAdminNavGroups<T extends AdminNavItemGate>(
  groups: ReadonlyArray<AdminNavGroupLike<T>>,
  state: AdminNavState,
  isCapabilityEnabled: (capability: AdminOptionalCapability) => boolean | null
): AdminNavGroupLike<T>[] {
  if (state !== 'ready') return []

  return groups
    .map((group) => ({
      label: group.label,
      items: group.items.filter((item) => {
        if (item.optionalCapability === undefined) return true
        return isCapabilityEnabled(item.optionalCapability) !== false
      })
    }))
    .filter((group) => group.items.length > 0)
}
