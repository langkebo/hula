#!/usr/bin/env node
/**
 * Guard — 源码可创建的 Tauri 窗口 label，必须被至少一个 capability 的 `windows` 覆盖。
 *
 * 背景（SC-05，2026-10-13）：
 * capabilities 的 `windows` 字段此前为通配 `["*"]`，等于把「窗口级最小权限」这把闸门
 * 彻底打开。本次把三份 capability 收敛为「显式 label 数组 + 动态族 glob」。
 *
 * 收敛带来一个新风险：**漏写一个 label ⇒ 该窗口运行期丢失全部权限**
 * （invoke 失败、无法拖动/关闭/销毁）。Tauri v2 ACL 的 windows 匹配是「枚举式」的：
 * 不存在「未命中则回退到默认」——未命中的窗口拿不到任何 capability。
 * 也就是说：**多写 label 无害（不匹配任何窗口即无效），漏写 label 灾难性**。
 *
 * 本守卫把「漏写」变成可执行的判据，分两层：
 *   1) 覆盖率：注册表里每个 label 必须能被某份 capability 的 windows 命中；
 *   2) 交叉核对：扫描源码建窗点的**字面量** label，若未登记进注册表则判红
 *      （提醒新增窗口时同步登记，否则覆盖率检查形同虚设）。
 *
 * 方向性是刻意的（**单向**）：只检查「窗口会被创建 ⇒ 必须被覆盖」。
 * **不**检查「capability 覆盖了 ⇒ 必须有人用」——多写无害，且精确到窗口的
 * 调用点归属恰恰是 SC05-P3-3 出错的环节（用粗糙 grep 反推"无人用"）。
 *
 * Usage:
 *   node scripts/check-tauri-capability-window-coverage.mjs          # 人类可读
 *   node scripts/check-tauri-capability-window-coverage.mjs --json   # 机器可读
 *
 * Exit codes:
 *   0  全部 label 均被覆盖，且无未登记字面量
 *   1  存在「会被创建但未被任何 capability 覆盖」的 label，或源码有未登记字面量 label
 *   2  环境/自检异常（注册表为空、capabilities 全读不到、扫描到 0 文件 —— 基数断言，
 *      避免"什么都没扫到"被误判为"通过"）
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const capabilitiesDir = path.join(projectRoot, 'src-tauri', 'capabilities')
const scanRoots = [path.join(projectRoot, 'src'), path.join(projectRoot, 'src-tauri', 'src')]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '__tests__', '.worktrees', 'gen'])
const SCAN_EXT = /\.(ts|tsx|vue|mts|rs)$/
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts)$/

const DESKTOP_PLATFORMS = new Set(['macOS', 'windows', 'linux'])
const MOBILE_PLATFORMS = new Set(['iOS', 'android'])

/**
 * 「源码可创建的窗口 label」注册表。
 *
 * label 为精确字符串，或以 `*` 结尾的 glob（动态族）。
 * 每条都要有**可复现的取证理由（文件:行）**；新增窗口请补登记，否则守卫会判红。
 *
 * 说明：`settings` / `lockScreen` / `modal-secretChat` 目前**无建窗点**
 * （settings 走 router.push、lockScreen 是 home 内 modal、modal-secretChat 为未接线路由），
 * 因此**不在此登记**；它们仅作为兜底 label 出现在 capabilities 的 windows 数组里（多写无害）。
 */
