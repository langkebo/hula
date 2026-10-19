<template>
  <div class="contact-alias-section">
    <InlineEdit
      class="management-section"
      :label="t('friend.alias.label')"
      :value="aliasName"
      :placeholder="t('friend.alias.placeholder')"
      :loading="saving"
      :edit-aria-label="t('friend.alias.edit_aria')"
      :maxlength="64"
      @submit="handleSave" />
    <p class="contact-alias-section__hint">{{ t('friend.alias.hint') }}</p>
    <button
      v-if="aliasName"
      type="button"
      class="contact-alias-section__clear"
      data-test="clear-contact-alias"
      @click="handleClear">
      {{ t('friend.alias.clear') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { applyAliasToDmRoom, clearAliasFromDmRoom } from '@/services/matrix/aliases/applyContactAlias'
import {
  contactAliasVersion,
  getContactAlias,
  loadContactAliases,
  removeContactAlias,
  saveContactAlias
} from '@/services/matrix/aliases/contactAliasRegistry'

/**
 * 「对方看到的我」编辑器（F-6）。
 *
 * ⚠️ 与同页的「备注」方向**相反**，文案必须说清：
 * - 备注（note）：**我**给对方起的名，只有我看得见；
 * - 别名（alias）：**对方**看我的名字，靠房间级 `m.room.member` 生效。
 *
 * 从 `SingleDetails.vue` 抽出：该文件已超 400 行硬限且不得增长，
 * 抽出后宿主只留一行挂载。
 */
defineOptions({ name: 'ContactAliasSection' })

const props = defineProps<{ userId: string }>()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const saving = ref(false)

/** 别名是模块级缓存（不是 store），读版本号建立响应式依赖 */
const aliasName = computed(() => {
  void contactAliasVersion.value
  return getContactAlias(props.userId)?.displayName ?? ''
})

void loadContactAliases()

async function handleSave(value: string): Promise<void> {
  saving.value = true
  try {
    await saveContactAlias(props.userId, { displayName: value })
    const applied = await applyAliasToDmRoom(props.userId)
    // 没有单聊房间时别名只存在于账号数据里，等建会话后自动生效 —— 不能谎报"已生效"
    showFeedback(applied ? t('friend.alias.saved') : t('friend.alias.saved_pending_room'), 'success', 'polite')
  } catch {
    showFeedback(t('friend.alias.invalid'), 'error', 'assertive')
  } finally {
    saving.value = false
  }
}

async function handleClear(): Promise<void> {
  saving.value = true
  try {
    // 先清房间级状态（对方立刻看到回落），再删本地记录。
    // 顺序反了会出现"本地已清、对方仍看我旧名字"。
    await clearAliasFromDmRoom(props.userId)
    await removeContactAlias(props.userId)
    showFeedback(t('friend.alias.cleared'), 'success', 'polite')
  } catch {
    showFeedback(t('friend.alias.clear_failed'), 'error', 'assertive')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.contact-alias-section__hint {
  margin: -4px 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tjg-text-tertiary);
}

.contact-alias-section__clear {
  margin-bottom: 8px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--tjg-color-danger-500);
  cursor: pointer;
}
</style>
