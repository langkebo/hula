<template>
  <n-drawer v-model:show="visible" placement="right" :width="440">
    <n-drawer-content :title="t('space.create_room_title')" closable>
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

      <!-- 房间已建但未入空间：留在抽屉内给出一键重新加入，避免用户重新建房 -->
      <div v-if="pendingAttachRoomId" class="space-create-room-pane__attach" role="alert">
        <span class="space-create-room-pane__attach-text">{{ t('space.create_room_attach_failed') }}</span>
        <n-button
          type="warning"
          size="small"
          :loading="submitting"
          data-testid="space-room-attach-retry"
          @click="handleAttachRetry">
          {{ t('space.create_room_attach_retry') }}
        </n-button>
      </div>

      <template #footer>
        <div class="space-create-room-pane__footer">
          <n-button tertiary @click="visible = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.create') }}</n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { NButton, NDrawer, NDrawerContent, NForm, NFormItem, NInput, NSwitch } from 'naive-ui'
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
const { createRoomInSpace, addRoom, error: createError } = useSpaceRooms(() => props.spaceId)

const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v)
})

const formRef = ref<FormInst | null>(null)
const submitting = ref(false)
/** 房间已建、未入空间的中间态：保留房间 ID 供一键重新加入 */
const pendingAttachRoomId = ref<string | null>(null)
const pendingSuggested = ref(false)

const formData = reactive({
  name: '',
  topic: '',
  suggested: false
})

const rules = {
  name: {
    required: true,
    // 名称先 trim 再判空：全空白视为未填写，阻止提交
    validator: () => {
      const name = formData.name.trim()
      if (!name) {
        return new Error(t('space.create_room_name_required'))
      }
      return true
    },
    trigger: ['input', 'blur']
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.suggested = false
}

// 关闭弹窗时重置表单与中间态，避免下次打开残留旧数据
watch(visible, (open) => {
  if (!open) {
    resetForm()
    pendingAttachRoomId.value = null
  }
})

/** 收尾：关闭抽屉并跳转新房间（成功创建 / 重新加入成功共用） */
const finishCreation = async (roomId: string) => {
  resetForm()
  visible.value = false
  try {
    await openMsgSessionByRoomId(roomId)
  } catch (navErr) {
    logger.warn('navigate to new room failed', navErr)
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const name = formData.name.trim()
  // 兜底：全空白名称直接阻止提交（不依赖表单组件实现）
  if (!name) {
    showFeedback(t('space.create_room_name_required'), 'error')
    return
  }
  submitting.value = true
  pendingAttachRoomId.value = null
  try {
    const result = await createRoomInSpace({
      name,
      ...(formData.topic.trim() ? { topic: formData.topic.trim() } : {}),
      suggested: formData.suggested
    })
    if (!result.roomId) {
      const errMsg = createError.value || ''
      if (errMsg.includes('M_ROOM_IN_USE') || errMsg.includes('already in use')) {
        // 同名房间：提示修改名称，保留表单数据（不做 ignoreDuplicateName 逃生阀）
        showFeedback(t('space.create_room_duplicate'), 'error')
      } else {
        showFeedback(t('space.create_room_failed'), 'error')
      }
      return
    }
    emit('created', result.roomId)
    if (!result.attached) {
      // 房间已建、未入空间：变更只完成一半。不关闭抽屉，给出「重新加入空间」一键动作，
      // 避免用户按创建失败处理后重新建房产生重复房间。
      pendingAttachRoomId.value = result.roomId
      pendingSuggested.value = formData.suggested
      showFeedback(t('space.create_room_attach_failed'), 'warning')
      return
    }
    showFeedback(t('space.create_room_success'), 'success')
    await finishCreation(result.roomId)
  } catch (err) {
    logger.error('create room pane submit failed', err)
    showFeedback(t('space.create_room_failed'), 'error')
  } finally {
    submitting.value = false
  }
}

/** 中间态重试：把已创建的房间重新挂载到当前空间 */
const handleAttachRetry = async () => {
  const roomId = pendingAttachRoomId.value
  if (!roomId) return
  submitting.value = true
  try {
    const ok = await addRoom(roomId, { suggested: pendingSuggested.value })
    if (!ok) {
      showFeedback(t('space.add_room_failed'), 'error')
      return
    }
    pendingAttachRoomId.value = null
    showFeedback(t('space.create_room_success'), 'success')
    await finishCreation(roomId)
  } catch (err) {
    logger.error('attach retry failed', err)
    showFeedback(t('space.add_room_failed'), 'error')
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

.space-create-room-pane__attach {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: var(--tjg-radius-md, 8px);
  background: var(--tjg-color-warning-bg);
  color: var(--tjg-color-warning-700);
  font-size: 13px;
  line-height: 1.4;
}
</style>
