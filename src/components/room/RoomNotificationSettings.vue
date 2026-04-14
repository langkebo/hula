<template>
  <n-card title="房间通知设置" :bordered="false">
    <n-space vertical :size="16">
      <n-alert type="info">
        您可以为此房间设置独立的通知规则，覆盖全局设置。
      </n-alert>

      <n-form-item label="通知模式">
        <n-radio-group v-model:value="notificationMode" @update:value="handleModeChange">
          <n-radio value="default">使用全局设置</n-radio>
          <n-radio value="all">始终通知</n-radio>
          <n-radio value="mentions">仅提及和直接消息</n-radio>
          <n-radio value="none">静音</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item v-if="notificationMode === 'mentions'" label="关键词">
        <n-dynamic-tags v-model:value="keywords" @update:value="handleKeywordsChange" />
      </n-form-item>
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

const notificationMode = ref<string>('default')
const keywords = ref<string[]>([])

onMounted(async () => {
  await loadSettings()
})

async function loadSettings(): Promise<void> {
  try {
    const settings = await MatrixRoomAccountDataService.getRoomNotificationSettings(props.roomId)
    if (settings) {
      notificationMode.value = settings.mode || 'default'
      keywords.value = settings.keywords || []
    }
  } catch (error) {
    message.error(`加载通知设置失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

async function handleModeChange(value: string): Promise<void> {
  try {
    await MatrixRoomAccountDataService.setRoomNotificationSettings(props.roomId, {
      mode: value,
      keywords: keywords.value
    })
    message.success('通知设置已更新')
  } catch (error) {
    message.error(`更新通知设置失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

async function handleKeywordsChange(value: string[]): Promise<void> {
  try {
    await MatrixRoomAccountDataService.setRoomNotificationSettings(props.roomId, {
      mode: notificationMode.value,
      keywords: value
    })
  } catch (error) {
    message.error(`更新关键词失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}
</script>
