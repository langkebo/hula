<template>
  <van-action-sheet :show="show" :title="t('space.create')" @update:show="emit('update:show', $event)">
    <div class="create-form">
      <van-form @submit="handleCreate">
        <van-cell-group inset>
          <van-field
            v-model="formData.name"
            :label="t('space.name')"
            :placeholder="t('space.name_placeholder')"
            :rules="[{ required: true, message: t('space.name_required') }]" />
          <van-field
            v-model="formData.topic"
            :label="t('space.topic')"
            :placeholder="t('space.topic_placeholder')"
            type="textarea"
            rows="3" />
          <van-field :label="t('space.visibility')">
            <template #input>
              <van-radio-group v-model="formData.visibility" direction="horizontal">
                <van-radio name="private">{{ t('space.private') }}</van-radio>
                <van-radio name="public">{{ t('space.public') }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
        </van-cell-group>
        <div class="form-actions">
          <van-button block type="primary" native-type="submit" :loading="mutating">
            {{ t('common.create') }}
          </van-button>
        </div>
      </van-form>
    </div>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { Visibility } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

defineProps<{ show: boolean }>()

const emit = defineEmits<{
  'update:show': [show: boolean]
  created: []
}>()

const logger = createLogger('SpaceCreateSheet')
const { t } = useI18n()

const mutating = ref(false)
const formData = reactive({
  name: '',
  topic: '',
  visibility: Visibility.Private
})

const handleCreate = async () => {
  mutating.value = true
  try {
    const result = await matrixSpaceService.createSpace({ ...formData })
    if (result) {
      showToast(t('space.create_success'))
      emit('update:show', false)
      emit('created')
      formData.name = ''
      formData.topic = ''
      formData.visibility = Visibility.Private
    }
  } catch (err) {
    logger.error('create space failed', err)
    showToast(t('space.create_failed'))
  } finally {
    mutating.value = false
  }
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
