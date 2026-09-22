import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * presence 唯一写入点结构守卫。
 *
 * 背景：门控规则原本只有一份实现（resolveOutgoingPresence），但「是否走门控」由各调用点
 * 自觉决定，于是存在两条绕过门控的裸 SDK 写入路径，移动端切状态正是从其中一条泄漏的。
 * 现在门控与记账都在 `MatrixPresenceService.setPresence` 内完成，因此**任何**直接调用
 * SDK presence 写入（`presenceManager.setPresence` / `client.setPresence`）的新代码都会
 * 重新打开这个缺口。本守卫把该不变量从「文档约定」变成「可执行检查」。
 *
 * 2026-09-22 最终评审加固了三个洞：
 *  - **解构绕过**：旧判据只看 `.setPresence(`，`const { setPresence } = matrixPresenceService`
 *    之后裸调 `setPresence(...)` 完全不被看见。现在任何把 `setPresence` 从 `useAccount`
 *    以外来源解构出来的写法都直接判违规。
 *  - **注释/日志误报**：旧判据按行做子串匹配，`// matrixPresenceService.setPresence`、
 *    `` logger.warn(`setPresence 失败`) `` 这类文本会被当成裸写。现在先剥掉注释与字符串
 *    字面量（模板插值里的代码仍保留）再判定。
 *  - **别名来源**：桌面 `UserMenuHeader.vue` 经 `const { setPresence } = useAccount()` 调用，
 *    这是被允许的委托路径（useAccount 内部仍走唯一写入点），显式登记而不是靠正则巧合。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../../..')
const SRC_ROOT = join(REPO_ROOT, 'src')
const SINGLE_WRITER = join(SRC_ROOT, 'services/matrix/user/MatrixPresenceService.ts')
/** 唯一被允许的委托来源：useAccount 的 setPresence 内部调用 matrixPresenceService.setPresence。 */
const SANCTIONED_ALIAS_SOURCE = 'useAccount'

/** 允许的门控调用：`matrixPresenceService.setPresence(...)`（含换行写法）。 */
const GATED_CALL = /\bmatrixPresenceService\s*\.\s*setPresence\b/g
/** 裸写：任何其它接收者的 `.setPresence(`（`presenceManager` / `client` / 别名对象……）。 */
const RAW_PROPERTY_WRITE = /(\.\s*)setPresence\b/g
/** 解构出 `setPresence` 的表达式及其来源：`const { setPresence } = <source>`。 */
const DESTRUCTURE = /\{[^{}]*\bsetPresence\b[^{}]*\}\s*=\s*([A-Za-z_$][\w$.]*)/g
/** 本地声明包装器：`const setPresence = (...)`。 */
const WRAPPER_DECLARATION = /\b(?:const|let|var)\s+setPresence\s*=/
const IDENTIFIER = /\bsetPresence\b/g

/**
 * 剥掉注释与字符串/模板字面量的**文本**，模板 `${...}` 插值里的代码保留。
 *
 * 不做这一层时，注释（`// 调用 matrixPresenceService.setPresence`）与日志模板
 * （`` logger.warn(`setPresence(online) 失败`) ``）里的同名字样会被误判成裸写。
 */
function stripCommentsAndStrings(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (ch === '/' && next === '/') {
      const lineEnd = source.indexOf('\n', i)
      i = lineEnd < 0 ? source.length : lineEnd
      continue
    }
    if (ch === '/' && next === '*') {
      const blockEnd = source.indexOf('*/', i + 2)
      i = blockEnd < 0 ? source.length : blockEnd + 2
      continue
    }
    if (ch === "'" || ch === '"') {
      i += 1
      while (i < source.length) {
        if (source[i] === '\\') i += 2
        else if (source[i] === ch) {
          i += 1
          break
        } else i += 1
      }
      out += "''"
      continue
    }
    if (ch === '`') {
      i += 1
      out += '`'
      while (i < source.length && source[i] !== '`') {
        if (source[i] === '\\') {
          i += 2
          continue
        }
        if (source[i] === '$' && source[i + 1] === '{') {
          let depth = 1
          i += 2
          const start = i
          while (i < source.length && depth > 0) {
            if (source[i] === '{') depth += 1
            else if (source[i] === '}') depth -= 1
            i += 1
          }
          out += stripCommentsAndStrings(source.slice(start, i - 1))
          continue
        }
        i += 1
      }
      i += 1
      out += '`'
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'typings') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc)
    } else if ((entry.endsWith('.ts') || entry.endsWith('.vue')) && !entry.endsWith('.d.ts')) {
      acc.push(full)
    }
  }
  return acc
}

