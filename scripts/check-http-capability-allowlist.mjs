#!/usr/bin/env node
/**
 * Guard — capability `http:default.allow` 与「实际使用的 homeserver」是否对齐。
 *
 * 背景（2026-10-13 实测）：`src-tauri/capabilities/default.json` 的 `http:default.allow`
 * 只有 10 条固定 host + loopback，而本机 dev homeserver 是 `https://matrix.test`
 * （`.env.local` 的 `VITE_HOMESERVER_URL`）。于是 `tauri-plugin-http` 对**每一个**
 * homeserver 请求都判 `url not allowed on the configured scope`，`runtimeFetch` 只能
 * 回退浏览器 `fetch`。回退恰好能跑通（CSP `connect-src` 含 `matrix.test`），
 * 于是**故障被静默掩盖**：原生出网通道对 homeserver 从未生效，而日志里只有几十条
 * 看似无害的 WARN。文档 `docs/TJG-安全纵深专项方案-2026-10-12.md` 附录 C 把这条
 * 缺口记为「本地/dev homeserver = http://localhost:8008 ⇒ 命中 loopback，无缺口」——
 * 该假设只在 `.env.example` 成立，与实际 `.env.local` 不符。
 *
 * 本守卫把该假设变成可执行判据（「配置类改动配门禁」）：
 *   1. **基数断言**：至少读到 2 个含 `http:default` 的 capability 文件，且各自 allow 非空。
 *   2. **两端一致**：桌面 `default.json` 与移动 `mobile.json` 的 allow 集合必须逐条一致
 *      （SC07-5 的对齐结论不能悄悄漂移）。
 *   3. **homeserver 覆盖**：解析生效的 homeserver host（`process.env` > `.env.local` >
 *      `.env` > `.env.example`）；非 loopback host 必须在 allow 中命中同 scheme 条目。
 *   4. **`.test` 域名白名单化**：allow 里出现的任何 `.test` host 必须正是当前配置的
 *      homeserver host（防止 `element.test` 这类陈旧残留回归；`.test` 是 RFC 2606 保留域，
 *      只在显式登记为 homeserver 时才允许出现）。
 *
 * Usage:
 *   node scripts/check-http-capability-allowlist.mjs          # 人类可读
 *   node scripts/check-http-capability-allowlist.mjs --json   # 机器可读
 *
 * Exit codes:
 *   0  全部判据通过
 *   1  存在违规
 *   2  环境/自检异常（读不到文件、capability 缺 `http:default`、allow 为空 —— 基数断言，
 *      避免「什么都没读到」被误判为「通过」）
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_HOMESERVER_URL } from './updater-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

/** 需要保持 allow 集合一致的 capability 文件（相对仓库根）；无 `http:default.allow` 的文件在加载时跳过 */
export const CAPABILITY_FILES = [
  'src-tauri/capabilities/default.json',
  'src-tauri/capabilities/mobile.json',
  'src-tauri/capabilities/network.json'
]

/** homeserver 环境变量键 */
export const HOMESERVER_ENV_KEY = 'VITE_HOMESERVER_URL'

/** homeserver 取值来源优先级（相对仓库根）；`process.env` 优先于全部文件 */
export const ENV_FILE_CANDIDATES = ['.env.local', '.env', '.env.example']

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** 从 `scheme://host[:port][/path]` 形式的 url 模式中取 scheme + host（端口/路径通配不影响判定） */
export function splitHostPattern(pattern) {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/:?#]+)/i.exec(String(pattern ?? '').trim())
  if (!match) return null
  return { scheme: match[1].toLowerCase(), host: match[2].toLowerCase() }
}

/** 读取一个 capability 对象的 `http:default.allow` 条目（支持 string 与 `{ url }` 两种写法） */
export function extractHttpAllowEntries(capability) {
  const permissions = Array.isArray(capability?.permissions) ? capability.permissions : []
  const entries = []
  for (const permission of permissions) {
    if (!permission || typeof permission !== 'object' || permission.identifier !== 'http:default') continue
    for (const allow of Array.isArray(permission.allow) ? permission.allow : []) {
      if (typeof allow === 'string') entries.push(allow)
      else if (allow && typeof allow.url === 'string') entries.push(allow.url)
    }
  }
  return entries
}

