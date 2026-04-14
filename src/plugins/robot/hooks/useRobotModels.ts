import { ref, computed } from 'vue'
import { matrixAIService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRobotModels')

export interface ModelInfo {
  id: string
  name: string
  description?: string
  platform?: string
  model?: string
  status: number
  type: number
  publicStatus?: number
  maxTokens?: number
  avatar?: string
}

export interface RoleInfo {
  id: string
  name: string
  description?: string
  avatar?: string
  status: number
  prompt?: string
}

export type ModelType = 'text' | 'image' | 'audio' | 'video' | 'text-to-video' | 'image-to-video'

export function useRobotModels() {
  const modelList = ref<ModelInfo[]>([])
  const roleList = ref<RoleInfo[]>([])
  const loadingModels = ref(false)
  const loadingRoles = ref(false)
  const selectedModel = ref<ModelInfo | null>(null)
  const selectedRole = ref<RoleInfo | null>(null)

  const textModels = computed(() => modelList.value.filter((m) => m.type === 1))
  const imageModels = computed(() => modelList.value.filter((m) => m.type === 2))
  const audioModels = computed(() => modelList.value.filter((m) => m.type === 3))
  const videoModels = computed(() => modelList.value.filter((m) => m.type === 4 || m.type === 7 || m.type === 8))

  const activeModels = computed(() => modelList.value.filter((m) => m.status === 0))
  const activeRoles = computed(() => roleList.value.filter((r) => r.status === 0))

  const loadModels = async () => {
    loadingModels.value = true
    try {
      const result = await matrixAIService.modelPage({})

      modelList.value = (result.list || []).map(
        (item: {
          id: string
          name?: string
          description?: string
          platform?: string
          model?: string
          status?: number
          type?: number
          publicStatus?: number
          maxTokens?: number
          avatar?: string
        }) => ({
          id: item.id,
          name: item.name || '未命名模型',
          description: item.description,
          platform: item.platform,
          model: item.model,
          status: item.status ?? 0,
          type: item.type ?? 1,
          publicStatus: item.publicStatus,
          maxTokens: item.maxTokens,
          avatar: item.avatar
        })
      )

      logger.debug('加载模型列表成功:', modelList.value.length)
    } catch (e) {
      logger.error('加载模型列表失败:', e)
      window.$message.error('加载模型列表失败')
    } finally {
      loadingModels.value = false
    }
  }

  const loadRoles = async () => {
    loadingRoles.value = true
    try {
      const result = await matrixAIService.chatRolePage({})

      roleList.value = (result.list || []).map(
        (item: {
          id: string
          name?: string
          description?: string
          avatar?: string
          status?: number
          prompt?: string
        }) => ({
          id: item.id,
          name: item.name || '未命名角色',
          description: item.description,
          avatar: item.avatar,
          status: item.status ?? 0,
          prompt: item.prompt
        })
      )

      logger.debug('加载角色列表成功:', roleList.value.length)
    } catch (e) {
      logger.error('加载角色列表失败:', e)
      window.$message.error('加载角色列表失败')
    } finally {
      loadingRoles.value = false
    }
  }

  const selectModel = (model: ModelInfo | null) => {
    selectedModel.value = model
    logger.debug('选择模型:', model?.name)
  }

  const selectRole = (role: RoleInfo | null) => {
    selectedRole.value = role
    logger.debug('选择角色:', role?.name)
  }

  const clearSelection = () => {
    selectedModel.value = null
    selectedRole.value = null
  }

  const getModelById = (id: string): ModelInfo | undefined => {
    return modelList.value.find((m) => m.id === id)
  }

  const getRoleById = (id: string): RoleInfo | undefined => {
    return roleList.value.find((r) => r.id === id)
  }

  const getModelsByType = (type: ModelType): ModelInfo[] => {
    const typeMap: Record<ModelType, number[]> = {
      text: [1],
      image: [2],
      audio: [3],
      video: [4, 7, 8],
      'text-to-video': [7],
      'image-to-video': [8]
    }
    return modelList.value.filter((m) => typeMap[type].includes(m.type))
  }

  const getDefaultModel = (type: ModelType = 'text'): ModelInfo | undefined => {
    const models = getModelsByType(type)
    return models.find((m) => m.status === 0) || models[0]
  }

  const loadRemainingUsage = async (modelId: string): Promise<number | null> => {
    if (!modelId) return null
    try {
      const result = await matrixAIService.getModelRemainingUsage({ modelId })
      return result
    } catch (e) {
      logger.error('获取模型剩余次数失败:', e)
      return null
    }
  }

  return {
    modelList,
    roleList,
    loadingModels,
    loadingRoles,
    selectedModel,
    selectedRole,
    textModels,
    imageModels,
    audioModels,
    videoModels,
    activeModels,
    activeRoles,
    loadModels,
    loadRoles,
    selectModel,
    selectRole,
    clearSelection,
    getModelById,
    getRoleById,
    getModelsByType,
    getDefaultModel,
    loadRemainingUsage
  }
}
