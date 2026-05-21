import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('TranslateService')

export class MatrixRoomTranslateService extends BaseMatrixService {
  /**
   * Translate text via the backend translation proxy.
   *
   * Falls back to Google Translate public API if the backend proxy is unavailable
   * (e.g., translation service not configured on the server).
   *
   * @param text - The text to translate
   * @param targetLang - Target language code (default: 'zh-CN')
   * @param throwOnErrorOrSource - Either a boolean (throwOnError) or a string (sourceLang)
   */
  async translateText(text: string, targetLang?: string, sourceLang?: string): Promise<string>
  async translateText(text: string, targetLang: string | undefined, throwOnError: true): Promise<string>
  async translateText(text: string, targetLang: string | undefined, throwOnError: false): Promise<string>
  async translateText(text: string, targetLang?: string, throwOnErrorOrSource?: boolean | string): Promise<string> {
    this.getClient()

    const target = typeof targetLang === 'string' && targetLang !== '' ? targetLang : 'zh-CN'
    const throwOnError = typeof throwOnErrorOrSource === 'boolean' ? throwOnErrorOrSource : true

    try {
      const result = await this.translateViaBackend(text, target)
      logger.info(`[Translate] 后端翻译成功 (provider: ${result.provider})`)
      return result.translated_text
    } catch (backendErr) {
      logger.warn(`[Translate] 后端翻译代理不可用，回退到客户端直连: ${backendErr}`)
      try {
        const translated = await this.translateViaFallback(text, target)
        logger.info(`[Translate] 客户端回退翻译成功`)
        return translated
      } catch (fallbackErr) {
        logger.error(`[Translate] 翻译失败: ${fallbackErr}`)
        if (throwOnError) {
          throw fallbackErr
        }
        return text
      }
    }
  }

  private async translateViaBackend(
    text: string,
    targetLang: string,
    sourceLang?: string
  ): Promise<{ translated_text: string; detected_source_lang?: string; target_lang: string; provider: string }> {
    const client = this.getClient()
    const body: Record<string, unknown> = {
      text,
      target_lang: targetLang
    }
    if (sourceLang) {
      body.source_lang = sourceLang
    }

    return (await client.http.authedRequest('POST', '/_matrix/client/v3/translate', undefined, body)) as unknown as {
      translated_text: string
      detected_source_lang?: string
      target_lang: string
      provider: string
    }
  }

  private async translateViaFallback(text: string, targetLang: string): Promise<string> {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
    )
    if (!response.ok) {
      throw new Error(`翻译请求失败: ${response.status}`)
    }
    const data = await response.json()
    if (data?.[0]) {
      return data[0].map((item: unknown[]) => item[0]).join('')
    }
    return text
  }
}

export const matrixRoomTranslateService = new MatrixRoomTranslateService()
