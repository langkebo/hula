/**
 * 「是否以阅后即焚发送」的判定策略（纯函数，便于单独测试）。
 *
 * 两个来源必须**或**起来：
 * - `roomEnabled`：房间级 state（`m.burn_after_read`），由房主/管理员设置；
 * - `globalDefault`：账号级偏好 `burnDefaultEnabled`。
 *
 * 历史缺陷（P0-7）：发送路径只读房间级 state，设置页里那个「默认开启阅后即焚」的开关
 * **只写不读**——用户打开后行为毫无变化。这里把判定收敛成一个可测的函数，
 * 避免再次在长 composable 里被改坏。
 */
export function resolveBurnAfterRead(roomEnabled: boolean, globalDefault: boolean | undefined | null): boolean {
  return roomEnabled || globalDefault === true
}
