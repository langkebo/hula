<template>
  <n-popover
    :show="show"
    trigger="click"
    placement="top-start"
    :show-arrow="false"
    style="padding: 0; width: 320px"
    @update:show="emit('update:show', $event)">
    <template #trigger>
      <div class="flex items-center gap-6px cursor-pointer" @click="emit('update:show', !show)">
        <n-avatar v-if="selectedRole" :src="selectedRole.avatar" :size="24" round :fallback-src="getDefaultAvatar()" />
        <Icon v-else icon="mdi:account-circle" class="text-24px color-[--hula-text-tertiary]" />
        <span class="text-(12px [--hula-text-primary])">
          {{ selectedRole ? selectedRole.name : t('ai_assistant.robot.select_role') }}
        </span>
        <Icon icon="mdi:chevron-down" class="text-16px color-[--hula-text-tertiary]" />
      </div>
    </template>
    <div class="role-selector">
      <div class="role-header">
        <span class="role-title">{{ t('ai_assistant.robot.select_role') }}</span>
        <n-button size="small" @click="emit('open-management')">
          <template #icon>
            <Icon icon="mdi:cog" />
          </template>
          {{ t('ai_assistant.robot.manage_short') }}
        </n-button>
      </div>

      <div class="role-list">
        <div v-if="roleLoading" class="loading-container">
          <n-spin size="small" />
          <span class="loading-text">{{ t('ai_assistant.robot.loading') }}</span>
        </div>

        <div v-else-if="roleList.length === 0" class="empty-container">
          <n-empty :description="t('ai_assistant.robot.no_role_data')" size="small">
            <template #icon>
              <Icon icon="mdi:account-off" class="text-24px color-[--hula-text-tertiary]" />
            </template>
          </n-empty>
        </div>

        <div v-else class="roles-container">
          <div
            v-for="role in roleList"
            :key="role.id"
            class="role-item"
            :class="{ active: selectedRole?.id === role.id }"
            @click="emit('select-role', role)">
            <n-avatar :src="role.avatar" :size="32" round :fallback-src="getDefaultAvatar()" />
            <n-flex vertical :size="2" class="flex-1 min-w-0">
              <n-flex align="center" :size="8">
                <span class="role-name">{{ role.name }}</span>
                <n-tag v-if="role.status === 0" size="tiny" type="success">
                  {{ t('ai_assistant.robot.available') }}
                </n-tag>
              </n-flex>
              <span class="role-desc">{{ role.description }}</span>
            </n-flex>
            <Icon
              v-if="selectedRole?.id === role.id"
              icon="mdi:check-circle"
              class="text-18px color-[--primary-color]" />
          </div>
        </div>
      </div>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'

const { t } = useI18n()

defineProps<{
  show: boolean
  selectedRole: ChatRole | null
  roleList: ChatRole[]
  roleLoading: boolean
  getDefaultAvatar: () => string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'select-role': [role: ChatRole]
  'open-management': []
}>()
</script>
