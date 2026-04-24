import { matrixExtensionEndpoints } from '@/services/backend'
import { httpClient } from '@/utils/HttpClient'
import { info, error as logError } from '@tauri-apps/plugin-log'

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
    try {
      const result = await httpClient.request<{ list: ChatRole[]; total: number }>({
        url: matrixExtensionEndpoints.CHAT_ROLE_PAGE,
        params
      })
      info(`[MatrixChatRole] 获取角色列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 获取角色列表失败: ${err}`)
      throw err
    }
  }

  async categoryList(): Promise<Array<{ label: string; value: string }>> {
    try {
      const result = await httpClient.request<Array<{ label: string; value: string }>>({
        url: matrixExtensionEndpoints.CHAT_ROLE_CATEGORY_LIST
      })
      info(`[MatrixChatRole] 获取角色类别列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 获取角色类别列表失败: ${err}`)
      throw err
    }
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
    try {
      const result = await httpClient.request<ChatRole>({
        url: matrixExtensionEndpoints.CHAT_ROLE_CREATE,
        body
      })
      info(`[MatrixChatRole] 创建角色成功: ${result.id}`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 创建角色失败: ${err}`)
      throw err
    }
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
    try {
      const result = await httpClient.request<ChatRole>({
        url: matrixExtensionEndpoints.CHAT_ROLE_UPDATE,
        body
      })
      info(`[MatrixChatRole] 更新角色成功: ${body.id}`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 更新角色失败: ${err}`)
      throw err
    }
  }

  async delete(params: { id: string }): Promise<boolean> {
    try {
      await httpClient.request({
        url: matrixExtensionEndpoints.CHAT_ROLE_DELETE,
        params
      })
      info(`[MatrixChatRole] 删除角色成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixChatRole] 删除角色失败: ${err}`)
      throw err
    }
  }
}

export const chatRoleService = new MatrixChatRoleService()
