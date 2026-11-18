/**
 * 能力位「路由面探测」（CAP-02 探测面，2026-11-18 单独立项）。
 *
 * ## 为什么需要
 *
 * `MatrixCapabilityService.getCapabilityStatus()` 只看两处声明：`/versions.unstable_features`
 * 与 `/capabilities`。这带来两种系统偏差：
 *   · **宣告缺失但实现存在**（后端登记了路由却没进 `/versions`）→ 入口被误藏；
 *   · **宣告存在但实现缺失**（版本回滚、模块未启用）→ 入口假存在，点进去 404/403。
 *
 * 本模块提供第三种证据：拿一条**只读 GET** 去问服务端「这条路由你到底有没有」。
 * 它**不改变** `getCapabilityStatus()` 的判定（避免探测失败把可用能力位打成不可用），
 * 只作为诊断证据与「宣告/实现不一致」的显式提示。
 *
 * ## 安全约束（探测绝不能产生副作用）
 *
 * · 只探测**已核实为 GET 且无副作用**的端点（路径来自后端 `ROUTE_HANDLERS.json` 实测，见 PROBE_SPECS 注释）；
 * · 写操作类能力位（`qr-rendezvous` 创建会话、`account-status` 的 POST 查询）**不探测**，标 `no-probe`；
 * · 统一走 `MatrixRequestHelper.safeGet`（本项目唯一允许直发认证请求的适配器），不新开裸通道；
 * · 结果按「能力位 + roomId」缓存 5 分钟，避免诊断面板反复点造成请求风暴。
 */
import type { TjgCapability } from './MatrixCapabilityService'
import { matrixClientService } from './MatrixClientService'
import { normalizeMatrixError, safeGet } from './MatrixRequestHelper'
import { PREFIX_UNSTABLE } from './paths/prefixes'

/** 探测结论：路由存在 / 路由缺失 / 无法判定 */
export type ProbeOutcome = 'route-present' | 'route-missing' | 'inconclusive'

/** 探测上下文：少数端点需要 room 或当前用户 */
export interface ProbeContext {
  roomId?: string | undefined
  userId?: string | undefined
}

export interface CapabilityProbeResult {
  capability: TjgCapability
  outcome: ProbeOutcome
  /** 实际探测的路径（无探测规格时为空串） */
  route: string
  httpStatus: number
  errcode: string
  /** 人类可读原因（诊断面板直接展示） */
  reason: string
  at: number
}

/** 可探测能力位的规格；未列出的能力位视为「不可探测」 */
interface ProbeSpec {
  /** 静态路径；含 `{roomId}` 时由上下文替换 */
  path: string
  /** 需要哪些上下文；缺失则返回 inconclusive */
  requires?: Array<'roomId' | 'userId'>
  query?: (ctx: ProbeContext) => Record<string, string>
  /** 该端点在什么情况下算「存在」，用于注释说明而非判定逻辑 */
  note: string
}

/**
 * 探测规格表。
 *
 * 路径均取自 `synapse-rust` 的 `ROUTE_HANDLERS.json`（2026-11-18 实测），
 * 且逐条确认是 **GET 且无副作用**：
 * · mutual_rooms：`GET /_matrix/client/unstable/uk.half-shot.msc2666/user/mutual_rooms?user_id=`
 * · rtc transports：`GET /_matrix/client/unstable/org.matrix.msc4143/rtc/transports`
 * · delayed events：`GET /_matrix/client/unstable/org.matrix.msc4140/delayed_events`
 * · dehydrated device status：`GET /_matrix/client/unstable/org.matrix.msc3814.v1/dehydrated_device/status`
 * · sticky events：`GET /_matrix/client/unstable/org.matrix.msc4354/rooms/{room_id}/sticky_events`
 */
export const PROBE_SPECS: Partial<Record<TjgCapability, ProbeSpec>> = {
  'mutual-rooms': {
    path: `${PREFIX_UNSTABLE}/uk.half-shot.msc2666/user/mutual_rooms`,
    requires: ['userId'],
    query: (ctx) => ({ user_id: ctx.userId ?? '' }),
    note: '缺少 user_id 会被 400 拒绝，因此必须有 userId 才探测'
  },
  'rtc-transports': {
    path: `${PREFIX_UNSTABLE}/org.matrix.msc4143/rtc/transports`,
    note: '通话传输配置，只读'
  },
  'scheduled-send': {
    path: `${PREFIX_UNSTABLE}/org.matrix.msc4140/delayed_events`,
    note: '定时发送的待发列表，只读（不带 delay_id 即列表）'
  },
  'dehydrated-device': {
    path: `${PREFIX_UNSTABLE}/org.matrix.msc3814.v1/dehydrated_device/status`,
    note: '脱水设备状态，只读'
  },
  'sticky-events': {
    path: `${PREFIX_UNSTABLE}/org.matrix.msc4354/rooms/{roomId}/sticky_events`,
    requires: ['roomId'],
    note: '按房间读取置顶事件，只读；无 roomId 不探测'
  }
}

