<template>
  <n-card title="屏蔽用户管理" :bordered="false">
    <template #header-extra>
      <n-tag :type="ignoredUsers.length > 0 ? 'warning' : 'success'">
        {{ ignoredUsers.length }} 个用户
      </n-tag>
    </template>

    <n-space vertical :size="16">
      <n-alert type="warning">
        屏蔽用户后，您将不会收到该用户的消息，该用户也无法邀请您加入房间。
      </n-alert>

      <n-list v-if="ignoredUsers.length > 0" bordered>
        <n-list-item v-for="userId in ignoredUsers" :key="userId">
          <n-thing :title="userId">
            <template #avatar>
              <n-avatar :src="getUserAvatar(userId)" :fallback-src="defaultAvatar" />
            </template>
          </n-thing>
          <template #suffix>
            <n-button size="small" @click="handleUnblock(userId)" :loading="unblocking === userId">
              解除屏蔽
            </n-button>
          </template>
        </n-list-item>
      </n-list>

      <n-empty v-else description="暂无屏蔽用户" />

      <n-button type="primary" block @click="showAddDialog = true">
        添加用户到屏蔽列表
      </n-button>
    </n-space>

    <n-modal v-model:show="showAddDialog" preset="card" title="添加屏蔽用户" style="width: 400px">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="用户 ID" path="userId">
          <n-input
            v-model:value="form.userId"
            placeholder="@user:example.com"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddDialog = false">取消</n-button>
          <n-button type="primary" @click="handleBlock" :loading="blocking">
            屏蔽
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import MatrixAccountService from '@/services/matrix/MatrixAccountService'

const message = useMessage()

const ignoredUsers = ref<string[]>([])
const showAddDialog = ref(false)
const unblocking = ref<string | null>(null)
const blocking = ref(false)

const form = ref({ userId: '' })
const formRef = ref()

const rules = {
  userId: [
    { required: true, message: '请输入用户 ID', trigger: 'blur' },
    { pattern: /^@[\w.-]+:[\w.-]+$/, message: '请输入有效的用户 ID', trigger: 'blur' }
  ]
}

const defaultAvatar =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg=='

onMounted(async () => {
  await loadIgnoredUsers()
})

async function loadIgnoredUsers(): Promise<void> {
  try {
    const users = await MatrixAccountService.getIgnoredUsers()
    ignoredUsers.value = users || []
  } catch (error) {
    message.error(`加载屏蔽用户列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

async function handleUnblock(userId: string): Promise<void> {
  unblocking.value = userId

  try {
    const newUsers = ignoredUsers.value.filter((id) => id !== userId)
    await MatrixAccountService.setIgnoredUsers(newUsers)
    ignoredUsers.value = newUsers
    message.success('已解除屏蔽')
  } catch (error) {
    message.error(`解除屏蔽失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    unblocking.value = null
  }
}

async function handleBlock(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  blocking.value = true

  try {
    const newUsers = [...ignoredUsers.value, form.value.userId]
    await MatrixAccountService.setIgnoredUsers(newUsers)
    ignoredUsers.value = newUsers
    showAddDialog.value = false
    form.value.userId = ''
    message.success('已屏蔽用户')
  } catch (error) {
    message.error(`屏蔽用户失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    blocking.value = false
  }
}

function getUserAvatar(_userId: string): string {
  // TODO: 获取用户头像
  return ''
}
</script>
