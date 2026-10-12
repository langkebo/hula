#!/usr/bin/env node
/**
 * P1-5（§前端技术审查报告 2026-10-12）— 文档路径存在性门禁。
 *
 * `.rules`（同时通过软链接暴露为 AGENTS.md / CLAUDE.md）大量描述目录结构与
 * 文件路径。代码演进后文档容易漂移，指向已删除的文件（例如历史上的
 * `src/hooks/`、`src/services/ai-provider.ts`、已失效的 ADR 链接）。
 *
 * 本脚本提取 `.rules` 中反引号包裹、且以仓库顶层目录开头的路径 token，
 * 逐一校验其存在性；缺失即失败。
 *
 * 解析规则：
 *   - 仅检查以顶层目录（src/、src-tauri/、scripts/ 等）开头的 token，
 *     避免把 npm 包名、别名（@/、~/）、分支名、命令误判为路径。
 *   - 含空白或 `*`（示例命令 / glob）的 token 跳过。
 *   - 以 `src/` 开头的 token 同时按 `<root>/src/...` 与
 *     `<root>/src-tauri/src/...` 两种根解析，兼容文档中相对
 *     `src-tauri/` 的写法（如 `src/command/`）。
 *
 * Usage:
 *   node scripts/check-doc-paths.mjs            # 校验（缺失即失败）
 *   node scripts/check-doc-paths.mjs --json     # 机器可读报告
 *
 * Exit codes:
 *   0  全部路径存在
 *   1  存在缺失路径
 *   2  扫描失败（如文档不可读）
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const docFile = path.join(projectRoot, '.rules')

// 顶层目录前缀，命中其一才视为“仓库路径”而非 npm 包名 / 别名 / 命令。
const TOP_LEVEL_PREFIXES = [
  'src/',
  'src-tauri/',
  'scripts/',
  'build/',
  'vendor/',
  'skills/',
  'docs/',
  'meta/',
  'e2e/',
  'tauri-plugin-hula/'
]

const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')

/** 从文档内容提取候选路径 token。 */
function extractPathTokens(content) {
  const tokens = new Set()
  const inlineCode = /`([^`\n]+)`/g
  let match
  while ((match = inlineCode.exec(content)) !== null) {
    const token = match[1].trim()
    if (!token || /\s/.test(token) || token.includes('*')) continue
    if (!TOP_LEVEL_PREFIXES.some((prefix) => token.startsWith(prefix) || token === prefix)) continue
    tokens.add(token)
  }
  return [...tokens].sort()
}

/** 判断 token 是否存在于仓库（含双根解析）。 */
function tokenExists(token) {
  const candidates = [token]
  if (token.startsWith('src/')) {
    candidates.push(path.join('src-tauri', token))
  }
  return candidates.some((candidate) => existsSync(path.join(projectRoot, candidate)))
}

async function main() {
  let content
  try {
    content = await readFile(docFile, 'utf8')
  } catch (error) {
    console.error(`[doc-paths] 无法读取 ${path.relative(projectRoot, docFile)}: ${error.message}`)
    process.exit(2)
  }

  const tokens = extractPathTokens(content)
  const missing = tokens.filter((token) => !tokenExists(token))

  if (jsonOutput) {
    console.log(JSON.stringify({ checked: tokens.length, missing }, null, 2))
  } else {
    console.log(`[doc-paths] 校验 ${path.relative(projectRoot, docFile)}：${tokens.length} 个路径引用`)
    if (missing.length === 0) {
      console.log('[doc-paths] OK：全部路径存在')
    } else {
      console.error(`[doc-paths] FAIL：${missing.length} 个路径不存在`)
      for (const token of missing) {
        console.error(`  - ${token}`)
      }
    }
  }

  process.exit(missing.length === 0 ? 0 : 1)
}

main()
