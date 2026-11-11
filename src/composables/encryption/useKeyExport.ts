import { ref } from 'vue'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'

/**
 * 恢复密钥导出：SDK 导出 + 浏览器下载的唯一实现。
 *
 * 桌面设置页与移动设置页共用，避免 Blob/锚点下载细节各写一份；
 * 文件名与提示文案由调用方提供，保留两端差异。
 */
export function useKeyExport() {
  const isExporting = ref(false)

  /**
   * 导出房间密钥并触发浏览器下载。
   * @param fileName 下载文件名
   * @returns 导出的 keys JSON；空字符串表示 SDK 没有可导出的内容
   */
  async function exportKeys(fileName: string): Promise<string> {
    isExporting.value = true
    try {
      const { data } = await cryptoSDKAdapter.exportKeys()
      if (!data) return ''
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      return data
    } finally {
      isExporting.value = false
    }
  }

  return { isExporting, exportKeys }
}
