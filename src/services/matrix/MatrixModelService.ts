import { ImUrlEnum } from '@/enums'
import { imRequest } from '@/utils/ImRequestUtils'
import { info, error as logError } from '@tauri-apps/plugin-log'

export interface AIModel {
  id: string
  userId?: string
  keyId?: string
  name: string
  model: string
  platform: string
  avatar?: string
  type: number
  sort: number
  status: number
  publicStatus: number
  temperature?: number
  maxTokens?: number
  maxContexts?: number
  createdAt?: number
  updatedAt?: number
}

class MatrixModelService {
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: AIModel[]; total: number }> {
    try {
      const result = await imRequest<{ list: AIModel[]; total: number }>({
        url: ImUrlEnum.MODEL_PAGE,
        params
      })
      info(`[MatrixModel] 获取模型列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixModel] 获取模型列表失败: ${err}`)
      throw err
    }
  }

  async update(body: {
    id?: string
    keyId?: string
    name?: string
    model?: string
    platform?: string
    avatar?: string
    type?: number
    sort?: number
    status?: number
    publicStatus?: number
    temperature?: number
    maxTokens?: number
    maxContexts?: number
  }): Promise<AIModel> {
    try {
      const result = await imRequest<AIModel>({
        url: ImUrlEnum.MODEL_UPDATE,
        body
      })
      info(`[MatrixModel] 更新模型成功`)
      return result
    } catch (err) {
      logError(`[MatrixModel] 更新模型失败: ${err}`)
      throw err
    }
  }

  async delete(params: { id: string }): Promise<boolean> {
    try {
      await imRequest({
        url: ImUrlEnum.MODEL_DELETE,
        params
      })
      info(`[MatrixModel] 删除模型成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixModel] 删除模型失败: ${err}`)
      throw err
    }
  }
}

export const matrixModelService = new MatrixModelService()
