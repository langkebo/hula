<template>
  <n-card title="屏蔽用户管理" :bordered="false">
    <template #header-extra>
      <n-tag :type="ignoredUsers.length > 0 ? 'warning' : 'default'">
        {{ ignoredUsers.length }} 人
      </n-tag>
    </template>

    <n-space vertical :size="16">
      <n-alert type="info">
        屏蔽用户后，您将不会收到该用户的消息和邀请。
      </n-alert>

      <n-input-group>
        <n-input
          v-model:value="newUserId"
          placeholder="输入用户 ID，如 @user:example.com"
          @keyup.enter="addIgnoredUser" />
        <n-button type="primary" @click="addIgnoredUser" :loading="loading">
          添加
        </n-button>
      </n-input-group>

      <n-list v-if="ignoredUsers.length > 0" bordered>
        <n-list-item v-for="userId in ignoredUsers" :key="userId">
          <template #prefix>
            <n-avatar round :size="32">
              {{ userId.charAt(1).toUpperCase() }}
            </n-avatar>
          </template>

          <n-thing :title="userId">
            <template #description>
              <n-text depth="3">已屏蔽</n-text>
            </template>
          </n-thing>

          <template #suffix>
            <n-button
              size="small"
              @click="removeIgnoredUser(userId)"
              :loading="loading">
              解除屏蔽
            </n-button>
          </template>
        </n-list-item>
      </n-list>

      <n-empty v-else description="暂无屏蔽用户" />
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { matrixAccountService } from '@/services/matrix/MatrixAccountService'
import { useMessage } from 'naive-ui'

const message = useMessage()

const ignoredUsers = ref<string[]>([])
const newUserId = ref('')
const loading = ref(false)

onMounted(async () => {
  await loadIgnoredUsers()
})

async function loadIgnoredUsers(): Promise<void> {
  loading.value = true

  try {
    const users = await matrixAccountService.getIgnoredUsers()
    ignoredUsers.value = users || []
  } catch (error) {
    message.error(`加载屏蔽列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function addIgnoredUser(): Promise<void> {
  if (!newUserId.value.trim()) {
    message.warning('请输入用户 ID')
    return
  }

  if (!newUserId.value.startsWith('@')) {
    message.warning('用户 ID 必须以 @ 开头')
    return
  }

  if (ignoredUsers.value.includes(newUserId.value)) {
    message.warning('该用户已在屏蔽列表中')
    return
  }

  loading.value = true

  try {
    const updatedList = [...ignoredUsers.value, newUserId.value]
    await matrixAccountService.setIgnoredUsers(updatedList)
    ignoredUsers.value = updatedList
    newUserId.value = ''
    message.success('已添加到屏蔽列表')
  } catch (error) {
    message.error(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function removeIgnoredUser(userId: string): Promise<void> {
  loading.value = true

  try {
    const updatedList = ignoredUsers.value.filter((id) => id !== userId)
    await matrixAccountService.setIgnoredUsers(updatedList)
    ignoredUsers.value = updatedList
    message.success('已解除屏蔽')
  } catch (error) {
    message.error(`解除屏蔽失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}
</script>
