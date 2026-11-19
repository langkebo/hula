#!/usr/bin/env node
/**
 * 从 SDK 的 `.d.ts` 生成测试夹具。
 *
 * ## 为什么
 *
 * 测试里 mock 后端响应时手写对象，没有任何东西保证它长得像后端（实测出过
 * `{ enabled, token }` 这种后端根本不返回的结构）。手工为 217 个 interface 建夹具不现实，
 * 而**类型本身就是结构真值** —— 于是用 TypeScript 的 compiler API 读 interface，
 * 生成「全字段最小有效值」的对象。
 *
 * 生成物带 `satisfies <Interface>`：
 * - 生成器若与 SDK 类型不符（字段名/p 类型变化），**编译期立刻红**
 * - 后端 SDK 升级导致类型变化时，重跑本脚本即可对齐
 *
 * ## 取舍（重要）
 *
 * 只生成**类型完全可推**的 interface：
 * - `string` / `number` / `boolean` / 可空 / `T[]` / 已声明的嵌套 interface → 生成
 * - 联合类型、泛型、索引签名、`Record<...>`、函数类型 → **整个 interface 跳过**
 *
 * 跳过的原因：生不出来就只能写 `as any` / `as never`，而那些**正是本项目门禁禁止的**
 * （见 check-ratchet 的 as_any / as_never / as_unknown_as）。宁可少生成，不可造假。
 *
 * 生成的值**语义上是占位**（`created_ts: 0`），但**结构上是真值** —— 夹具要解决的正是结构。
 * 测试若依赖具体值，用对象展开覆盖：`{ ...fx.AdminRoomInfo, room_id: '!r:s' }`。
 *
 * ## 用法
 *
 *   node scripts/gen-fixtures-from-sdk.mjs            # 生成
 *   node scripts/gen-fixtures-from-sdk.mjs --dry-run  # 只报告会生成多少
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SDK_ADMIN = path.join(ROOT, 'node_modules/matrix-js-sdk/lib/admin')
const OUT_DIR = path.join(ROOT, 'src/services/matrix/__tests__/fixtures/generated')
const DRY = process.argv.includes('--dry-run')

/** 找到 admin 下所有 .d.ts（排除 .map / 入口 barrel，避免重复定义） */
function dtsFiles() {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (name === 'node_modules') continue
      if (name.endsWith('.d.ts')) out.push(full)
      else if (!name.includes('.')) walk(full)
    }
  }
  walk(SDK_ADMIN)
  return out
}

/** 把 TS 类型节点转成「能否生成 + 生成表达式」 */
function valueFor(type, checker, depth = 0) {
  if (depth > 4) return null
  const flags = type.flags

  // 单字面量类型（`'pending'`、`true`）必须返回**该字面量本身**；
  // 只有宽类型（`string`/`number`/`boolean`）才用占位值。
  if (flags & ts.TypeFlags.StringLiteral) return JSON.stringify(type.value)
  if (flags & ts.TypeFlags.NumberLiteral) return String(type.value)
  if (flags & ts.TypeFlags.BooleanLiteral) return type.intrinsicName === 'true' ? 'true' : 'false'
  if (flags & ts.TypeFlags.String) return "'x'"
  if (flags & ts.TypeFlags.Number) return '0'
  if (flags & ts.TypeFlags.Boolean) return 'false'
  if (flags & ts.TypeFlags.Null || flags & ts.TypeFlags.Undefined || flags & ts.TypeFlags.Void) return 'null'

  // 联合：只要有一个可生成的非 null/undefined 分支就取它；否则 null
  if (flags & ts.TypeFlags.Union) {
    const parts = type.types.filter(
      (t) => !(t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))
    )
    if (parts.length === 1) return valueFor(parts[0], checker, depth + 1)
    // 字面量联合（`'ok' | 'error'`）必须取**真实字面量值**，不能填 'x' ——
    // 否则 satisfies 立刻报 TS2322（这是第一版生成器踩的坑）。
    for (const p of parts) {
      if (p.flags & ts.TypeFlags.StringLiteral) return JSON.stringify(p.value)
    }
    for (const p of parts) {
      if (p.flags & ts.TypeFlags.NumberLiteral) return String(p.value)
    }
    for (const p of parts) {
      if (p.flags & ts.TypeFlags.BooleanLiteral) return p.intrinsicName === 'true' ? 'true' : 'false'
    }
    // 宽类型（string/number）兜底
    for (const p of parts) {
      if (p.flags & ts.TypeFlags.String) return "'x'"
      if (p.flags & ts.TypeFlags.Number) return '0'
    }
    for (const p of parts) {
      const v = valueFor(p, checker, depth + 1)
      if (v !== null) return v
    }
    return 'null'
  }

  // 数组：空数组永远是合法值
  if (checker.isArrayType(type)) return '[]'

  // 嵌套 interface / 对象字面量类型 → 递归
  if (flags & ts.TypeFlags.Object) {
    const props = type.getProperties()
    if (props.length === 0) return '{}'
    const fields = []
    for (const prop of props) {
      const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration ?? prop.declarations?.[0])
      const optional = Boolean(prop.flags & ts.SymbolFlags.Optional)
      const isNullable =
        (propType.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !== 0 ||
        (propType.flags & ts.TypeFlags.Union &&
          propType.types.some((t) => t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)))
      if (optional) continue // 可选字段整体省略，避免造出无意义的 null
      const v = valueFor(propType, checker, depth + 1)
      if (v === null) {
        if (isNullable) continue // 可空且生不出 → 省略
        return null // 必填且生不出 → 整个 interface 放弃
      }
      fields.push(`  ${prop.name}: ${v}`)
    }
    if (fields.length === 0) return '{}'
    return `{\n${fields.join(',\n')}\n}`
  }

  return null
}

