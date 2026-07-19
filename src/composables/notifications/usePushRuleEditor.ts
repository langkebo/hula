import { type PushRuleAction, PushRuleActionName } from 'matrix-js-sdk'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixPushService } from '@/services/matrix/notifications/MatrixPushService'
import type { IPushRule, IPushRules } from '@/types/matrix-services'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('usePushRuleEditor')

/** 推送规则类别,与 Matrix 协议 PushRuleKind 一致 */
export type PushRuleKindValue = 'override' | 'content' | 'room' | 'sender' | 'underride'

/** 编辑器可视化的动作类型 */
export type PushActionType = 'notify' | 'dont_notify' | 'coalesce'

/** 扁平化后的规则条目,携带所属类别 */
export interface FlatPushRule {
  kind: PushRuleKindValue
  rule: IPushRule
}

/** 所有可编辑的规则类别,按 Matrix 协议优先级排序 */
const RULE_KINDS: PushRuleKindValue[] = ['override', 'content', 'room', 'sender', 'underride']

/**
 * 从 actions 数组推断主要动作类型
 * - 包含 dont_notify -> dont_notify
 * - 包含 coalesce -> coalesce(合并通知,SDK 会同时携带 notify)
 * - 包含 notify -> notify
 * - 默认 -> dont_notify
 */
export function inferActionType(actions: PushRuleAction[]): PushActionType {
  if (actions.includes(PushRuleActionName.DontNotify)) return 'dont_notify'
  if (actions.includes(PushRuleActionName.Coalesce)) return 'coalesce'
  if (actions.includes(PushRuleActionName.Notify)) return 'notify'
  return 'dont_notify'
}

/**
 * 根据动作类型构造 actions 数组
 * coalesce 在 Matrix 协议中需要同时携带 notify 才能生效
 */
export function buildActions(actionType: PushActionType): PushRuleAction[] {
  if (actionType === 'dont_notify') return [PushRuleActionName.DontNotify]
  if (actionType === 'coalesce') return [PushRuleActionName.Notify, PushRuleActionName.Coalesce]
  return [PushRuleActionName.Notify]
}

/**
 * 跨端推送规则可视化编辑器 composable
 * PC 端 PushRuleEditor.vue 与移动端可共用此逻辑
 *
 * 流程:
 * 1. load() 拉取全量推送规则 IPushRules
 * 2. updateRule(ruleId, actions) 更新指定规则的动作
 *
 * 服务层能力来源:
 * - matrixPushService.getPushRules()
 * - matrixPushService.setPushRuleActions(scope, kind, ruleId, actions)
 */
export function usePushRuleEditor() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const rules = ref<IPushRules | null>(null)
  const loading = ref(false)
  const updating = ref(false)
  const errorMessage = ref<string | null>(null)

  /** 将 global 各类别规则扁平化,便于列表渲染 */
  const flatRules = computed<FlatPushRule[]>(() => {
    if (!rules.value?.global) return []
    const result: FlatPushRule[] = []
    for (const kind of RULE_KINDS) {
      const list = rules.value.global[kind] ?? []
      for (const rule of list) {
        result.push({ kind, rule })
      }
    }
    return result
  })

  const hasRules = computed(() => flatRules.value.length > 0)

  /** 按 kind 分组,便于分类展示 */
  const groupedRules = computed<Record<PushRuleKindValue, FlatPushRule[]>>(() => {
    const empty: Record<PushRuleKindValue, FlatPushRule[]> = {
      override: [],
      content: [],
      room: [],
      sender: [],
      underride: []
    }
    if (!rules.value?.global) return empty
    for (const kind of RULE_KINDS) {
      const list = rules.value.global[kind] ?? []
      empty[kind] = list.map((rule) => ({ kind, rule }))
    }
    return empty
  })

  /**
   * 加载全量推送规则
   */
  const load = async (): Promise<void> => {
    loading.value = true
    errorMessage.value = null

    try {
      rules.value = await matrixPushService.getPushRules()
    } catch (err) {
      logger.error('加载推送规则失败', err)
      errorMessage.value = t('setting.push.editor.load_failed')
      showFeedback(errorMessage.value as string, 'error')
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新指定规则的动作
   * @param ruleId 规则 ID
   * @param actions 新的动作数组
   * @returns 是否更新成功
   */
  const updateRule = async (ruleId: string, actions: PushRuleAction[]): Promise<boolean> => {
    const entry = flatRules.value.find((item) => item.rule.rule_id === ruleId)
    if (!entry) {
      logger.warn('未找到待更新的推送规则', ruleId)
      showFeedback(t('setting.push.editor.rule_not_found'), 'error')
      return false
    }

    updating.value = true
    errorMessage.value = null

    try {
      await matrixPushService.setPushRuleActions('global', entry.kind, ruleId, actions)
      // 同步更新本地状态,避免重新拉取
      if (rules.value?.global?.[entry.kind]) {
        const list = rules.value.global[entry.kind]!
        const idx = list.findIndex((r) => r.rule_id === ruleId)
        if (idx >= 0) {
          list[idx] = { ...list[idx], actions: [...actions] }
        }
      }
      showFeedback(t('setting.push.editor.update_success'), 'success')
      return true
    } catch (err) {
      logger.error('更新推送规则失败', err)
      errorMessage.value = t('setting.push.editor.update_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 便捷方法:按动作类型更新规则
   */
  const updateRuleByActionType = async (ruleId: string, actionType: PushActionType): Promise<boolean> => {
    return updateRule(ruleId, buildActions(actionType))
  }

  return {
    rules,
    loading,
    updating,
    errorMessage,
    flatRules,
    groupedRules,
    hasRules,
    load,
    updateRule,
    updateRuleByActionType,
    inferActionType,
    buildActions
  }
}