const CACHE_TTL_MS = 5 * 60 * 1000
const probeCache = new Map<string, CapabilityProbeResult>()

/** 清空探测缓存（登出 / 换服 / 手动刷新时调用） */
export function clearProbeCache(): void {
  probeCache.clear()
}

/** 该能力位是否具备探测规格（诊断面板据此决定是否展示「探测」入口） */
export function canProbeCapability(capability: TjgCapability): boolean {
  return PROBE_SPECS[capability] !== undefined
}

/**
 * 把「失败响应」归类。纯函数，便于判据覆盖。
 *
 * · 404（含 `M_UNRECOGNIZED`）→ 路由缺失
 * · 400/401/403/405 → 路由存在（参数或权限问题，说明路径已注册）
 * · 2xx 不进入本函数（`safeGet` 成功即说明路由存在，直接判 route-present）
 * · 429/5xx/网络错误(0)/未知 → 无法判定（不冤枉服务端）
 */
export function classifyProbeFailure(httpStatus: number, errcode: string): ProbeOutcome {
  if (httpStatus === 404 || errcode === 'M_UNRECOGNIZED') return 'route-missing'
  if ([400, 401, 403, 405].includes(httpStatus)) return 'route-present'
  return 'inconclusive'
}

function buildRoute(spec: ProbeSpec, ctx: ProbeContext): string {
  return spec.path.replace('{roomId}', ctx.roomId ?? '')
}

function hasRequiredContext(spec: ProbeSpec, ctx: ProbeContext): boolean {
  return (spec.requires ?? []).every((key) => Boolean(ctx[key]))
}

/**
 * 探测单个能力位的路由是否存在。
 *
 * 恒不抛错：任何异常都归一为 `inconclusive`，因为探测是**诊断证据**，
 * 不应该让能力判定或界面因它失败。
 */
export async function probeCapability(
  capability: TjgCapability,
  ctx: ProbeContext = {},
  options: { force?: boolean } = {}
): Promise<CapabilityProbeResult> {
  const now = Date.now()
  const spec = PROBE_SPECS[capability]
  const cacheKey = `${capability}:${ctx.roomId ?? ''}:${ctx.userId ?? ''}`

  if (!options.force) {
    const cached = probeCache.get(cacheKey)
    if (cached && now - cached.at < CACHE_TTL_MS) return cached
  }

  const base: CapabilityProbeResult = {
    capability,
    outcome: 'inconclusive',
    route: '',
    httpStatus: 0,
    errcode: '',
    reason: '',
    at: now
  }

  if (!spec) {
    return { ...base, reason: 'no-probe' }
  }

  const route = buildRoute(spec, ctx)
  if (!hasRequiredContext(spec, ctx)) {
    const missing = (spec.requires ?? []).filter((key) => !ctx[key]).join('/')
    return { ...base, route, reason: `missing-context:${missing}` }
  }

  if (!matrixClientService.getClient()) {
    return { ...base, route, reason: 'client-not-ready' }
  }

  try {
    const query = spec.query?.(ctx)
    await safeGet<unknown>(route, query)
    const result: CapabilityProbeResult = { ...base, route, outcome: 'route-present', httpStatus: 200, reason: 'ok' }
    probeCache.set(cacheKey, result)
    return result
  } catch (err) {
    const normalized = normalizeMatrixError(err)
    const outcome = classifyProbeFailure(normalized.httpStatus, normalized.errcode)
    const result: CapabilityProbeResult = {
      ...base,
      route,
      outcome,
      httpStatus: normalized.httpStatus,
      errcode: normalized.errcode,
      reason:
        outcome === 'route-missing'
          ? 'route-missing'
          : outcome === 'route-present'
            ? 'rejected-but-present'
            : 'undetermined'
    }
    // 只缓存确定结论，避免把一次网络抖动固化成 5 分钟的错误判断
    if (outcome !== 'inconclusive') probeCache.set(cacheKey, result)
    return result
  }
}

/** 批量探测（诊断面板用）；并发执行，返回按能力位索引的结果 */
export async function probeCapabilities(
  capabilities: TjgCapability[],
  ctx: ProbeContext = {}
): Promise<Partial<Record<TjgCapability, CapabilityProbeResult>>> {
  const targets = capabilities.filter((capability) => canProbeCapability(capability))
  const settled = await Promise.all(targets.map((capability) => probeCapability(capability, ctx)))
  return settled.reduce<Partial<Record<TjgCapability, CapabilityProbeResult>>>((acc, result) => {
    acc[result.capability] = result
    return acc
  }, {})
}
