import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() },
  matrixClientService: { getClient: () => getClientMock() }
}))

const { MatrixRoomTranslateService } = await import('../TranslateService')

describe('MatrixRoomTranslateService', () => {
  let service: InstanceType<typeof MatrixRoomTranslateService>
  let fetchMock: ReturnType<typeof vi.fn>
  let authedRequestMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    service = new MatrixRoomTranslateService()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    authedRequestMock = vi.fn()
    getClientMock.mockReset()
    getClientMock.mockReturnValue({
      http: { authedRequest: authedRequestMock }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when client is not initialized', async () => {
    getClientMock.mockReturnValueOnce(null)
    await expect(service.translateText('hello')).rejects.toThrow('客户端未初始化')
  })

  describe('backend proxy', () => {
    it('calls authedRequest with correct parameters', async () => {
      authedRequestMock.mockResolvedValueOnce({
        translated_text: '你好',
        detected_source_lang: 'en',
        target_lang: 'zh-CN',
        provider: 'youdao'
      })
      const result = await service.translateText('hello')
      expect(result).toBe('你好')
      expect(authedRequestMock).toHaveBeenCalledWith('POST', '/_matrix/client/v3/translate', undefined, {
        text: 'hello',
        target_lang: 'zh-CN'
      })
    })

    it('passes targetLang to the backend', async () => {
      authedRequestMock.mockResolvedValueOnce({
        translated_text: 'こんにちは',
        target_lang: 'ja',
        provider: 'youdao'
      })
      await service.translateText('hello', 'ja')
      expect(authedRequestMock).toHaveBeenCalledWith('POST', '/_matrix/client/v3/translate', undefined, {
        text: 'hello',
        target_lang: 'ja'
      })
    })

    it('passes sourceLang to the backend when provided', async () => {
      authedRequestMock.mockResolvedValueOnce({
        translated_text: '你好',
        target_lang: 'zh-CN',
        provider: 'youdao'
      })
      await (service as any).translateViaBackend('hello', 'zh-CN', 'en')
      expect(authedRequestMock).toHaveBeenCalledWith('POST', '/_matrix/client/v3/translate', undefined, {
        text: 'hello',
        target_lang: 'zh-CN',
        source_lang: 'en'
      })
    })

    it('defaults targetLang to zh-CN when not provided', async () => {
      authedRequestMock.mockResolvedValueOnce({
        translated_text: '你好',
        target_lang: 'zh-CN',
        provider: 'youdao'
      })
      await service.translateText('hello')
      expect(authedRequestMock).toHaveBeenCalledWith('POST', '/_matrix/client/v3/translate', undefined, {
        text: 'hello',
        target_lang: 'zh-CN'
      })
    })
  })

  describe('fallback to Google Translate', () => {
    it('falls back to Google Translate when backend proxy fails', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend unavailable'))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [[['你好', 'hello', null, null]]]
      })
      const result = await service.translateText('hello')
      expect(result).toBe('你好')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const url: string = fetchMock.mock.calls[0][0]
      expect(url).toContain('tl=zh-CN')
    })

    it('URL-encodes the query text in the fallback URL', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend unavailable'))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [[['你好', 'hello world & more', null, null]]]
      })
      await service.translateText('hello world & more')
      const url: string = fetchMock.mock.calls[0][0]
      expect(url).toContain('q=hello%20world%20%26%20more')
    })

    it('uses targetLang in the fallback URL', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend unavailable'))
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [[['こんにちは', 'hello', null, null]]]
      })
      await service.translateText('hello', 'ja')
      const url: string = fetchMock.mock.calls[0][0]
      expect(url).toContain('tl=ja')
    })

    it('joins multi-segment fallback responses into one string', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend unavailable'))
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

    it('returns original text when fallback response data[0] is absent', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend unavailable'))
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] })
      expect(await service.translateText('original')).toBe('original')
    })
  })

  describe('error handling', () => {
    it('throws when both backend and fallback fail by default (throwOnError=true)', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend down'))
      fetchMock.mockRejectedValueOnce(new Error('network down'))
      await expect(service.translateText('x')).rejects.toThrow('network down')
    })

    it('returns original text when both fail and throwOnError=false', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend down'))
      fetchMock.mockRejectedValueOnce(new Error('network down'))
      expect(await service.translateText('original', undefined, false)).toBe('original')
    })

    it('throws on non-ok fallback HTTP status by default', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend down'))
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      await expect(service.translateText('x')).rejects.toThrow('翻译请求失败: 503')
    })

    it('returns original text on non-ok fallback status when throwOnError=false', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('backend down'))
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      expect(await service.translateText('original', undefined, false)).toBe('original')
    })
  })
})
