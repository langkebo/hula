<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('room_tags.title')"
    :style="{ width: '460px' }"
    :bordered="false"
    @update:show="handleVisibleChange">
    <div class="room-tags-dialog">
      <!-- 添加标签 -->
      <div class="add-row">
        <n-input
          v-model:value="inputValue"
          :placeholder="t('room_tags.add_placeholder')"
          :disabled="flow.updating.value"
          :maxlength="32"
          @keydown.enter="handleAdd" />
        <n-button type="primary" :loading="flow.updating.value" @click="handleAdd">
          {{ t('room_tags.add') }}
        </n-button>
      </div>

      <!-- 推荐标签 -->
      <div class="suggested-section">
        <div class="section-label">{{ t('room_tags.suggested') }}</div>
        <n-flex :size="8" class="suggested-list">
          <n-tag
            v-for="suggestion in flow.SUGGESTED_TAGS"
            :key="suggestion"
            :type="flow.hasTag(suggestion) ? 'default' : 'info'"
            size="small"
            round
            checkable
            :checked="flow.hasTag(suggestion)"
            :disabled="flow.updating.value || flow.hasTag(suggestion)"
            @click="handleAddSuggested(suggestion)">
            {{ suggestion }}
          </n-tag>
        </n-flex>
      </div>

      <n-divider style="margin: 8px 0" />

      <!-- 当前标签列表 -->
      <n-spin :show="flow.loading.value">
        <div class="tag-list" v-if="flow.hasTags.value">
          <n-tag
            v-for="tag in flow.tags.value"
            :key="tag.name"
            closable
            size="medium"
            round
            :disabled="flow.updating.value"
            @close="handleRemove(tag.name)">
            {{ tag.name }}
          </n-tag>
        </div>
        <n-empty v-else :description="t('room_tags.empty')" />
      </n-spin>

      <div v-if="flow.errorMessage.value" class="error-text">
        {{ flow.errorMessage.value }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button
          v-if="flow.hasTags.value"
          size="small"
          type="error"
          ghost
          :loading="flow.updating.value"
          @click="handleClearAll">
          {{ t('room_tags.clear_all') }}
        </n-button>
        <n-button @click="handleClose">{{ t('common.close') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { useDialog } from 'naive-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomTags } from '@/composables/room/useRoomTags'

const props = defineProps<{
  visible: boolean
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'updated'): void
}>()

const { t } = useI18n()
const dialog = useDialog()

const flow = useRoomTags({ roomId: props.roomId })

const inputValue = ref('')

const handleAdd = async () => {
  const name = inputValue.value
  if (!name.trim()) return
  const ok = await flow.addTag(name)
  if (ok) {
    inputValue.value = ''
    emit('updated')
  }
}

const handleAddSuggested = async (suggestion: string) => {
  if (flow.hasTag(suggestion)) return
  const ok = await flow.addTag(suggestion)
  if (ok) emit('updated')
}

const handleRemove = async (name: string) => {
  const ok = await flow.removeTag(name)
  if (ok) emit('updated')
}

const handleClearAll = () => {
  dialog.warning({
    title: t('room_tags.clear_all'),
    content: t('room_tags.clear_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const ok = await flow.clearAll()
      if (ok) emit('updated')
    }
  })
}

const handleClose = () => {
  emit('update:visible', false)
}

const handleVisibleChange = (value: boolean) => {
  emit('update:visible', value)
  if (!value) emit('close')
}

watch(
  () => [props.visible, props.roomId] as const,
  ([visible, roomId]) => {
    if (visible && roomId) {
      flow.load()
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.room-tags-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-row {
  display: flex;
  gap: 8px;
}

.suggested-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

.suggested-list {
  flex-wrap: wrap;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 40px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px 0;
}

.error-text {
  font-size: 12px;
  color: var(--tjg-color-danger-500);
  padding: 4px 0;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
</style>
