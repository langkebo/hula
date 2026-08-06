import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * FT-106: findPushRuleKind 必须通过 rules.global[kind] 访问规则列表，
 * 而非 rules[kind]（IPushRules 结构是 { global: { override, content, room, sender, underride } }）
 */
describe('FT-106: findPushRuleKind 通过 rules.global 访问规则', () => {
  const sourcePath = resolve(process.cwd(), 'src/services/matrix/notifications/MatrixNotificationService.ts')
  const sourceContent = readFileSync(sourcePath, 'utf8')

  it('findPushRuleKind 方法体引用 rules.global 而非顶层 rules[kind]', () => {
    // 提取 findPushRuleKind 方法体
    const methodMatch = sourceContent.match(/private async findPushRuleKind[\s\S]*?\n {2}\}/)
    expect(methodMatch).toBeTruthy()
    const methodBody = methodMatch![0]

    // 应该通过 rules.global 访问（或 rules.global?.[kind]）
    expect(methodBody).toMatch(/rules\.global/)

    // 不应该直接通过 rules[kind] 访问顶层（错误模式）
    // 排除 rules.global 的正确用法后，不应有其他 rules[ 访问
    expect(methodBody).not.toMatch(/\brules\s*\[\s*['"`]/)
  })
})
