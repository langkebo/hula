<template>
  <div class="create-space-pane flex-1 min-h-0 flex flex-col">
    <!-- 草稿恢复提示 -->
    <Transition name="hint-fade">
      <div v-if="showRestoredHint" class="create-space-pane__hint" role="status" aria-live="polite">
        <svg class="size-14px"><use href="#info"></use></svg>
        <span>{{ t('common.draft_restored', '已恢复上次编辑内容') }}</span>
      </div>
    </Transition>

    <n-scrollbar class="flex-1 min-h-0">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-placement="left"
        label-width="80"
        class="px-20px py-16px">
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

        <n-form-item :label="t('space.avatar')" path="avatarUrl">
          <n-upload :max="1" accept="image/*" :custom-request="handleAvatarUpload" :show-file-list="false">
            <n-avatar round :size="64" :src="formData.avatarUrl || undefined" />
          </n-upload>
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <!-- 底部操作栏 -->
    <div
      class="create-space-pane__footer flex items-center justify-end gap-12px px-20px py-12px border-t border-[--tjg-border-layout-divider]">
      <n-button type="primary" :loading="loading" @click="handleSubmit">
        {{ t('common.create') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FormInst, UploadCustomRequestOptions } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type SpaceInfo, useSpaces } from '@/composables/space'
import { buildSpaceWorkbenchRoute } from '@/router/spaceNavigation'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { useRightViewDraftStore } from '@/stores/domains/widget/rightViewDraft'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('CreateSpacePane')
const RESTORED_HINT_DURATION = 3000

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const draftStore = useRightViewDraftStore()
const { create: createSpace } = useSpaces()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const showRestoredHint = ref(false)

const formData = reactive({
  name: '',
  topic: '',
  avatarUrl: ''
})

const rules = {
  name: {
    required: true,
    message: t('space.name_required')
  }
}

const handleAvatarUpload = async (options: UploadCustomRequestOptions) => {
  try {
    const file = options.file.file as File
    const result = await matrixMediaService.uploadFile(file)
    formData.avatarUrl = result.contentUri
    options.onFinish()
  } catch (error) {
    logger.error('[CreateSpacePane] 上传头像失败:', error)
    options.onError()
  }
}

const handleSubmit = async () => {
  try {
    loading.value = true
    await formRef.value?.validate()
    const createdSpace = await createSpace({
      name: formData.name,
      topic: formData.topic,
      avatarUrl: formData.avatarUrl
    })
    if (!createdSpace) {
      showFeedback(t('space.create_failed'), 'error')
      return
    }
    showFeedback(t('space.create_success'), 'success')
    // 创建成功后清除草稿
    draftStore.clearCreateSpace()
    // 跳转到新空间工作台
    const { default: router } = await import('@/router')
    void router.replace(buildSpaceWorkbenchRoute((createdSpace as SpaceInfo).spaceId))
  } catch (error) {
    logger.error('[CreateSpacePane] 创建空间失败:', error)
    showFeedback(t('space.create_failed'), 'error')
  } finally {
    loading.value = false
  }
}

// 自动同步草稿
watch(
  formData,
  (value) => {
    draftStore.saveCreateSpace({ ...value })
  },
  { deep: true }
)

onMounted(() => {
  const draft = draftStore.createSpace
  const hasDraft = draft.name.trim().length > 0 || draft.topic.trim().length > 0 || draft.avatarUrl.length > 0

  if (hasDraft) {
    formData.name = draft.name
    formData.topic = draft.topic
    formData.avatarUrl = draft.avatarUrl
    showRestoredHint.value = true
    draftStore.setRestoredHint('createSpace')
    setTimeout(() => {
      showRestoredHint.value = false
      if (draftStore.restoredHint === 'createSpace') {
        draftStore.setRestoredHint(null)
      }
    }, RESTORED_HINT_DURATION)
  }
})
</script>

<style scoped lang="scss">
.create-space-pane {
  background: var(--tjg-surface-panel);
}

.create-space-pane__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--tjg-color-primary-50);
  color: var(--tjg-color-primary-600, var(--tjg-color-primary-500));
  font-size: 12px;
  border-bottom: 1px solid var(--tjg-color-primary-100);
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
