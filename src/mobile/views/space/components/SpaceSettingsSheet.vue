<template>
  <van-action-sheet :show="show" :title="t('space.settings_title')" @update:show="emit('update:show', $event)">
    <div class="create-form">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field v-model="nameInput" :label="t('space.name')" :placeholder="t('space.name_placeholder')" />
          <van-field
            v-model="topicInput"
            :label="t('space.topic')"
            :placeholder="t('space.topic_placeholder')"
            type="textarea"
            rows="3" />
        </van-cell-group>
        <div class="form-actions">
          <van-button block type="primary" native-type="submit" :loading="loading">
            {{ t('common.confirm') }}
          </van-button>
        </div>
      </van-form>
    </div>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'

defineOptions({ name: 'SpaceSettingsSheet' })

const props = defineProps<{
  show: boolean
  loading: boolean
  name?: string | undefined
  topic?: string | undefined
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [payload: Partial<SpaceOptions>]
}>()

const { t } = useI18n()
const nameInput = ref('')
const topicInput = ref('')

// 打开时用当前空间的真实值回填，避免展示上一次编辑的残留
watch(
  () => props.show,
  (value) => {
    if (!value) return
    nameInput.value = props.name ?? ''
    topicInput.value = props.topic ?? ''
  }
)

function handleSubmit() {
  const payload: Partial<SpaceOptions> = {}
  if (nameInput.value && nameInput.value !== (props.name ?? '')) payload.name = nameInput.value
  if (topicInput.value !== (props.topic ?? '')) payload.topic = topicInput.value
  emit('submit', payload)
}
</script>

<style scoped lang="scss">
.create-form {
  padding: 16px;

  .form-actions {
    margin-top: 16px;
  }
}
</style>
