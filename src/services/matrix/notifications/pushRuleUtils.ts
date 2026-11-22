import { type IPushRule, type IPushRules, type MatrixClient, PushRuleKind } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PushRules')

/** 把 `{ global: { override, content, room, sender, underride } }` 拉平为规则数组。 */
export function flattenPushRules(rules: IPushRules): IPushRule[] {
  const allRules: IPushRule[] = []
  const globalRules = rules.global
  for (const value of Object.values(globalRules)) {
    if (Array.isArray(value)) {
      allRules.push(...value)
    }
  }
  return allRules
}

/**
 * 查找指定规则的 kind；失败或无匹配时回退 Override。
 *
 * FT-106: IPushRules 结构是 `{ global: { override, content, room, sender, underride } }`，
 * 必须通过 `rules.global[kind]` 访问，而非 `rules[kind]`。
 */
export async function findPushRuleKind(client: MatrixClient, ruleId: string): Promise<PushRuleKind> {
  try {
    const rules = await client.getPushManager().getPushRules()
    const kinds: PushRuleKind[] = [
      PushRuleKind.Override,
      PushRuleKind.ContentSpecific,
      PushRuleKind.RoomSpecific,
      PushRuleKind.SenderSpecific,
      PushRuleKind.Underride
    ]
    for (const kind of kinds) {
      const ruleList = (rules.global?.[kind] ?? undefined) as IPushRule[] | undefined
      if (ruleList?.some((r) => r.rule_id === ruleId)) {
        return kind
      }
    }
  } catch (err) {
    logger.warn('Notification operation failed:', err)
  }
  return PushRuleKind.Override
}
