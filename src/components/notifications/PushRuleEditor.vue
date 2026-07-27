<template>
  <div class="push-rule-editor">
    <n-card size="small" :bordered="false" class="editor-card">
      <template #header>
        <div class="editor-header">
          <span class="editor-title">{{ t('setting.push.editor.title') }}</span>
          <n-button size="tiny" quaternary :loading="loading" @click="load">
            {{ t('setting.push.editor.refresh') }}
          </n-button>
        </div>
      </template>
      <template #header-extra>
        <span class="editor-desc">{{ t('setting.push.editor.desc') }}</span>
      </template>

      <n-spin :show="loading">
        <!-- 加载失败提示 -->
        <div v-if="errorMessage && !loading" class="editor-error">
          <n-tag type="error" size="small">{{ errorMessage }}</n-tag>
        </div>

        <!-- 空状态 -->
        <n-empty v-else-if="!hasRules" :description="t('setting.push.editor.empty')" />

        <!-- 规则列表,按 kind 分组 -->
        <div v-else class="rule-groups">
          <div v-for="kind in ruleKinds" :key="kind" class="rule-kind-group">
            <template v-if="groupedRules[kind].length > 0">
              <div class="rule-kind-header">
                <n-tag :type="kindTagType(kind)" size="small" round>
                  {{ t(`setting.push.rules_by_kind.kinds.${kind}`) }}
                </n-tag>
                <span class="rule-kind-count">{{ groupedRules[kind].length }}</span>
              </div>
              <n-list bordered class="rule-list">
                <n-list-item v-for="item in groupedRules[kind]" :key="item.rule.rule_id" class="rule-item">
                  <div class="rule-row">
                    <div class="rule-info">
                      <span class="rule-id" :title="item.rule.rule_id">{{ formatRuleId(item.rule.rule_id) }}</span>
                      <div class="rule-meta">
                        <n-tag v-if="item.rule.default" size="tiny" :bordered="false" type="info">
                          {{ t('setting.push.editor.default_rule') }}
                        </n-tag>
                        <n-tag v-if="item.rule.pattern" size="tiny" :bordered="false">
                          {{ t('setting.push.rules_by_kind.pattern') }}: {{ item.rule.pattern }}
                        </n-tag>
                        <n-tag v-if="!item.rule.enabled" size="tiny" :bordered="false" type="warning">
                          {{ t('setting.push.editor.disabled') }}
                        </n-tag>
                      </div>
                    </div>
                    <div class="rule-action">
                      <n-select
                        :value="inferActionType(item.rule.actions)"
                        :options="actionOptions"
                        size="small"
                        :disabled="updating || !item.rule.enabled"
                        style="width: 140px"
                        @update:value="(value: PushActionType) => handleActionChange(item.rule.rule_id, value)" />
                    </div>
                  </div>
                </n-list-item>
              </n-list>
            </template>
          </div>
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NButton, NCard, NEmpty, NList, NListItem, NSelect, NSpin, NTag } from 'naive-ui'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PushActionType, PushRuleKindValue } from '@/composables/notifications/usePushRuleEditor'
import { inferActionType, usePushRuleEditor } from '@/composables/notifications/usePushRuleEditor'

defineOptions({
  name: 'PushRuleEditor'
})

const { t } = useI18n()
const { load, updateRuleByActionType, groupedRules, hasRules, loading, updating, errorMessage } = usePushRuleEditor()

/** 规则类别顺序,与 Matrix 协议优先级一致 */
const ruleKinds: PushRuleKindValue[] = ['override', 'content', 'room', 'sender', 'underride']

/** 动作类型选项 */
const actionOptions = [
  { label: t('setting.push.editor.action_notify'), value: 'notify' as PushActionType },
  { label: t('setting.push.editor.action_dont_notify'), value: 'dont_notify' as PushActionType },
  { label: t('setting.push.editor.action_coalesce'), value: 'coalesce' as PushActionType }
]

onMounted(() => {
  load()
})

/** 处理动作切换 */
async function handleActionChange(ruleId: string, actionType: PushActionType) {
  await updateRuleByActionType(ruleId, actionType)
}

/** 格式化规则 ID,去掉默认前缀 */
function formatRuleId(ruleId: string): string {
  if (ruleId.startsWith('.m.rule.')) {
    return ruleId.replace('.m.rule.', '')
  }
  return ruleId
}

/** 不同类别使用不同颜色标签 */
function kindTagType(kind: PushRuleKindValue): 'default' | 'success' | 'warning' | 'info' | 'error' {
  switch (kind) {
    case 'override':
      return 'error'
    case 'content':
      return 'warning'
    case 'room':
      return 'info'
    case 'sender':
      return 'success'
    default:
      return 'default'
  }
}
</script>

<style scoped>
.push-rule-editor {
  width: 100%;
}

.editor-card {
  background-color: transparent;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
}

.editor-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}

.editor-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}

.editor-error {
  display: flex;
  justify-content: center;
  padding: var(--hula-space-4) 0;
}

.rule-groups {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-4);
}

.rule-kind-group {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-2);
}

.rule-kind-header {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
}

.rule-kind-count {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}

.rule-list {
  border-radius: var(--hula-radius-sm);
}

.rule-item {
  padding: var(--hula-space-2) var(--hula-space-3) !important;
}

.rule-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hula-space-3);
  width: 100%;
}

.rule-info {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-1);
  min-width: 0;
  flex: 1;
}

.rule-id {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hula-space-1);
}

.rule-action {
  flex-shrink: 0;
}
</style>
