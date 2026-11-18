<template>
  <van-action-sheet :show="show" :title="t('space.add_room_title')" @update:show="emit('update:show', $event)">
    <div class="create-form">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="roomId"
            :label="t('space.add_room')"
            :placeholder="t('space.add_room_placeholder')"
            :rules="[{ required: true, message: t('space.add_room_required') }]" />
          <van-field :label="t('space.add_room_suggested')">
            <template #input>
              <van-switch v-model="suggested" />
            </template>
          </van-field>
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

defineOptions({ name: 'SpaceAddRoomSheet' })

const props = defineProps<{
  show: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [payload: { roomId: string; suggested: boolean }]
}>()

const { t } = useI18n()
const roomId = ref('')
const suggested = ref(false)

watch(
  () => props.show,
  (value) => {
    if (!value) return
    roomId.value = ''
    suggested.value = false
  }
)

function handleSubmit() {
  emit('submit', { roomId: roomId.value.trim(), suggested: suggested.value })
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
