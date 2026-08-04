<template>
  <div class="scanner-page">
    <HeaderBar
      class="scanner-header"
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('mobile_qrcode.page_title')" />

    <div class="scanner">
      <div
        class="w-60 h-60 mt-30% items-center justify-center border-op-50 overflow-hidden flex-col rounded-15px flex border-solid border-white border-3"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { listen } from '@tauri-apps/api/event'
import { cancel, Format, scan } from '@tauri-apps/plugin-barcode-scanner'
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/composables/common/useMitt'
import { usePlatformClose } from '@/composables/common/usePlatformClose'
import { MittEnum } from '@/enums'
import router from '@/router'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('MobileQRCode')
const timerManager = useTimerManager()
const { t } = useI18n()
const { closeCurrentWindow } = usePlatformClose()

const result = ref<string | null>(null)
const isActive = ref(true)

const startScan = async () => {
  try {
    const scanTask = scan({
      windowed: true,
      formats: [Format.QRCode, Format.EAN13]
    })

    const cancelTask = new Promise((resolve) => {
      const interval = timerManager.setInterval(() => {
        if (!isActive.value) {
          timerManager.clearInterval(interval)
          resolve(null)
        }
      }, 300)
    })

    const res = (await Promise.race([scanTask, cancelTask])) as { content?: string } | string | null

    // 为空或已取消
    if (!res) {
      result.value = t('mobile_qrcode.scan_cancelled')
      return
    }

    logger.debug('Scan result:', res)

    if (res && typeof res === 'object' && 'content' in res && typeof res.content === 'string') {
      try {
        const jsonData = JSON.parse(res.content)
        logger.debug('Parsed QR payload:', jsonData)
        useMitt.emit(MittEnum.QR_SCAN_EVENT, jsonData)
      } catch (error) {
        logger.debug('QR result is not JSON, falling back to plain text:', error)
        useMitt.emit(MittEnum.QR_SCAN_EVENT, { raw: res.content })
      }

      if (window.history.length > 1) {
        window.history.back()
      } else {
        await closeCurrentWindow()
      }
      result.value = res.content
    } else if (typeof res === 'string') {
      // 某些平台可能直接返回字符串内容
      useMitt.emit(MittEnum.QR_SCAN_EVENT, { raw: res })
      result.value = res
      if (window.history.length > 1) window.history.back()
      else await closeCurrentWindow()
    } else {
      result.value = t('mobile_qrcode.scan_failed_or_cancelled')
    }
  } catch (err: unknown) {
    logger.error('QR scan failed', err)

    if (err && typeof err === 'object' && 'message' in err && /permission/i.test((err as Error).message)) {
      alert(t('mobile_qrcode.camera_permission_required'))
      router.back() // 用户点 OK 后会执行这里
      result.value = t('mobile_qrcode.permission_missing')
    } else {
      alert(t('mobile_qrcode.scan_error'))
      router.back() // 其他错误也返回上一页
      result.value = t('mobile_qrcode.scan_error')
    }
  }
}

let unlistenAndroidBack: (() => void) | null = null
let originalAppBg = ''

onMounted(async () => {
  // 使相机预览可见：将根容器背景设为透明，避免遮挡
  const appContainer = document.querySelector('.appContainer') as HTMLElement | null
  if (appContainer) {
    originalAppBg = appContainer.style.backgroundColor || ''
    appContainer.style.backgroundColor = 'transparent'
  }

  isActive.value = true
  startScan()

  // 仅在 Android 设备监听返回键，避免在 iOS/Safari 环境报错
  const isAndroid = /Android/i.test(navigator.userAgent)
  if (isAndroid) {
    try {
      unlistenAndroidBack = await listen('tauri://android-back', () => {
        isActive.value = false
        cancel().catch((e) => {
          logger.warn('Failed to call cancel()', e)
        })
      })
    } catch (e) {
      logger.warn('Failed to listen for Android back event', e)
    }
  }
})

onUnmounted(() => {
  isActive.value = false
  if (unlistenAndroidBack) {
    unlistenAndroidBack()
    unlistenAndroidBack = null
  }
  // 恢复应用根容器背景色
  const appContainer = document.querySelector('.appContainer') as HTMLElement | null
  if (appContainer) {
    appContainer.style.backgroundColor = originalAppBg
  }
  cancel().catch((e) => {
    logger.warn('Failed to call cancel()', e)
  })
})
</script>

<style scoped>
.scanner-page {
  position: relative;
  width: 100%;
  height: 100%;
}

.scanner-header {
  position: relative;
  z-index: 10; /* 确保头部在扫码层之上 */
}

.scanner {
  position: fixed;
  inset: 0;
  background: transparent; /* 保持透明，透出相机预览 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  text-align: center;
  pointer-events: none; /* 不拦截点击，避免遮挡返回按钮 */
}

.scanner > div {
  z-index: 1;
}
</style>
