#!/usr/bin/env node

/**
 * i18n 死 key 报告（report-only，非 CI 门禁）。
 *
 * 扫描 locales/zh-CN 的扁平化 key，检查每个 key 是否在 src/ 源码里
 * 有字面引用（t('key') / $t('key') 等）。0 引用的列为「疑似死 key」。
 *
 * 注意：
 *  - 动态 key（`t(\`space.${type}\`)`）只有前缀出现在源码，整 key 会被
 *    报告为疑似死 key，需人工确认。
 *  - 本脚本只报告，不阻断；清理需人工确认后逐批删除。
 *
 * 用法：node scripts/check-i18n-dead-keys.mjs [--limit N]
 */

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const localesDir = path.join(root, 'locales')
const baseLocale = 'zh-CN'
const srcDir = path.join(root, 'src')
const limit = Number(process.argv[process.argv.indexOf('--limit') + 1] ?? 500) || 500

function getKeys(obj, prefix = '') {
  const keys = []
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getKeys(obj[key], `${prefix}${key}.`))
    } else {
      keys.push(`${prefix}${key}`)
    }
  }
  return keys
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.js', '.jsx', '.mjs'])

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      yield fullPath
    }
  }
}

// 1. 收集 zh-CN 全部 key
const baseFiles = fs.readdirSync(path.join(localesDir, baseLocale)).filter((f) => f.endsWith('.json'))
const allKeys = []
for (const file of baseFiles) {
  const content = JSON.parse(fs.readFileSync(path.join(localesDir, baseLocale, file), 'utf-8'))
  allKeys.push(...getKeys(content))
}

// 2. 读全部源码（排除测试，测试里的 key 引用也算使用，但保守起见一并计入）
let sourceText = ''
for (const filePath of walk(srcDir)) {
  sourceText += `${fs.readFileSync(filePath, 'utf8')}\n`
}

// 3. 找 0 字面引用的 key；数字下标段（如 privacy.sections.0.title）是数组动态访问，跳过
const isArrayKey = (key) => key.split('.').some((seg) => /^\d+$/.test(seg))
const unreferenced = allKeys.filter((key) => !sourceText.includes(key))
const arrayKeys = unreferenced.filter(isArrayKey)
const deadKeys = unreferenced.filter((key) => !isArrayKey(key))

console.log(`i18n 死 key 报告（${baseLocale}，共 ${allKeys.length} key）`)
console.log(`疑似死 key（扁平、源码无字面引用）: ${deadKeys.length}`)
console.log(`数组动态 key（数字下标，跳过）: ${arrayKeys.length}`)
console.log('---')
for (const key of deadKeys.slice(0, limit)) {
  console.log(key)
}
if (deadKeys.length > limit) {
  console.log(`... 其余 ${deadKeys.length - limit} 个省略（用 --limit 调整）`)
}
