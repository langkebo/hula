import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeContractDiff, distinctPathsFromManifest } from '../../scripts/check-bare-matrix-paths.mjs'

const projectRoot = join(__dirname, '..', '..')
const authorityFile = join(projectRoot, 'scripts', 'contract-authority-paths.json')
const registeredFile = join(projectRoot, 'scripts', 'contract-judgment-diff-registered.json')
const siblingManifest = join(
  projectRoot,
  '..',
  'matrix-js-sdk',
  'docs',
  'api-contract',
  'generated',
  'route-manifest.all.json'
)

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

describe('C-1 contract judgment parity: 后端权威 distinct path 与判据面口径', () => {
  it('distinctPathsFromManifest 抽取 distinct path 集（去重 (method,path) 条目）', () => {
    const manifest = {
      entries: [
        { method: 'GET', path: '/a' },
        { method: 'POST', path: '/a' },
        { method: 'GET', path: '/b' }
      ]
    }
    expect(Array.from(distinctPathsFromManifest(manifest)).sort()).toEqual(['/a', '/b'])
  })

  it('computeContractDiff 区分未登记缺口与已登记剩余项', () => {
    const authorityPaths = new Set(['/a', '/b', '/c'])
    const surfacePaths = new Set(['/a'])
    const diff = computeContractDiff({
      authorityPaths,
      surfacePaths,
      registeredPaths: ['/b']
    })
    expect(diff.missingFromSurface).toEqual(['/c'])
    expect(diff.registeredRemaining).toEqual(['/b'])
  })

  it('本地权威快照自洽：distinct_path_count === paths.length，唯一且有序', () => {
    const snapshot = readJson(authorityFile) as {
      entry_count: number
      distinct_path_count: number
      paths: string[]
    }
    expect(Array.isArray(snapshot.paths)).toBe(true)
    expect(snapshot.paths.length).toBeGreaterThan(0)
    expect(new Set(snapshot.paths).size).toBe(snapshot.paths.length)
    expect(snapshot.distinct_path_count).toBe(snapshot.paths.length)
    // entry_count 是 (method, path) 条目数 ⇒ 必 ≥ distinct path 数
    expect(snapshot.entry_count).toBeGreaterThanOrEqual(snapshot.distinct_path_count)
    expect(snapshot.paths.every((p) => p.startsWith('/'))).toBe(true)
    // 已排序（便于 diff/漂移比对稳定）
    const sorted = [...snapshot.paths].sort()
    expect(snapshot.paths).toEqual(sorted)
  })

  it('登记表结构合法：每条剩余项都有 path 与非空 reason', () => {
    const table = readJson(registeredFile) as { registered: Array<{ path?: string; reason?: string }> }
    expect(Array.isArray(table.registered)).toBe(true)
    for (const entry of table.registered) {
      expect(typeof entry.path).toBe('string')
      expect(entry.path?.startsWith('/')).toBe(true)
      expect(typeof entry.reason).toBe('string')
      expect((entry.reason ?? '').trim().length).toBeGreaterThan(0)
    }
  })

  // 漂移检测：sibling manifest 在场时（本地/SDK 协同开发），权威快照必须与之一致；
  // CI 无 sibling 时跳过（此处即 CI 的降级路径 —— 快照本身已保证判据面为 814）。
  it.skipIf(!existsSync(siblingManifest))(
    '本地权威快照与 sibling 新鲜 manifest 的 distinct path 集完全一致（无漂移）',
    () => {
      const snapshot = readJson(authorityFile) as { paths: string[] }
      const fresh = distinctPathsFromManifest(readJson(siblingManifest) as { entries: unknown[] })
      const vendored = new Set(snapshot.paths)
      const onlyFresh = Array.from(fresh).filter((p) => !vendored.has(p))
      const onlyVendored = Array.from(vendored).filter((p) => !fresh.has(p))
      expect({ onlyFresh, onlyVendored }).toEqual({ onlyFresh: [], onlyVendored: [] })
    }
  )
})
