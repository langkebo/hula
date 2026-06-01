<template>
  <div class="create-room-pane">
    <div class="pane-header">
      <span class="pane-title">{{ t('room.create.title') }}</span>
      <n-button text size="small" @click="emit('close')">
        <template #icon>
          <svg class="size-14px"><use href="#close"></use></svg>
        </template>
      </n-button>
    </div>

    <div class="pane-body">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" require-mark-placement="left">
        <div class="avatar-section">
          <div class="avatar-preview" @click="triggerAvatarUpload">
            <img v-if="form.avatarUrl" :src="form.avatarUrl" alt="avatar" class="avatar-img" />
            <svg v-else class="avatar-placeholder size-24px"><use href="#camera"></use></svg>
            <div class="avatar-hint">
              <svg class="size-12px"><use href="#camera"></use></svg>
            </div>
          </div>
          <span class="avatar-label">{{ t('room.create.avatar') }}</span>
        </div>

        <n-form-item :label="t('room.create.name')" path="name">
          <n-input
            v-model:value="form.name"
            :placeholder="t('room.create.name_placeholder')"
            :maxlength="100"
            show-count
            clearable />
        </n-form-item>

        <n-form-item :label="t('room.create.topic')" path="topic">
          <n-input
            v-model:value="form.topic"
            type="textarea"
            :placeholder="t('room.create.topic_placeholder')"
            :maxlength="500"
            show-count
            :autosize="{ minRows: 2, maxRows: 4 }"
            clearable />
        </n-form-item>

        <n-form-item :label="t('room.create.alias')" path="alias">
          <n-input v-model:value="form.alias" :placeholder="t('room.create.alias_placeholder')" clearable />
        </n-form-item>

        <n-form-item :label="t('room.create.visibility')" path="isPublic">
          <n-radio-group v-model:value="form.isPublic" name="visibility">
            <n-radio :value="false">
              {{ t('room.create.private') }}
            </n-radio>
            <n-radio :value="true">
              {{ t('room.create.public') }}
            </n-radio>
          </n-radio-group>
        </n-form-item>

        <n-form-item :label="t('room.create.history_visibility')" path="historyVisibility">
          <n-select
            v-model:value="form.historyVisibility"
            :options="historyVisibilityOptions"
            :placeholder="t('room.create.history_visibility_placeholder')" />
        </n-form-item>

        <n-form-item :label="t('room.create.encryption')" path="isEncrypted">
          <n-switch v-model:value="form.isEncrypted" />
          <span class="switch-label">
            {{ form.isEncrypted ? t('room.create.encrypted') : t('room.create.not_encrypted') }}
          </span>
        </n-form-item>
      </n-form>
    </div>

    <div class="pane-footer">
      <n-button @click="emit('close')">{{ t('common.cancel') }}</n-button>
      <n-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('room.create.submit') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  submitting: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [
    data: {
      name: string
      topic: string
      avatarUrl: string
      isPublic: boolean
      alias: string
      isEncrypted: boolean
      historyVisibility: string
    }
  ]
}>()

const formRef = ref<FormInst | null>(null)

const form = reactive({
  name: '',
  topic: '',
  avatarUrl: '',
  isPublic: false,
  alias: '',
  isEncrypted: false,
  historyVisibility: 'shared'
})

const historyVisibilityOptions = [
  { label: t('room.create.history_shared'), value: 'shared' },
  { label: t('room.create.history_invited'), value: 'invited' },
  { label: t('room.create.history_joined'), value: 'joined' },
  { label: t('room.create.history_world_readable'), value: 'world_readable' }
]

const rules: FormRules = {
  name: [
    { required: true, message: t('room.create.name_required'), trigger: 'blur' },
    { min: 1, max: 100, message: t('room.create.name_length'), trigger: 'blur' }
  ]
}

const triggerAvatarUpload = () => {
  // TODO: integrate avatar upload
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  emit('submit', { ...form })
}
</script>

<style lang="scss" scoped>
.create-room-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hula-surface-panel);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-default);
  flex-shrink: 0;
}

.pane-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.pane-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.avatar-preview {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid var(--hula-border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: var(--hula-surface-raised);

  &:hover .avatar-hint {
    opacity: 1;
  }
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  color: var(--hula-text-tertiary);
}

.avatar-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hula-overlay-mask-default);
  color: var(--hula-text-inverse);
  opacity: 0;
  transition: opacity 0.15s;
  border-radius: 50%;
}

.avatar-label {
  font-size: 13px;
  color: var(--hula-text-secondary);
}

.switch-label {
  margin-left: 8px;
  font-size: 13px;
  color: var(--hula-text-tertiary);
}

.pane-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--hula-border-default);
  flex-shrink: 0;
}
</style>
