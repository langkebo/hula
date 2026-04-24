<template>
  <div class="labs-settings">
    <div class="settings-section">
      <h3 class="section-title">实验功能</h3>
      <p class="section-desc">这些功能正在开发中，可能不稳定。启用后请谨慎使用，如有问题请反馈。</p>
    </div>

    <n-divider />

    <div class="settings-section">
      <n-spin :show="loading">
        <div class="labs-list">
          <div v-for="feature in labFeatures" :key="feature.id" class="lab-item">
            <div class="lab-info">
              <div class="lab-header">
                <span class="lab-name">{{ feature.name }}</span>
                <n-tag v-if="feature.status === 'beta'" type="warning" size="small">Beta</n-tag>
                <n-tag v-else-if="feature.status === 'alpha'" type="error" size="small">Alpha</n-tag>
                <n-tag v-else type="info" size="small">实验中</n-tag>
              </div>
              <div class="lab-desc">{{ feature.description }}</div>
              <div v-if="feature.warning" class="lab-warning">
                <Icon icon="mdi:alert-circle" :width="14" />
                <span>{{ feature.warning }}</span>
              </div>
            </div>
            <n-switch v-model:value="feature.enabled" @update:value="() => handleToggleFeature(feature)" />
          </div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">开发者选项</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">调试模式</span>
          <span class="setting-desc">启用详细的调试日志和开发者工具</span>
        </div>
        <n-switch v-model:value="debugMode" @update:value="handleDebugModeChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示性能指标</span>
          <span class="setting-desc">在界面上显示性能统计信息</span>
        </div>
        <n-switch v-model:value="showPerformanceMetrics" @update:value="handlePerformanceChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用 React DevTools</span>
          <span class="setting-desc">允许使用 React 开发者工具检查组件</span>
        </div>
        <n-switch v-model:value="enableDevTools" @update:value="handleDevToolsChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">重置实验功能</h3>
      <n-button type="warning" @click="handleResetLabs">重置所有实验功能为默认状态</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NSwitch, NButton, NDivider, NSpin, NTag, useMessage, useDialog } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LabsSettings')

defineOptions({
  name: 'LabsSettings'
})

interface LabFeature {
  id: string
  name: string
  description: string
  status: 'alpha' | 'beta' | 'experimental'
  enabled: boolean
  warning?: string
}

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const debugMode = ref(false)
const showPerformanceMetrics = ref(false)
const enableDevTools = ref(false)

const labFeatures = ref<LabFeature[]>([
  {
    id: 'threads',
    name: '消息线程',
    description: '支持在消息中创建线程讨论，便于组织对话',
    status: 'beta',
    enabled: false
  },
  {
    id: 'spaces',
    name: '空间功能',
    description: '将相关房间组织到空间中，便于管理社区和项目',
    status: 'beta',
    enabled: false
  },
  {
    id: 'voip',
    name: '语音视频通话',
    description: '支持一对一和群组语音视频通话',
    status: 'alpha',
    enabled: false,
    warning: '此功能仍在早期开发阶段，可能存在稳定性问题'
  },
  {
    id: 'widget',
    name: '小部件支持',
    description: '在房间中嵌入第三方应用和工具',
    status: 'experimental',
    enabled: false
  },
  {
    id: 'custom-status',
    name: '自定义状态消息',
    description: '设置自定义状态消息和过期时间',
    status: 'beta',
    enabled: true
  },
  {
    id: 'message-editing',
    name: '消息编辑历史',
    description: '查看和恢复消息的编辑历史',
    status: 'beta',
    enabled: false
  },
  {
    id: 'reactions',
    name: '消息反应',
    description: '对消息添加表情反应',
    status: 'beta',
    enabled: true
  },
  {
    id: 'read-receipts',
    name: '已读回执详情',
    description: '查看谁已阅读消息的详细信息',
    status: 'experimental',
    enabled: false
  }
])

onMounted(() => {
  loadSavedSettings()
})

function loadSavedSettings() {
  const savedFeatures = localStorage.getItem('hula-lab-features')
  if (savedFeatures) {
    try {
      const enabledIds = JSON.parse(savedFeatures) as string[]
      labFeatures.value.forEach((feature) => {
        feature.enabled = enabledIds.includes(feature.id)
      })
    } catch (e) {
      logger.error('Failed to parse saved lab features')
    }
  }

  const savedDebug = localStorage.getItem('hula-debug-mode')
  if (savedDebug) {
    debugMode.value = savedDebug === 'true'
  }

  const savedPerformance = localStorage.getItem('hula-show-performance')
  if (savedPerformance) {
    showPerformanceMetrics.value = savedPerformance === 'true'
  }

  const savedDevTools = localStorage.getItem('hula-enable-devtools')
  if (savedDevTools) {
    enableDevTools.value = savedDevTools === 'true'
  }
}

function saveFeatures() {
  const enabledIds = labFeatures.value.filter((f) => f.enabled).map((f) => f.id)
  localStorage.setItem('hula-lab-features', JSON.stringify(enabledIds))
}

function handleToggleFeature(feature: LabFeature) {
  saveFeatures()

  if (feature.enabled) {
    message.success(`已启用 ${feature.name}`)
  } else {
    message.info(`已禁用 ${feature.name}`)
  }
}

function handleDebugModeChange(value: boolean) {
  localStorage.setItem('hula-debug-mode', value.toString())
  message.success(value ? '调试模式已启用' : '调试模式已禁用')
}

function handlePerformanceChange(value: boolean) {
  localStorage.setItem('hula-show-performance', value.toString())
  message.success(value ? '性能指标已显示' : '性能指标已隐藏')
}

function handleDevToolsChange(value: boolean) {
  localStorage.setItem('hula-enable-devtools', value.toString())
  message.success(value ? 'DevTools 已启用' : 'DevTools 已禁用')
}

function handleResetLabs() {
  dialog.warning({
    title: '重置实验功能',
    content: '确定要将所有实验功能重置为默认状态吗？',
    positiveText: '确定重置',
    negativeText: '取消',
    onPositiveClick: () => {
      labFeatures.value.forEach((feature) => {
        feature.enabled = ['custom-status', 'reactions'].includes(feature.id)
      })
      saveFeatures()
      message.success('所有实验功能已重置')
    }
  })
}
</script>

<style scoped>
.labs-settings {
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

.labs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lab-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .lab-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.lab-info {
  flex: 1;
  min-width: 0;
  margin-right: 16px;
}

.lab-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.lab-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #1a1a1a);
}

:deep(.dark) .lab-name {
  color: #fff;
}

.lab-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

:deep(.dark) .lab-desc {
  color: var(--color-text-tertiary);
}

.lab-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background-color: rgba(250, 173, 20, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-warning);
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
</style>
