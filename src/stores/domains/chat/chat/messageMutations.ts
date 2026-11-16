import { createMessageCacheMutations } from './messageCacheMutations'
import { createMessageInsertMutations } from './messageInsertMutations'
import type { MessageMutationsDeps } from './messageMutationsDeps'
import { createMessageRecallMutations } from './messageRecallMutations'
import { createMessageSessionReset } from './messageSessionReset'

export type { MessageMutationsDeps }

/**
 * 消息写操作聚合入口。
 *
 * 原实现集中在本文件（564 行），已按职责拆为：
 * - `messageInsertMutations.ts`：插入 / 更新 / 删除 / 清空
 * - `messageRecallMutations.ts`：标记计数、撤回记录与撤回态更新
 * - `messageCacheMutations.ts`：房间消息缓存裁剪
 *
 * 对外仍暴露单个 `createMessageMutations`，调用方无需改动。
 */
export const createMessageMutations = (deps: MessageMutationsDeps) => ({
  ...createMessageInsertMutations(deps),
  ...createMessageRecallMutations(deps),
  ...createMessageCacheMutations(deps),
  ...createMessageSessionReset(deps)
})
