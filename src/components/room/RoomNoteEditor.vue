<template>
  <n-card title="房间备注" :bordered="false" size="small">
    <n-space vertical :size="12">
      <n-alert type="info" :show-icon="false">
        备注仅自己可见，其他成员无法看到。
      </n-alert>

      <n-input
        v-model:value="noteContent"
        type="textarea"
        placeholder="添加房间备注..."
        :rows="3"
        :maxlength="500"
        show-count
        @blur="handleSave"
      />

      <n-space justify="end">
        <n-button size="small" @click="handleSave" :loading="saving">
          保存
        </n-button>
        <n-button size="small" @click="handleDelete" :disabled="!noteContent">
          删除
        </n-button>
      </n-space>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import MatrixRoomAccountDataService from '@/services/matrix/MatrixRoomAccountDataService'

interface Props {
  roomId: string
}

const props = defineProps<Props>()
const message = useMessage()

const noteContent = ref('')
const saving = ref(false)

onMounted(async () => {
  await loadNote()
})

async function loadNote(): Promise<void> {
  try {
    const note = await MatrixRoomAccountDataService.getRoomNote(props.roomId)
    if (note) {
      noteContent.value = note.content
    }
  } catch (error) {
    // 静默失败，备注可能不存在
  }
}

async function handleSave(): Promise<void> {
  if (!noteContent.value.trim()) {
    return
  }

  saving.value = true

  try {
    await MatrixRoomAccountDataService.setRoomNote(props.roomId, noteContent.value)
    message.success('备注已保存')
  } catch (error) {
    message.error(`保存备注失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    saving.value = false
  }
}

async function handleDelete(): Promise<void> {
  try {
    await MatrixRoomAccountDataService.deleteRoomNote(props.roomId)
    noteContent.value = ''
    message.success('备注已删除')
  } catch (error) {
    message.error(`删除备注失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}
</script>
