/**
 * 房间 state event 写权限判定（power levels）。
 *
 * 从 `RoomOperations` 抽出：该文件不得增长（`check:file-size` 基线 593），
 * 而这段判定本身是**纯逻辑**，单独放更便于测试与复用。
 *
 * 规则与服务端 `verify_state_event_write` 一致：
 * - 用户 power = `power_levels.users[userId] ?? power_levels.users_default ?? 0`
 * - 所需 power = `power_levels.events[eventType] ?? power_levels.state_default ?? 50`
 * - 可写当且仅当 userPower >= requiredPower
 *
 * UI 用它决定「隐藏还是禁用」——目前统一选择**隐藏**：
 * 展示一个必定 403 的开关只会制造困惑。
 */

/** 仅需 power_levels 的 content 与当前用户，便于单测 */
export interface PowerLevelsContent {
  users?: Record<string, number>
  users_default?: number
  events?: Record<string, number>
  state_default?: number
}

/** 最小客户端面：只要能取到 room 与 userId */
interface PowerLevelsClient {
  getUserId: () => string | null
  getRoom: (roomId: string) => {
    currentState: { getStateEvents: (type: string, stateKey: string) => { getContent: () => unknown } | null }
  } | null
}

/**
 * 纯判定：给定 power_levels 内容，当前用户能否写 `eventType`。
 *
 * 缺省值刻意与 Matrix spec 对齐（users_default 0 / state_default 50）——
 * 写错这两个默认值会让普通成员看到"能点但必 403"的开关。
 */
export function canWriteStateEventFromContent(content: PowerLevelsContent, userId: string, eventType: string): boolean {
  const users = content.users ?? {}
  const usersDefault = content.users_default ?? 0
  const events = content.events ?? {}
  const stateDefault = content.state_default ?? 50
  const userPower = users[userId] ?? usersDefault
  const requiredPower = events[eventType] ?? stateDefault
  return userPower >= requiredPower
}

/**
 * 读取房间当前 power_levels 并判定写权限。
 *
 * 任何一环缺失（无 client / 未登录 / 无房间 / 无 power_levels）都返回 false：
 * 权限判定拿不到依据时必须按「不可写」处理，否则 UI 会给出必被 403 的入口。
 */
export function canWriteStateEventInRoom(
  client: PowerLevelsClient | null | undefined,
  roomId: string,
  eventType: string
): boolean {
  if (!client) return false
  const userId = client.getUserId()
  if (!userId) return false
  const room = client.getRoom(roomId)
  if (!room) return false
  const powerEvent = room.currentState.getStateEvents('m.room.power_levels', '')
  if (!powerEvent) return false
  return canWriteStateEventFromContent(powerEvent.getContent() as PowerLevelsContent, userId, eventType)
}
