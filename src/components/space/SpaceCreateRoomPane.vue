<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('space.create_room_title')"
    :auto-focus="false"
    style="width: 440px; max-width: calc(100vw - 32px)">
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="84"
      class="space-create-room-pane__form">
      <n-form-item :label="t('space.name')" path="name">
        <n-input
          v-model:value="formData.name"
          :placeholder="t('space.create_room_name_placeholder')"
          :maxlength="255"
          show-count
          @keydown.enter.prevent="handleSubmit" />
      </n-form-item>

      <n-form-item :label="t('space.topic')" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('space.create_room_topic_placeholder')"
          :maxlength="4096"
          show-count />
      </n-form-item>

      <n-form-item :label="t('space.create_room_suggested')" path="suggested">
        <n-switch v-model:value="formData.suggested" />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="space-create-room-pane__footer">
        <n-button tertiary @click="visible = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.create') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { NButton, NForm, NFormItem, NInput, NModal, NSwitch } from 'naive-ui'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { openMsgSessionByRoomId } from '@/composables/chat/openMsgSession'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceRooms } from '@/composables/space/useSpaceRooms'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SpaceCreateRoomPane')

const props = defineProps<{
  /** 当前空间 ID（房间将创建并挂载到该空间下） */
  spaceId: string
  /** 弹窗可见性（v-model:show） */
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  created: [roomId: string]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { createRoomInSpace, error: createError } = useSpaceRooms(() => props.spaceId)

const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v)
})

const formRef = ref<FormInst | null>(null)
const submitting = ref(false)

const formData = reactive({
  name: '',
  topic: '',
  suggested: false
})

const rules = {
  name: {
    required: true,
    message: t('space.create_room_name_required'),
    trigger: ['input', 'blur']
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.suggested = false
}

// 关闭弹窗时重置表单，避免下次打开残留旧数据
watch(visible, (open) => {
  if (!open) resetForm()
})

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const roomId = await createRoomInSpace({
      name: formData.name.trim(),
      topic: formData.topic.trim() || undefined,
      suggested: formData.suggested
    })
    if (!roomId) {
      const errMsg = createError.value || ''
      if (errMsg.includes('M_ROOM_IN_USE') || errMsg.includes('already in use')) {
        // 同名房间：提示修改名称，保留表单数据（不做 ignoreDuplicateName 逃生阀）
        showFeedback(t('space.create_room_duplicate'), 'error')
      } else {
        showFeedback(t('space.create_room_failed'), 'error')
      }
      return
    }
    showFeedback(t('space.create_room_success'), 'success')
    emit('created', roomId)
    // Step 4：跳转到新房间
    try {
      await openMsgSessionByRoomId(roomId)
    } catch (navErr) {
      logger.warn('navigate to new room failed', navErr)
    }
    resetForm()
    visible.value = false
  } catch (err) {
    logger.error('create room pane submit failed', err)
    showFeedback(t('space.create_room_failed'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.space-create-room-pane__form {
  padding: 4px 0;
}

.space-create-room-pane__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
