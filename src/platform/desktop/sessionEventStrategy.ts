import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWindow } from '@/composables/common/useWindow'
import { CallTypeEnum } from '@/enums'
import type { SessionEventStrategy } from '@/platform/contracts'

/**
 * 桌面端会话事件策略：旧 WS 来电走独立通话窗口，远端登录失效通过 home 窗口提示。
 */
export const desktopSessionEventStrategy: SessionEventStrategy = {
  handleLegacyVideoCall: ({ callerUid, isVideo }, { handleVideoCall }) => {
    const callType = isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
    void handleVideoCall(callerUid, callType)
  },

  handleRemoteLoginExpired: async ({ remoteIp, logout }) => {
    const home = await WebviewWindow.getByLabel('home')
    await home?.setFocus()
    const { sendWindowPayload } = useWindow()
    await sendWindowPayload('login', {
      remoteLogin: { ip: remoteIp ?? '未知IP', timestamp: Date.now() }
    })
    await logout()
  }
}
