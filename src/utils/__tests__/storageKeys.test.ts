import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_STORAGE_KEYS,
  E2E_STORAGE_KEYS,
  MATRIX_HOMESERVER_STORAGE_KEY,
  MATRIX_IDENTITY_SERVER_STORAGE_KEY,
  MATRIX_SESSION_HOMESERVER_STORAGE_KEY,
  MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY
} from '../storageKeys'

// vitest 会把 `import.meta.url` 改写成 root 相对路径（`file:///src/...`），
// 不能用它推仓库根；vitest 的 cwd 恒为仓库根（scripts/run-vitest.js 保证）。
const REPO_ROOT = process.cwd()
const E2E_DIR = join(REPO_ROOT, 'e2e')
const DEBUG_SCRIPT = join(REPO_ROOT, 'scripts/debug-matrix-live-import.mjs')

/** 存储键字面量：`tjg` / `hula` 前缀的单双引号或反引号包裹字符串。 */
const KEY_LITERAL = /['"`](tjg|hula)[:'-][^'"`\n]*['"`]/g

const collectTsFiles = (dir: string): string[] => {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full))
      continue
    }
    if (entry.endsWith('.ts') || entry.endsWith('.mjs')) {
      files.push(full)
    }
  }
  return files
}

const readText = (file: string): string => readFileSync(file, 'utf-8')

const extractKeyLiterals = (text: string): string[] =>
  (text.match(KEY_LITERAL) ?? []).map((literal) => literal.slice(1, -1))

describe('storageKeys（F-8 存储键漂移守卫）', () => {
  it('所有键都带 tjg 前缀且互不重复', () => {
    expect(ALL_STORAGE_KEYS.length).toBe(new Set(ALL_STORAGE_KEYS).size)
    for (const key of ALL_STORAGE_KEYS) {
      expect(key, `${key} 必须以 tjg 开头`).toMatch(/^tjg/)
    }
  })

  it('导出常量与历史键值一致（改名即视为破坏兼容，需显式迁移）', () => {
    expect(E2E_STORAGE_KEYS).toEqual({
      enabled: 'tjg:e2e:enabled',
      mockAuth: 'tjg:e2e:mock-auth',
      platform: 'tjg:e2e:platform'
    })
    expect([
      MATRIX_HOMESERVER_STORAGE_KEY,
      MATRIX_IDENTITY_SERVER_STORAGE_KEY,
      MATRIX_SESSION_HOMESERVER_STORAGE_KEY,
      MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY
    ]).toEqual([
      'tjg-homeserver-url',
      'tjg-identity-server-url',
      'tjg-session-homeserver-url',
      'tjg-session-identity-server-url'
    ])
  })

  it('e2e 与调试脚本不得再出现旧品牌前缀的键字面量', () => {
    const offenders: string[] = []
    for (const file of [...collectTsFiles(E2E_DIR), DEBUG_SCRIPT]) {
      for (const literal of extractKeyLiterals(readText(file))) {
        if (literal.startsWith('hula')) {
          offenders.push(`${relative(REPO_ROOT, file)} → ${literal}`)
        }
      }
    }
    expect(offenders, '发现旧品牌存储键，统一改用 src/utils/storageKeys（F-8）').toEqual([])
  })

  it('e2e 中出现的 tjg 键字面量必须命中已声明键集合', () => {
    const unknown = new Set<string>()
    for (const file of collectTsFiles(E2E_DIR)) {
      for (const literal of extractKeyLiterals(readText(file))) {
        if (literal.startsWith('tjg') && !ALL_STORAGE_KEYS.includes(literal)) {
          unknown.add(`${relative(REPO_ROOT, file)} → ${literal}`)
        }
      }
    }
    expect([...unknown], '未声明的存储键（拼写漂移）').toEqual([])
  })

  it('src 侧消费方与 e2e support 都必须从 storageKeys 取值', () => {
    const consumers = ['src/utils/AppHarness.ts', 'src/utils/platformDetection.ts', 'src/services/backend/config.ts']
    for (const consumer of consumers) {
      expect(readText(join(REPO_ROOT, consumer)), `${consumer} 未复用 storageKeys`).toMatch(
        /from '@\/utils\/storageKeys'/
      )
    }
    for (const support of ['e2e/support/session.ts', 'e2e/support/matrixLive.ts']) {
      expect(readText(join(REPO_ROOT, support)), `${support} 未复用 storageKeys`).toMatch(
        /from '\.\.\/\.\.\/src\/utils\/storageKeys'/
      )
    }
  })
})