export const WINDOW_LABEL_REGISTRY = [
  // —— 桌面：精确 label ——
  { label: 'home', platform: 'desktop', rationale: '主窗口（src/services/matrix/auth/DesktopSessionTransition.ts:61、SessionLogoutService:82/149 的 getByLabel 亦引用）' },
  { label: 'login', platform: 'desktop', rationale: '登录窗口（src/services/matrix/auth/SessionLogoutService.ts:149；桌面静态窗口 tauri.macos/windows.conf.json）' },
  { label: 'tray', platform: 'desktop', rationale: '托盘窗口（src-tauri/src/desktops/tray.rs:28 的唯一 Rust 侧建窗点；tauri.linux.conf.json 亦为静态窗口）' },
  { label: 'checkupdate', platform: 'desktop', rationale: '检查更新窗（src/composables/common/windowRtc.ts:124 ensureDesktopWindowInstance；tauri.linux.conf.json 亦为静态窗口）' },
  { label: 'update', platform: 'desktop', rationale: '更新流程窗（src/App.vue:293、src/views/CheckUpdate.vue:208）' },
  { label: 'about', platform: 'desktop', rationale: '关于窗（src/layout/left/config.tsx:133）' },
  { label: 'forgetPassword', platform: 'desktop', rationale: '找回密码窗（src/views/loginWindow/Login.vue:42）' },
  { label: 'register', platform: 'desktop', rationale: '注册窗（src/views/loginWindow/QRCode.vue:105；DesktopSessionTransition:45 getByLabel 引用）' },
  { label: 'onlineStatus', platform: 'desktop', rationale: '在线状态窗（src/layout/left/components/LeftAvatar.vue:17、src/views/Tray.vue:18）' },
  { label: 'capture', platform: 'desktop', rationale: '截图窗（src/composables/common/windowRtc.ts:96）' },
  { label: 'notify', platform: 'desktop', rationale: '通知窗（src/composables/common/windowRtc.ts:147；tray.rs:231/252、init.rs:84 引用）' },
  { label: 'rtcCall', platform: 'desktop', rationale: '音视频通话窗（src/composables/common/windowRtc.ts:76）' },
  { label: 'imageViewer', platform: 'desktop', rationale: '图片查看窗（src/composables/common/useImageViewer.ts:446）' },
  { label: 'videoViewer', platform: 'desktop', rationale: '视频查看窗（src/composables/common/useVideoViewer.ts:186）' },
  { label: 'previewFile', platform: 'desktop', rationale: '文件预览窗（src/composables/chat/useChatFileDownload.ts:249，label 固定为字符串 previewFile）' },
  { label: 'chat-history', platform: 'desktop', rationale: '聊天记录窗（src/components/rightBox/chatBox/ChatFooter.vue:290）' },
  { label: 'fileManager', platform: 'desktop', rationale: '文件管理窗（src/layout/left/config.tsx:20 pageJumps 以 url 作 label）' },
  { label: 'mail', platform: 'desktop', rationale: '邮件窗（src/layout/left/config.tsx:32 pageJumps 以 url 作 label）' },
  { label: 'modal-remoteLogin', platform: 'desktop', rationale: '扫码登录确认模态窗（src/views/loginWindow/useLoginOrchestrator.ts:99）' },
  { label: 'modal-serviceAgreement', platform: 'desktop', rationale: '服务协议模态窗（src/views/loginWindow/useLoginOrchestrator.ts:130、src/views/registerWindow/index.vue:424）' },
  { label: 'modal-privacyAgreement', platform: 'desktop', rationale: '隐私协议模态窗（src/views/loginWindow/useLoginOrchestrator.ts:134、src/views/registerWindow/index.vue:429）' },
  // —— 桌面：动态族 glob（label 含运行时变量，无法静态枚举） ——
  { label: 'multiMsg*', platform: 'desktop', rationale: '合并转发记录窗，label=multiMsg<msgId>（src/components/rightBox/chatBox/ChatMultiMsg.vue:107）' },
  { label: 'windowChat--*', platform: 'desktop', rationale: '独立聊天窗，label=windowChat--<roomId>（src/composables/chat/useIndependentChatWindow.ts:29/35）' },
  { label: 'alone*', platform: 'desktop', rationale: '独立消息窗前缀，useWindow.checkLabel 对含 alone 的 label 去数字（src/composables/common/useWindow.ts:49；Alone.vue:24 发射 EventEnum.ALONE）' },
  // —— 移动：精确 label ——
  { label: 'mobile-home', platform: 'mobile', rationale: '移动端主窗口（src-tauri/tauri.ios.conf.json:27、tauri.android.conf.json:45；mobile-hula.json 已按此 label 授权）' }
]

