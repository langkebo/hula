import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdminCallbackService,
  type CreateAccountDataCallbackRequest,
  type CreateMediaCallbackRequest
} from '../AdminCallbackService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const listMediaCallbacks = vi.fn()
const listMediaCallbacksByType = vi.fn()
const createMediaCallback = vi.fn()
const listAccountDataCallbacks = vi.fn()
const createAccountDataCallback = vi.fn()

const makeDeps = () => {
  const client = {
    getAdminManager: () => ({
      config: {
        listMediaCallbacks,
        listMediaCallbacksByType,
        createMediaCallback,
        listAccountDataCallbacks,
        createAccountDataCallback
      }
    })
  }
  return {
    getClient: () => client as never,
    waitForClientReady: async () => client as never
  }
}

const mediaRecord = {
  id: 1,
  callback_type: 'thumbnail',
  media_id: 'm1',
  user_id: '@alice:example.org',
  status: 'success',
  result: { ok: true },
  created_ts: 1700000000,
  completed_ts: 1700000001,
  is_enabled: true
}

const accountRecord = {
  id: 2,
  callback_name: 'account-sync',
  is_enabled: true,
  data_types: ['m.direct'],
  config: { url: 'https://example.com/hook' },
  created_ts: 1700000000
}

describe('AdminCallbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listMediaCallbacks 返回执行记录数组', async () => {
    listMediaCallbacks.mockResolvedValueOnce([mediaRecord])

    const result = await new AdminCallbackService(makeDeps()).listMediaCallbacks()

    expect(listMediaCallbacks).toHaveBeenCalledWith()
    expect(result).toEqual([mediaRecord])
  })

  it('listMediaCallbacksByType 透传 callback_type', async () => {
    listMediaCallbacksByType.mockResolvedValueOnce([mediaRecord])

    const result = await new AdminCallbackService(makeDeps()).listMediaCallbacksByType('thumbnail')

    expect(listMediaCallbacksByType).toHaveBeenCalledWith('thumbnail')
    expect(result).toEqual([mediaRecord])
  })

  it('createMediaCallback 透传请求体', async () => {
    const payload: CreateMediaCallbackRequest = {
      callback_name: 'media-thumbnail',
      callback_type: 'thumbnail',
      url: 'https://example.com/hook',
      method: 'POST',
      is_enabled: true,
      timeout_ms: 5000,
      retry_count: 0
    }
    createMediaCallback.mockResolvedValueOnce(mediaRecord)

    const result = await new AdminCallbackService(makeDeps()).createMediaCallback(payload)

    expect(createMediaCallback).toHaveBeenCalledWith(payload)
    expect(result).toEqual(mediaRecord)
  })

  it('listAccountDataCallbacks 返回回调配置数组', async () => {
    listAccountDataCallbacks.mockResolvedValueOnce([accountRecord])

    const result = await new AdminCallbackService(makeDeps()).listAccountDataCallbacks()

    expect(listAccountDataCallbacks).toHaveBeenCalledWith()
    expect(result).toEqual([accountRecord])
  })

  it('createAccountDataCallback 透传请求体', async () => {
    const payload: CreateAccountDataCallbackRequest = {
      callback_name: 'account-sync',
      config: { url: 'https://example.com/hook' },
      is_enabled: true,
      data_types: ['m.direct']
    }
    createAccountDataCallback.mockResolvedValueOnce(accountRecord)

    const result = await new AdminCallbackService(makeDeps()).createAccountDataCallback(payload)

    expect(createAccountDataCallback).toHaveBeenCalledWith(payload)
    expect(result).toEqual(accountRecord)
  })

  it('后端失败时记录日志并重新抛出', async () => {
    listMediaCallbacks.mockRejectedValueOnce(new Error('HTTP 403'))

    await expect(new AdminCallbackService(makeDeps()).listMediaCallbacks()).rejects.toThrow('HTTP 403')
  })
})
