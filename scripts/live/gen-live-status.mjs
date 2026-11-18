#!/usr/bin/env node
/**
 * 联调状态生成器 —— 状态只写一次（`live-status.json`），其余全部生成。
 *
 * 为什么需要它：同一份「哪个用例跑过了」的事实，此前在
 * `TJG-前后端联调测试报告` §二、`UI优化方案` §19.5x/§19.6x、`THREE_REPO_OPEN_ISSUES` §8
 * 各写一遍，于是出现「一处说已闭环、另一处说仍待补」。本脚本把「事实」与「叙述」分开：
 * 事实在 JSON，叙述由它生成。
 *
 * 降级规则：`status: "passed"` 但缺 `last_run` 四元组、或四元组与**当前**环境不符时，
 * 输出为 `stale` 并注明原因 —— 因为「结论存在但环境无法复现」不等于「通过」。
 *
 * Usage:
 *   node scripts/live/gen-live-status.mjs                 # 打印到 stdout
 *   node scripts/live/gen-live-status.mjs --write         # 写进方案文档的标记块
 *   node scripts/live/gen-live-status.mjs --file <path>   # 指定目标文档
 *
 * Exit codes: 0 成功 / 2 读写或解析失败
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureBaseline, formatBaseline } from '../lib/live-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

const BEGIN = '<!-- live-status:begin -->'
const END = '<!-- live-status:end -->'

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const valueOf = (f) => {
  const i = args.indexOf(f)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}

const WRITE = has('--write')
const TARGET = valueOf('--file') ?? 'docs/TJG-联调测试方案-2026-11-18.md'

function readJson(relPath) {
  try {
    return JSON.parse(readFileSync(path.join(projectRoot, relPath), 'utf8'))
  } catch (err) {
    console.error(`[live-status] 无法读取 ${relPath}：${err.message}`)
    process.exit(2)
  }
}

/** markdown 单元格转义（避免 note 里的 `|` 撑破表格）。 */
const cell = (v) => String(v ?? '-').replace(/\|/g, '\\|')

/** 判定最终展示状态（含降级）。 */
function resolveStatus(entry, currentSdkCommit) {
  if (!entry) return { status: 'never-run', note: 'status.json 无此条目' }
  const { status } = entry
  if (status !== 'passed') return { status, note: entry.note ?? '' }

  const run = entry.last_run
  if (!run || !run.backend_image || !run.sdk_pin?.commit) {
    return { status: 'stale', note: `${entry.note ?? ''}（降级：缺四元组）`.trim() }
  }
  if (currentSdkCommit && run.sdk_pin.commit !== currentSdkCommit) {
    return { status: 'stale', note: `${entry.note ?? ''}（降级：SDK pin 已变）`.trim() }
  }
  return { status, note: entry.note ?? '' }
}

const STATUS_ICON = {
  passed: '✅ passed',
  failed: '❌ failed',
  stale: '🟠 stale',
  'never-run': '⬜ never-run',
  manual: '📋 manual'
}

function main() {
  const manifest = readJson('scripts/live/live-manifest.json')
  const status = readJson('scripts/live/live-status.json')
  const baseline = captureBaseline()
  const entries = status.entries ?? {}

  const liveSpecs = (manifest.specs ?? []).filter((s) => s.live)
  const probes = manifest.probes ?? []
  const manual = manifest.manual ?? []

  const rows = [
    ...liveSpecs.map((s) => ({ kind: 'live', name: s.name, meta: s.routeSet, entry: entries[s.name] })),
    ...probes.map((p) => ({ kind: 'probe', name: p.name, meta: p.category, entry: entries[p.name] }))
  ]

  const resolved = rows.map((r) => ({
    ...r,
    ...resolveStatus(r.entry, baseline.sdk_pin.commit),
    result: r.entry?.result
      ? `${r.entry.result.passed ?? 0}/${(r.entry.result.passed ?? 0) + (r.entry.result.failed ?? 0)}${
          r.entry.result.skipped ? ` (skip ${r.entry.result.skipped})` : ''
        }`
      : '-'
  }))

  const count = (s) => resolved.filter((r) => r.status === s).length
  const lines = []

  lines.push(`> 生成于 2026-11-18（\`scripts/live/gen-live-status.mjs\`，禁止手改本块；改 \`scripts/live/live-status.json\` 后重跑）`)
  lines.push('')
  lines.push(`**当前环境**：${formatBaseline(baseline)}`)
  lines.push('')
  lines.push(
    `**汇总**：条目 ${resolved.length}（live ${liveSpecs.length} / 探针 ${probes.length}）｜` +
      `passed **${count('passed')}**｜failed **${count('failed')}**｜stale **${count('stale')}**｜` +
      `never-run **${count('never-run')}**｜manual **${manual.length}**`
  )
  lines.push('')
  lines.push(
    `> **判读口径**：\`passed\` 才代表「有自动化用例且跑过、结论可核验」；` +
      `\`stale\` = 有历史结论但环境已不可复现（不等于通过）；\`never-run\` = 从未执行。` +
      `这解释了为什么「文档写已完成」与「状态表一片 stale」可以同时成立。`
  )
  lines.push('')

  lines.push('| 条目 | 类型 | 状态 | 上次结果 | 备注 |')
  lines.push('|---|---|---|---|---|')
  for (const r of resolved) {
    lines.push(`| \`${r.name}\` | ${r.kind}/${r.meta} | ${STATUS_ICON[r.status] ?? r.status} | ${cell(r.result)} | ${cell(r.note)} |`)
  }
  lines.push('')

  if (manual.length) {
    lines.push('**人工清单（不进自动化）**')
    lines.push('')
    lines.push('| 项 | 原因 | 责任域 | 优先级 |')
    lines.push('|---|---|---|---|')
    for (const m of manual) {
      lines.push(`| ${cell(m.name)} | ${cell(m.reason)} | ${cell(m.owner)} | ${cell(m.priority)} |`)
    }
    lines.push('')
  }

  const block = [BEGIN, ...lines, END].join('\n')

  if (!WRITE) {
    process.stdout.write(`${block}\n`)
    return
  }

  const targetPath = path.join(projectRoot, TARGET)
  let doc
  try {
    doc = readFileSync(targetPath, 'utf8')
  } catch (err) {
    console.error(`[live-status] 无法读取目标文档 ${TARGET}：${err.message}`)
    process.exit(2)
  }

  const begin = doc.indexOf(BEGIN)
  const end = doc.indexOf(END)
  if (begin < 0 || end < 0 || end < begin) {
    console.error(`[live-status] ${TARGET} 里找不到 ${BEGIN} / ${END} 标记块，请先手工加一次空块`)
    process.exit(2)
  }

  const next = `${doc.slice(0, begin)}${block}${doc.slice(end + END.length)}`
  writeFileSync(targetPath, next)
  console.log(`[live-status] 已写入 ${TARGET}（${resolved.length} 条）`)
}

main()
