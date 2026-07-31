import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MOBILE_DIR = join(process.cwd(), 'src/mobile')
const EXEMPT_FILES = ['NaiveProvider.vue']

function walkVueFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkVueFiles(full, acc)
    else if (extname(entry.name) === '.vue') acc.push(full)
  }
  return acc
}

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g

describe('no hardcoded colors in mobile vue files', () => {
  const files = walkVueFiles(MOBILE_DIR)
  for (const file of files) {
    const basename = file.split('/').pop()!
    if (EXEMPT_FILES.includes(basename)) continue
    it(`${basename} should not contain hardcoded hex colors`, () => {
      const content = readFileSync(file, 'utf-8')
      // 移除注释、url() 中的色值，以及 canvas 上下文赋值
      const cleaned = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/url\([^)]*\)/g, '')
        .replace(/ctx\.\w+\s*=\s*['"][^'"]+['"]/g, '')
      const matches = cleaned.match(HEX_RE) ?? []
      expect(matches, `Found hardcoded colors in ${file}: ${matches.join(', ')}`).toHaveLength(0)
    })
  }
})
