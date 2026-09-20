import type { IPushRule, IPushRules } from './MatrixPushService'

/**
 * 推送设置的纯展示逻辑（5.2 推送配置）。
 *
 * 抽成独立模块的原因：
 * 1. pushkey 是推送凭证，界面上必须掩码，掩码规则需要被测试固定下来；
 * 2. 规则 id/分组的映射逻辑两端通用，放在组件里无法复用也无法单测。
 */

/** 规则 id 前缀 `.m.rule.` 属于 Matrix 规范实现细节，界面不应直接暴露。 */
const RULE_ID_PREFIX = '.m.rule.'

export const PUSH_RULE_KINDS = ['override', 'content', 'room', 'sender', 'underride'] as const

export type PushRuleKindName = (typeof PUSH_RULE_KINDS)[number]

/**
 * 掩码推送凭证：保留头尾各 6 位，中间省略。
 * 短于等于 12 位时整体保留（再截断反而失去辨识度）。
 */
export function maskPushKey(pushkey: string | null | undefined): string {
  if (!pushkey) {
    return ''
  }
  if (pushkey.length <= 12) {
    return pushkey
  }
  return `${pushkey.slice(0, 6)}...${pushkey.slice(-6)}`
}

/** 去掉 `.m.rule.` 前缀，便于用户识别规则。 */
export function formatPushRuleId(ruleId: string): string {
  if (!ruleId) {
    return ''
  }
  return ruleId.startsWith(RULE_ID_PREFIX) ? ruleId.slice(RULE_ID_PREFIX.length) : ruleId
}

/**
 * 按 kind 取规则列表，保持 SDK 返回的顺序，空列表返回空数组（而不是 undefined）。
 * 显式排除 `enabled === false` 之外的判断留给调用方，这里只做分组。
 */
export function groupPushRulesByKind(rules: IPushRules | null | undefined): Record<PushRuleKindName, IPushRule[]> {
  const grouped = {} as Record<PushRuleKindName, IPushRule[]>
  const global = rules?.global as Record<string, IPushRule[] | undefined> | undefined

  for (const kind of PUSH_RULE_KINDS) {
    const list = global?.[kind]
    grouped[kind] = Array.isArray(list) ? list : []
  }

  return grouped
}

/**
 * 规则是否启用。
 *
 * SDK 用 `enabled === false` 表示禁用，`undefined` 视为启用；
 * MSC3881 的 `org.matrix.msc3881.enabled` 是推送级开关，与规则开关不同，这里不参与判断。
 */
export function isPushRuleEnabled(rule: Partial<Pick<IPushRule, 'enabled'>>): boolean {
  return rule.enabled !== false
}

/** 规则总数，用于判断规则区是否为空。 */
export function countPushRules(grouped: Record<PushRuleKindName, IPushRule[]>): number {
  return PUSH_RULE_KINDS.reduce((total, kind) => total + grouped[kind].length, 0)
}

/**
 * 推送设备是否处于可接收推送的状态。
 *
 * `enabled === false` 表示服务端已停用该 pusher；`undefined`/`true` 均视为启用。
 */
export function isPusherEnabled(pusher: {
  enabled?: boolean | null
  'org.matrix.msc3881.enabled'?: boolean | null
}): boolean {
  const explicit = pusher['org.matrix.msc3881.enabled'] ?? pusher.enabled
  return explicit !== false
}

/** 设备主标题：设备名优先，退化到应用名，最后给出调用方提供的占位。 */
export function getPusherDisplayName(
  pusher: { device_display_name?: string | null; app_display_name?: string | null },
  fallback: string
): string {
  return pusher.device_display_name?.trim() || pusher.app_display_name?.trim() || fallback
}

/** 设备副标题：应用名 + 推送通道种类；两者都缺失时返回空串（由调用方决定是否渲染）。 */
export function getPusherSubtitle(pusher: { app_display_name?: string | null; kind?: string | null }): string {
  return [pusher.app_display_name?.trim(), pusher.kind?.trim()].filter(Boolean).join(' · ')
}
