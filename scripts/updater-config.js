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
