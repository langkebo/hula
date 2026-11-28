/**
 * 焚毁已读定向信号（to-device）的线格式约定。
 *
 * 背景：服务端 burn sweep 只把待焚毁行标记 processed，既不 redact 房间事件、
 * 也不广播任何事件；正常情况下接收方阅读后补发的 `m.read` 回执（经 Sliding Sync
 * receipts 扩展广播）是发送端唯一能拿到的跨端阅读信号。但接收方可以关闭
 * 「发送已读回执」，此时 `MatrixReceiptService.sendReadReceiptByEventId` 直接返回，
 * 发送端就永远收不到阅读信号，双端闭环断开。
 *
 * 因此关闭回执时改用本事件定向通知原消息发送者：只投递给发送者的全部设备，
 * 不向房间其他成员泄露阅读状态。发送侧见 `MatrixBurnAfterReadService.notifyBurnReadToSender`，
 * 接收侧见 `MatrixEventRouter.toDeviceBurnListener`。
 */
export const BURN_READ_TO_DEVICE_EVENT = 'com.tjg.burn_read'

/** `com.tjg.burn_read` 的事件内容。 */
export interface BurnReadToDeviceContent {
  /** 焚毁消息所在房间 */
  room_id: string
  /** 被阅读的焚毁消息事件 ID */
  event_id: string
  /** 阅读发生的时间戳（毫秒） */
  read_ts: number
}
