/**
 * MessageLockBadge 样式可达性契约测试
 *
 * 为什么不能只做正则断言：
 * SCSS 的 `&` 嵌套会让「看起来对」的选择器编译成**复合选择器**。
 * 例如 `.msg-lock-badge__icon { &.msg-lock-badge--verified { color: X } }`
 * 会编译为 `.msg-lock-badge__icon.msg-lock-badge--verified` —— 要求两个类
 * 同时出现在**同一个元素**上。而模板把 `--verified` 放在根 span、把
 * `__icon` 放在 svg 上，DOM 中二者永不共存 → 三态配色静默失效，
 * 任何「断言 class 存在」的测试都会继续通过。
 *
 * 因此本测试采用「编译 + 真实 DOM 校验」：
 * 1. 从 SFC 抽取 <style lang="scss"> 并用 sass 真实编译（与构建同源）
 * 2. 逐个信任等级挂载组件，收集真实 DOM 的 class 集合
 * 3. 对每条含 color 声明的选择器，断言其 class token 在 DOM 中可达
 *
 * 覆盖范围与限制：
 * - ✅ 选择器可达性（catch 复合选择器永不匹配）
 * - ✅ 三态配色逐级可达（verified / unverified / risk 都不能丢色）
 * - ✅ 外环 ::after 的定位上下文（防止绝对定位逃逸到最近定位祖先）
 * - ✅ __icon 不得声明 color（否则会遮蔽三态配色）
 * - ❌ 不覆盖：真实浏览器中的最终像素颜色（需视觉回归 / 人工验收）
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import * as sass from 'sass'
import { describe, expect, it } from 'vitest'
import MessageLockBadge from '../MessageLockBadge.vue'

const SFC_PATH = resolve(__dirname, '..', 'MessageLockBadge.vue')

type TrustLevel = 'verified' | 'unverified' | 'risk'
const LEVELS: TrustLevel[] = ['verified', 'unverified', 'risk']

interface CompiledRule {
  selector: string
  body: string
}

interface ElementClasses {
  tag: string
  classes: string[]
}

/** 抽取 SFC 的 SCSS 样式块 */
function readStyleBlock(): string {
  const sfc = readFileSync(SFC_PATH, 'utf-8')
  const match = sfc.match(/<style[^>]*lang="scss"[^>]*>([\s\S]*?)<\/style>/)
  if (!match) throw new Error('MessageLockBadge.vue 中未找到 <style lang="scss"> 块')
  return match[1]
}

/** 用与构建同源的 sass 编译样式块，并拍平成 { selector, body } 列表 */
function compileRules(): CompiledRule[] {
  // sass 会保留注释，且样式块含中文时会在顶部插入 `@charset "UTF-8";`，
  // 两者都必须先剥离，否则首条规则的 selector 会带上这些前缀
  const css = sass
    .compileString(readStyleBlock())
    .css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@charset[^;]*;/g, '')
  const rules: CompiledRule[] = []
  // 编译产物是扁平规则，无嵌套
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null = rulePattern.exec(css)
  while (match !== null) {
    rules.push({ selector: match[1].trim(), body: match[2].trim() })
    match = rulePattern.exec(css)
  }
  return rules
}

/** 提取选择器中的 class token（用于判断可达性） */
function classTokens(selector: string): string[] {
  return (selector.match(/\.[-A-Za-z0-9_]+/g) ?? []).map((token) => token.slice(1))
}

/** 挂载组件并收集真实 DOM 中每个元素的 class 集合 */
function collectElementClasses(trustLevel: TrustLevel): ElementClasses[] {
  // showLabel: true —— 让 __label 元素真实渲染，否则会把它的配色误判为不可达
  const wrapper = mount(MessageLockBadge, { props: { trustLevel, showLabel: true } })
  const host = wrapper.element as Element
  const elements: Element[] = [host, ...Array.from(host.querySelectorAll('*'))]
  return elements.map((element) => ({
    tag: element.tagName.toLowerCase(),
    classes: Array.from(element.classList)
  }))
}