function main() {
  const files = dtsFiles()
  const program = ts.createProgram(files, {
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler
  })
  const checker = program.getTypeChecker()

  /**
   * `admin/index` 真正对外导出的名字。
   *
   * 只生成这些：`.d.ts` 里有些 interface 是内部形状（`AdminServerInfoDto` 等）
   * 并未从入口导出，生成了也 `import * as T from 'matrix-js-sdk/admin'` 拿不到，
   * 反而让 `satisfies T.X` 直接编译错。
   */
  const indexPath = path.join(SDK_ADMIN, 'index.d.ts')
  const indexSource = program.getSourceFile(indexPath)
  const exportedNames = new Set()
  if (indexSource) {
    const moduleSymbol = checker.getSymbolAtLocation(indexSource)
    if (moduleSymbol) {
      for (const sym of checker.getExportsOfModule(moduleSymbol)) exportedNames.add(sym.name)
    }
  }

  /** file → [{ name, body }] */
  const byFile = new Map()
  let generated = 0
  let skipped = 0
  const skippedNames = []

  for (const sf of program.getSourceFiles()) {
    if (!sf.fileName.includes('/lib/admin/')) continue
    for (const stmt of sf.statements) {
      if (!ts.isInterfaceDeclaration(stmt)) continue
      if (!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue
      const name = stmt.name.text
      if (!exportedNames.has(name)) {
        skipped += 1
        skippedNames.push(`${name}(not-exported)`)
        continue
      }
      const type = checker.getTypeAtLocation(stmt)
      const body = valueFor(type, checker)
      const rel = path.relative(SDK_ADMIN, sf.fileName).replace(/\.d\.ts$/, '')
      if (!byFile.has(rel)) byFile.set(rel, [])
      if (body === null) {
        skipped += 1
        skippedNames.push(name)
        continue
      }
      byFile.get(rel).push({ name, body })
      generated += 1
    }
  }

  console.log(`[gen-fixtures] 可生成 ${generated} 个，跳过 ${skipped} 个（联合/泛型/索引签名等）`)
  if (skippedNames.length) console.log(`  跳过示例: ${skippedNames.slice(0, 8).join(', ')}`)
  if (DRY) return

  mkdirSync(OUT_DIR, { recursive: true })
  const indexLines = []
  for (const [rel, items] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    if (items.length === 0) continue
    const fileName = rel.replaceAll('/', '-').replace(/[^a-zA-Z0-9-]/g, '-')
    const lines = [
      '// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。',
      '// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。',
      "import type * as T from 'matrix-js-sdk/admin'",
      ''
    ]
    for (const { name, body } of items) {
      lines.push(`/** \`${rel}\` 的 \`${name}\` */`)
      lines.push(`export const ${name}Fixture = ${body} satisfies T.${name}`)
      lines.push('')
    }
    writeFileSync(path.join(OUT_DIR, `${fileName}.ts`), lines.join('\n'), 'utf8')
    indexLines.push(`export * from './${fileName}'`)
  }
  writeFileSync(
    path.join(OUT_DIR, 'index.ts'),
    ['// ⚠️ 生成物，请勿手改。', ...indexLines, ''].join('\n'),
    'utf8'
  )
  console.log(`[gen-fixtures] 已写入 ${byFile.size} 个文件到 ${path.relative(ROOT, OUT_DIR)}/`)
}

main()
