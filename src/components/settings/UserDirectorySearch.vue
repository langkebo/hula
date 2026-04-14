<template>
  <n-modal :show="show" @update:show="emit('update:show', $event)" preset="card" title="搜索用户" style="width: 500px">
    <n-input
      v-model:value="searchQuery"
      placeholder="输入用户名或邮箱"
      @input="handleSearch"
      clearable
    >
      <template #prefix>
        <Icon icon="mdi:magnify" :width="18" />
      </template>
    </n-input>

    <n-spin :show="loading" class="mt-16px">
      <n-list v-if="searchResults.length > 0" bordered>
        <n-list-item v-for="user in searchResults" :key="user.userId">
          <n-thing :title="user.displayName || user.userId">
            <template #avatar>
              <n-avatar :src="user.avatarUrl" :fallback-src="defaultAvatar" />
            </template>
            <template #description>
              <n-text depth="3">{{ user.userId }}</n-text>
            </template>
          </n-thing>
          <template #suffix>
            <n-button size="small" @click="handleSelectUser(user)">
              选择
            </n-button>
          </template>
        </n-list-item>
      </n-list>

      <n-empty v-else-if="searchQuery && !loading" description="未找到用户" />
    </n-spin>

    <template #footer>
      <n-space justify="end">
        <n-button @click="visible = false">关闭</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMessage, NIcon } from 'naive-ui'
import { Icon } from '@iconify/vue'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { matrixUserDirectoryService } from '@/services/matrix/MatrixUserDirectoryService'

interface User {
  userId: string
  displayName?: string
  avatarUrl?: string
}

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'select', user: User): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const message = useMessage()
const loading = ref(false)
const searchQuery = ref('')
const searchResults = ref<User[]>([])

const defaultAvatar =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg=='

const visible = ref(props.show)

watch(
  () => props.show,
  (val) => {
    visible.value = val
  }
)

watch(visible, (val) => {
  emit('update:show', val)
  if (!val) {
    searchQuery.value = ''
    searchResults.value = []
  }
})

let searchTimer: number | null = null

async function handleSearch(): Promise<void> {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  searchTimer = window.setTimeout(async () => {
    await performSearch()
  }, 300)
}

async function performSearch(): Promise<void> {
  if (!searchQuery.value.trim()) return

  loading.value = true

  try {
    if (!matrixClientService.isConnected()) return

    const result = await matrixUserDirectoryService.searchUsers(searchQuery.value, 10)

    searchResults.value = (result || []).map((user: { userId: string; displayName?: string; avatarUrl?: string }) => ({
      userId: user.userId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    }))
  } catch (error) {
    message.error(`搜索失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

function handleSelectUser(user: User): void {
  emit('select', user)
  visible.value = false
}
</script>

<style scoped>
.mt-16px {
  margin-top: 16px;
}
</style>