/** 选择器是否在真实 DOM 中可达：必须存在某元素同时拥有其全部 class token */
function isReachable(selector: string, elements: ElementClasses[]): boolean {
  const tokens = classTokens(selector)
  if (tokens.length === 0) return true // 纯元素/伪元素选择器不适用
  return elements.some((element) => tokens.every((token) => element.classes.includes(token)))
}

const hasColorDeclaration = (body: string): boolean => /(^|[;\s])color\s*:/.test(body)

describe('MessageLockBadge 样式可达性', () => {
  const rules = compileRules()
  const colorRules = rules.filter((rule) => hasColorDeclaration(rule.body))

  it('前置校验：样式块应能编译出含 color 的规则（防止测试空转）', () => {
    expect(rules.length).toBeGreaterThan(0)
    expect(colorRules.length).toBeGreaterThanOrEqual(3)
  })

  it.each(LEVELS)('trustLevel=%s 时，所有含 color 声明的选择器都必须可达', (level) => {
    const elements = collectElementClasses(level)
    // 只校验「当前等级」与「等级无关」的规则：
    // 挂载某个等级时，其它等级的修饰类天然不在 DOM 中，属于合法的未激活状态
    const inScope = colorRules.filter(
      (rule) => !LEVELS.some((other) => other !== level && rule.selector.includes(`msg-lock-badge--${other}`))
    )
    const unreachable = inScope.filter((rule) => !isReachable(rule.selector, elements)).map((rule) => rule.selector)

    expect(unreachable, `以下选择器的 class 组合在 DOM 中不存在，配色会静默失效：\n${unreachable.join('\n')}`).toEqual(
      []
    )
  })

  it.each(LEVELS)('trustLevel=%s 必须有可达的专属 color 声明', (level) => {
    const elements = collectElementClasses(level)
    const reachable = colorRules.filter(
      (rule) => rule.selector.includes(`msg-lock-badge--${level}`) && isReachable(rule.selector, elements)
    )
    expect(reachable.length, `${level} 状态没有任何可达的配色规则`).toBeGreaterThan(0)
  })

  it('三态配色必须落在根元素的修饰类上（而非 __icon 的复合选择器）', () => {
    for (const level of LEVELS) {
      const offenders = colorRules.filter(
        (rule) =>
          rule.selector.includes(`msg-lock-badge--${level}`) &&
          classTokens(rule.selector).includes('msg-lock-badge__icon')
      )
      expect(
        offenders.map((rule) => rule.selector),
        `${level} 的配色写在了 __icon 的复合选择器上，DOM 中永不匹配；应改为根元素修饰类 + currentColor 继承`
      ).toEqual([])
    }
  })

  it('__icon 规则不得自行声明 color（否则遮蔽三态配色）', () => {
    const iconRule = rules.find((rule) => rule.selector === '.msg-lock-badge__icon')
    expect(iconRule, '缺少 .msg-lock-badge__icon 规则').toBeDefined()
    expect(hasColorDeclaration(iconRule?.body ?? ''), '.msg-lock-badge__icon 不应声明 color').toBe(false)
  })

  it('外环 ::after 必须有其宿主元素的定位上下文', () => {
    const ringRule = rules.find(
      (rule) => rule.selector.includes('::after') && /position\s*:\s*absolute/.test(rule.body)
    )
    expect(ringRule, '缺少使用绝对定位的 ::after 规则').toBeDefined()

    // 宿主必须是根元素（.msg-lock-badge--ring 与 .msg-lock-badge 同元素）
    const hostTokens = classTokens(ringRule?.selector ?? '')
    expect(hostTokens).toContain('msg-lock-badge--ring')

    const rootRule = rules.find((rule) => rule.selector === '.msg-lock-badge')
    expect(rootRule, '缺少 .msg-lock-badge 规则').toBeDefined()
    expect(
      rootRule?.body ?? '',
      '.msg-lock-badge 必须声明 position: relative，否则 ::after 外环会逃逸到最近定位祖先'
    ).toMatch(/position\s*:\s*relative/)
  })
})
