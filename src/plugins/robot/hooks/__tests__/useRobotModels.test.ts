import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRobotModels } from '../useRobotModels'

vi.mock('@/services/matrix', () => ({
  matrixAIService: {
    modelPage: vi.fn().mockResolvedValue({
      list: [
        { id: 'model-1', name: 'GPT-4', status: 0, type: 1 },
        { id: 'model-2', name: 'DALL-E', status: 0, type: 2 }
      ]
    }),
    chatRolePage: vi.fn().mockResolvedValue({
      list: [
        { id: 'role-1', name: '助手', status: 0 },
        { id: 'role-2', name: '翻译', status: 0 }
      ]
    }),
    getModelRemainingUsage: vi.fn().mockResolvedValue(100)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn()
  })
}))

describe('useRobotModels', () => {
  let robotModels: ReturnType<typeof useRobotModels>

  beforeEach(() => {
    vi.clearAllMocks()
    robotModels = useRobotModels()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      expect(robotModels.modelList.value).toEqual([])
      expect(robotModels.roleList.value).toEqual([])
      expect(robotModels.loadingModels.value).toBe(false)
      expect(robotModels.loadingRoles.value).toBe(false)
      expect(robotModels.selectedModel.value).toBeNull()
      expect(robotModels.selectedRole.value).toBeNull()
    })
  })

  describe('loadModels', () => {
    it('应该加载模型列表', async () => {
      await robotModels.loadModels()
      expect(robotModels.modelList.value).toHaveLength(2)
      expect(robotModels.modelList.value[0].name).toBe('GPT-4')
    })

    it('应该设置 loading 状态', async () => {
      const promise = robotModels.loadModels()
      expect(robotModels.loadingModels.value).toBe(true)
      await promise
      expect(robotModels.loadingModels.value).toBe(false)
    })
  })

  describe('loadRoles', () => {
    it('应该加载角色列表', async () => {
      await robotModels.loadRoles()
      expect(robotModels.roleList.value).toHaveLength(2)
      expect(robotModels.roleList.value[0].name).toBe('助手')
    })
  })

  describe('selectModel', () => {
    it('应该设置选中的模型', () => {
      const model = { id: 'test', name: 'Test', status: 0, type: 1 }
      robotModels.selectModel(model)
      expect(robotModels.selectedModel.value?.id).toBe('test')
    })

    it('传入 null 应该清除选中的模型', () => {
      robotModels.selectModel({ id: 'test', name: 'Test', status: 0, type: 1 })
      robotModels.selectModel(null)
      expect(robotModels.selectedModel.value).toBeNull()
    })
  })

  describe('selectRole', () => {
    it('应该设置选中的角色', () => {
      const role = { id: 'test', name: 'Test', status: 0 }
      robotModels.selectRole(role)
      expect(robotModels.selectedRole.value?.id).toBe('test')
    })
  })

  describe('clearSelection', () => {
    it('应该清除所有选择', () => {
      robotModels.selectModel({ id: 'm1', name: 'M1', status: 0, type: 1 })
      robotModels.selectRole({ id: 'r1', name: 'R1', status: 0 })
      robotModels.clearSelection()
      expect(robotModels.selectedModel.value).toBeNull()
      expect(robotModels.selectedRole.value).toBeNull()
    })
  })

  describe('computed 属性', () => {
    beforeEach(async () => {
      await robotModels.loadModels()
    })

    it('textModels 应该只返回文本模型', () => {
      expect(robotModels.textModels.value).toHaveLength(1)
      expect(robotModels.textModels.value[0].type).toBe(1)
    })

    it('imageModels 应该只返回图像模型', () => {
      expect(robotModels.imageModels.value).toHaveLength(1)
      expect(robotModels.imageModels.value[0].type).toBe(2)
    })

    it('activeModels 应该只返回可用模型', () => {
      expect(robotModels.activeModels.value).toHaveLength(2)
    })
  })

  describe('getModelById', () => {
    it('应该根据 ID 返回模型', async () => {
      await robotModels.loadModels()
      const model = robotModels.getModelById('model-1')
      expect(model?.name).toBe('GPT-4')
    })

    it('找不到时应该返回 undefined', () => {
      const model = robotModels.getModelById('non-existent')
      expect(model).toBeUndefined()
    })
  })

  describe('getModelsByType', () => {
    beforeEach(async () => {
      await robotModels.loadModels()
    })

    it('应该返回指定类型的模型', () => {
      const textModels = robotModels.getModelsByType('text')
      expect(textModels).toHaveLength(1)
    })
  })

  describe('getDefaultModel', () => {
    beforeEach(async () => {
      await robotModels.loadModels()
    })

    it('应该返回第一个可用的文本模型', () => {
      const model = robotModels.getDefaultModel('text')
      expect(model?.status).toBe(0)
    })
  })

  describe('loadRemainingUsage', () => {
    it('应该返回剩余使用次数', async () => {
      const usage = await robotModels.loadRemainingUsage('model-1')
      expect(usage).toBe(100)
    })
  })
})
