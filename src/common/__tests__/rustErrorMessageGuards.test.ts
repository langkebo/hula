import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const rustRoot = resolve(root, 'src-tauri/src')

/** 与 check-ratchet 的 zh_literal_rust 同口径：区分代码与字符串，剥离注释。 */
function stripRustComments(content: string) {
  let out = ''
  let i = 0
  let inString = false
  while (i < content.length) {
    const ch = content[i]
    if (inString) {
      if (ch === '\\') {
        out += content.slice(i, i + 2)
        i += 2
        continue
      }
      if (ch === '"') inString = false
      out += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && content[i + 1] === '/') {
      const end = content.indexOf('\n', i)
      i = end === -1 ? content.length : end
      continue
    }
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2)
      i = end === -1 ? content.length : end + 2
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function collectRustFiles(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectRustFiles(path, out)
    } else if (entry.name.endsWith('.rs')) {
      out.push(path)
    }
  }
  return out
}

function readLocale(locale: string) {
  return JSON.parse(readFileSync(resolve(root, `locales/${locale}/error.json`), 'utf-8')) as {
    cmd?: Record<string, string>
  }
}

describe('Rust 侧运行期提示不得硬编码中文', () => {
  it('src-tauri/src 下所有字符串字面量都不含中文', () => {
    const offenders: string[] = []
    for (const file of collectRustFiles(rustRoot)) {
      for (const [index, line] of stripRustComments(readFileSync(file, 'utf-8')).split('\n').entries()) {
        for (const matched of line.match(/"[^"\n]*[\u4e00-\u9fff][^"\n]*"/g) ?? []) {
          offenders.push(`${relative(root, file)}:${index + 1} ${matched}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('命令错误码与前端文案一一对应', () => {
  it('每个 cmd_error 错误码都在中英文 error.cmd 中登记', () => {
    const codes = new Set<string>()
    for (const file of collectRustFiles(rustRoot)) {
      const source = readFileSync(file, 'utf-8')
      for (const matched of source.matchAll(/cmd_error(?:_with_detail)?\(\s*"([A-Z][A-Z0-9_]+)"/g)) {
        if (matched[1]) codes.add(matched[1].toLowerCase())
      }
    }

    const zh = readLocale('zh-CN').cmd ?? {}
    const en = readLocale('en').cmd ?? {}
    const missing = [...codes].sort().flatMap((code) => {
      const gap: string[] = []
      if (!zh[code]) gap.push(`zh-CN: error.cmd.${code}`)
      if (!en[code]) gap.push(`en: error.cmd.${code}`)
      return gap
    })

    expect(codes.size).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })
})
