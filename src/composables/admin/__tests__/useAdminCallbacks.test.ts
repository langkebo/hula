import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminCallbackService: {
    listMediaCallbacks: vi.fn(),
    listMediaCallbacksByType: vi.fn(),
    createMediaCallback: vi.fn(),
    listAccountDataCallbacks: vi.fn(),
    createAccountDataCallback: vi.fn()
  }
}))

import { adminCallbackService } from '@/services/matrix/admin'
import { useAdminCallbacks } from '../useAdminCallbacks'

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

describe('useAdminCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未指定类型时拉取全部媒体回调记录', async () => {
    vi.mocked(adminCallbackService.listMediaCallbacks).mockResolvedValue([mediaRecord])

    const state = useAdminCallbacks()
    await state.loadMediaCallbacks('   ')

    expect(adminCallbackService.listMediaCallbacks).toHaveBeenCalledTimes(1)
    expect(adminCallbackService.listMediaCallbacksByType).not.toHaveBeenCalled()
    expect(state.mediaCallbacks.value).toEqual([mediaRecord])
  })

  it('指定类型时走按类型过滤端点', async () => {
    vi.mocked(adminCallbackService.listMediaCallbacksByType).mockResolvedValue([mediaRecord])

    const state = useAdminCallbacks()
    await state.loadMediaCallbacks(' thumbnail ')

    expect(adminCallbackService.listMediaCallbacksByType).toHaveBeenCalledWith('thumbnail')
    expect(state.mediaCallbacks.value).toEqual([mediaRecord])
  })

  it('拉取失败时清空列表并记录错误', async () => {
    vi.mocked(adminCallbackService.listMediaCallbacks).mockRejectedValue(new Error('HTTP 500'))

    const state = useAdminCallbacks()
    await state.loadMediaCallbacks()

    expect(state.mediaCallbacks.value).toEqual([])
    expect(state.mediaError.value).toBe('HTTP 500')
  })

  it('创建媒体回调后重新拉取列表', async () => {
    vi.mocked(adminCallbackService.createMediaCallback).mockResolvedValue(mediaRecord)
    vi.mocked(adminCallbackService.listMediaCallbacks).mockResolvedValue([mediaRecord])

    const state = useAdminCallbacks()
    const ok = await state.createMediaCallback({
      callbackName: ' media-thumbnail ',
      callbackType: ' thumbnail ',
      url: ' https://example.com/hook ',
      method: '   ',
      timeoutMs: 5000,
      retryCount: 0,
      isEnabled: true
    })

    expect(ok).toBe(true)
    expect(adminCallbackService.createMediaCallback).toHaveBeenCalledWith({
      callback_name: 'media-thumbnail',
      callback_type: 'thumbnail',
      url: 'https://example.com/hook',
      method: 'POST',
      is_enabled: true,
      timeout_ms: 5000,
      retry_count: 0
    })
    expect(adminCallbackService.listMediaCallbacks).toHaveBeenCalledTimes(1)
  })

  it('创建媒体回调失败时返回 false 并保留错误', async () => {
    vi.mocked(adminCallbackService.createMediaCallback).mockRejectedValue(new Error('HTTP 400'))

    const state = useAdminCallbacks()
    const ok = await state.createMediaCallback({
      callbackName: 'x',
      callbackType: 'y',
      url: 'https://example.com',
      method: 'POST',
      timeoutMs: 5000,
      retryCount: 0,
      isEnabled: true
    })

    expect(ok).toBe(false)
    expect(state.mediaError.value).toBe('HTTP 400')
  })

  it('创建账户数据回调时拆分监听范围', async () => {
    vi.mocked(adminCallbackService.createAccountDataCallback).mockResolvedValue(accountRecord)
    vi.mocked(adminCallbackService.listAccountDataCallbacks).mockResolvedValue([accountRecord])

    const state = useAdminCallbacks()
    const ok = await state.createAccountDataCallback({
      callbackName: ' account-sync ',
      dataTypes: 'm.direct, m.push_rules  m.ignored_user_list',
      config: { url: 'https://example.com/hook' },
      isEnabled: true
    })

    expect(ok).toBe(true)
    expect(adminCallbackService.createAccountDataCallback).toHaveBeenCalledWith({
      callback_name: 'account-sync',
      config: { url: 'https://example.com/hook' },
      is_enabled: true,
      data_types: ['m.direct', 'm.push_rules', 'm.ignored_user_list']
    })
    expect(adminCallbackService.listAccountDataCallbacks).toHaveBeenCalledTimes(1)
  })

  it('监听范围为空时不传 data_types', async () => {
    vi.mocked(adminCallbackService.createAccountDataCallback).mockResolvedValue(accountRecord)
    vi.mocked(adminCallbackService.listAccountDataCallbacks).mockResolvedValue([])

    const state = useAdminCallbacks()
    await state.createAccountDataCallback({
      callbackName: 'account-sync',
      dataTypes: '   ',
      config: {},
      isEnabled: false
    })

    const payload = vi.mocked(adminCallbackService.createAccountDataCallback).mock.calls[0][0]
    expect('data_types' in payload).toBe(false)
  })
})
