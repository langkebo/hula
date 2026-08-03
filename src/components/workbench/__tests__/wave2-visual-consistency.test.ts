/**
 * Wave 2 视觉一致性收尾方案 - 回归测试
 *
 * 对应 docs/ui/optimization-plan.md Wave 2 的问题 4：
 * 3px 强调指示条变量命名不一致（详见 CONTEXT.md「3px 强调指示条」术语）
 *
 * TDD vertical slices：
 * 1. ThreadPanel.vue 使用 --hula-color-primary-500（非旧别名 --color-primary）
 * 2. Bot.vue 3px 指示条使用 --hula-color-primary-500（非本地别名 --fgColor-accent）
 * 3. src/ 全局无 --fgColor-accent 残留
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..')
const THREAD_PANEL_PATH = resolve(ROOT, 'src/components/thread/ThreadPanel.vue')
const BOT_PATH = resolve(ROOT, 'src/components/rightBox/chatBox/Bot.vue')
const _SRC_DIR = resolve(ROOT, 'src')

function readSource(p: string): string {
  return readFileSync(p, 'utf-8')
}

describe('Wave 2 - 问题 4：3px 强调指示条变量命名一致性', () => {
  describe('Tracer Bullet 1：ThreadPanel.vue', () => {
    const source = readSource(THREAD_PANEL_PATH)

    it('3px 指示条应使用 var(--hula-color-primary-500)（非旧别名 --color-primary）', () => {
      // 提取 border-left: 3px ... 的声明
      const borderLeftMatch = source.match(/border-left:\s*3px\s+solid\s+([^;]+);/)
      expect(borderLeftMatch, '应存在 border-left: 3px 声明').not.toBeNull()
      const colorValue = borderLeftMatch![1].trim()
      expect(colorValue).toBe('var(--hula-color-primary-500)')
    })

    it('不应使用旧别名 var(--color-primary) 作为 3px 指示条颜色', () => {
      expect(source).not.toMatch(/border-left:\s*3px\s+solid\s+var\(--color-primary\)/)
    })
  })

  describe('Tracer Bullet 2：Bot.vue 3px 指示条', () => {
    const source = readSource(BOT_PATH)

    it('3px 指示条应使用 var(--hula-color-primary-500)（非本地别名 --fgColor-accent）', () => {
      const borderLeftMatch = source.match(/border-left:\s*3px\s+solid\s+([^;]+);/)
      expect(borderLeftMatch, '应存在 border-left: 3px 声明').not.toBeNull()
      const colorValue = borderLeftMatch![1].trim()
      expect(colorValue).toBe('var(--hula-color-primary-500)')
    })
  })

  describe('Tracer Bullet 3：src/ 全局无 --fgColor-accent 残留', () => {
    it('Bot.vue 不应定义本地 --fgColor-accent 别名', () => {
      const source = readSource(BOT_PATH)
      expect(source).not.toMatch(/--fgColor-accent\s*:/)
    })

    it('Bot.vue 不应在任何位置使用 var(--fgColor-accent)', () => {
      const source = readSource(BOT_PATH)
      expect(source).not.toMatch(/var\(--fgColor-accent\)/)
    })
  })
})
