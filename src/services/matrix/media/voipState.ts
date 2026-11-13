import type { CallState } from './voipTypes'

/**
 * SDK `CallEvent.State` 的 `state` 参数是 SDK `CallState` 枚举的字符串值
 * （fledgling / invite_sent / wait_local_media / create_offer / create_answer /
 * connecting / connected / ringing / ended），这里只映射本服务关心的部分。
 */
export type SdkCallState = string

/**
 * 把 SDK 状态事件映射为服务层 `CallState`，返回 `null` 表示保持当前状态不变。
 *
 * SDK 在 ICE 断线且此前已接通时会把 state 改回 `connecting`（同时 restartIce()），
 * 因此「上一次状态是 connected 的 connecting」就是网络重连，而不是首次建连。
 */
export function resolveCallState(
  sdkState: SdkCallState,
  prevSdkState: SdkCallState | undefined,
  currentState: CallState | undefined
): CallState | null {
  if (sdkState === 'connected') return 'connected'
  if (sdkState === 'connecting') {
    if (prevSdkState === 'connected' || currentState === 'reconnecting') return 'reconnecting'
    return 'connecting'
  }
  return null
}
