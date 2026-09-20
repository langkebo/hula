/**
 * 消息加密信任徽章（MessageLockBadge）集成契约测试
 *
 * 反馈循环策略：本次改动是「模板绑定 + SCSS 定位规则」两处源码文本契约，
 * happy-dom 无法可靠计算 scoped 样式优先级与布局，因此沿用仓库既有做法
 * （见 components/workbench/__tests__/wave1-visual-consistency.test.ts），
 * 用源码断言建立 red-capable 循环。
 *
 * 覆盖范围与限制：
 * - ✅ 绑定契约：徽章的显隐条件、trust-level 来源、左右定位 class
 * - ✅ 样式契约：.msg-lock-badge--left / --right 的存在性与关键定位属性
 * - ✅ token 契约：新增规则不得引入硬编码颜色（必须走 --tjg-*）
 * - ❌ 不覆盖：真实浏览器渲染后的像素位置（需视觉回归/人工验收）
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..')
const RENDER_MESSAGE_VUE = resolve(ROOT, 'src/components/rightBox/renderMessage/index.vue')
const RENDER_MESSAGE_SCSS = resolve(ROOT, 'src/styles/scss/render-message.scss')

const readSource = (p: string): string => readFileSync(p, 'utf-8')

/** 提取形如 `.类名 { ... }` 的规则块（取第一个匹配） */
function extractRule(source: string, selector: string): string | null {
  const pattern = new RegExp(`\\${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'g')
  const match = pattern.exec(source)
  return match ? match[1] : null
}

describe('renderMessage/index.vue - MessageLockBadge 绑定契约', () => {
  const source = readSource(RENDER_MESSAGE_VUE)

  it('应导入 MessageLockBadge 组件', () => {
    expect(source).toMatch(/import\s+MessageLockBadge\s+from\s+'@\/components\/atomic\/MessageLockBadge\.vue'/)
  })

  it('应使用 useMessageTrust 且传入 getter（保证 props 变化时信任等级同步）', () => {
    // getter 形式：列表复用组件实例时不会残留上一条消息的信任状态
    expect(source).toMatch(/useMessageTrust\(\s*\(\)\s*=>/)
  })

  it('trust-level 必须绑定 lockBadgeLevel，而非直接绑定 trustLevel', () => {
    // trustLevel 含 'plain'，与 MessageLockBadge 的三态 prop 不兼容
    expect(source).toMatch(/:trust-level="lockBadgeLevel"/)
    expect(source).not.toMatch(/:trust-level="trustLevel"/)
  })

  it('应以 isEncryptedMessage 作为显隐守卫', () => {
    expect(source).toMatch(/v-if="isEncryptedMessage"/)
    expect(source).toMatch(/const\s*\{\s*isEncrypted:\s*isEncryptedMessage/)
  })

  it('应按 isMe 区分左右定位 class', () => {
    expect(source).toMatch(/:class="isMe \? 'msg-lock-badge--right' : 'msg-lock-badge--left'"/)
  })

  it('title 应绑定翻译后的 trustDescriptionKey（可访问性提示）', () => {
    // composable 只给 i18n key，文案由调用方 t() 渲染，避免英文界面漏出中文
    expect(source).toMatch(/:title="t\(trustDescriptionKey\)"/)
  })

  it('不应残留已改名为 trustDescriptionKey 的旧属性', () => {
    expect(source).not.toMatch(/\btrustDescription\b(?!Key)/)
  })

  it('不应保留重复的内联加密判断（收敛到 composable）', () => {
    expect(source).not.toMatch(/shouldShowLockBadge/)
  })
})

describe('render-message.scss - 锁徽章定位契约', () => {
  const source = readSource(RENDER_MESSAGE_SCSS)

  it('应定义 .msg-lock-badge--left 规则', () => {
    const block = extractRule(source, '.msg-lock-badge--left')
    expect(block, '缺少 .msg-lock-badge--left 规则块').not.toBeNull()
    expect(block).toMatch(/display:\s*inline-flex/)
    expect(block).toMatch(/align-items:\s*center/)
    expect(block).toMatch(/margin-top:/)
  })

  it('应定义 .msg-lock-badge--right 规则并右对齐', () => {
    const block = extractRule(source, '.msg-lock-badge--right')
    expect(block, '缺少 .msg-lock-badge--right 规则块').not.toBeNull()
    expect(block).toMatch(/display:\s*inline-flex/)
    expect(block).toMatch(/align-items:\s*center/)
    expect(block).toMatch(/flex-direction:\s*row-reverse/)
  })

  it('新增规则不得引入硬编码颜色（必须使用 --tjg-* token）', () => {
    for (const selector of ['.msg-lock-badge--left', '.msg-lock-badge--right']) {
      const block = extractRule(source, selector)
      expect(block, `缺少 ${selector} 规则块`).not.toBeNull()
      // 不含 #hex / rgb() / rgba() / hsl() 字面色值
      expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(block).not.toMatch(/\brgba?\(/)
      expect(block).not.toMatch(/\bhsla?\(/)
    }
  })
})
