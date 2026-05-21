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
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: AIModel[]; total: number }> {
    return matrixHttpClient.request<{ list: AIModel[]; total: number }>(
      {
        url: matrixExtensionEndpoints.MODEL_PAGE,
        params
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
