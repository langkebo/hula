// biome-ignore-all lint/suspicious/noConsole: This CLI script intentionally writes progress to the terminal.
/**
 * Guard: raw `fetch()` outside the approved transport boundary.
 *
 * 背景（2026-10-11 修复）：旧实现用 `execSync("grep -rln '\bfetch(' src/ …")`，
 * `grep` 无匹配时退出码为 1，而 `execSync` 对非零退出直接抛异常 ⇒ 该脚本在任何
 * 「零命中」的正常状态下都会**崩溃**（EXIT=1，stderr 为空），既不能报告违规，
 * 也从未接入任何 CI 链。本实现改为纯 Node 目录遍历，不再依赖外部 `grep`（也顺带
 * 规避了 WorkBuddy CLI 把 `grep` 换成 toybox shim 的环境问题）。
 *
 * 判据：`src/**` 中的 `.ts/.tsx/.vue` 文件出现 `fetch(` 调用（前面不能是标识符
 * 字符，即排除 `myFetch(`），且不在白名单内 ⇒ 违规。
 *
 * Exit code:
 *   0  无违规
 *   1  存在白名单外的裸 fetch
 *   2  环境/自检异常（扫描目录不存在，或扫描到 0 个文件 —— 基数断言，
 *      避免「什么都没扫到」被误判为「通过」）
 *
 * Usage:
 *   node scripts/check-no-raw-fetch.mjs            human-readable
 *   node scripts/check-no-raw-fetch.mjs --json     machine-readable
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const scanRoot = resolve(repoRoot, 'src')
const emitJson = process.argv.includes('--json')

/**
 * 白名单：每一项都必须写明「为什么这里必须用浏览器原生 fetch」。
 * 新增条目请附带正当理由，否则应改用 SDK manager 方法或统一 HttpClient。
 */
const ALLOWLIST = new Map([
  ['src/services/matrix/network/runtimeFetch.ts', 'fetch 包装器本体'],
  [
    'src/workers/workerProbeHandlers.ts',
    '登录前哨探测（versions/loginFlows/CORS/capabilities）——此时 SDK client 尚不存在'
  ],
  ['src/App.vue', 'apple.com favicon 可达性探测（no-cors）'],
  ['src/strategy/strategies/video.ts', 'blob: URL 必须用浏览器原生 fetch'],
  ['src/composables/user/useAvatarUpload.ts', '头像上传读的是 webview 本地静态资源（/avatar/*.webp），非网络请求']
])

const EXT = /\.(ts|tsx|vue)$/
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '__tests__'])
const FETCH_CALL = /(^|[^\w$])fetch\s*\(/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (SKIP_DIR.has(entry)) continue
      walk(full, out)
    } else if (EXT.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function fail(message) {
  if (emitJson) console.log(JSON.stringify({ error: message }, null, 2))
  else console.error(`[check-no-raw-fetch] ${message}`)
  process.exit(2)
}

try {
  statSync(scanRoot)
} catch {
  fail(`扫描根目录不存在: ${scanRoot}`)
}

const allFiles = walk(scanRoot)
if (allFiles.length === 0) {
  fail(`扫描到 0 个源文件（${scanRoot}）—— 拒绝以「通过」收场`)
}

const hits = []
for (const file of allFiles) {
  if (/\.(test|spec)\./.test(file)) continue
  const rel = relative(repoRoot, file).split(sep).join('/')
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  text.split('\n').forEach((line, idx) => {
    if (FETCH_CALL.test(line)) hits.push({ file: rel, line: idx + 1 })
  })
}

const byFile = new Map()
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, [])
  byFile.get(h.file).push(h.line)
}

const files = [...byFile.keys()].sort()
const violations = files.filter((f) => !ALLOWLIST.has(f))
const staleAllowlist = [...ALLOWLIST.keys()].filter((f) => !byFile.has(f)).sort()

if (emitJson) {
  console.log(
    JSON.stringify(
      {
        scannedFiles: allFiles.length,
        filesWithFetch: files.length,
        violations,
        staleAllowlist,
        findings: [...byFile.entries()]
          .map(([file, lines]) => ({ file, lines, approved: ALLOWLIST.has(file) }))
          .sort((a, b) => a.file.localeCompare(b.file))
      },
      null,
      2
    )
  )
} else {
  console.log(`扫描源文件: ${allFiles.length}`)
  console.log(`含 fetch( 的文件: ${files.length}（白名单内 ${files.length - violations.length}）`)
  if (staleAllowlist.length > 0) {
    // 只提示不阻断：文件可能只是重命名/迁移中。缩小白名单是好事，但不应误伤并行改动。
    console.log(`\n提示：白名单中 ${staleAllowlist.length} 项已无匹配（可考虑移除）:`)
    for (const f of staleAllowlist) console.log(`  - ${f}`)
  }
}

if (violations.length > 0) {
  if (!emitJson) {
    console.error(`\nERROR: ${violations.length} 个文件在白名单外使用裸 fetch():`)
    for (const f of violations) console.error(`  ${f}:${byFile.get(f).join(',')}`)
    console.error(
      '请改用 @/utils/HttpClient、SDK manager 方法，或在 scripts/check-no-raw-fetch.mjs 的白名单中附带正当理由后加入。'
    )
  }
  process.exit(1)
}

if (!emitJson) console.log('\nOK: 所有裸 fetch() 均在白名单内')
process.exit(0)
