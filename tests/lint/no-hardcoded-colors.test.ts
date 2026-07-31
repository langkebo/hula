import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MOBILE_DIR = join(process.cwd(), 'src/mobile')
const COMPONENTS_DIR = join(process.cwd(), 'src/components')
const SCSS_DIR = join(process.cwd(), 'src/styles/scss')

const EXEMPT_VUE = ['NaiveProvider.vue', 'LocationMap.vue']
const EXEMPT_SCSS = ['login-bg.scss']

function walkFiles(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, exts, acc)
    else if (exts.includes(extname(entry.name))) acc.push(full)
  }
  return acc
}

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g

function cleanContent(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/url\([^)]*\)/g, '')
    .replace(/ctx\.\w+\s*=\s*['"][^'"]+['"]/g, '')
    .replace(/(?:xlink:)?href="#[\w-]+"/g, '')
}

describe('no hardcoded colors in mobile vue files', () => {
  const files = walkFiles(MOBILE_DIR, ['.vue'])
  for (const file of files) {
    const basename = file.split('/').pop()!
    if (EXEMPT_VUE.includes(basename)) continue
    it(`${basename} should not contain hardcoded hex colors`, () => {
      const content = readFileSync(file, 'utf-8')
      const matches = cleanContent(content).match(HEX_RE) ?? []
      expect(matches, `Found hardcoded colors in ${file}: ${matches.join(', ')}`).toHaveLength(0)
    })
  }
})

describe('no hardcoded colors in desktop vue files', () => {
  const files = walkFiles(COMPONENTS_DIR, ['.vue'])
  for (const file of files) {
    const basename = file.split('/').pop()!
    if (EXEMPT_VUE.includes(basename)) continue
    it(`${basename} should not contain hardcoded hex colors`, () => {
      const content = readFileSync(file, 'utf-8')
      const matches = cleanContent(content).match(HEX_RE) ?? []
      expect(matches, `Found hardcoded colors in ${file}: ${matches.join(', ')}`).toHaveLength(0)
    })
  }
})

describe('no hardcoded colors in scss files', () => {
  const files = walkFiles(SCSS_DIR, ['.scss'])
  for (const file of files) {
    const basename = file.split('/').pop()!
    if (EXEMPT_SCSS.includes(basename)) continue
    it(`${basename} should not contain hardcoded hex colors`, () => {
      const content = readFileSync(file, 'utf-8')
      const matches = cleanContent(content).match(HEX_RE) ?? []
      expect(matches, `Found hardcoded colors in ${file}: ${matches.join(', ')}`).toHaveLength(0)
    })
  }
})
