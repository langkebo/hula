<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('room.join.title')"
    :style="{ width: '480px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
      <n-alert type="info" :bordered="false" class="mb-16px">
        {{ t('room.join.format_hint') }}
      </n-alert>

      <n-form-item :label="t('room.join.room_id_or_alias')" path="roomIdOrAlias">
        <n-input
          v-model:value="formData.roomIdOrAlias"
          :placeholder="t('room.join.room_id_or_alias_placeholder')"
          clearable />
      </n-form-item>

      <n-form-item :label="t('room.join.reason')" path="reason">
        <n-input
          v-model:value="formData.reason"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('room.join.reason_placeholder')" />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="$emit('update:visible', false)">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="joining" @click="handleJoin">
          {{ t('room.join.join') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('JoinRoomDialog')

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'joined', roomId: string): void
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const formRef = ref<FormInst>()
const joining = ref(false)

const formData = reactive({
  roomIdOrAlias: '',
  reason: ''
})

const rules: FormRules = {
  roomIdOrAlias: [
    { required: true, message: t('room.join.room_id_or_alias_required'), trigger: 'blur' },
    { min: 3, max: 255, message: t('room.join.room_id_or_alias_length'), trigger: 'blur' }
  ]
}

const handleJoin = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  joining.value = true
  try {
    const room = await matrixRoomService.joinRoom(formData.roomIdOrAlias)
    showFeedback(t('room.join.success'), 'success')
    emit('joined', room?.roomId || formData.roomIdOrAlias)
    emit('update:visible', false)
    resetForm()
  } catch (error: unknown) {
    logger.error('加入房间失败:', error)
    const err = error as { errcode?: string; error?: string }
    if (err?.errcode === 'M_NOT_FOUND') {
      showFeedback(t('room.join.not_found'), 'error')
    } else if (err?.errcode === 'M_ALREADY_JOINED' || err?.error?.includes('already')) {
      showFeedback(t('room.join.already_joined'), 'warning')
    } else if (err?.errcode === 'M_FORBIDDEN') {
      showFeedback(t('room.join.forbidden'), 'error')
    } else {
      showFeedback(t('room.join.failed'), 'error')
    }
  } finally {
    joining.value = false
  }
}

const resetForm = () => {
  formData.roomIdOrAlias = ''
  formData.reason = ''
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      resetForm()
    }
  }
)
</script>

<style scoped lang="scss">
.dialog-footer {
  @apply flex justify-end gap-12px;
}
</style>
