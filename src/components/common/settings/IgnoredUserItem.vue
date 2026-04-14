<script setup lang="ts">
/**
 * 屏蔽用户项组件
 * 用于显示和管理被屏蔽的用户
 */
import { NListItem, NButton, NAvatar, NSpace, NPopconfirm } from 'naive-ui'
import { Icon } from '@iconify/vue'

interface Props {
  userId: string
  displayName?: string
  avatarUrl?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  displayName: '',
  avatarUrl: '',
  loading: false
})

const emit = defineEmits<{
  unblock: [userId: string]
}>()

const onUnblock = () => {
  emit('unblock', props.userId)
}
</script>

<template>
  <n-list-item>
    <template #prefix>
      <n-avatar
        round
        :size="40"
        :src="avatarUrl"
      >
        <template #fallback>
          <Icon icon="mdi:account" />
        </template>
      </n-avatar>
    </template>
    <div class="ignored-user-info">
      <div class="ignored-user-name">
        {{ displayName || userId }}
      </div>
      <div class="ignored-user-id">
        {{ userId }}
      </div>
    </div>
    <template #suffix>
      <n-popconfirm @positive-click="onUnblock">
        <template #trigger>
          <n-button size="small" type="warning" :loading="loading">
            解除屏蔽
          </n-button>
        </template>
        确定要解除对此用户的屏蔽吗？
      </n-popconfirm>
    </template>
  </n-list-item>
</template>

<style scoped>
.ignored-user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ignored-user-name {
  font-weight: 500;
}

.ignored-user-id {
  font-size: 12px;
  color: var(--n-text-color-3);
}
</style>
