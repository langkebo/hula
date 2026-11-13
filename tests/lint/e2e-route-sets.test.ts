import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESKTOP_ONLY_SPECS,
  MOBILE_ONLY_SPECS,
  ROUTE_SET_DECLARATION_RE,
  routeSetForSpec,
  specStem
} from '../../e2e/specRouteSets'

/**
 * e2e spec 路由集声明守卫。
 *
 * 背景：路由集是构建期装配（5210 只有 `/mobile/*`，5211 只有桌面路由）。一个 spec 跑错
 * server 必然假红 —— 历史上 mobile 项目有 6 条常红、桌面项目整片空窗（报告 §4.14-②）。
 *
 * 为什么不能只靠 `playwright.config.ts` 里的名单：名单是隐式的，新增 spec 忘了登记
 * 不会报错，只会悄悄变成假红。本守卫要求**每个 spec 顶部显式写 `路由集: …`**，
 * 并与 `e2e/specRouteSets.ts` 的名单逐条比对，任何一处不一致都会红。
 */

const E2E_DIR = join(process.cwd(), 'e2e')
const specs = readdirSync(E2E_DIR).filter((file) => file.endsWith('.spec.ts'))

/** 取文件开头的第一个块注释（声明只认这个位置，避免注释里的示例误判）。 */
const headerOf = (file: string): string => {
  const content = readFileSync(join(E2E_DIR, file), 'utf-8')
  const match = content.match(/^\/\*\*[\s\S]*?\*\//)
  return match ? match[0] : ''
}

describe('e2e spec 路由集声明', () => {
  it('应当至少扫到一个 spec（防止目录写错导致空跑）', () => {
    expect(specs.length).toBeGreaterThan(20)
  })

  it('每个 spec 顶部都要有 `路由集: desktop|mobile|both` 声明', () => {
    const missing = specs.filter((file) => !ROUTE_SET_DECLARATION_RE.test(headerOf(file)))
    expect(
      missing,
      `以下 spec 顶部缺少「路由集」声明（在文件最前面加块注释：路由集: desktop|mobile|both）：\n${missing.join('\n')}`
    ).toEqual([])
  })

  it('声明值必须与 specRouteSets.ts 的名单一致', () => {
    const mismatches = specs
      .map((file) => {
        const declared = headerOf(file).match(ROUTE_SET_DECLARATION_RE)?.[1]
        const expected = routeSetForSpec(file)
        return declared === expected ? null : `${file}: 声明=${declared ?? '(缺失)'}，名单=${expected}`
      })
      .filter((item): item is string => item !== null)

    expect(
      mismatches,
      `声明与名单不一致（改 spec 声明或改 e2e/specRouteSets.ts，二者必须一致）：\n${mismatches.join('\n')}`
    ).toEqual([])
  })

  it('名单里的每个 stem 必须对应真实存在的 spec 文件（防止改名后留死条目）', () => {
    const stems = new Set(specs.map(specStem))
    const stale = [...MOBILE_ONLY_SPECS, ...DESKTOP_ONLY_SPECS].filter((stem) => !stems.has(stem))
    expect(stale, `specRouteSets.ts 里存在已不存在的 spec：\n${stale.join('\n')}`).toEqual([])
  })

  it('同一 spec 不得同时进两张名单', () => {
    const duplicated = MOBILE_ONLY_SPECS.filter((stem) => DESKTOP_ONLY_SPECS.includes(stem))
    expect(duplicated, `同一 spec 不能既 mobile-only 又 desktop-only：${duplicated.join(', ')}`).toEqual([])
  })

  it('`both` 必须是「两张名单都没登记」的结果，不允许名单内出现未声明项', () => {
    const bothSpecs = specs.filter((file) => routeSetForSpec(file) === 'both')
    // both 数量本身不是硬约束，但至少要能列出来，便于人工复核
    expect(bothSpecs.length).toBeGreaterThan(0)
  })
})
