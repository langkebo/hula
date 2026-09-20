/**
 * GroupDetails hero 卡契约测试
 *
 * 背景：`Details.vue` 中 SingleDetails（单聊）与 GroupDetails（群聊）互斥渲染，
 * 二者共用同一个右侧面板容器（`.details-panel`，padding 24px 20px）。此前单聊有
 * 玻璃 hero 卡、群聊没有，且 GroupDetails 只 `@use` 了 liquid-glass mixin 却从未
 * `@include`（死导入），导致两种详情面板视觉规格不一致。
 *
 * 本测试守护修复后的**规格一致性**：
 * - 群聊 hero 卡存在，且包住头像上传/展示与群名编辑
 * - 两种 hero 卡的几何（圆角/内边距/间距/宽度）与玻璃参数完全一致
 * - 双方都走带降级的 `liquid-glass-panel` 变体
 * - 群聊面板顶部偏移与单聊的 `padding: 8px 0` 对齐
 *
 * 反馈循环策略：目标约束是 SCSS/模板源码文本（happy-dom 无法计算 backdrop-filter
 * 生效值与布局几何），故沿用仓库既有做法以源码断言建立 red-capable 循环。
 *
 * 未覆盖（需人工/视觉回归验收）：真实渲染后的像素位置、低性能设备上的降级观感。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..')
const GROUP_DETAILS = resolve(ROOT, 'src/components/rightBox/GroupDetails.vue')
const SINGLE_DETAILS = resolve(ROOT, 'src/components/rightBox/SingleDetails.vue')

const read = (p: string) => readFileSync(p, 'utf-8')

/** 提取 `.selector { ... }` 规则块（取第一个匹配，支持单层嵌套之外的一级块） */
function extractRule(source: string, selector: string): string | null {
  const pattern = new RegExp(`\\${selector}\\s*\\{([\\s\\S]*?)\\n\\}`)
  const match = pattern.exec(source)
  return match ? match[1] : null
}

/** 从规则块中抽取某个声明的值 */
function declOf(block: string, prop: string): string | null {
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${prop}:\\s*([^;]+);`))
  return match ? match[1].trim() : null
}

describe('GroupDetails - hero 卡结构与样式', () => {
  const source = read(GROUP_DETAILS)

  it('模板中应存在 .group-details__hero 容器', () => {
    expect(source).toMatch(/<div class="group-details__hero">/)
  })

  it('hero 卡应包住头像区域与群名编辑', () => {
    const heroBody = source.match(/<div class="group-details__hero">([\s\S]*?)\n {4}<\/div>/)
    expect(heroBody, '未找到 .group-details__hero 的模板主体').not.toBeNull()
    const body = heroBody![1]
    // 头像（管理员上传分支 + 只读分支）与群名 InlineEdit 都应在卡内
    expect(body).toMatch(/<n-upload/)
    expect(body).toMatch(/<n-image/)
    expect(body).toMatch(/<InlineEdit/)
    expect(body).toMatch(/group-details__name-edit/)
  })

  it('.group-details__hero 应使用 liquid-glass-panel（自带 html.low-perf 降级）', () => {
    const block = extractRule(source, '.group-details__hero')
    expect(block, '缺少 .group-details__hero 规则块').not.toBeNull()
    expect(block).toMatch(/@include\s+liquid-glass-panel\(20px,\s*0\.85\)/)
  })

  it('liquid-glass mixin 不应再是死导入', () => {
    expect(source).toMatch(/@use\s+'@\/styles\/scss\/mixins\/liquid-glass'/)
    // 有 @use 就必须至少有一次 @include
    expect(source).toMatch(/@include\s+liquid-glass/)
  })

  it('hero 卡不得引入硬编码颜色', () => {
    const block = extractRule(source, '.group-details__hero')!
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(block).not.toMatch(/\brgba?\(/)
    expect(block).not.toMatch(/\bhsla?\(/)
  })
})

describe('SingleDetails / GroupDetails - hero 卡规格一致性', () => {
  const groupSource = read(GROUP_DETAILS)
  const singleSource = read(SINGLE_DETAILS)

  const groupHero = extractRule(groupSource, '.group-details__hero')
  const singleHero = extractRule(singleSource, '.single-details__hero')

  it('两个 hero 规则块都应存在', () => {
    expect(groupHero, '缺少 .group-details__hero').not.toBeNull()
    expect(singleHero, '缺少 .single-details__hero').not.toBeNull()
  })

  it('几何声明应逐项一致（border-radius / padding / width / gap / box-sizing）', () => {
    for (const prop of ['border-radius', 'padding', 'width', 'gap', 'box-sizing']) {
      expect(declOf(groupHero!, prop), `群聊 hero 的 ${prop} 应与单聊一致`).toBe(declOf(singleHero!, prop))
    }
  })

  it('两者都应使用 liquid-glass-panel 的同一参数', () => {
    const includePattern = /@include\s+liquid-glass-panel\(([^)]*)\)/
    const groupParams = groupHero!.match(includePattern)?.[1]
    const singleParams = singleHero!.match(includePattern)?.[1]
    expect(singleParams, '单聊 hero 应改用带降级的 liquid-glass-panel').toBeDefined()
    expect(groupParams, '群聊 hero 应使用 liquid-glass-panel').toBeDefined()
    expect(groupParams).toBe(singleParams)
  })
})

describe('详情面板顶部间距对齐', () => {
  const GROUP_DETAILS_SOURCE = read(GROUP_DETAILS)
  const SINGLE_DETAILS_SOURCE = read(SINGLE_DETAILS)

  it('群聊根容器 margin-top 应与单聊根容器 padding-top 对齐（8px）', () => {
    const groupRule = extractRule(GROUP_DETAILS_SOURCE, '.group-details')!
    const singleRule = extractRule(SINGLE_DETAILS_SOURCE, '.single-details')!
    expect(declOf(groupRule, 'margin-top')).toBe('8px')
    // 单聊以 padding: 8px 0 提供同样的顶部偏移
    expect(declOf(singleRule, 'padding')).toBe('8px 0')
  })
})
