import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { createLogger } from '@/utils/Logger'
import { getOSType } from '@/utils/PlatformConstants'

const logger = createLogger('Fingerprint')

const CACHE_DURATION = 24 * 60 * 60 * 1000

const worker = new Worker(new URL('../workers/fingerprint.worker.ts', import.meta.url), {
  type: 'module'
})

let fingerprintPromise: Promise<string> | null = null

/**
 * 获取性能优化的跨平台设备指纹
 */
export const getEnhancedFingerprint = async (): Promise<string> => {
  if (fingerprintPromise) {
    return fingerprintPromise
  }

  fingerprintPromise = (async () => {
    const totalStart = performance.now()

    try {
      const cachedData = localStorage.getItem('deviceFingerprint')
      if (cachedData) {
        const { fingerprint, timestamp } = JSON.parse(cachedData)
        if (Date.now() - timestamp < CACHE_DURATION) {
          const totalTime = performance.now() - totalStart
          logger.debug(`使用缓存的设备指纹，总耗时: ${totalTime.toFixed(2)}ms`)
          return fingerprint
        }
      }

      const deviceInfoStart = performance.now()
      const deviceInfo = {
        platform: getOSType(),
        screenSize: `${window.screen.width}x${window.screen.height}`,
        pixelRatio: window.devicePixelRatio,
        colorDepth: window.screen.colorDepth,
        hardwareConcurrency: navigator.hardwareConcurrency || undefined,
        deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
      const deviceInfoTime = performance.now() - deviceInfoStart
      logger.debug(`收集设备信息耗时: ${deviceInfoTime.toFixed(2)}ms`)

      const fpStart = performance.now()
      const fp = await FingerprintJS.load()
      const fpResult = await fp.get({
        debug: false
      })
      const fpTime = performance.now() - fpStart
      logger.debug(`基础指纹生成耗时: ${fpTime.toFixed(2)}ms`)

      const workerStart = performance.now()
      const fingerprint = await new Promise<string>((resolve) => {
        const handleMessage = (e: MessageEvent) => {
          const { type, fingerprint } = e.data
          if (type === 'fingerprintGenerated') {
            worker.removeEventListener('message', handleMessage)
            resolve(fingerprint)
          }
        }

        worker.addEventListener('message', handleMessage)
        worker.postMessage({
          type: 'generateFingerprint',
          deviceInfo,
          browserFingerprint: fpResult.visitorId
        })
      })
      const workerTime = performance.now() - workerStart
      logger.debug(`Worker生成指纹耗时: ${workerTime.toFixed(2)}ms`)

      if (fingerprint) {
        localStorage.setItem(
          'deviceFingerprint',
          JSON.stringify({
            fingerprint,
            timestamp: Date.now()
          })
        )
      }

      const totalTime = performance.now() - totalStart
      logger.debug(`设备指纹获取总耗时: ${totalTime.toFixed(2)}ms`)
      return fingerprint
    } catch (error) {
      const totalTime = performance.now() - totalStart
      logger.error(`获取设备指纹失败，总耗时: ${totalTime.toFixed(2)}ms`, error)
      return ''
    } finally {
      fingerprintPromise = null
    }
  })()

  return fingerprintPromise
}
