<template>
  <van-action-sheet :show="show" :title="t('space.invite_title')" @update:show="emit('update:show', $event)">
    <div class="create-form">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="userId"
            :label="t('space.invite_title')"
            :placeholder="t('space.invite_user_placeholder')"
            :rules="[{ required: true, message: t('space.invite_user_required') }]" />
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

defineOptions({ name: 'SpaceInviteSheet' })

const props = defineProps<{
  show: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [userId: string]
}>()

const { t } = useI18n()
const userId = ref('')

// 每次打开都清空上一次输入，避免残留旧账号导致误邀请
watch(
  () => props.show,
  (value) => {
    if (value) userId.value = ''
  }
)

function handleSubmit() {
  emit('submit', userId.value.trim())
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