/** 从 `.env` 风格文本里取 `VITE_HOMESERVER_URL`（去掉包裹引号） */
export function parseEnvHomeserver(text) {
  const match = new RegExp(`^\\s*${HOMESERVER_ENV_KEY}\\s*=\\s*(.*)$`, 'm').exec(String(text ?? ''))
  if (!match) return null
  const raw = match[1].trim().replace(/^["']|["']$/g, '')
  return raw.length > 0 ? raw : null
}

/**
 * 取 `.env` 风格文本里**所有** `VITE_HOMESERVER_URL`（含被注释掉的备选模式）。
 *
 * `.env.example` 同时登记两种受支持的本地联调模式（直连 `http://localhost:8008`
 * 与 nginx 反代 `https://matrix.test`），后者写在注释里 —— 它们都是**受支持的 dev
 * homeserver**，据此构成 `.test` 域名的登记集合（见 `evaluateHttpCapabilityAllowlist` 第 4 条）。
 */
export function parseAllEnvHomeservers(text) {
  const urls = []
  const line = new RegExp(`^\\s*#?\\s*${HOMESERVER_ENV_KEY}\\s*=\\s*(.*)$`, 'gm')
  let match
  while ((match = line.exec(String(text ?? ''))) !== null) {
    const raw = match[1].trim().replace(/^["']|["']$/g, '')
    if (raw.length > 0) urls.push(raw)
  }
  return urls
}

/** 受版本管理的 dev homeserver host 登记集合（`.env.example` 全量写法 + `updater-config` 默认值） */
export function collectSanctionedDevHomeserverHosts(envExampleText, defaultHomeserverUrl = DEFAULT_HOMESERVER_URL) {
  const hosts = new Set()
  for (const url of [...parseAllEnvHomeservers(envExampleText), defaultHomeserverUrl]) {
    const parsed = splitHostPattern(url)
    if (parsed !== null) hosts.add(parsed.host)
  }
  return [...hosts].sort()
}

/** 解析生效的 homeserver 来源：process.env 优先，其次按候选顺序取第一个命中的文件 */
export function resolveHomeserver(projectDir, env = process.env, readFile = (p) => readFileSync(p, 'utf8')) {
  const fromEnv = env?.[HOMESERVER_ENV_KEY]
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return { url: fromEnv.trim(), source: `process.env.${HOMESERVER_ENV_KEY}` }
  }
  for (const rel of ENV_FILE_CANDIDATES) {
    const abs = path.join(projectDir, rel)
    if (!existsSync(abs)) continue
    const url = parseEnvHomeserver(readFile(abs))
    if (url) return { url, source: rel }
  }
  return { url: null, source: null }
}

function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.has(host) || host.startsWith('127.')
}

/** allow 条目是否覆盖给定 scheme+host（端口/路径通配均视为覆盖） */
export function coversHost(entries, scheme, host) {
  return entries.some((entry) => {
    const parsed = splitHostPattern(entry)
    return parsed !== null && parsed.scheme === scheme && parsed.host === host
  })
}

/**
 * 纯函数判据 —— 无 I/O，便于单测。
 *
 * @param {{
 *   allowLists: Record<string, string[]>,
 *   homeserverUrl?: string | null,
 *   homeserverSource?: string | null
 * }} input
 * @returns {{
 *   ok: boolean,
 *   problems: string[],
 *   homeserver: { url: string | null, scheme: string | null, host: string | null, loopback: boolean },
 *   testHosts: string[]
 * }}
 */
export function evaluateHttpCapabilityAllowlist({
  allowLists,
  homeserverUrl,
  homeserverSource,
  sanctionedTestHosts
} = {}) {
  const problems = []
  const files = Object.keys(allowLists ?? {})

  // 1. 基数断言
  if (files.length < 2) {
    problems.push(`基数断言失败：只读到 ${files.length} 个含 http:default 的 capability 文件（期望 ≥2）`)
  }
  for (const file of files) {
    if ((allowLists[file] ?? []).length === 0) {
      problems.push(`基数断言失败：${file} 的 http:default.allow 为空`)
    }
  }

  // 2. 两端一致
  const uniqueSets = new Set(files.map((file) => [...new Set(allowLists[file] ?? [])].sort().join('|')))
  if (files.length >= 2 && uniqueSets.size > 1) {
    problems.push(`两端 allow 集合不一致（应逐条相同）：${files.join(' vs ')}`)
  }

  // 3. homeserver 覆盖
  let scheme = null
  let host = null
  let loopback = false
  if (homeserverUrl) {
    const parsed = splitHostPattern(homeserverUrl)
    if (parsed === null) {
      problems.push(`homeserver URL 无法解析（来源 ${homeserverSource ?? 'unknown'}）：${homeserverUrl}`)
    } else {
      scheme = parsed.scheme
      host = parsed.host
      loopback = isLoopbackHost(host)
      const allEntries = files.flatMap((file) => allowLists[file] ?? [])
      if (!loopback && !coversHost(allEntries, scheme, host)) {
        problems.push(
          `http:default.allow 未覆盖 homeserver ${scheme}://${host}（来源 ${homeserverSource ?? 'unknown'}）` +
            ` ⇒ tauri-plugin-http 将拒绝该 host，nativeFetch 只能回退浏览器 fetch（静默降级）` +
            `；请补 {"url": "${scheme}://${host}"} 与 {"url": "${scheme}://${host}:**"}`
        )
      }
    }
  }

  // 4. `.test` 域名登记制（`.test` 是 RFC 2606 保留域，只应是本仓登记的 dev homeserver；
  //    `element.test` 这类他方残留会静默扩大出网面）
  const sanctioned = new Set([...(sanctionedTestHosts ?? []), ...(host ? [host] : [])])
  const testHosts = [
    ...new Set(
      files
        .flatMap((file) => allowLists[file] ?? [])
        .map((entry) => splitHostPattern(entry))
        .filter((parsed) => parsed !== null && parsed.host.endsWith('.test'))
        .map((parsed) => parsed.host)
    )
  ].sort()
  for (const testHost of testHosts) {
    if (!sanctioned.has(testHost)) {
      const allowance =
        sanctioned.size > 0
          ? `（已登记：${[...sanctioned].sort().join(', ')}）`
          : '（当前未登记任何 dev homeserver，不允许任何 .test 条目）'
      problems.push(`http:default.allow 含未登记的 .test 域名 ${testHost}${allowance}；陈旧残留会静默扩大出网面`)
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    homeserver: { url: homeserverUrl ?? null, scheme, host, loopback },
    testHosts,
    sanctionedTestHosts: [...sanctioned].sort()
  }
}

/** `tauri-plugin-http` 明确禁止启用的 feature（会打开危险请求能力/绕过 header 校验） */
export const FORBIDDEN_HTTP_FEATURES = ['dangerous-settings', 'unsafe-headers']

/** 唯一允许的 `frame-src` 取值：禁止嵌入任何外部/自站 iframe */
export const REQUIRED_FRAME_SRC = "'none'"

/** 从 `tauri.conf.json` 的 `app.security.csp` 取 CSP 文本（支持字符串与按平台分组的对象写法） */
export function extractCspEntries(tauriConf) {
  const csp = tauriConf?.app?.security?.csp
  if (typeof csp === 'string') return [{ label: 'app.security.csp', value: csp }]
  if (csp && typeof csp === 'object') {
    return Object.entries(csp)
      .filter(([, value]) => typeof value === 'string')
      .map(([label, value]) => ({ label: `app.security.csp.${label}`, value }))
  }
  return []
}

/** 把 CSP 文本解析为 `directive → 归一化取值`（多条同名指令合并） */
export function parseCspDirectives(csp) {
  const directives = new Map()
  for (const part of String(csp ?? '').split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const [name, ...values] = tokens
    const key = name.toLowerCase()
    const merged = [...(directives.get(key) ?? []), ...values]
    directives.set(key, merged)
  }
  return directives
}

/**
 * 从 `Cargo.toml` 取某个 crate 的 features 列表。
 *
 * 同时支持行内表（`crate = { ..., features = [...] }`）与独立依赖段
 * （`[dependencies.crate]` + `features = [...]`）；未找到该依赖时返回 `null`。
 */
export function extractCargoFeatures(cargoToml, crate = 'tauri-plugin-http') {
  const text = String(cargoToml ?? '')
  const inline = new RegExp(`^\\s*${crate}\\s*=\\s*\\{([\\s\\S]*?)\\}`, 'm').exec(text)
  const section = new RegExp(
    `^[ \\t]*\\[dependencies\\.${crate}\\][^\\n]*\\n([\\s\\S]*?)(?=^[ \\t]*\\[|(?![\\s\\S]))`,
    'm'
  ).exec(text)
  const block = inline?.[1] ?? section?.[1]
  if (block === undefined) {
    // 简单写法（`crate = "2"`）没有 features 字段；完全未声明则返回 null
    const simple = new RegExp(`^\\s*${crate}\\s*=\\s*["']`, 'm')
    return simple.test(text) ? [] : null
  }
  const features = /features\s*=\s*\[([^\]]*)\]/.exec(block)
  if (!features) return []
  return features[1]
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/**
 * 纯函数判据：CSP 不得允许 iframe 嵌入；`tauri-plugin-http` 不得启用危险 feature。
 *
 * @param {{ cargoToml?: string, tauriConf?: unknown }} input
 * @returns {{ ok: boolean, problems: string[], frameSrc: string[], httpFeatures: string[] }}
 */
export function evaluateHttpTransportHardening({ cargoToml, tauriConf } = {}) {
  const problems = []
  const frameSrc = []

  const cspEntries = extractCspEntries(tauriConf)
  if (cspEntries.length === 0) {
    problems.push('基数断言失败：tauri.conf.json 未配置 app.security.csp（无法断言 frame-src）')
  }
  for (const { label, value } of cspEntries) {
    const directives = parseCspDirectives(value)
    const values = directives.get('frame-src')
    const normalized = values === undefined ? null : values.join(' ')
    if (normalized === null) {
      problems.push(`${label} 缺少 frame-src 指令（必须显式 frame-src ${REQUIRED_FRAME_SRC}，禁止嵌入 iframe）`)
    } else {
      frameSrc.push(normalized)
      if (normalized !== REQUIRED_FRAME_SRC) {
        problems.push(`${label} 的 frame-src 必须为 ${REQUIRED_FRAME_SRC}，当前为 ${normalized}`)
      }
    }
  }

  const httpFeatures = extractCargoFeatures(cargoToml)
  if (httpFeatures === null) {
    problems.push('基数断言失败：src-tauri/Cargo.toml 未找到 tauri-plugin-http 依赖声明（无法断言 feature）')
  } else {
    const forbidden = httpFeatures.filter((feature) => FORBIDDEN_HTTP_FEATURES.includes(feature))
    if (forbidden.length > 0) {
      problems.push(
        `tauri-plugin-http 启用了危险 feature：${forbidden.join(', ')}（会绕过 scope/header 约束；仅允许 rustls-tls 等传输 feature）`
      )
    }
  }

  return { ok: problems.length === 0, problems, frameSrc, httpFeatures: httpFeatures ?? [] }
}

function loadCapabilityAllowLists(projectDir, readFile = (p) => readFileSync(p, 'utf8')) {
  const allowLists = {}
  for (const rel of CAPABILITY_FILES) {
    const abs = path.join(projectDir, rel)
    if (!existsSync(abs)) continue
    const capability = JSON.parse(readFile(abs))
    const entries = extractHttpAllowEntries(capability)
    if (entries.length > 0) allowLists[rel] = entries
  }
  return allowLists
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  let allowLists
  let homeserver
  let sanctionedTestHosts
  let hardening
  try {
    allowLists = loadCapabilityAllowLists(projectRoot)
    homeserver = resolveHomeserver(projectRoot)
    const envExampleFile = path.join(projectRoot, '.env.example')
    sanctionedTestHosts = collectSanctionedDevHomeserverHosts(
      existsSync(envExampleFile) ? readFileSync(envExampleFile, 'utf8') : ''
    )
    hardening = evaluateHttpTransportHardening({
      cargoToml: readFileSync(path.join(projectRoot, 'src-tauri', 'Cargo.toml'), 'utf8'),
      tauriConf: JSON.parse(readFileSync(path.join(projectRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'))
    })
  } catch (err) {
    console.error(`[http-allowlist] scan failed: ${err.message}`)
    process.exit(2)
  }

  if (Object.keys(allowLists).length === 0) {
    console.error('[http-allowlist] scan failed: 未读到任何含 http:default 的 capability 文件（基数断言）')
    process.exit(2)
  }

  const result = evaluateHttpCapabilityAllowlist({
    allowLists,
    homeserverUrl: homeserver.url,
    homeserverSource: homeserver.source,
    sanctionedTestHosts
  })
  result.problems.push(...hardening.problems)
  result.ok = result.problems.length === 0

  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify(
        { ...result, files: Object.keys(allowLists), homeserverSource: homeserver.source, hardening },
        null,
        2
      )}\n`
    )
  } else if (result.ok) {
    console.log(
      `[http-allowlist] OK — ${Object.keys(allowLists).length} 份 capability 一致；` +
        `homeserver=${result.homeserver.url ?? '(未配置)'} (${homeserver.source ?? 'n/a'}) 已覆盖；` +
        `frame-src=${hardening.frameSrc.join(' | ')}；http features=[${hardening.httpFeatures.join(', ')}]`
    )
  } else {
    console.error('[http-allowlist] FAIL — 网络出网面配置不合规（capability allow / CSP frame-src / http feature）:')
    for (const problem of result.problems) console.error(`  - ${problem}`)
    console.error('  see docs/TJG-安全纵深专项方案-2026-10-12.md 附录 C')
  }

  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[http-allowlist] unexpected error', err)
    process.exit(2)
  })
}