/**
 * 「字面量 label 建窗点」提取规则（用于交叉核对注册表是否漏登记）。
 *
 * 只提取**可直接判定为字面量**的 label；变量形式的 label（如 createWebviewWindow 传 `path`）
 * 无法静态提取，只能靠注册表人工登记。
 */
export const LABEL_EXTRACTION_PATTERNS = [
  { pattern: /createWebviewWindow\s*\(\s*[^,]+?,\s*['"`]([A-Za-z][\w-]*)['"`]/g, kind: 'createWebviewWindow(label=第2参数)' },
  { pattern: /createModalWindow\s*\(\s*[^,]+?,\s*['"`]([A-Za-z][\w-]*)['"`]/g, kind: 'createModalWindow(label=第2参数)' },
  { pattern: /new WebviewWindow\s*\(\s*['"`]([A-Za-z][\w-]*)['"`]/g, kind: 'new WebviewWindow(label=第1参数)' },
  { pattern: /ensureDesktopWindowInstance\s*\(\s*['"`]([A-Za-z][\w-]*)['"`]/g, kind: 'ensureDesktopWindowInstance(label=第1参数)' },
  { pattern: /WebviewWindowBuilder::new\s*\(\s*[^,]+?,\s*"([A-Za-z][\w-]*)"/g, kind: 'Rust WebviewWindowBuilder::new(label=第2参数)' }
]

/** 把 capability 的 windows 通配模式转成正则（`*` → `.*`，其余按字面量转义） */
export function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

function platformGroupOf(capability) {
  const platforms = Array.isArray(capability?.platforms) ? capability.platforms : []
  if (platforms.some((p) => DESKTOP_PLATFORMS.has(p))) return 'desktop'
  if (platforms.some((p) => MOBILE_PLATFORMS.has(p))) return 'mobile'
  return 'unknown'
}

function platformGroupOfLabel(label) {
  return label.platform === 'mobile' ? 'mobile' : 'desktop'
}

/**
 * 纯函数判据：注册表里每个 label 必须被「平台匹配」的某份 capability 的 windows 命中。
 *
 * @param {{ labels?: typeof WINDOW_LABEL_REGISTRY, capabilities?: Record<string, unknown> }} input
 * @returns {{ ok: boolean, uncovered: Array<{ label: string, platform: string, rationale: string }>, coveredCount: number }}
 */
export function evaluateWindowCoverage({ labels = WINDOW_LABEL_REGISTRY, capabilities = {} } = {}) {
  const caps = Object.entries(capabilities).map(([file, capability]) => ({
    file,
    group: platformGroupOf(capability),
    windows: (Array.isArray(capability?.windows) ? capability.windows : []).map((w) => patternToRegExp(String(w)))
  }))

  const uncovered = []
  let coveredCount = 0

  for (const entry of labels) {
    const group = platformGroupOfLabel(entry)
    const matchers = caps.filter((c) => c.group === group)
    const covered = matchers.some((c) => c.windows.some((re) => re.test(entry.label)))
    if (covered) coveredCount += 1
    else uncovered.push({ label: entry.label, platform: group, rationale: entry.rationale })
  }

  return { ok: uncovered.length === 0, uncovered, coveredCount }
}

/**
 * 纯函数判据：源码建窗点的字面量 label 必须已登记进注册表。
 *
 * @param {{ sources?: Record<string, string>, labels?: typeof WINDOW_LABEL_REGISTRY }} input
 * @returns {{ ok: boolean, unregistered: Array<{ label: string, kind: string, hits: string[] }> }}
 */
export function evaluateLiteralRegistration({ sources = {}, labels = WINDOW_LABEL_REGISTRY } = {}) {
  const registered = new Set(labels.map((l) => l.label))
  const byLabel = new Map()

  for (const [file, text] of Object.entries(sources)) {
    for (const { pattern, kind } of LABEL_EXTRACTION_PATTERNS) {
      pattern.lastIndex = 0
      let match = pattern.exec(text)
      while (match !== null) {
        const label = match[1]
        if (!registered.has(label)) {
          if (!byLabel.has(label)) byLabel.set(label, { label, kind, hits: [] })
          byLabel.get(label).hits.push(file)
        }
        match = pattern.exec(text)
      }
    }
  }

  const unregistered = [...byLabel.values()].map((entry) => ({ ...entry, hits: [...new Set(entry.hits)].sort() }))
  unregistered.sort((a, b) => a.label.localeCompare(b.label))
  return { ok: unregistered.length === 0, unregistered }
}

function walkSources(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue
      walkSources(full, out)
    } else if (SCAN_EXT.test(entry) && !TEST_FILE.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function loadSources() {
  const sources = {}
  for (const root of scanRoots) {
    for (const file of walkSources(root)) {
      sources[path.relative(projectRoot, file)] = readFileSync(file, 'utf8')
    }
  }
  return sources
}

function loadCapabilities() {
  if (!existsSync(capabilitiesDir)) return {}
  const capabilities = {}
  for (const entry of readdirSync(capabilitiesDir)) {
    if (!entry.endsWith('.json')) continue
    capabilities[entry] = JSON.parse(readFileSync(path.join(capabilitiesDir, entry), 'utf8'))
  }
  return capabilities
}

async function main() {
  const jsonOutput = process.argv.includes('--json')

  let sources
  let capabilities
  try {
    sources = loadSources()
    capabilities = loadCapabilities()
  } catch (err) {
    console.error(`[tauri-window-coverage] scan failed: ${err.message}`)
    process.exit(2)
  }

  // 基数断言：注册表、capabilities、源码三者都必须真的读到东西
  if (WINDOW_LABEL_REGISTRY.length === 0) {
    console.error('[tauri-window-coverage] scan failed: 窗口 label 注册表为空（基数断言）')
    process.exit(2)
  }
  if (Object.keys(capabilities).length === 0) {
    console.error('[tauri-window-coverage] scan failed: 未读到任何 capability 文件（基数断言）')
    process.exit(2)
  }
  if (Object.keys(sources).length === 0) {
    console.error('[tauri-window-coverage] scan failed: 未扫描到任何源文件（基数断言）')
    process.exit(2)
  }

  const coverage = evaluateWindowCoverage({ capabilities })
  const registration = evaluateLiteralRegistration({ sources })
  const ok = coverage.ok && registration.ok

  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify(
        { ok, coverage, registration, registeredLabels: WINDOW_LABEL_REGISTRY.length, scannedFiles: Object.keys(sources).length, capabilities: Object.keys(capabilities) },
        null,
        2
      )}\n`
    )
  } else if (ok) {
    console.log(
      `[tauri-window-coverage] OK — ${coverage.coveredCount}/${WINDOW_LABEL_REGISTRY.length} 个窗口 label 均被 capability 覆盖，且无未登记字面量 label（扫描 ${Object.keys(sources).length} 文件）`
    )
  } else {
    console.error('[tauri-window-coverage] FAIL:')
    for (const item of coverage.uncovered) {
      console.error(`  - 未被任何 capability 覆盖：[${item.platform}] ${item.label}`)
      console.error(`      ${item.rationale}`)
    }
    for (const item of registration.unregistered) {
      console.error(`  - 源码建窗了未登记的 label：「${item.label}」（${item.kind}）`)
      console.error(`      调用点：${item.hits.join(', ')}`)
    }
    console.error('  修法：把缺失的 label 补进注册表 WINDOW_LABEL_REGISTRY，并确保 src-tauri/capabilities/*.json 的 windows 覆盖它')
  }

  process.exit(ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((err) => {
    console.error('[tauri-window-coverage] unexpected error', err)
    process.exit(2)
  })
}
