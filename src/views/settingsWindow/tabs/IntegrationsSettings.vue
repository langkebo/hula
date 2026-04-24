<template>
  <div class="integrations-settings">
    <div class="settings-section">
      <h3 class="section-title">集成管理</h3>
      <p class="section-desc">管理第三方集成和小部件，扩展 HuLa 的功能。</p>
    </div>

    <n-divider />

    <div class="settings-section">
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用集成</span>
          <span class="setting-desc">允许使用第三方集成和小部件</span>
        </div>
        <n-switch v-model:value="integrationsEnabled" @update:value="handleIntegrationsToggle" />
      </div>
    </div>

    <n-divider />

    <div v-if="integrationsEnabled" class="settings-section">
      <h3 class="section-title">已安装的集成</h3>

      <n-spin :show="loading">
        <div v-if="integrations.length > 0" class="integrations-list">
          <div v-for="integration in integrations" :key="integration.id" class="integration-item">
            <div class="integration-icon">
              <img v-if="integration.icon" :src="integration.icon" :alt="integration.name" />
              <Icon v-else icon="mdi:puzzle" :width="32" />
            </div>
            <div class="integration-info">
              <div class="integration-name">{{ integration.name }}</div>
              <div class="integration-desc">{{ integration.description }}</div>
              <div class="integration-meta">
                <span class="integration-version">v{{ integration.version }}</span>
                <span class="integration-status" :class="integration.enabled ? 'enabled' : 'disabled'">
                  {{ integration.enabled ? '已启用' : '已禁用' }}
                </span>
              </div>
            </div>
            <div class="integration-actions">
              <n-switch
                v-model:value="integration.enabled"
                size="small"
                @update:value="() => handleToggleIntegration(integration)" />
              <n-button size="tiny" quaternary @click="handleConfigureIntegration(integration)">
                <template #icon><Icon icon="mdi:cog" :width="14" /></template>
              </n-button>
              <n-button size="tiny" quaternary @click="handleRemoveIntegration(integration)">
                <template #icon><Icon icon="mdi:delete" :width="14" /></template>
              </n-button>
            </div>
          </div>
        </div>
        <n-empty v-else description="暂无已安装的集成" />
      </n-spin>
    </div>

    <n-divider />

    <div v-if="integrationsEnabled" class="settings-section">
      <h3 class="section-title">添加集成</h3>

      <div class="add-integration">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索集成..."
          clearable
          @keyup.enter="handleSearchIntegrations">
          <template #prefix>
            <Icon icon="mdi:magnify" :width="16" />
          </template>
        </n-input>
        <n-button type="primary" @click="handleOpenIntegrationsManager">浏览集成商店</n-button>
      </div>

      <div v-if="availableIntegrations.length > 0" class="available-list">
        <div class="available-title">推荐集成</div>
        <div v-for="integration in availableIntegrations" :key="integration.id" class="available-item">
          <div class="available-icon">
            <Icon :icon="integration.icon || 'mdi:puzzle'" :width="24" />
          </div>
          <div class="available-info">
            <div class="available-name">{{ integration.name }}</div>
            <div class="available-desc">{{ integration.description }}</div>
          </div>
          <n-button size="small" @click="handleInstallIntegration(integration)">安装</n-button>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">集成权限</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">允许访问用户信息</span>
          <span class="setting-desc">集成可以访问您的显示名称和头像</span>
        </div>
        <n-switch v-model:value="permissions.userInfo" @update:value="handlePermissionChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">允许访问房间列表</span>
          <span class="setting-desc">集成可以查看您加入的房间</span>
        </div>
        <n-switch v-model:value="permissions.roomList" @update:value="handlePermissionChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">允许发送消息</span>
          <span class="setting-desc">集成可以代表您发送消息</span>
        </div>
        <n-switch v-model:value="permissions.sendMessage" @update:value="handlePermissionChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NSwitch, NButton, NDivider, NSpin, NEmpty, NInput, useMessage, useDialog } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('IntegrationsSettings')

defineOptions({
  name: 'IntegrationsSettings'
})

interface Integration {
  id: string
  name: string
  description: string
  version: string
  icon?: string
  enabled: boolean
}

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const integrationsEnabled = ref(true)
const searchQuery = ref('')

const integrations = ref<Integration[]>([
  {
    id: 'github',
    name: 'GitHub',
    description: '接收 GitHub 通知和问题更新',
    version: '1.2.0',
    icon: 'mdi:github',
    enabled: true
  },
  {
    id: 'giphy',
    name: 'Giphy',
    description: '搜索和发送 GIF 动图',
    version: '2.0.1',
    icon: 'mdi:gif',
    enabled: false
  }
])

