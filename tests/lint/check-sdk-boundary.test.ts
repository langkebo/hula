import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifySpecifier,
  collectViolations,
  dedupeViolations,
  evaluateGate,
  keyOf,
  scanFileText,
  stripComments
} from '../../scripts/check-sdk-boundary.mjs'

const projectRoot = join(__dirname, '..', '..')
const srcRoot = join(projectRoot, 'src')
const baselineFile = join(projectRoot, 'scripts', 'sdk-boundary-baseline.json')

function loadBaseline(): { count: number; violations: Set<string> } {
  const parsed = JSON.parse(readFileSync(baselineFile, 'utf8'))
  return {
    count: Number(parsed.count ?? parsed.violations.length),
    violations: new Set<string>(parsed.violations)
  }
}

/** Minimal import-channel violation factory that mirrors collectViolations output. */
function importViolation(file: string, specifier: string, dynamic = false) {
  const classification = classifySpecifier(specifier, dynamic)
  return {
    file,
    specifier,
    kind: classification.kind,
    subpath: classification.subpath,
    dynamic
  }
}

describe('check-sdk-boundary: scanFileText 识别三种 import 形态', () => {
  it('识别 bare / subpath / 多行 / export-from 静态导入', () => {
    const text = [
      "import { MatrixClient } from 'matrix-js-sdk'",
      "import type { Room } from 'matrix-js-sdk/dm'",
      'import {',
      '  SlidingSync',
      "} from 'matrix-js-sdk/sliding-sync'",
      "export { Visibility } from 'matrix-js-sdk'"
    ].join('\n')
    const specifiers = scanFileText(text)
      .map((i: { specifier: string }) => i.specifier)
      .sort()
    expect(specifiers).toEqual(['matrix-js-sdk', 'matrix-js-sdk', 'matrix-js-sdk/dm', 'matrix-js-sdk/sliding-sync'])
  })

  it('识别动态 import 并标记 dynamic=true', () => {
    const text = ["const core = await import('matrix-js-sdk/core')", "type T = typeof import('matrix-js-sdk')"].join(
      '\n'
    )
    const found = scanFileText(text)
    expect(found).toHaveLength(2)
    expect(found.every((i: { dynamic: boolean }) => i.dynamic)).toBe(true)
  })

  it('注释中的 matrix-js-sdk 不计入违规', () => {
    const text = [
      "// import { MatrixClient } from 'matrix-js-sdk'",
      '/*',
      " * import { Room } from 'matrix-js-sdk/dm'",
      ' */',
      "const label = 'matrix-js-sdk'"
    ].join('\n')
    expect(scanFileText(text)).toHaveLength(0)
  })

  it('stripComments 保留行数（偏移稳定）并跳过字符串内的 // ', () => {
    const text = 'const url = "https://x"\n// trailing\nconst a = 1'
    const stripped = stripComments(text)
    expect(stripped.split('\n')).toHaveLength(3)
    expect(stripped).toContain('https://x')
    expect(stripped).not.toContain('trailing')
  })
})

describe('check-sdk-boundary: classifySpecifier / keyOf', () => {
  it('bare 与 subpath 分类正确', () => {
    expect(classifySpecifier('matrix-js-sdk', false)).toEqual({ kind: 'bare', subpath: null })
    expect(classifySpecifier('matrix-js-sdk/dm', false)).toEqual({ kind: 'subpath', subpath: 'dm' })
  })

  it('dynamic 后缀叠加到 kind 上', () => {
    expect(classifySpecifier('matrix-js-sdk', true).kind).toBe('bare-dynamic')
    expect(classifySpecifier('matrix-js-sdk/core', true).kind).toBe('subpath-dynamic')
  })

  it('keyOf 对同文件同类导入稳定，dynamic 与静态不冲突', () => {
    const a = importViolation('src/x.ts', 'matrix-js-sdk')
    const b = importViolation('src/x.ts', 'matrix-js-sdk', true)
    expect(keyOf(a)).toBe('src/x.ts::matrix-js-sdk')
    expect(keyOf(b)).toBe('src/x.ts::matrix-js-sdk::dynamic')
  })
})

