import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 守卫：`<svg>` 不能再被当成"可点但不可聚焦"的元素。
 *
 * 背景（见 docs/TJG-桌面端界面评审报告-2026-11-24.md 附录 D）：
 * 全仓曾有 46 处把 `@click` 挂在 `<svg>` 上，其中
 *  - 37 处带 `aria-hidden="true"`：ARIA 规范禁止 aria-hidden 元素承载可聚焦内容，
 *    这种写法连补 tabindex 都无效；
 *  - 9 处已有 `role="button"` + `aria-label`，只缺 `tabindex`：有名字、没焦点。
 *
 * 本守卫只覆盖第二类（已修完那批），锁住"role=button 的 svg 必须键盘可达"。
 * 第一类要等拆 `aria-hidden` 时再逐批收紧，现在设为 37 会把 lint 打红后被 --no-verify 绕过。
 */

const SRC_DIR = path.resolve(__dirname, '../../')

function collectVueFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      collectVueFiles(full, out)
    } else if (entry.name.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

interface SvgClickSite {
  file: string
  line: number
  tag: string
}

/** 抓所有"带 @click 的 <svg …>…</svg>"整块（含内部 `<use>`，用于识别关闭图标）。 */
function findCloseIconSites(): SvgClickSite[] {
  const sites: SvgClickSite[] = []
  for (const file of collectVueFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, 'utf-8')
    const blockPattern = /<svg\b[^>]*>[\s\S]*?<\/svg>/gs
    let match: RegExpExecArray | null = blockPattern.exec(source)
    while (match !== null) {
      if (/@click/.test(match[0]) && /href="#close"/.test(match[0])) {
        sites.push({
          file: path.relative(SRC_DIR, file),
          line: source.slice(0, match.index).split('\n').length,
          tag: match[0]
        })
      }
      match = blockPattern.exec(source)
    }
  }
  return sites
}

/** 抓所有"带 @click 的 <svg …>"开标签（属性可跨行）。 */
function findSvgClickSites(): SvgClickSite[] {
  const sites: SvgClickSite[] = []
  for (const file of collectVueFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, 'utf-8')
    // [^>]* 跨行匹配：ActionList.vue / definePlugins/index.vue 的属性都是多行的，
    // 单行 grep 会漏，这正是当初把 46 处误报成 9 处的原因。
    const tagPattern = /<svg\b[^>]*>/gs
    let match: RegExpExecArray | null = tagPattern.exec(source)
    while (match !== null) {
      if (/@click/.test(match[0])) {
        sites.push({
          file: path.relative(SRC_DIR, file),
          line: source.slice(0, match.index).split('\n').length,
          tag: match[0]
        })
      }
      match = tagPattern.exec(source)
    }
  }
  return sites
}

describe('svg 可交互守卫', () => {
  const sites = findSvgClickSites()

  it('能抓到 <svg> 上的 @click（守卫自身不能空转）', () => {
    // 分母断言：若哪天重构导致正则失配，这里先红，避免"0 违规"的假绿。
    expect(sites.length).toBeGreaterThan(0)
  })

  it('声明 role="button" 的 <svg> 必须键盘可达（tabindex 或 v-clickable）', () => {
    const violations = sites
      .filter((site) => /role\s*=\s*"button"/.test(site.tag))
      .filter((site) => !/\btabindex\b/.test(site.tag) && !/\bv-clickable\b/.test(site.tag))
      .map((site) => `${site.file}:${site.line}`)

    expect(violations).toEqual([])
  })

  it('键盘可达的 <svg> 不能再用 outline-none 压制焦点环', () => {
    // 补了 tabindex 却留着 outline-none，等于"能聚焦但看不见" —— 比不可聚焦更难排查。
    const violations = sites
      .filter((site) => /\b(tabindex|v-clickable)\b/.test(site.tag))
      .filter((site) => /outline-none/.test(site.tag))
      .map((site) => `${site.file}:${site.line}`)

    expect(violations).toEqual([])
  })

  it('把 <use href="#close"> 当关闭按钮用时，不得再挂 aria-hidden', () => {
    // 关闭图标是最典型的"看得见但 Tab 不到"：`aria-hidden` 让它对读屏消失，
    // 而 @click 又让它承担了交互 —— 两种写法互斥。
    // 例外：X 图标被拿来当"删除某条记录"（handler 里带 delete-account），
    // 那不是关闭语义，标签应跟随删除流程，故按 handler 排除而不是按文件排除。
    const violations = findCloseIconSites()
      .filter((site) => !/delete-account/.test(site.tag))
      .filter((site) => /aria-hidden/.test(site.tag))
      .map((site) => `${site.file}:${site.line}`)

    expect(violations).toEqual([])
  })
})
