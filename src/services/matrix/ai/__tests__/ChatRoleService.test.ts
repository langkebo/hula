import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn()
}))

vi.mock('@/services/backend', () => ({
  matrixExtensionEndpoints: {
    CHAT_ROLE_PAGE: 'chatRolePage',
    CHAT_ROLE_CATEGORY_LIST: 'chatRoleCategoryList',
    CHAT_ROLE_CREATE: 'chatRoleCreate',
    CHAT_ROLE_UPDATE: 'chatRoleUpdate',
    CHAT_ROLE_DELETE: 'chatRoleDelete'
  }
}))

vi.mock('../../MatrixHttpClient', () => ({
  matrixHttpClient: { request: mockRequest }
}))

import { chatRoleService } from '../ChatRoleService'

describe('MatrixChatRoleService', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  it('page 调用 chatRolePage 端点并传分页参数', async () => {
    mockRequest.mockResolvedValueOnce({ list: [], total: 0 })
    const result = await chatRoleService.page({ pageNo: 2, pageSize: 20 })
    expect(result).toEqual({ list: [], total: 0 })
    expect(mockRequest).toHaveBeenCalledWith({ url: 'chatRolePage', params: { pageNo: 2, pageSize: 20 } }, undefined, {
      logPrefix: 'MatrixChatRole'
    })
  })

  it('page 不传参数时 params 为 undefined', async () => {
    mockRequest.mockResolvedValueOnce({ list: [], total: 0 })
    await chatRoleService.page()
    expect(mockRequest).toHaveBeenCalledWith({ url: 'chatRolePage', params: undefined }, undefined, {
      logPrefix: 'MatrixChatRole'
    })
  })

  it('categoryList 返回 label/value 数组', async () => {
    mockRequest.mockResolvedValueOnce([
      { label: '助手', value: 'assistant' },
      { label: '翻译', value: 'translator' }
    ])
    const result = await chatRoleService.categoryList()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ label: '助手', value: 'assistant' })
    expect(mockRequest).toHaveBeenCalledWith({ url: 'chatRoleCategoryList' }, undefined, {
      logPrefix: 'MatrixChatRole'
    })
  })

  it('create POST 请求体并返回新建的 ChatRole', async () => {
    const body = {
      name: '助手',
      avatar: 'a.png',
      category: '助手',
      sort: 1,
      description: 'desc',
      systemMessage: 'sys',
      publicStatus: true,
      status: 1
    }
    mockRequest.mockResolvedValueOnce({ id: 'r1', ...body })
    const result = await chatRoleService.create(body)
    expect(result.id).toBe('r1')
    expect(mockRequest).toHaveBeenCalledWith({ url: 'chatRoleCreate', method: 'POST', body }, undefined, {
      logPrefix: 'MatrixChatRole'
    })
  })

  it('update POST 请求体（含 id）并返回更新后的 ChatRole', async () => {
    const body = { id: 'r1', name: '新名称' }
    mockRequest.mockResolvedValueOnce({ id: 'r1', name: '新名称' })
    const result = await chatRoleService.update(body)
    expect(result.name).toBe('新名称')
    expect(mockRequest).toHaveBeenCalledWith(
      { url: 'chatRoleUpdate', method: 'POST', body: { id: 'r1', name: '新名称' } },
      undefined,
      { logPrefix: 'MatrixChatRole' }
    )
  })

  it('delete 透传 id 作为 query 参数并返回 true', async () => {
    mockRequest.mockResolvedValueOnce(undefined)
    const ok = await chatRoleService.delete({ id: 'r1' })
    expect(ok).toBe(true)
    expect(mockRequest).toHaveBeenCalledWith({ url: 'chatRoleDelete', params: { id: 'r1' } }, undefined, {
      logPrefix: 'MatrixChatRole'
    })
  })

  it('delete 在请求失败时抛出原错误', async () => {
    mockRequest.mockRejectedValueOnce(new Error('403'))
    await expect(chatRoleService.delete({ id: 'r1' })).rejects.toThrow('403')
  })

  it('page 在请求失败时抛出原错误', async () => {
    mockRequest.mockRejectedValueOnce(new Error('timeout'))
    await expect(chatRoleService.page()).rejects.toThrow('timeout')
  })
})