describe('check-sdk-boundary: dedupeViolations 折叠重复口径（AR-03 缺陷回归守卫）', () => {
  it('同文件重复 import 折叠为一条', () => {
    const raw = [
      importViolation('src/x.ts', 'matrix-js-sdk'),
      importViolation('src/x.ts', 'matrix-js-sdk'),
      importViolation('src/x.ts', 'matrix-js-sdk'),
      importViolation('src/y.ts', 'matrix-js-sdk/dm')
    ]
    const deduped = dedupeViolations(raw)
    expect(raw).toHaveLength(4)
    expect(deduped).toHaveLength(2)
  })

  it('保留首次出现顺序', () => {
    const raw = [
      importViolation('src/b.ts', 'matrix-js-sdk'),
      importViolation('src/a.ts', 'matrix-js-sdk'),
      importViolation('src/b.ts', 'matrix-js-sdk')
    ]
    expect(dedupeViolations(raw).map((v: { file: string }) => v.file)).toEqual(['src/b.ts', 'src/a.ts'])
  })
})

describe('check-sdk-boundary: evaluateGate 判据', () => {
  it('无基线时非 strict 不阻断，strict 有违规即阻断', () => {
    const raw = [importViolation('src/x.ts', 'matrix-js-sdk')]
    expect(evaluateGate(raw, null).failed).toBe(false)
    expect(evaluateGate(raw, null).hasBaseline).toBe(false)
    expect(evaluateGate(raw, null, { strict: true }).failed).toBe(true)
  })

  it('全部命中基线时不阻断', () => {
    const raw = [importViolation('src/x.ts', 'matrix-js-sdk')]
    const baseline = { count: 1, violations: new Set(['src/x.ts::matrix-js-sdk']) }
    const result = evaluateGate(raw, baseline)
    expect(result.regressed).toHaveLength(0)
    expect(result.countRegression).toBe(false)
    expect(result.failed).toBe(false)
  })

  it('出现基线外新 key 时判回归', () => {
    const raw = [importViolation('src/new.ts', 'matrix-js-sdk')]
    const baseline = { count: 0, violations: new Set<string>() }
    const result = evaluateGate(raw, baseline)
    expect(result.regressed).toHaveLength(1)
    expect(result.failed).toBe(true)
  })

  it('计数超过基线时触发计数棘轮（去重口径）', () => {
    // raw 含重复行：去重后 1 条；基线 count=0 → 计数回归。
    const raw = [importViolation('src/x.ts', 'matrix-js-sdk'), importViolation('src/x.ts', 'matrix-js-sdk')]
    const baseline = { count: 0, violations: new Set<string>() }
    const result = evaluateGate(raw, baseline)
    expect(result.current).toHaveLength(1)
    expect(result.countRegression).toBe(true)
    expect(result.failed).toBe(true)
  })

  it('去重后计数不超基线时，重复 import 行不会造成假阳性回归', () => {
    const raw = [importViolation('src/x.ts', 'matrix-js-sdk'), importViolation('src/x.ts', 'matrix-js-sdk')]
    const baseline = { count: 1, violations: new Set(['src/x.ts::matrix-js-sdk']) }
    const result = evaluateGate(raw, baseline)
    expect(result.countRegression).toBe(false)
    expect(result.failed).toBe(false)
  })

  it('已解决项进入 fixed', () => {
    const raw = [importViolation('src/x.ts', 'matrix-js-sdk')]
    const baseline = {
      count: 2,
      violations: new Set(['src/x.ts::matrix-js-sdk', 'src/gone.ts::matrix-js-sdk'])
    }
    expect(evaluateGate(raw, baseline).fixed).toEqual(['src/gone.ts::matrix-js-sdk'])
  })
})

describe('check-sdk-boundary: 当前代码树自洽', () => {
  // 全量并行跑测试时，扫描全仓 1300+ 文件会超过 Vitest 默认 5s，这里显式放宽。
  it('真实扫描结果相对真实基线不阻断（门禁绿）', { timeout: 60_000 }, async () => {
    const baseline = loadBaseline()
    const { violations, scanned } = await collectViolations(srcRoot)
    expect(scanned).toBeGreaterThan(0)
    const result = evaluateGate(violations, baseline)
    expect(result.failed).toBe(false)
    expect(result.regressed).toEqual([])
  })
})
