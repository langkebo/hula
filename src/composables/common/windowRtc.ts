import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import { CallTypeEnum, RoomTypeEnum } from '@/enums'
import type { useI18nGlobal } from '@/services/i18n'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { isMac } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { ensureDesktopWindowInstance, logger, MAC_TRAFFIC_LIGHTS_SPACING } from './windowHelpers'

export type CreateWebviewWindow = (
  title: string,
  label: string,
  width: number,
  height: number,
  wantCloseWindow?: string,
  resizable?: boolean,
  minW?: number,
  minH?: number,
  transparent?: boolean,
  visible?: boolean,
  queryParams?: Record<string, string | number | boolean>
) => Promise<WebviewWindow | null>

interface RtcWindowManagerDeps {
  globalStore: ReturnType<typeof useGlobalStore>
  t: ReturnType<typeof useI18nGlobal>['t']
  showFeedback: ReturnType<typeof useActionFeedback>['showFeedback']
  createWebviewWindow: CreateWebviewWindow
}

export function createRtcWindowManager(deps: RtcWindowManagerDeps) {
  const { globalStore, t, showFeedback, createWebviewWindow } = deps

  const startRtcCall = async (callType: CallTypeEnum) => {
    try {
      const currentSession = globalStore.currentSession
      if (!currentSession) {
        showFeedback(t('hooks.window.session_not_ready'), 'warning')
        return
      }
      // 判断是否为群聊，如果是群聊则跳过
      if (currentSession.type === RoomTypeEnum.GROUP) {
        showFeedback(t('hooks.window.group_call_not_supported'), 'warning')
        return
      }

      // 获取当前房间好友的ID（单聊时使用detailId作为remoteUid）
      const remoteUid = currentSession.detailId
      if (!remoteUid) {
        showFeedback(t('hooks.window.user_info_missing'), 'error')
        return
      }
      await createRtcCallWindow(false, remoteUid, globalStore.currentSessionRoomId, callType)
    } catch (error) {
      logger.error('创建视频通话窗口失败:', error)
    }
  }

  const createRtcCallWindow = async (
    isIncoming: boolean,
    remoteUserId: string,
    roomId: string,
    callType: CallTypeEnum
  ) => {
    // 根据是否来电决定窗口尺寸
    const windowConfig = isIncoming
      ? { width: 360, height: 90, minWidth: 360, minHeight: 90 } // 来电通知尺寸
      : callType === CallTypeEnum.VIDEO
        ? { width: 850, height: 580, minWidth: 850, minHeight: 580 } // 视频通话尺寸
        : { width: 500, height: 650, minWidth: 500, minHeight: 650 } // 语音通话尺寸

    const type =
      callType === CallTypeEnum.VIDEO ? t('common.window_titles.video_call') : t('common.window_titles.audio_call')
    await createWebviewWindow(
      type, // 窗口标题
      'rtcCall', // 窗口标签
      windowConfig.width, // 宽度
      windowConfig.height, // 高度
      undefined, // 不需要关闭其他窗口
      true, // 可调整大小
      windowConfig.minWidth, // 最小宽度
      windowConfig.minHeight, // 最小高度
      false, // 不透明
      false, // 显示窗口
      {
        remoteUserId,
        roomId: roomId,
        callType,
        isIncoming
      }
    )
  }

  const ensureCaptureWindow = async () => {
    return ensureDesktopWindowInstance(
      'capture',
      {
        url: '/capture',
        fullscreen: false,
        transparent: true,
        resizable: false,
        skipTaskbar: true,
        decorations: false,
        visible: false,
        hiddenTitle: true,
        alwaysOnTop: true,
        focus: true,
        titleBarStyle: 'overlay',
        visibleOnAllWorkspaces: true
      },
      async (captureWindow) => {
        await captureWindow.hide().catch(() => {
          /* window may already be hidden */
        })
      }
    )
  }

  const ensureCheckUpdateWindow = async () => {
    return ensureDesktopWindowInstance(
      'checkupdate',
      {
        title: t('common.window_titles.check_update'),
        url: '/checkupdate',
        resizable: false,
        width: 500,
        height: 150,
        alwaysOnTop: true,
        focus: true,
        skipTaskbar: true,
        visible: false,
        titleBarStyle: 'overlay',
        hiddenTitle: true
      },
      async (checkUpdateWindow) => {
        if (isMac()) {
          await invokeSilently('set_macos_traffic_lights_spacing', {
            windowLabel: checkUpdateWindow.label,
            spacing: MAC_TRAFFIC_LIGHTS_SPACING
          })
        }
      }
    )
  }

  const ensureNotifyWindow = async () => {
    return ensureDesktopWindowInstance('notify', {
      url: '/notify',
      resizable: false,
      visible: false,
      width: 280,
      height: 140,
      alwaysOnTop: true,
      skipTaskbar: true,
      decorations: false,
      transparent: true
    })
  }

  return {
    startRtcCall,
    createRtcCallWindow,
    ensureCaptureWindow,
    ensureCheckUpdateWindow,
    ensureNotifyWindow
  }
}
