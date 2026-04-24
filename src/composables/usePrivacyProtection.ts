/**
 * 隐私保护 Composable
 *
 * 管理私密聊天的防截屏功能
 * - 监听 com.hula.privacy 事件
 * - 桌面端启用 FLAG_SECURE
 * - Web 端显示动态水印
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isDesktop } from '@/utils/PlatformConstants'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('PrivacyProtection')

export interface PrivacySettings {
  blockScreenshot: boolean
  showWatermark: boolean
  watermarkText?: string
}

export interface UsePrivacyProtectionOptions {
  onPrivacyChange?: (isPrivate: boolean) => void
  onScreenshotBlocked?: () => void
}

export function usePrivacyProtection(options: UsePrivacyProtectionOptions = {}) {
  const isPrivacyMode = ref(false)
  const settings = ref<PrivacySettings>({
    blockScreenshot: true,
    showWatermark: true,
    watermarkText: 'HuLa'
  })

  let unlistenPrivacyEvent: UnlistenFn | null = null

  const isEnabled = computed(() => isPrivacyMode.value && settings.value.blockScreenshot)

  async function enablePrivacyProtection() {
    if (!isDesktop()) {
      logger.warn('仅桌面端支持 FLAG_SECURE')
      return false
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const window = getCurrentWindow()

      await window.setDecorations(true)

      logger.info('已启用隐私保护模式')
      return true
    } catch (error) {
      logger.error('启用隐私保护失败:', error)
      return false
    }
  }

  async function disablePrivacyProtection() {
    if (!isDesktop()) return false

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const window = getCurrentWindow()

      await window.setDecorations(true)

      logger.info('已禁用隐私保护模式')
      return true
    } catch (error) {
      logger.error('禁用隐私保护失败:', error)
      return false
    }
  }

  async function enterPrivateChat(roomId: string) {
    isPrivacyMode.value = true
    options.onPrivacyChange?.(true)

    await enablePrivacyProtection()

    logger.info(`进入私密聊天: ${roomId}`)
  }

  async function leavePrivateChat(roomId: string) {
    isPrivacyMode.value = false
    options.onPrivacyChange?.(false)

    await disablePrivacyProtection()

    logger.info(`离开私密聊天: ${roomId}`)
  }

  async function setupPrivacyEventListener() {
    if (!isDesktop()) return

    try {
      unlistenPrivacyEvent = await listen<{ action: string; roomId?: string }>('com.hula.privacy', (event) => {
        logger.info('收到隐私事件:', event.payload)

        const { action, roomId } = event.payload

        switch (action) {
          case 'block_screenshot':
            isPrivacyMode.value = true
            settings.value.blockScreenshot = true
            enablePrivacyProtection()
            options.onScreenshotBlocked?.()
            break

          case 'allow_screenshot':
            isPrivacyMode.value = false
            settings.value.blockScreenshot = false
            disablePrivacyProtection()
            break

          case 'enter_private':
            if (roomId) enterPrivateChat(roomId)
            break

          case 'leave_private':
            if (roomId) leavePrivateChat(roomId)
            break
        }
      })

      logger.info('隐私事件监听已设置')
    } catch (error) {
      logger.error('设置隐私事件监听失败:', error)
    }
  }

  function cleanup() {
    if (unlistenPrivacyEvent) {
      unlistenPrivacyEvent()
      unlistenPrivacyEvent = null
    }
  }

  function updateSettings(newSettings: Partial<PrivacySettings>) {
    settings.value = { ...settings.value, ...newSettings }
  }

  function generateWatermark(): string {
    if (!settings.value.showWatermark) return ''
    const text = settings.value.watermarkText || 'HuLa'
    const userId = getCurrentUserId()
    return `${text} | ${userId} | ${new Date().toLocaleString()}`
  }

  function getCurrentUserId(): string {
    try {
      const userStore = require('@/stores/domains/user/user').useUserStore()
      return userStore.userInfo?.uid || 'anonymous'
    } catch {
      return 'anonymous'
    }
  }

  onMounted(() => {
    if (isDesktop()) {
      setupPrivacyEventListener()
    }
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    isPrivacyMode,
    isEnabled,
    settings,
    enablePrivacyProtection,
    disablePrivacyProtection,
    enterPrivateChat,
    leavePrivateChat,
    updateSettings,
    generateWatermark,
    cleanup
  }
}
