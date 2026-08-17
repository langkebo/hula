/**
 * updater-config — 构建时注入 Tauri updater endpoints 的 tauriKey。
 *
 * `src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints` 仅保留占位符
 * `__UPDATER_TAURI_KEY__`，不含真实密钥。构建脚本（interactive-build-inquirer.js）
 * 读取 `UPDATER_TAURI_KEY` 环境变量，通过 `tauri build --config <file>` 合并
 * 真实 endpoints（Tauri 使用 JSON Merge Patch，数组会被整体替换）。
 *
 * 本模块保持纯函数、无副作用，便于单元测试。
 */

export const UPDATER_KEY_ENV = 'UPDATER_TAURI_KEY'

export const UPDATER_KEY_PLACEHOLDER = '__UPDATER_TAURI_KEY__'

// 构建时注入 homeserver 到 CSP connect-src 的环境变量（与前端 VITE_HOMESERVER_URL 一致）
export const HOMESERVER_URL_ENV = 'VITE_HOMESERVER_URL'

// 与各 tauri*.conf.json 中 csp/devCsp 的 connect-src 占位一致。
// 未显式配置 homeserver 时保持该默认值，即不做注入（conf 里已是该值）。
export const DEFAULT_HOMESERVER_URL = 'https://matrix.test'

// 每个 csp / devCsp 的 connect-src 中硬编码的 homeserver 占位片段。
export const CSP_HOMESERVER_PATTERN = 'https://matrix.test wss://matrix.test'

// 与 src-tauri/tauri.conf.json 中 plugins.updater.endpoints 保持一致，
// 仅 tauriKey 用占位符；构建时注入真实值后整体替换。
export const UPDATER_ENDPOINTS = [
  `https://api.upgrade.toolsetlink.com/v1/tauri/upgrade?tauriKey=${UPDATER_KEY_PLACEHOLDER}&versionName={{current_version}}&appointVersionName=&devModelKey=&devKey=&target={{target}}&arch={{arch}}`,
  'https://gitee.com/llangkebo/hula/releases/download/latest/latest.json'
]

/**
 * 生成 `tauri build --config` 的合并配置对象。
 * @param {string | undefined} tauriKey 环境变量 UPDATER_TAURI_KEY 的值
 * @returns {object | null} 有 key 时返回 `{ plugins: { updater: { endpoints } } }`，否则返回 null
 */
export function buildUpdaterConfigOverride(tauriKey) {
  const key = typeof tauriKey === 'string' ? tauriKey.trim() : ''
  if (!key) return null

  return {
    plugins: {
      updater: {
        endpoints: UPDATER_ENDPOINTS.map((url) => url.replaceAll(UPDATER_KEY_PLACEHOLDER, key))
      }
    }
  }
}

/**
 * 将 homeserver URL 解析为 connect-src 中允许的来源片段：
 *   - `https://<host>` → `https://<host> wss://<host>`
 *   - `http://<host>`  → `http://<host> ws://<host>`
 * 只保留 host（含端口），剥离路径与查询；非 http(s) 或无法解析时返回 null。
 * @param {string | undefined} url homeserver URL
 * @returns {string | null} 例如 `https://matrix.test wss://matrix.test`
 */
export function homeserverUrlToConnectSrc(url) {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return null

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  const { protocol, host } = parsed
  if (!host || (protocol !== 'https:' && protocol !== 'http:')) return null

  return protocol === 'https:' ? `https://${host} wss://${host}` : `http://${host} ws://${host}`
}

/**
 * 将 csp 字符串中硬编码的 `https://matrix.test wss://matrix.test` 替换为
 * homeserver 对应的来源片段。未命中占位或无法解析时原样返回。
 * @param {string} csp 完整的 csp / devCsp 字符串
 * @param {string | undefined} homeserverUrl homeserver URL
 * @returns {string}
 */
export function replaceHomeserverInCsp(csp, homeserverUrl) {
  const tokens = homeserverUrlToConnectSrc(homeserverUrl)
  if (!tokens || typeof csp !== 'string') return csp
  return csp.split(CSP_HOMESERVER_PATTERN).join(tokens)
}

/**
 * 生成注入 homeserver 的 `--config` 覆盖对象（JSON Merge Patch）。
 * `csp` / `devCsp` 字符串必须由调用方从实际 conf 文件读取后传入，避免 JS 端
 * 复制整段 CSP 造成漂移。
 * 当 homeserver 未配置、无法解析、或与默认 `https://matrix.test` 相同（即无变化）时返回 null。
 * @param {string | undefined} homeserverUrl homeserver URL（默认 `https://matrix.test`）
 * @param {{ csp?: string, devCsp?: string }} [sources] 实际 conf 中的 csp / devCsp 字符串
 * @returns {object | null} `{ app: { security: { csp?, devCsp? } } }` 或 null
 */
export function buildCspConfigOverride(homeserverUrl, sources = {}) {
  const resolved = typeof homeserverUrl === 'string' && homeserverUrl.trim() ? homeserverUrl : DEFAULT_HOMESERVER_URL
  const tokens = homeserverUrlToConnectSrc(resolved)
  if (!tokens) return null

  // 与默认 homeserver 相同时，conf 里已是该值，无需覆盖（避免覆盖平台 csp 造成漂移）。
  if (tokens === CSP_HOMESERVER_PATTERN) return null

  const security = {}
  if (typeof sources.csp === 'string' && sources.csp.includes(CSP_HOMESERVER_PATTERN)) {
    security.csp = replaceHomeserverInCsp(sources.csp, resolved)
  }
  if (typeof sources.devCsp === 'string' && sources.devCsp.includes(CSP_HOMESERVER_PATTERN)) {
    security.devCsp = replaceHomeserverInCsp(sources.devCsp, resolved)
  }
  if (Object.keys(security).length === 0) return null

  return { app: { security } }
}
