import type { MessageMutationsDeps } from './messageMutationsDeps'

/**
 * 会话级「消息缓存整体丢弃」。
 *
 * 为什么单独一个模块：登出 / 账号重置时必须把**按 roomId 累积**的所有消息状态一次清掉，
 * 而不是逐房间调用裁剪。此前这条路径根本不存在 —— 登出只清 `user`/`global`/`setting`
 * 与若干按账号缓存，`messageMap`、`messageOptions`、`replyMapping`、未读计数、撤回缓存
 * 都留在内存里，直到下次登录 bootstrap（§19.19 已知边界 1）。
 *
 * 清空顺序有讲究：先按 `messageMap` 的房间列表清「派生结构」（排序键 / 回复映射 / 选项），
 * 再删主表，避免中途出现「有排序键但没有消息」的半截状态被渲染层读到。
 */
export const createMessageSessionReset = (deps: MessageMutationsDeps) => {
  const { messageMap, sortedMessageKeys, messageOptions, replyMapping, newMsgCount, currentMsgReply, recallMgr } = deps

  /** 丢弃全部房间的消息缓存与会话级派生状态（登出 / 账号重置用） */
  const clearAllMessages = (): void => {
    for (const roomId of Object.keys(messageMap)) {
      delete sortedMessageKeys[roomId]
      delete replyMapping[roomId]
      delete messageOptions[roomId]
      delete newMsgCount[roomId]
      delete messageMap[roomId]
    }
    currentMsgReply.value = {}
    // 撤回态（含到期定时器）属于「当前会话的运行时状态」，换账号必须一起丢弃
    recallMgr.clearAllExpirationTimers()
  }

  return { clearAllMessages }
}
