<template>
  <!-- 新增/编辑模型弹窗 -->
  <n-modal
    v-model:show="show"
    preset="card"
    :title="editingModel ? t('ai_assistant.robot.edit_model') : t('ai_assistant.robot.add_model')"
    style="width: 750px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <n-scrollbar style="max-height: calc(80vh - 140px)">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-placement="left"
        label-width="120px"
        style="padding-right: 12px">
        <n-form-item :label="t('ai_assistant.robot.api_key_label')" path="keyId">
          <n-flex :size="8" style="width: 100%">
            <n-select
              v-model:value="formData.keyId"
              :options="apiKeyOptions"
              :placeholder="t('ai_assistant.robot.select_api_key')"
              style="flex: 1"
              @update:value="emit('keyIdChange', $event)" />
            <n-button @click="emit('openApiKeyManagement')">
              <template #icon>
                <Icon icon="mdi:cog" />
              </template>
              {{ t('ai_assistant.robot.manage') }}
            </n-button>
          </n-flex>
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.platform_label_select')" path="platform">
          <n-input
            v-model:value="formData.platform"
            :placeholder="t('ai_assistant.robot.platform_auto_set')"
            disabled />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_avatar')" path="avatar">
          <n-flex :size="12" align="center" style="width: 100%">
            <n-avatar :key="formData.avatar" :src="formData.avatar" :size="60" round fallback-src="">
              <Icon v-if="!formData.avatar" icon="mdi:account-circle" :size="40" />
            </n-avatar>
            <n-flex vertical :size="8" style="flex: 1">
              <n-button size="small" @click="openAvatarCropper">
                <template #icon>
                  <Icon icon="mdi:upload" />
                </template>
                {{ formData.avatar ? t('ai_assistant.robot.change_avatar') : t('ai_assistant.robot.upload_avatar') }}
              </n-button>
              <span v-if="formData.avatar" class="text-(12px [--tjg-text-tertiary])">
                {{ t('ai_assistant.robot.uploaded') }}
                <n-button text type="error" size="tiny" @click="formData.avatar = ''">
                  {{ t('ai_assistant.robot.clear') }}
                </n-button>
              </span>
            </n-flex>
          </n-flex>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileChange" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_type_label')" path="type">
          <n-flex :size="8" style="flex-wrap: wrap">
            <n-button :type="formData.type === 1 ? 'primary' : 'default'" size="small" @click="formData.type = 1">
              <template #icon>
                <Icon icon="mdi:message-text" />
              </template>
              {{ t('ai_assistant.robot.model_type_chat') }}
            </n-button>
            <n-button :type="formData.type === 2 ? 'primary' : 'default'" size="small" @click="formData.type = 2">
              <template #icon>
                <Icon icon="mdi:image" />
              </template>
              {{ t('ai_assistant.robot.model_type_image') }}
            </n-button>
            <n-button :type="formData.type === 3 ? 'primary' : 'default'" size="small" @click="formData.type = 3">
              <template #icon>
                <Icon icon="mdi:microphone" />
              </template>
              {{ t('ai_assistant.robot.model_type_audio') }}
            </n-button>
            <n-button :type="formData.type === 7 ? 'primary' : 'default'" size="small" @click="formData.type = 7">
              <template #icon>
                <Icon icon="mdi:video-outline" />
              </template>
              {{ t('ai_assistant.robot.model_type_text2video') }}
            </n-button>
            <n-button :type="formData.type === 8 ? 'primary' : 'default'" size="small" @click="formData.type = 8">
              <template #icon>
                <Icon icon="mdi:video-image" />
              </template>
              {{ t('ai_assistant.robot.model_type_image2video') }}
            </n-button>
          </n-flex>
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_name')" path="name">
          <n-input
            v-model:value="formData.name"
            :placeholder="t('ai_assistant.robot.model_name_placeholder')"
            @update:value="emit('nameChange', $event)" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_flag')" path="model">
          <n-flex vertical :size="4" style="width: 100%">
            <n-flex :size="8" style="width: 100%">
              <n-select
                v-if="modelExamples.length > 0"
                v-model:value="formData.model"
                :options="modelExamples"
                :placeholder="modelPlaceholder"
                :disabled="!formData.platform"
                filterable
                tag
                style="flex: 1" />
              <n-input
                v-else
                v-model:value="formData.model"
                :placeholder="modelPlaceholder"
                :disabled="!formData.platform"
                style="flex: 1" />
              <n-button v-if="modelDocsUrl" text type="info" style="padding: 0" @click="openExternalUrl(modelDocsUrl)">
                {{ t('ai_assistant.robot.view_docs') }}
              </n-button>
            </n-flex>
            <n-text depth="3" style="font-size: 12px">
              {{ modelHint }}
            </n-text>
            <n-flex v-if="modelDocsUrl" align="center" :size="8" class="mt-4px">
              <n-text depth="3" style="font-size: 12px">{{ t('ai_assistant.robot.view_docs_label') }}</n-text>
              <n-button text type="info" style="font-size: 12px" @click="openExternalUrl(modelDocsUrl)">
                {{ modelDocsUrl }}
              </n-button>
            </n-flex>
          </n-flex>
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.status_label')" path="status">
          <n-select
            v-model:value="formData.status"
            :options="statusOptions"
            :placeholder="t('ai_assistant.robot.select_status')" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.sort_value')" path="sort">
          <n-input-number
            v-model:value="formData.sort"
            :min="0"
            :placeholder="t('ai_assistant.robot.sort_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.temperature_param')" path="temperature">
          <n-input-number
            v-model:value="formData.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :placeholder="t('ai_assistant.robot.temperature_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.max_token')" path="maxTokens">
          <n-input-number
            v-model:value="formData.maxTokens"
            :min="1"
            :placeholder="t('ai_assistant.robot.max_token_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.max_context')" path="maxContexts">
          <n-input-number
            v-model:value="formData.maxContexts"
            :min="1"
            :placeholder="t('ai_assistant.robot.max_context_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.is_public')" path="publicStatus">
          <n-switch :value="formData.publicStatus === 0" @update:value="emit('publicStatusChange', $event)">
            <template #checked>{{ t('ai_assistant.robot.public') }}</template>
            <template #unchecked>{{ t('ai_assistant.robot.private') }}</template>
          </n-switch>
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="show = false">{{ t('ai_assistant.robot.cancel') }}</n-button>
        <n-button type="primary" @click="emit('submit')" :loading="submitting">
          {{ editingModel ? t('ai_assistant.robot.save') : t('ai_assistant.robot.create') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>

  <!-- 头像裁剪组件 -->
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormInst, FormRules, SelectOption } from 'naive-ui'
import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import type { FormModel } from '../composables/useModelForm'

const props = defineProps<{
  editingModel: AIModel | null
  submitting: boolean
  formData: FormModel
  formRules: FormRules
  statusOptions: SelectOption[]
  apiKeyOptions: SelectOption[]
  modelExamples: SelectOption[]
  modelDocsUrl: string
  modelPlaceholder: string
  modelHint: string
}>()

const emit = defineEmits<{
  submit: []
  keyIdChange: [keyId: string]
  nameChange: [value: string]
  publicStatusChange: [checked: boolean]
  openApiKeyManagement: []
}>()

const show = defineModel<boolean>('show', { default: false })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const formRef = ref<FormInst>()

// 头像上传（裁剪成功后写回表单 avatar 字段）
const { localImageUrl, showCropper, cropperRef, fileInput, openAvatarCropper, handleFileChange, handleCrop } =
  useAvatarUpload({
    onSuccess: async (mxcUrl) => {
      props.formData.avatar = ''
      await nextTick()
      props.formData.avatar = mxcUrl
      await nextTick()
      showFeedback(t('ai_assistant.robot.avatar_upload_success'), 'success')
    }
  })

// 暴露表单校验入口给父组件（useModelForm.handleSubmit 使用）
const validate = () => formRef.value?.validate()

defineExpose({ validate })
</script>
