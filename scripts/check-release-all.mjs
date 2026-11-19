#!/usr/bin/env node
/**
 * 全量跑 `check:release` 的所有段，**收集全部失败后再汇总**。
 *
 * ## 为什么需要它
 *
 * `check:release` 是 34 段 `A && B && ...` 串行链：第 N 段失败后，后面**全部不执行**。
 * 后果是「每次只看得见第一个红」——修好一个才暴露下一个，很容易误判成「只差一点」；
 * 更糟的是前面红着时，后面 20 多段等于**从没跑过**，「全量门禁」长期没有真正全量过。
 *
 * 2026-11-19 实测三轮：`bare-matrix-paths`（修好）→ `tauri-window-coverage`（修好）
 * → `matrix-service-layering`（既有债）。若一开始就能一次看到三个，判断会完全不同。
 *
 * ## 与 check:release 的分工
 *
 * - `check:release`：保留 `&&` 链，CI 上快速失败（省时间）；
 * - `check:release:all`：本地/发布前做一次全量体检，输出「执行了几段、哪几段红、各自首行错误」。
 *
 * ## 用法
 *
 *   node scripts/check-release-all.mjs              # 全量，逐段打印
 *   node scripts/check-release-all.mjs --only-failed # 只打印失败的段（安静模式）
 *   node scripts/check-release-all.mjs --json        # 机器可读
 *
 * 退出码：0 全通过 / 1 有段失败 / 2 无法解析 check:release
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEGMENT_TIMEOUT_MS = 15 * 60 * 1000

/** 从输出里挑出最能说明问题的几行（各门禁的失败首行形态不同） */
function pickErrorLines(out, max = 4) {
  const lines = String(out || '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
  const hit = lines.filter((l) =>
    /(❌|FAIL|ERROR|error TS|Error:|✗|失败|不通过|missing|drift)/i.test(l) && !/^✔|^✅|^INFO|^ℹ/.test(l)
  )
  const picked = (hit.length > 0 ? hit : lines.slice(-max)).slice(0, max)
  return picked.map((l) => (l.length > 220 ? `${l.slice(0, 220)}…` : l))
}

function loadSegments() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const chain = pkg.scripts?.['check:release']
  if (typeof chain !== 'string' || !chain.trim()) return null
  return chain
    .split(' && ')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function runAll({ segments, onlyFailed = false, cwd = ROOT, log = console.log } = {}) {
  const results = []
  for (const [i, cmd] of segments.entries()) {
    const started = Date.now()
    // ⚠️ maxBuffer 必须显式放大：`check:coverage` 这类跑全量单测的段输出可达数十 MB，
    // 默认 1MB 会 ENOBUFS ⇒ spawnSync 返回 status=null，看起来像「被信号杀死」，
    // 极易误判成该段真的失败（2026-11-19 就是这样把 check:coverage 误报成红）。
    const r = spawnSync(cmd, {
      cwd,
      shell: true,
      encoding: 'utf8',
      timeout: SEGMENT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024
    })
    const ms = Date.now() - started
    // signal 存在说明是被超时/信号终止，与「命令自己非零退出」要分开报
    const killed = r.status === null && Boolean(r.signal)
    const ok = r.status === 0
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    results.push({
      index: i + 1,
      cmd,
      ok,
      code: r.status,
      signal: r.signal ?? null,
      killed,
      ms,
      errorLines: pickErrorLines(out)
    })
    if (!onlyFailed || !ok) {
      const suffix = killed ? `killed by ${r.signal}` : `exit=${r.status}`
      log(`${ok ? '✅' : '❌'} [${i + 1}/${segments.length}] ${cmd}  (${(ms / 1000).toFixed(1)}s, ${suffix})`)
    }
  }
  return results
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isDirectRun()) {
  const onlyFailed = process.argv.includes('--only-failed')
  const asJson = process.argv.includes('--json')
  const segments = loadSegments()
  if (!segments) {
    console.error('[check:release:all] 无法从 package.json 解析 check:release')
    process.exit(2)
  }

  console.log(`[check:release:all] 共 ${segments.length} 段，逐段执行（失败也继续）\n`)
  const results = runAll({ segments, onlyFailed: false })
  const failed = results.filter((r) => !r.ok)
  const passed = results.length - failed.length

  if (asJson) {
    console.log(JSON.stringify({ total: results.length, passed, failed }, null, 2))
  } else {
    console.log(`\n=== 汇总：${passed}/${results.length} 通过，${failed.length} 失败 ===`)
    if (failed.length === 0) {
      console.log('✅ 全部段落通过')
    } else {
      for (const r of failed) {
        console.log(`\n❌ [${r.index}] ${r.cmd}  (exit=${r.code}, ${(r.ms / 1000).toFixed(1)}s)`)
        for (const line of r.errorLines) console.log(`   ${line}`)
      }
      const skipped = results.length - (results.at(-1)?.index ?? results.length)
      if (skipped > 0) console.log(`\n（注意：check:release 串行链会在第 ${failed[0].index} 段就停，其余 ${skipped} 段本来不会跑到）`)
    }
  }

  process.exit(failed.length === 0 ? 0 : 1)
}
