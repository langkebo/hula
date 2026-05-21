import { matrixExtensionEndpoints } from '@/services/backend'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'

export interface ChatRole {
  id: string
  userId?: string
  name: string
  avatar: string
  category: string
  sort: number
  description: string
  systemMessage: string
  modelId?: string
  knowledgeIds?: string[]
  toolIds?: string[]
  publicStatus: boolean
  status: number
  createdAt?: number
  updatedAt?: number
}

class MatrixChatRoleService {
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: ChatRole[]; total: number }> {
    return matrixHttpClient.request<{ list: ChatRole[]; total: number }>(
      {
        url: matrixExtensionEndpoints.CHAT_ROLE_PAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixChatRole' }
    )
  }

  async categoryList(): Promise<Array<{ label: string; value: string }>> {
    return matrixHttpClient.request<Array<{ label: string; value: string }>>(
      {
        url: matrixExtensionEndpoints.CHAT_ROLE_CATEGORY_LIST
      },
      undefined,
      { logPrefix: 'MatrixChatRole' }
    )
  }

  async create(body: {
    modelId?: string
    name: string
    avatar: string
    category: string
    sort: number
    description: string
    systemMessage: string
    knowledgeIds?: string[]
    toolIds?: string[]
    publicStatus: boolean
    status: number
  }): Promise<ChatRole> {
    return matrixHttpClient.request<ChatRole>(
      {
        url: matrixExtensionEndpoints.CHAT_ROLE_CREATE,
        method: 'POST',
        body
      },
      undefined,
      { logPrefix: 'MatrixChatRole' }
    )
  }

  async update(body: {
    id: string
    modelId?: string
    name?: string
    avatar?: string
    category?: string
    sort?: number
    description?: string
    systemMessage?: string
    knowledgeIds?: string[]
    toolIds?: string[]
    publicStatus?: boolean
    status?: number
  }): Promise<ChatRole> {
    return matrixHttpClient.request<ChatRole>(
      {
        url: matrixExtensionEndpoints.CHAT_ROLE_UPDATE,
        method: 'POST',
        body
      },
      undefined,
      { logPrefix: 'MatrixChatRole' }
    )
  }

  async delete(params: { id: string }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.CHAT_ROLE_DELETE,
        params
      },
      undefined,
      { logPrefix: 'MatrixChatRole' }
    )
    return true
  }
}

export const chatRoleService = new MatrixChatRoleService()
