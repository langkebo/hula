<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('space.create.title')"
    :style="{ width: '440px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <div class="space-create-dialog">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
        <n-form-item :label="t('space.name')" path="name">
          <n-input v-model:value="formData.name" :placeholder="t('space.name_placeholder')" />
        </n-form-item>

        <n-form-item :label="t('space.topic')" path="topic">
          <n-input
            v-model:value="formData.topic"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="t('space.topic_placeholder')" />
        </n-form-item>

        <n-form-item :label="t('space.create.visibility')" path="visibility">
          <n-radio-group v-model:value="formData.visibility">
            <n-radio-button value="public">{{ t('space.create.public') }}</n-radio-button>
            <n-radio-button value="private">{{ t('space.create.private') }}</n-radio-button>
          </n-radio-group>
        </n-form-item>
      </n-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="loading" @click="handleSubmit">
          {{ t('common.create') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaces } from '@/composables/space'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SpaceCreateDialog')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { create: createSpace } = useSpaces()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [spaceId: string]
}>()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const formData = reactive({
  name: '',
  topic: '',
  visibility: 'private' as 'public' | 'private'
})

const rules = {
  name: {
    required: true,
    message: t('space.name_required')
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.visibility = 'private'
}

const handleSubmit = async () => {
  try {
    loading.value = true
    await formRef.value?.validate()
    const result = await createSpace({
      name: formData.name,
      topic: formData.topic,
      visibility: formData.visibility
    })
    if (!result) {
      showFeedback(t('space.create_failed'), 'error')
      return
    }
    showFeedback(t('space.create_success'), 'success')
    emit('created', result.spaceId)
    resetForm()
    emit('update:visible', false)
  } catch (err) {
    logger.error('创建空间失败:', err)
    showFeedback(t('space.create_failed'), 'error')
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  resetForm()
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) return
    resetForm()
  }
)
</script>

<style scoped lang="scss">
.space-create-dialog {
  padding: 4px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
