/**
 * 右键菜单共享类型定义
 *
 * ContextMenu.vue 及其 composable 共用的类型，从全局 OPT 命名空间派生。
 */

export type MenuContent = unknown
export type ContextMenuItem = OPT.RightMenu<MenuContent>

export type ReactionEmoji = {
  url: string
  value: number
  title: string
}

export type SizePayload = {
  width: number
  height: number
}
