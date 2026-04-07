<template>
  <div class="add-to-space-dialog">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
      <n-form-item :label="t('addToSpace.room')" path="roomId">
        <n-input v-model:value="formData.roomId" :placeholder="t('addToSpace.room_placeholder')" />
      </n-form-item>
    </n-form>

    <div class="dialog-footer">
      <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
      <n-button type="primary" :loading="loading" @click="handleSubmit">
        {{ t('common.add') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSpaceStore } from '@/stores/space'
import { matrixSpaceService } from '@/services/matrix/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'
import type { FormInst } from 'naive-ui'

import type { PropType } from 'vue'

const logger = createLogger('AddToSpaceDialog')
const { t } = useI18n()
const router = useRouter()
const spaceStore = useSpaceStore()
const props = defineProps<{
  visible: boolean
  spaceId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const formData = reactive({
  roomId: ''
})
const rules = {
  roomId: {
    required: true,
    message: t('addToSpace.room_required')
  }
}
const handleSubmit = async () => {
  try {
    loading.value = true
    await formRef.value?.validate()
    await matrixSpaceService.addChildToSpace(props.spaceId, formData.roomId)
    emit('update:visible', false)
  } catch (error) {
    logger.error('[AddToSpaceDialog] 添加房间失败:', error)
  } finally {
    loading.value = false
  }
}
const handleCancel = () => {
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.add-to-space-dialog {
  padding: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
