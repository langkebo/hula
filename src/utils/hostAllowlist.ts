/**
 * Host allowlist 纯函数（无副作用、无 Tauri 依赖，便于单测）。
 *
 * 用于 `@/utils/HttpClient` 出网咽喉的 host 级白名单判定：
 * 未知 host 默认拒绝（`no-rule`），scheme 必须命中规则；`prod` 下对非 loopback
 * host 额外拒绝明文 http，`dev` 下放行（本地调试需要）。
 */

export interface AllowRule {
  host: string
  schemes: readonly string[]
  matchSubdomains: boolean
}

export type Env = 'dev' | 'prod'

type Decision =
  | { allowed: true; rule: AllowRule; host: string }
  | { allowed: false; reason: 'invalid-url' | 'no-rule' | 'scheme-mismatch'; host: string | null; url: string }

const DEFAULT_SCHEMES: readonly string[] = ['https', 'http']
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function normalizeHost(input: string): string {
  return input
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .replace(/\.$/, '')
}

function stripPort(host: string): string {
  if (host.startsWith('[')) return host
  const colon = host.indexOf(':')
  return colon >= 0 ? host.slice(0, colon) : host
}

function isValidHost(host: string): boolean {
  return host.length > 0 && HOST_PATTERN.test(host)
}

function normalizeSchemes(schemes: readonly string[]): readonly string[] {
  const cleaned = schemes.map((s) => s.trim().toLowerCase().replace(/:$/, '')).filter(Boolean)
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : DEFAULT_SCHEMES
}

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host) || host.startsWith('127.')
}

interface RawEntry {
  rawHost: string
  schemes: readonly string[]
  matchSubdomains: boolean
  display: string
}

/** 拆分单条 entry：支持 `scheme://host`、`host`、`host:port`、`*.host` 形式 */
function parseEntry(raw: string): { rawHost: string; schemes: readonly string[] } {
  const sep = raw.indexOf('://')
  if (sep >= 0) {
    const scheme = raw.slice(0, sep)
    const rest = raw.slice(sep + 3)
    const host = rest.split('/')[0].split('?')[0].split('#')[0]
    return { rawHost: host, schemes: [scheme] }
  }
  return { rawHost: raw, schemes: DEFAULT_SCHEMES }
}

function buildRule(entry: RawEntry, warnings: string[]): AllowRule | null {
  let host = stripPort(normalizeHost(entry.rawHost))
  let matchSubdomains = entry.matchSubdomains
  if (host.startsWith('*.')) {
    matchSubdomains = true
    host = host.slice(2)
  }
  if (!isValidHost(host)) {
    warnings.push(`Skip invalid allowlist entry: ${entry.display}`)
    return null
  }
  return { host, schemes: normalizeSchemes(entry.schemes), matchSubdomains }
}

/**
 * 解析配置为规则集（容错：跳过非法项并返回告警列表）。
 * 支持逗号/分号/换行分隔的字符串，或 JSON 数组（元素为字符串或 `{host, schemes?, matchSubdomains?}`）。
 */
export function parseAllowRules(raw: string): { rules: AllowRule[]; warnings: string[] } {
  const warnings: string[] = []
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { rules: [], warnings }

  const entries: RawEntry[] = []

  if (trimmed.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      warnings.push('Allowlist JSON is not valid; ignoring')
      return { rules: [], warnings }
    }
    if (!Array.isArray(parsed)) {
      warnings.push('Allowlist JSON must be an array; ignoring')
      return { rules: [], warnings }
    }
    for (const item of parsed) {
      if (typeof item === 'string') {
        entries.push({ ...parseEntry(item), matchSubdomains: false, display: item })
      } else if (item !== null && typeof item === 'object' && typeof (item as { host?: unknown }).host === 'string') {
        const obj = item as { host: string; schemes?: unknown; matchSubdomains?: unknown }
        const schemes = Array.isArray(obj.schemes)
          ? obj.schemes.filter((s): s is string => typeof s === 'string')
          : DEFAULT_SCHEMES
        entries.push({ rawHost: obj.host, schemes, matchSubdomains: obj.matchSubdomains === true, display: obj.host })
      } else {
        warnings.push(`Skip invalid allowlist entry: ${String(item)}`)
      }
    }
  } else {
    for (const piece of trimmed.split(/[,;\n]+/)) {
      const item = piece.trim()
      if (!item) continue
      entries.push({ ...parseEntry(item), matchSubdomains: false, display: item })
    }
  }

  const merged = new Map<string, AllowRule>()
  for (const entry of entries) {
    const rule = buildRule(entry, warnings)
    if (!rule) continue
    const key = `${rule.host}|${rule.matchSubdomains}`
    const existing = merged.get(key)
    if (existing) {
      merged.set(key, { ...existing, schemes: Array.from(new Set([...existing.schemes, ...rule.schemes])) })
    } else {
      merged.set(key, rule)
    }
  }

  return { rules: Array.from(merged.values()), warnings }
}

function matchesHost(host: string, rule: AllowRule): boolean {
  if (host === rule.host) return true
  return rule.matchSubdomains && host.endsWith(`.${rule.host}`)
}

/** 判定：默认拒绝；host 小写、去端口、精确或后缀匹配；scheme 必须命中 */
export function isUrlAllowed(url: string, rules: readonly AllowRule[], env: Env): Decision {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { allowed: false, reason: 'invalid-url', host: null, url }
  }

  const host = normalizeHost(parsed.hostname)
  if (!host) {
    return { allowed: false, reason: 'invalid-url', host: null, url }
  }
  const scheme = parsed.protocol.slice(0, -1)

  for (const rule of rules) {
    if (!matchesHost(host, rule)) continue
    const schemes = env === 'prod' ? rule.schemes.filter((s) => s !== 'http' || isLoopback(host)) : rule.schemes
    if (schemes.includes(scheme)) {
      return { allowed: true, rule, host }
    }
    return { allowed: false, reason: 'scheme-mismatch', host, url }
  }

  return { allowed: false, reason: 'no-rule', host, url }
}