const availableIntegrations = ref<Integration[]>([
  {
    id: 'jira',
    name: 'Jira',
    description: '接收 Jira 任务更新',
    version: '1.0.0',
    icon: 'mdi:jira',
    enabled: false
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: '同步日历事件和提醒',
    version: '1.1.0',
    icon: 'mdi:calendar',
    enabled: false
  }
])

const permissions = ref({
  userInfo: true,
  roomList: false,
  sendMessage: false
})

onMounted(() => {
  loadSavedSettings()
})

function loadSavedSettings() {
  const savedEnabled = localStorage.getItem('hula-integrations-enabled')
  if (savedEnabled) {
    integrationsEnabled.value = savedEnabled === 'true'
  }

  const savedPermissions = localStorage.getItem('hula-integrations-permissions')
  if (savedPermissions) {
    try {
      permissions.value = JSON.parse(savedPermissions)
    } catch (e) {
      logger.error('Failed to parse saved permissions')
    }
  }
}

function handleIntegrationsToggle(value: boolean) {
  localStorage.setItem('hula-integrations-enabled', value.toString())
  message.success(value ? '集成已启用' : '集成已禁用')
}

function handleToggleIntegration(integration: Integration) {
  const status = integration.enabled ? '已启用' : '已禁用'
  message.success(`${integration.name} ${status}`)
}

function handleConfigureIntegration(integration: Integration) {
  dialog.info({
    title: `配置 ${integration.name}`,
    content: `配置选项将在此处显示。当前版本暂不支持自定义配置。`,
    positiveText: '确定'
  })
}

function handleRemoveIntegration(integration: Integration) {
  dialog.warning({
    title: '移除集成',
    content: `确定要移除 ${integration.name} 吗？移除后需要重新安装。`,
    positiveText: '确定移除',
    negativeText: '取消',
    onPositiveClick: () => {
      integrations.value = integrations.value.filter((i) => i.id !== integration.id)
      message.success(`${integration.name} 已移除`)
    }
  })
}

function handleSearchIntegrations() {
  if (!searchQuery.value.trim()) {
    return
  }

  const query = searchQuery.value.toLowerCase().trim()
  const results = availableIntegrations.value.filter(
    (i) => i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query)
  )

  if (results.length > 0) {
    message.success(`找到 ${results.length} 个相关集成`)
  } else {
    message.info('未找到匹配的集成')
  }
}

function handleOpenIntegrationsManager() {
  dialog.info({
    title: '集成商店',
    content: '集成商店允许您浏览和安装更多第三方集成。此功能将在未来版本中提供。',
    positiveText: '知道了'
  })
}

function handleInstallIntegration(integration: Integration) {
  message.success(`正在安装 ${integration.name}...`)
  setTimeout(() => {
    integrations.value.push({
      ...integration,
      enabled: true
    })
    availableIntegrations.value = availableIntegrations.value.filter((i) => i.id !== integration.id)
    message.success(`${integration.name} 安装成功`)
  }, 1000)
}

function handlePermissionChange() {
  localStorage.setItem('hula-integrations-permissions', JSON.stringify(permissions.value))
}
</script>

<style scoped>
.integrations-settings {
  padding: 0;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px 0;
  color: var(--text-color, #1a1a1a);
}

:deep(.dark) .section-title {
  color: #fff;
}

.section-desc {
  font-size: 13px;
  color: var(--color-text-quaternary);
  margin: 0;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: 14px;
  color: var(--text-color, #1a1a1a);
}

:deep(.dark) .setting-label {
  color: #fff;
}

.setting-desc {
  display: block;
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}

.integrations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.integration-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .integration-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.integration-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}

:deep(.dark) .integration-icon {
  background-color: rgba(255, 255, 255, 0.1);
}

.integration-icon img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.integration-info {
  flex: 1;
  min-width: 0;
}

.integration-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #1a1a1a);
}

:deep(.dark) .integration-name {
  color: #fff;
}

.integration-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 2px;
}

.integration-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.integration-version {
  font-size: 11px;
  color: var(--color-text-quaternary);
}

.integration-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.integration-status.enabled {
  background-color: var(--color-success-light);
  color: var(--color-success);
}

.integration-status.disabled {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-text-quaternary);
}

:deep(.dark) .integration-status.disabled {
  background-color: rgba(255, 255, 255, 0.1);
}

.integration-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-integration {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.available-list {
  margin-top: 16px;
}

.available-title {
  font-size: 13px;
  color: var(--color-text-quaternary);
  margin-bottom: 8px;
}

.available-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .available-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.available-item:last-child {
  border-bottom: none;
}

.available-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
}

:deep(.dark) .available-icon {
  background-color: rgba(255, 255, 255, 0.1);
}

.available-info {
  flex: 1;
  min-width: 0;
}

.available-name {
  font-size: 13px;
  font-weight: 500;
}

.available-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
}
</style>
