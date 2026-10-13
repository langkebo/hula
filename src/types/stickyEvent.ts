/**
 * 粘性事件（MSC4354 sticky events）的**展示态**类型。
 *
 * 从已删除的 `useStickyEvents` composable 迁出（C2 收敛）：该 composable 零生产消费者，
 * 但 `StickyEventBanner.vue` 仍需要这个视图模型，故类型独立成文，谁需要谁引。
 *
 * 注意数据来源：横幅实际渲染的是 `usePinnedMessage` 的 `pinnedMessages`
 * （`ChatMain.vue` 把它作为 `stickyEvents` 传给 `ChatBanners`），本条只是渲染层的形状契约。
 */
export interface StickyEventInfo {
  eventId: string
  sender: string
  body: string
  timestamp: number
}
