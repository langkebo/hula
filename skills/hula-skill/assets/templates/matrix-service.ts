import type { MatrixClient } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'

export interface ExampleItem {
  id: string
  name: string
  description: string
  createdAt: number
}

export interface GetItemsOptions {
  limit?: number
  offset?: number
}

export interface GetItemsResult {
  items: ExampleItem[]
  hasMore: boolean
}

export interface CreateItemOptions {
  name: string
  description: string
}

class MatrixExampleService {
  private client: MatrixClient | null = null

  setClient(client: MatrixClient | null): void {
    this.client = client
    if (client) {
      info('[MatrixExample] 客户端已设置')
    }
  }

  getClient(): MatrixClient | null {
    return this.client
  }

  private requireClient(): MatrixClient {
    if (!this.client) {
      throw new Error('[MatrixExample] 客户端未初始化')
    }
    return this.client
  }

  async getItems(options: GetItemsOptions = {}): Promise<GetItemsResult> {
    const client = this.requireClient()
    const { limit = 20, offset = 0 } = options

    try {
      const response = await client.http.authedRequest<{
        items: Array<{ id: string; name: string; description: string; created_at: number }>
        has_more: boolean
      }>('GET', '/example/items', { limit: String(limit), offset: String(offset) }, undefined, {
        prefix: '/_matrix/client/v1'
      })

      return {
        items: response.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.created_at
        })),
        hasMore: response.has_more
      }
    } catch (e) {
      await error(`[MatrixExample] 获取列表失败: ${e}`)
      throw e
    }
  }

  async createItem(options: CreateItemOptions): Promise<ExampleItem> {
    const client = this.requireClient()

    try {
      const response = await client.http.authedRequest<{
        id: string
        name: string
        description: string
        created_at: number
      }>(
        'POST',
        '/example/items',
        undefined,
        { name: options.name, description: options.description },
        { prefix: '/_matrix/client/v1' }
      )

      await info(`[MatrixExample] 创建成功: ${response.id}`)

      return {
        id: response.id,
        name: response.name,
        description: response.description,
        createdAt: response.created_at
      }
    } catch (e) {
      await error(`[MatrixExample] 创建失败: ${e}`)
      throw e
    }
  }

  async updateItem(id: string, updates: Partial<CreateItemOptions>): Promise<ExampleItem> {
    const client = this.requireClient()

    try {
      const response = await client.http.authedRequest<{
        id: string
        name: string
        description: string
        created_at: number
      }>('PUT', `/example/items/${id}`, undefined, updates, { prefix: '/_matrix/client/v1' })

      await info(`[MatrixExample] 更新成功: ${id}`)

      return {
        id: response.id,
        name: response.name,
        description: response.description,
        createdAt: response.created_at
      }
    } catch (e) {
      await error(`[MatrixExample] 更新失败: ${e}`)
      throw e
    }
  }

  async deleteItem(id: string): Promise<void> {
    const client = this.requireClient()

    try {
      await client.http.authedRequest<void>('DELETE', `/example/items/${id}`, undefined, undefined, {
        prefix: '/_matrix/client/v1'
      })

      await info(`[MatrixExample] 删除成功: ${id}`)
    } catch (e) {
      await error(`[MatrixExample] 删除失败: ${e}`)
      throw e
    }
  }

  async getItemById(id: string): Promise<ExampleItem | null> {
    const client = this.requireClient()

    try {
      const response = await client.http.authedRequest<{
        id: string
        name: string
        description: string
        created_at: number
      } | null>('GET', `/example/items/${id}`, undefined, undefined, { prefix: '/_matrix/client/v1' })

      if (!response) return null

      return {
        id: response.id,
        name: response.name,
        description: response.description,
        createdAt: response.created_at
      }
    } catch (e) {
      await error(`[MatrixExample] 获取详情失败: ${e}`)
      throw e
    }
  }
}

export const matrixExampleService = new MatrixExampleService()
export default matrixExampleService
