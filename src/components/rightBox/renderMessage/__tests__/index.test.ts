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
 * - ❌ 不覆盖：真实浏览器渲染后的像素位置（需视觉回归/人工验收）
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..')
const RENDER_MESSAGE_VUE = resolve(ROOT, 'src/components/rightBox/renderMessage/index.vue')

const readSource = (p: string): string => readFileSync(p, 'utf-8')

describe('renderMessage/index.vue - MessageLockBadge 绑定契约', () => {
  const source = readSource(RENDER_MESSAGE_VUE)

  it('应导入 MessageLockBadge 组件', () => {
    expect(source).toMatch(/import\s+MessageLockBadge\s+from\s+'@\/components\/atomic\/MessageLockBadge\.vue'/)
  })

  it('应使用 useMessageTrust 且传入 getter（保证 props 变化时信任等级同步）', () => {
    // getter 形式：列表复用组件实例时不会残留上一条消息的信任状态
    expect(source).toMatch(/useMessageTrust\(\s*\(\)\s*=>/)
  })

  it('徽章 trust-level 必须绑定 lockBadgeLevel，而非直接绑定 trustLevel', () => {
    // trustLevel 含 'plain'，与 MessageLockBadge 的三态 prop 不兼容。
    //
    // ⚠️ 断言必须**限定在徽章块内**：F-1 的 MessageTrustGate 接收的正是含 plain 的
    // 四态 trustLevel（它自己做分级），若用文件级否定断言，会把合法用法一起判红。
    const badge = source.match(/<MessageLockBadge[\s\S]*?\/>/)?.[0] ?? ''
    expect(badge).not.toBe('')
    expect(badge).toMatch(/:trust-level="lockBadgeLevel"/)
    expect(badge).not.toMatch(/:trust-level="trustLevel"/)
  })

  it('F-1：信任门禁接收四态 trustLevel（分级由 gate 自己完成）', () => {
    const gate = source.match(/<MessageTrustGate[\s\S]*?>/)?.[0] ?? ''
    expect(gate).toMatch(/:trust-level="trustLevel"/)
  })

  it('显隐守卫必须同时覆盖「已加密」与「加密房间里的明文（risk）」', () => {
    // 只按 isEncryptedMessage 渲染会让 risk 永远显示不出来 ——
    // risk 的语义正是「加密房间里出现了明文消息」，此时 isEncryptedMessage 为 false。
    expect(source).toMatch(/v-if="isEncryptedMessage \|\| lockBadgeLevel === 'risk'"/)
    expect(source).toMatch(/const\s*\{\s*isEncrypted:\s*isEncryptedMessage/)
  })

  it('必须向 useMessageTrust 传入房间加密状态（risk 判据的唯一来源）', () => {
    expect(source).toMatch(/isEncrypted:\s*\(\)\s*=>/)
    expect(source).toMatch(/isRoomEncrypted\(/)
  })

  it('应按 isMe 区分左右定位 class', () => {
    expect(source).toMatch(/:class="isMe \? 'self-end' : 'self-start'"/)
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
