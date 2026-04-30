import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() }
}))

const { MatrixRoomTranslateService } = await import('../TranslateService')

describe('MatrixRoomTranslateService', () => {
  let service: InstanceType<typeof MatrixRoomTranslateService>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    service = new MatrixRoomTranslateService()
    getClientMock.mockReset()
    getClientMock.mockReturnValue({})
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when client is not initialized', async () => {
    getClientMock.mockReturnValueOnce(null)
    await expect(service.translateText('hello')).rejects.toThrow('客户端未初始化')
  })

  it('URL-encodes the query text in the Google Translate URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [[['你好', 'hello', null, null]]]
    })
    await service.translateText('hello world & more')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url: string = fetchMock.mock.calls[0][0]
    expect(url).toContain('q=hello%20world%20%26%20more')
    expect(url).toContain('tl=zh-CN')
    expect(url).toContain('client=gtx')
  })

  it('joins multi-segment responses into one string', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [
          ['你', 'h', null, null],
          ['好', 'ello', null, null]
        ]
      ]
    })
    expect(await service.translateText('hello')).toBe('你好')
  })

  it('returns original text when response data[0] is absent', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] })
    expect(await service.translateText('original')).toBe('original')
  })

  it('throws on non-ok HTTP status by default (throwOnError=true)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    await expect(service.translateText('x')).rejects.toThrow('翻译请求失败: 503')
  })

  it('returns original text on non-ok status when throwOnError=false', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    expect(await service.translateText('original', undefined, false)).toBe('original')
  })

  it('re-throws network errors when throwOnError=true', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(service.translateText('x')).rejects.toThrow('network down')
  })

  it('swallows network errors and returns original text when throwOnError=false', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect(await service.translateText('original', 'google', false)).toBe('original')
  })

  it('accepts an unused provider arg without affecting the URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [[['hi', 'hi', null, null]]]
    })
    await service.translateText('hi', 'deepl')
    const url: string = fetchMock.mock.calls[0][0]
    expect(url).not.toContain('deepl')
  })
})