/** 在剥掉注释/字符串后的源码里找出所有裸写（解构绕过、非门控接收者、无来源裸调）。 */
function findRawWrites(source: string): string[] {
  const code = stripCommentsAndStrings(source)
  const offenders: string[] = []
  const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length

  // 1) 解构绕过：`const { setPresence } = <来源>`，来源不是 useAccount 即违规。
  for (const match of code.matchAll(DESTRUCTURE)) {
    const sourceName = match[1]
    if (sourceName !== SANCTIONED_ALIAS_SOURCE) {
      offenders.push(
        `line ${lineOf(code, match.index ?? 0)}: 解构 setPresence 于 ${sourceName}（应经 useAccount 或唯一写入点）`
      )
    }
  }

  // 2) 去掉被允许的门控调用后，任何残留的 `.setPresence(` 都是裸写。
  const withoutGated = code.replace(GATED_CALL, 'GATED_CALL')
  for (const match of withoutGated.matchAll(RAW_PROPERTY_WRITE)) {
    const index = match.index ?? 0
    offenders.push(
      `line ${lineOf(withoutGated, index)}: ${withoutGated
        .slice(index, index + 60)
        .split('\n')[0]
        .trim()}`
    )
  }

  // 3) 既不声明包装器、也不从 useAccount 解构的文件里，裸出现 `setPresence` 标识符 = 来源不明。
  const declaresWrapper = WRAPPER_DECLARATION.test(withoutGated)
  const aliasesSanctionedSource = [...withoutGated.matchAll(DESTRUCTURE)].some(
    (match) => match[1] === SANCTIONED_ALIAS_SOURCE
  )
  if (!declaresWrapper && !aliasesSanctionedSource) {
    for (const match of withoutGated.matchAll(IDENTIFIER)) {
      offenders.push(`line ${lineOf(withoutGated, match.index ?? 0)}: 裸引用 setPresence（来源不明）`)
    }
  }
  return offenders
}

describe('presence 唯一写入点', () => {
  it('除 MatrixPresenceService / useAccount 委托外没有任何源码直接写 presence', () => {
    const files = collectSourceFiles(SRC_ROOT)
    const offenders: string[] = []

    for (const file of files) {
      if (file === SINGLE_WRITER) continue
      for (const hit of findRawWrites(readFileSync(file, 'utf8'))) {
        offenders.push(`${relative(REPO_ROOT, file)}: ${hit}`)
      }
    }

    // 防止「扫描目录为空所以永远通过」的假绿
    expect(files.length).toBeGreaterThan(100)
    expect(offenders).toEqual([])
  })

  it('唯一写入点自身确实执行 SDK 写入，且门控规则在其中生效', () => {
    const src = readFileSync(SINGLE_WRITER, 'utf8')

    expect(src).toMatch(/presenceManager\.setPresence\s*\(/)
    expect(src).toMatch(/resolveOutgoingPresence\s*\(/)
    expect(src).toMatch(/recordSentPresence\s*\(/)
  })

  it('守卫能识别解构绕过与注释误报（自证非空转）', () => {
    const bypass = 'const { setPresence } = matrixPresenceService\nsetPresence("online")\n'
    expect(findRawWrites(bypass).length).toBeGreaterThan(0)

    const commentOnly = '// matrixPresenceService.setPresence 是唯一写入点\nconst ok = 1\n'
    expect(findRawWrites(commentOnly)).toEqual([])

    const sanctionedAlias = 'const { setPresence } = useAccount()\nawait setPresence("online")\n'
    expect(findRawWrites(sanctionedAlias)).toEqual([])
  })
})
