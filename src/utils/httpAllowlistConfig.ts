import { type AllowRule, type Env, parseAllowRules } from '@/utils/hostAllowlist'

type AllowlistMode = 'report' | 'enforce'

interface AllowlistConfig {
  rules: AllowRule[]
  mode: AllowlistMode
  warnings: string[]
}

/** 内置默认集：按方案 §6.2 host 归属表中的固定 host */
const DEFAULT_ALLOWLIST = 'https://gitee.com,https://api.siliconflow.cn,https://translate.googleapis.com'

/** dev 默认集：在固定 host 基础上补本地 loopback（TrendRadar / Prometheus / consul 本地调试） */
const DEFAULT_ALLOWLIST_DEV = `${DEFAULT_ALLOWLIST},http://localhost,http://127.0.0.1`

function homeserverEntry(url?: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return `${parsed.protocol.replace(':', '')}://${parsed.hostname}`
  } catch {
    return null
  }
}

/**
 * 纯函数：由原始配置 + homeserver + mode 推导规则集。
 * raw 为空时回退内置默认集（dev/prod 各一份）；homeserver host 始终追加。
 *
 * `mode` 采用 fail-closed 语义：**缺省为 `enforce`（拒绝未命中 host）**，
 * 仅当显式传 `report` 时才降级为「仅记录不拦截」（用于观察/排障）。
 * 任何非 `report` 的取值（含空值、拼写错误）一律按 `enforce` 处理。
 */
export function resolveAllowlistConfig(input: {
  raw?: string | undefined
  homeserverUrl?: string | undefined
  mode?: string | undefined
  env: Env
}): AllowlistConfig {
  const fallback = input.env === 'dev' ? DEFAULT_ALLOWLIST_DEV : DEFAULT_ALLOWLIST
  const raw = (input.raw ?? '').trim() || fallback
  const hostEntry = homeserverEntry(input.homeserverUrl)
  const combined = hostEntry ? `${raw},${hostEntry}` : raw
  const { rules, warnings } = parseAllowRules(combined)
  return { rules, mode: input.mode === 'report' ? 'report' : 'enforce', warnings }
}

export function currentEnv(): Env {
  return import.meta.env.PROD ? 'prod' : 'dev'
}

/**
 * 运行时读取 env 配置：
 * - `VITE_HTTP_ALLOWLIST_DEV` / `VITE_HTTP_ALLOWLIST_PROD` 优先，回退 `VITE_HTTP_ALLOWLIST`，再回退内置默认集。
 * - `VITE_HTTP_ALLOWLIST_MODE` 缺省为 `enforce`（拒绝未命中 host）；仅显式设为 `report` 时才降级为「仅记录不拦截」。
 */
export function getAllowlistConfig(env: Env = currentEnv()): AllowlistConfig {
  const raw: string | undefined =
    env === 'dev'
      ? (import.meta.env.VITE_HTTP_ALLOWLIST_DEV ?? import.meta.env.VITE_HTTP_ALLOWLIST)
      : (import.meta.env.VITE_HTTP_ALLOWLIST_PROD ?? import.meta.env.VITE_HTTP_ALLOWLIST)
  return resolveAllowlistConfig({
    raw,
    homeserverUrl: import.meta.env.VITE_HOMESERVER_URL,
    mode: import.meta.env.VITE_HTTP_ALLOWLIST_MODE,
    env
  })
}
