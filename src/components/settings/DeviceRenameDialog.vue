<template>
  <n-modal :show="show" @update:show="emit('update:show', $event)" preset="card" title="重命名设备" style="width: 400px">
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
      <n-form-item label="设备 ID">
        <n-input :value="deviceId" disabled />
      </n-form-item>

      <n-form-item label="设备名称" path="displayName">
        <n-input
          v-model:value="form.displayName"
          placeholder="请输入设备名称"
          :maxlength="50"
          show-count
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" @click="handleConfirm" :loading="loading"> 确定 </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import matrixAccountService from '@/services/matrix/MatrixAccountService'

interface Props {
  show: boolean
  deviceId: string
  currentName?: string
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const message = useMessage()
const loading = ref(false)
const formRef = ref()

const form = ref({
  displayName: ''
})

const rules = {
  displayName: [
    { required: true, message: '请输入设备名称', trigger: 'blur' },
    { min: 1, max: 50, message: '设备名称长度为 1-50 个字符', trigger: 'blur' }
  ]
}

const visible = ref(props.show)

watch(
  () => props.show,
  (val) => {
    visible.value = val
    if (val) {
      form.value.displayName = props.currentName || ''
    }
  }
)

watch(visible, (val) => {
  emit('update:show', val)
})

async function handleConfirm(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true

  try {
    await matrixAccountService.setDeviceName(props.deviceId, form.value.displayName)

    message.success('设备名称已更新')
    emit('success')
    visible.value = false
  } catch (error) {
    message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

function handleCancel(): void {
  visible.value = false
}
</script>
