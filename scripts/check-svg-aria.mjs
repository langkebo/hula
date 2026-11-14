#!/usr/bin/env node
/**
 * 装饰性 SVG 无障碍守卫。
 *
 * 规则：`src/**\/*.vue` 中每个 `<svg>` 必须满足其一：
 *  - 装饰性：显式 `aria-hidden="true"`（或 true 之外的等价写法）
 *  - 有语义：`aria-label` / `aria-labelledby` / `role`，或元素内含 `<title>`
 *
 * 缺少以上任一标记的 svg 会让读屏器把它当作无名图形朗读，属于无障碍回归。
 * 退出码：0 = 全部合规；1 = 存在违规。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(repoRoot, 'src')
const SVG_OPEN = /<svg\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g
const NAME_ATTR = /aria-hidden|aria-label|aria-labelledby|role=/

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(fullPath)
    else if (entry.isFile() && entry.name.endsWith('.vue')) yield fullPath
  }
}

const violations = []
let total = 0

for (const filePath of walk(srcRoot)) {
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content.includes('<svg')) continue
  const relPath = path.relative(repoRoot, filePath)
  let match
  SVG_OPEN.lastIndex = 0
  while ((match = SVG_OPEN.exec(content))) {
    total++
    const attrs = match[1]
    if (NAME_ATTR.test(attrs)) continue
    if (!attrs.trimEnd().endsWith('/')) {
      const openEnd = match.index + match[0].length
      const closeIdx = content.indexOf('</svg>', openEnd)
      if (closeIdx !== -1 && content.slice(openEnd, closeIdx).includes('<title')) continue
    }
    const line = content.slice(0, match.index).split('\n').length
    violations.push(`${relPath}:${line}`)
  }
}

if (violations.length > 0) {
  console.error(`check-svg-aria: FAIL — ${violations.length}/${total} 个 svg 缺少 aria-hidden 或可访问名：`)
  for (const item of violations.slice(0, 50)) console.error(`  ${item}`)
  if (violations.length > 50) console.error(`  ... 其余 ${violations.length - 50} 项省略`)
  process.exit(1)
}

console.log(`check-svg-aria: OK — ${total} 个 svg 均具备 aria-hidden 或可访问名`)
