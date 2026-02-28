<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('poll.create.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="poll-create-dialog"
    style="width: 480px; max-width: 90vw">
    <n-flex vertical :size="16">
      <n-form ref="formRef" :model="pollForm" :rules="rules">
        <n-form-item :label="t('poll.create.question')" path="question">
          <n-input
            v-model:value="pollForm.question"
            type="textarea"
            :placeholder="t('poll.create.question_placeholder')"
            :maxlength="500"
            :autosize="{ minRows: 2, maxRows: 4 }"
            show-count />
        </n-form-item>

        <n-form-item :label="t('poll.create.options')" path="options">
          <n-flex vertical :size="8" class="w-full">
            <n-flex v-for="(option, index) in pollForm.options" :key="index" :size="8" align="center">
              <n-input
                v-model:value="option.text"
                :placeholder="t('poll.create.option_placeholder', { n: index + 1 })"
                :maxlength="200" />
              <n-button v-if="pollForm.options.length > 2" quaternary circle size="small" @click="removeOption(index)">
                <template #icon>
                  <n-icon>
                    <svg><use href="#close" /></svg>
                  </n-icon>
                </template>
              </n-button>
            </n-flex>
            <n-button v-if="pollForm.options.length < 10" dashed block @click="addOption">
              <template #icon>
                <n-icon>
                  <svg><use href="#plus" /></svg>
                </n-icon>
              </template>
              {{ t('poll.create.add_option') }}
            </n-button>
          </n-flex>
        </n-form-item>

        <n-form-item :label="t('poll.create.settings')">
          <n-flex vertical :size="8">
            <n-checkbox v-model:checked="pollForm.isAnonymous">
              {{ t('poll.create.anonymous') }}
            </n-checkbox>
            <n-checkbox v-model:checked="pollForm.allowMultiple">
              {{ t('poll.create.multiple') }}
            </n-checkbox>
            <n-flex align="center" :size="8">
              <n-checkbox v-model:checked="pollForm.hasDeadline">
                {{ t('poll.create.deadline') }}
              </n-checkbox>
              <n-date-picker
                v-if="pollForm.hasDeadline"
                v-model:value="pollForm.deadline"
                type="datetime"
                :disabled-date="disabledDate"
                clearable />
            </n-flex>
          </n-flex>
        </n-form-item>
      </n-form>
    </n-flex>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="creating" @click="handleCreate">
          {{ t('poll.create.submit') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FormInst, FormRules } from 'naive-ui'
import { matrixPollService } from '@/services/matrix/MatrixPollService'

const { t } = useI18n()

const visible = defineModel<boolean>('show', { default: false })
const emit = defineEmits<(e: 'created', pollId: string) => void>()

const props = defineProps<{
  roomId: string
}>()

const formRef = ref<FormInst>()
const creating = ref(false)

const pollForm = reactive({
  question: '',
  options: [{ text: '' }, { text: '' }],
  isAnonymous: false,
  allowMultiple: false,
  hasDeadline: false,
  deadline: null as number | null
})

const rules: FormRules = {
  question: {
    required: true,
    message: t('poll.create.question_required'),
    trigger: 'blur'
  }
}

const disabledDate = (ts: number) => {
  return ts < Date.now()
}

const addOption = () => {
  if (pollForm.options.length < 10) {
    pollForm.options.push({ text: '' })
  }
}

const removeOption = (index: number) => {
  pollForm.options.splice(index, 1)
}

const handleCreate = async () => {
  await formRef.value?.validate()

  const validOptions = pollForm.options.filter((o) => o.text.trim())
  if (validOptions.length < 2) {
    window.$message.error(t('poll.create.options_required'))
    return
  }

  creating.value = true

  try {
    const result = await matrixPollService.createPoll(
      props.roomId,
      pollForm.question,
      validOptions.map((o) => o.text),
      pollForm.hasDeadline && pollForm.deadline ? pollForm.deadline : undefined
    )

    window.$message.success(t('poll.create.success'))
    emit('created', result)
    handleCancel()
  } catch (err) {
    window.$message.error(t('poll.create.error'))
  } finally {
    creating.value = false
  }
}

const handleCancel = () => {
  visible.value = false
  resetForm()
}

const resetForm = () => {
  pollForm.question = ''
  pollForm.options = [{ text: '' }, { text: '' }]
  pollForm.isAnonymous = false
  pollForm.allowMultiple = false
  pollForm.hasDeadline = false
  pollForm.deadline = null
}

watch(visible, (val) => {
  if (!val) {
    resetForm()
  }
})
</script>

<style scoped lang="scss">
.poll-create-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  :deep(.n-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
  }
}
</style>
