<template>
  <div class="contact-profile-editors">
    <InlineEdit
      class="management-section"
      :label="t('friend.detail.note')"
      :value="contactInfo.note || ''"
      :placeholder="t('friend.detail.note_placeholder')"
      :loading="savingNote"
      :edit-aria-label="t('friend.detail.note_section')"
      :maxlength="200"
      @submit="handleSaveNote" />

    <InlineEdit
      class="management-section"
      :label="t('friend.detail.display_name')"
      :value="contactInfo.remark || contactInfo.displayName || ''"
      :placeholder="t('friend.detail.display_name_placeholder')"
      :loading="savingDisplayName"
      :edit-aria-label="t('friend.detail.edit_display_name')"
      :maxlength="100"
      @submit="handleSaveDisplayName" />

    <ContactAliasSection v-if="userId" :user-id="userId" />
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import ContactAliasSection from '@/components/friend/ContactAliasSection.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'

/**
 * 联系人资料编辑区（备注 / 显示名 / 对方看到的我）。
 *
 * 三者的方向必须区分清楚，否则用户会混淆：
 * - 备注 / 显示名：**我**给对方起的名，只有我看得见（存服务端 friend note）；
 * - 别名（`ContactAliasSection`）：**对方**看我的名字，靠房间级 `m.room.member` 生效。
 *
 * 从 `SingleDetails.vue` 整体抽出：该文件不得增长，抽出后宿主只留一行挂载。
 */
defineOptions({ name: 'ContactProfileEditors' })

const props = defineProps({
  userId: { type: String, required: true },
  contactInfo: {
    type: Object as PropType<Partial<MatrixContact>>,
    required: true
  }
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const contactStore = useContactStore()

const savingNote = ref(false)
const savingDisplayName = ref(false)

const handleSaveNote = async (newValue: string): Promise<void> => {
  if (!props.userId || !newValue) return
  savingNote.value = true
  try {
    const success = await contactStore.setFriendNote(props.userId, newValue)
    if (success) {
      showFeedback(t('friend.detail.note_saved'), 'success', 'polite')
    }
  } catch {
    showFeedback(t('friend.detail.note_error'), 'error', 'assertive')
  } finally {
    savingNote.value = false
  }
}

const handleSaveDisplayName = async (newValue: string): Promise<void> => {
  if (!props.userId || !newValue) return
  savingDisplayName.value = true
  try {
    const success = await contactStore.setFriendDisplayName(props.userId, newValue)
    if (success) {
      showFeedback(t('friend.detail.display_name_saved'), 'success', 'polite')
    }
  } catch {
    showFeedback(t('friend.detail.display_name_error'), 'error', 'assertive')
  } finally {
    savingDisplayName.value = false
  }
}
</script>
