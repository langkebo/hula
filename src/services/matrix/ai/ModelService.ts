import { matrixExtensionEndpoints } from '@/services/backend'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'

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
  description?: string
  supportsReasoning?: boolean
}

class MatrixModelService {
  /**
   * 分页查询当前用户的 AI 模型列表。
   *
   * @param params - 分页参数
   * @param params.pageNo - 页码
   * @param params.pageSize - 每页数量
   * @returns 列表与总数
   */
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: AIModel[]; total: number }> {
    return matrixHttpClient.request<{ list: AIModel[]; total: number }>(
      {
        url: matrixExtensionEndpoints.MODEL_PAGE,
        ...(params !== undefined ? { params } : {})
      },
      undefined,
      { logPrefix: 'MatrixModel' }
    )
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
    return matrixHttpClient.request<AIModel>(
      {
        url: matrixExtensionEndpoints.MODEL_UPDATE,
        method: 'POST',
        body
      },
      undefined,
      { logPrefix: 'MatrixModel' }
    )
  }

  /**
   * 删除指定 AI 模型。
   *
   * @param params - 删除参数
   * @param params.id - 模型 ID
   * @returns 删除成功返回 true
   */
  async delete(params: { id: string }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.MODEL_DELETE,
        params
      },
      undefined,
      { logPrefix: 'MatrixModel' }
    )
    return true
  }
}

export const modelService = new MatrixModelService()
