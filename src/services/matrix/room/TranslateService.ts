import { error, info } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'

/**
 * Text translation domain service.
 *
 * Wraps a Google Translate GET endpoint behind a facade-stable signature.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 * Kept inside the `matrix/room/` subtree because the existing consumer
 * calls it via `matrixRoomService.translateText`; the client-initialized
 * guard is retained for backwards-compatible error parity.
 */
export class MatrixRoomTranslateService {
  async translateText(text: string, _provider?: string): Promise<string>
  async translateText(text: string, _provider: string | undefined, throwOnError: true): Promise<string>
  async translateText(text: string, _provider: string | undefined, throwOnError: false): Promise<string>
  async translateText(text: string, _provider?: string, throwOnError = true): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`
      )
      if (!response.ok) {
        throw new Error(`翻译请求失败: ${response.status}`)
      }
      const data = await response.json()
      if (data?.[0]) {
        const translatedText = data[0].map((item: unknown[]) => item[0]).join('')
        info(`[MatrixRoom] 翻译成功`)
        return translatedText
      }
      return text
    } catch (err) {
      error(`[MatrixRoom] 翻译失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return text
    }
  }
}

export const matrixRoomTranslateService = new MatrixRoomTranslateService()
