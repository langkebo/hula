<template>
  <div class="inline-edit">
    <div class="inline-edit__header">
      <span class="inline-edit__label">{{ label }}</span>
      <button
        v-if="!editing"
        type="button"
        class="inline-edit__toggle"
        :aria-label="editAriaLabel || t('common.edit')"
        @click="enterEdit">
        {{ t('common.edit') }}
      </button>
      <button v-else type="button" class="inline-edit__toggle" :aria-label="t('common.cancel')" @click="cancelEdit">
        {{ t('common.cancel') }}
      </button>
    </div>

    <!-- 查看态 -->
    <div v-if="!editing" class="inline-edit__value" :class="{ 'inline-edit__value--placeholder': isPlaceholder }">
      {{ displayValue }}
    </div>

    <!-- 编辑态 -->
    <div v-else class="inline-edit__editor" :class="{ 'inline-edit__editor--multiline': multiline }">
      <textarea
        v-if="multiline"
        ref="textareaRef"
        v-model="draft"
        class="inline-edit__input inline-edit__input--textarea"
        :placeholder="placeholder"
        :disabled="loading"
        :maxlength="maxlength"
        :rows="rows"
        @keydown.esc.prevent="cancelEdit"
        @blur="handleBlur" />
      <input
        v-else
        ref="inputRef"
        v-model="draft"
        type="text"
        class="inline-edit__input"
        :placeholder="placeholder"
        :disabled="loading"
        :maxlength="maxlength"
        @keydown.enter.prevent="confirmEdit"
        @keydown.esc.prevent="cancelEdit"
        @blur="handleBlur" />
      <button
        type="button"
        class="inline-edit__confirm"
        :disabled="!canConfirm"
        :aria-label="t('common.confirm')"
        @click="confirmEdit">
        <svg v-if="loading" class="inline-edit__spinner size-14px" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" fill="none" />
        </svg>
        <span v-else>{{ t('common.confirm') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    /** 字段标签 */
    label: string
    /** 当前值 */
    value: string
    /** 占位提示文案 */
    placeholder?: string
    /** 编辑按钮的无障碍标签（默认复用 common.edit） */
    editAriaLabel?: string
    /** 最大长度 */
    maxlength?: number
    /** 是否去除首尾空白后才允许提交 */
    trim?: boolean
    /** 提交中 loading 状态（由父组件控制） */
    loading?: boolean
    /** 多行文本模式（textarea） */
    multiline?: boolean
    /** 多行模式下的行数 */
    rows?: number
  }>(),
  {
    placeholder: '',
    editAriaLabel: '',
    maxlength: undefined,
    trim: true,
    loading: false,
    multiline: false,
    rows: 3
  }
)

const emit = defineEmits<{
  /** 提交事件：传递 trim 后的值（若启用 trim） */
  submit: [value: string]
  /** 取消编辑 */
  cancel: []
}>()

const { t } = useI18n()

const editing = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement>()
const textareaRef = ref<HTMLTextAreaElement>()

const normalizedValue = computed(() => (props.trim ? props.value.trim() : props.value))
const isPlaceholder = computed(() => normalizedValue.value.length === 0)
const displayValue = computed(() => normalizedValue.value || props.placeholder)

const canConfirm = computed(() => {
  if (props.loading) return false
  const draftVal = props.trim ? draft.value.trim() : draft.value
  return draftVal.length > 0 && draftVal !== normalizedValue.value
})

const enterEdit = () => {
  draft.value = props.value
  editing.value = true
  nextTick(() => {
    const target = props.multiline ? textareaRef.value : inputRef.value
    target?.focus()
    target?.select()
  })
}

const cancelEdit = () => {
  editing.value = false
  draft.value = ''
  emit('cancel')
}

const confirmEdit = async () => {
  if (!canConfirm.value) return
  const submitValue = props.trim ? draft.value.trim() : draft.value
  emit('submit', submitValue)
}

const handleBlur = () => {
  // 失焦时若未提交则取消，避免状态卡死
  // 使用 setTimeout 让确认按钮的 click 先触发
  setTimeout(() => {
    if (editing.value && !props.loading) {
      cancelEdit()
    }
  }, 150)
}

// 监听 value 变化：父组件提交成功后 value 会刷新，此时自动退出编辑态
watch(
  () => props.value,
  (newVal) => {
    if (editing.value && !props.loading && newVal !== draft.value) {
      editing.value = false
      draft.value = ''
    }
  }
)
</script>

<style scoped lang="scss">
.inline-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.inline-edit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.inline-edit__label {
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.inline-edit__toggle {
  background: transparent;
  border: none;
  color: var(--tjg-color-primary-500);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;

  &:hover {
    background: var(--tjg-color-primary-50);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.inline-edit__value {
  font-size: 14px;
  color: var(--tjg-text-primary);
  padding: 6px 8px;
  background: var(--tjg-surface-input, rgba(0, 0, 0, 0.04));
  border-radius: 6px;
  min-height: 32px;
  display: flex;
  align-items: center;
  word-break: break-all;
}

.inline-edit__value--placeholder {
  color: var(--tjg-text-tertiary);
}

.inline-edit__editor {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-edit__editor--multiline {
  align-items: flex-end;
}

.inline-edit__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  font-size: 14px;
  color: var(--tjg-text-primary);
  background: var(--tjg-surface-panel);
  border: 1px solid var(--tjg-color-primary-500);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: var(--tjg-text-tertiary);
  }

  &:focus {
    border-color: var(--tjg-color-primary-500);
    box-shadow: 0 0 0 2px var(--tjg-color-primary-100);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.inline-edit__input--textarea {
  height: auto;
  min-height: 72px;
  padding: 8px 10px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  word-break: break-all;
}

.inline-edit__confirm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--tjg-text-inverse);
  background: var(--tjg-color-primary-500);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: var(--tjg-color-primary-600, var(--tjg-color-primary-500));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.inline-edit__spinner {
  animation: inline-edit-spin 0.8s linear infinite;
}

@keyframes inline-edit-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
