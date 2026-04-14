<template>
  <div class="openclaw-config">
    <n-card title="OpenClaw 配置" :bordered="false">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="100">
        <n-form-item label="Gateway URL" path="gatewayUrl">
          <n-input v-model:value="formData.gatewayUrl" placeholder="http://127.0.0.1:18789" />
        </n-form-item>

        <n-form-item label="Token" path="token">
          <n-input
            v-model:value="formData.token"
            type="password"
            placeholder="可选，Bearer Token"
            show-password-on="click" />
        </n-form-item>

        <n-form-item label="自动连接">
          <n-switch v-model:value="formData.autoConnect" />
        </n-form-item>

        <n-form-item label="自动重连">
          <n-switch v-model:value="formData.reconnect" />
        </n-form-item>

        <n-form-item v-if="formData.reconnect" label="重连间隔">
          <n-input-number
            v-model:value="formData.reconnectInterval"
            :min="1000"
            :max="60000"
            :step="1000">
            <template #suffix>ms</template>
          </n-input-number>
        </n-form-item>

        <n-form-item label="心跳间隔">
          <n-input-number
            v-model:value="formData.heartbeatInterval"
            :min="10000"
            :max="120000"
            :step="10000">
            <template #suffix>ms</template>
          </n-input-number>
        </n-form-item>
      </n-form>

      <n-flex justify="space-between" class="mt-16px">
        <n-flex :size="12">
          <n-button @click="handleTestConnection" :loading="testing">
            测试连接
          </n-button>
          <n-tag v-if="connectionStatus" :type="connectionStatus === 'success' ? 'success' : 'error'">
            {{ connectionStatus === 'success' ? '连接成功' : '连接失败' }}
          </n-tag>
        </n-flex>
        <n-flex :size="12">
          <n-button @click="handleReset">重置</n-button>
          <n-button type="primary" @click="handleSave">保存配置</n-button>
        </n-flex>
      </n-flex>
    </n-card>

    <n-card title="连接状态" :bordered="false" class="mt-16px">
      <n-descriptions :column="2" label-placement="left">
        <n-descriptions-item label="状态">
          <n-tag :type="stateType">{{ stateText }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="上次连接">
          {{ lastConnectedAt || '从未连接' }}
        </n-descriptions-item>
        <n-descriptions-item label="重连次数">
          {{ connectionState.reconnectAttempts }}
        </n-descriptions-item>
        <n-descriptions-item label="最后错误">
          {{ connectionState.lastError || '-' }}
        </n-descriptions-item>
      </n-descriptions>

      <n-flex :size="12" class="mt-16px">
        <n-button v-if="!isConnected" type="primary" @click="handleConnect" :loading="connecting">
          连接
        </n-button>
        <n-button v-else type="error" @click="handleDisconnect">
          断开
        </n-button>
        <n-button @click="handleReconnect" :disabled="!isConnected">
          重新连接
        </n-button>
      </n-flex>
    </n-card>

    <n-card title="Viking 智能路由" :bordered="false" class="mt-16px">
      <template #header-extra>
        <n-switch v-model:value="vikingEnabled" @update:value="handleVikingToggle" />
      </template>

      <n-alert v-if="vikingEnabled" type="info" class="mb-16px">
        Viking 路由根据任务复杂度自动选择模型，可节省 67%-93% tokens
      </n-alert>

      <n-descriptions v-if="vikingEnabled" :column="2" label-placement="left">
        <n-descriptions-item label="总请求数">
          {{ vikingStats.totalRequests }}
        </n-descriptions-item>
        <n-descriptions-item label="节省 Tokens">
          {{ vikingSavings.tokens.toLocaleString() }}
        </n-descriptions-item>
        <n-descriptions-item label="节省比例">
          <n-text type="success">{{ vikingSavings.percentage }}%</n-text>
        </n-descriptions-item>
        <n-descriptions-item label="简单任务">
          {{ vikingStats.simpleCount }}
        </n-descriptions-item>
        <n-descriptions-item label="中等任务">
          {{ vikingStats.mediumCount }}
        </n-descriptions-item>
        <n-descriptions-item label="复杂任务">
          {{ vikingStats.complexCount }}
        </n-descriptions-item>
        <n-descriptions-item label="代码任务">
          {{ vikingStats.codeCount }}
        </n-descriptions-item>
      </n-descriptions>

      <n-flex v-if="vikingEnabled" :size="12" class="mt-16px">
        <n-button @click="handleResetVikingStats">重置统计</n-button>
      </n-flex>

      <n-collapse v-if="vikingEnabled" class="mt-16px">
        <n-collapse-item title="模型配置" name="models">
          <n-form label-placement="left" label-width="100">
            <n-form-item label="简单任务模型">
              <n-input v-model:value="vikingConfig.simpleModel" placeholder="ollama:glm-4-9b-chat" />
            </n-form-item>
            <n-form-item label="中等任务模型">
              <n-input v-model:value="vikingConfig.mediumModel" placeholder="openai:gpt-3.5-turbo" />
            </n-form-item>
            <n-form-item label="复杂任务模型">
              <n-input v-model:value="vikingConfig.complexModel" placeholder="openai:gpt-4" />
            </n-form-item>
            <n-form-item label="代码任务模型">
              <n-input v-model:value="vikingConfig.codeModel" placeholder="openai:gpt-4" />
            </n-form-item>
          </n-form>
          <n-button type="primary" @click="handleSaveVikingConfig">保存模型配置</n-button>
        </n-collapse-item>
      </n-collapse>
    </n-card>

    <n-card title="Function Calling 工具" :bordered="false" class="mt-16px">
      <template #header-extra>
        <n-switch v-model:value="functionCallingEnabled" @update:value="handleFunctionCallingToggle" />
      </template>

      <n-alert v-if="functionCallingEnabled" type="info" class="mb-16px">
        启用后 AI 可以调用工具获取实时信息或执行操作
      </n-alert>

      <n-list v-if="functionCallingEnabled" bordered>
        <n-list-item v-for="tool in availableTools" :key="tool.function.name">
          <template #prefix>
            <n-checkbox
              :checked="isToolEnabled(tool.function.name)"
              @update:checked="() => toggleTool(tool.function.name)" />
          </template>
          <n-thing :title="tool.function.name" :description="tool.function.description" />
        </n-list-item>
      </n-list>
    </n-card>

    <n-card title="可用模型" :bordered="false" class="mt-16px">
      <n-spin :show="loadingModels">
        <n-flex v-if="availableModels.length > 0" :size="8">
          <n-tag
            v-for="model in availableModels"
            :key="model"
            :type="currentModel === model ? 'primary' : 'default'"
            class="cursor-pointer"
            @click="handleSelectModel(model)">
            {{ model }}
          </n-tag>
        </n-flex>
        <n-empty v-else description="请先连接 OpenClaw Gateway" />
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import {
  useOpenClaw,
  useVikingRouter,
  useFunctionCalling,
  ConnectionState,
  type OpenClawConfig
} from '@/services/openclaw'

const {
  isConnected,
  isLoading,
  availableModels,
  currentModel,
  connectionState,
  connect,
  disconnect,
  reconnect,
  setModel
} = useOpenClaw()

const {
  config: vikingConfigRef,
  stats: vikingStatsRef,
  savings: vikingSavingsRef,
  configure: configureViking,
  resetStats: resetVikingStats
} = useVikingRouter()

const { availableTools, isToolEnabled, toggleTool } = useFunctionCalling()

const formRef = ref()
const testing = ref(false)
const connecting = ref(false)
const loadingModels = ref(false)
const connectionStatus = ref<'success' | 'error' | null>(null)
const vikingEnabled = ref(true)
const functionCallingEnabled = ref(true)

const formData = ref<OpenClawConfig>({
  gatewayUrl: 'http://127.0.0.1:18789',
  token: '',
  autoConnect: false,
  reconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000
})

const vikingConfig = reactive({
  simpleModel: 'ollama:glm-4-9b-chat',
  mediumModel: 'openai:gpt-3.5-turbo',
  complexModel: 'openai:gpt-4',
  codeModel: 'openai:gpt-4'
})

const vikingStats = computed(() => vikingStatsRef.value)
const vikingSavings = computed(() => vikingSavingsRef.value)

const rules = {
  gatewayUrl: {
    required: true,
    message: '请输入 Gateway URL',
    trigger: 'blur'
  }
}

const stateType = computed(() => {
  switch (connectionState.value.state) {
    case ConnectionState.Connected:
      return 'success'
    case ConnectionState.Connecting:
    case ConnectionState.Reconnecting:
      return 'warning'
    case ConnectionState.Error:
      return 'error'
    default:
      return 'default'
  }
})

const stateText = computed(() => {
  switch (connectionState.value.state) {
    case ConnectionState.Connected:
      return '已连接'
    case ConnectionState.Connecting:
      return '连接中...'
    case ConnectionState.Reconnecting:
      return '重连中...'
    case ConnectionState.Error:
      return '错误'
    default:
      return '未连接'
  }
})

const lastConnectedAt = computed(() => {
  if (!connectionState.value.lastConnectedAt) return null
  return new Date(connectionState.value.lastConnectedAt).toLocaleString()
})

const handleTestConnection = async () => {
  testing.value = true
  connectionStatus.value = null

  try {
    const response = await fetch(`${formData.value.gatewayUrl}/`, { method: 'GET' })
    connectionStatus.value = response.ok ? 'success' : 'error'
  } catch {
    connectionStatus.value = 'error'
  } finally {
    testing.value = false
  }
}

const handleConnect = async () => {
  connecting.value = true
  try {
    await connect({
      ...formData.value,
      enableVikingRouter: vikingEnabled.value,
      enableFunctionCalling: functionCallingEnabled.value
    })
  } finally {
    connecting.value = false
  }
}

const handleDisconnect = () => {
  disconnect()
}

const handleReconnect = async () => {
  await reconnect()
}

const handleSelectModel = (model: string) => {
  setModel(model)
}

const handleSave = () => {
  localStorage.setItem(
    'openclaw-config',
    JSON.stringify({
      ...formData.value,
      enableVikingRouter: vikingEnabled.value,
      enableFunctionCalling: functionCallingEnabled.value
    })
  )
  window.$message.success('配置已保存')
}

const handleReset = () => {
  formData.value = {
    gatewayUrl: 'http://127.0.0.1:18789',
    token: '',
    autoConnect: false,
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  }
}

const handleVikingToggle = (value: boolean) => {
  configureViking({ enabled: value })
}

const handleFunctionCallingToggle = (_value: boolean) => {
  // Function calling is managed through the composable
}

const handleResetVikingStats = () => {
  resetVikingStats()
}

const handleSaveVikingConfig = () => {
  configureViking(vikingConfig)
  localStorage.setItem('viking-router-config', JSON.stringify(vikingConfig))
  window.$message.success('Viking 配置已保存')
}

onMounted(() => {
  const saved = localStorage.getItem('openclaw-config')
  if (saved) {
    try {
      const config = JSON.parse(saved)
      formData.value = { ...formData.value, ...config }
      vikingEnabled.value = config.enableVikingRouter ?? true
      functionCallingEnabled.value = config.enableFunctionCalling ?? true
    } catch {
      // ignore
    }
  }

  const vikingSaved = localStorage.getItem('viking-router-config')
  if (vikingSaved) {
    try {
      const config = JSON.parse(vikingSaved)
      Object.assign(vikingConfig, config)
    } catch {
      // ignore
    }
  }
})
</script>

<style scoped lang="scss">
.openclaw-config {
  @apply p-16px;
}

.mt-16px {
  margin-top: 16px;
}

.mb-16px {
  margin-bottom: 16px;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
