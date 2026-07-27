/**
 * 右侧栏视图类型定义
 *
 * 右侧栏视图状态从路由派生（路由为单一真相源）。
 * 参考需求文档第 5.3 节。
 */

export type RightViewType =
  | 'empty'
  | 'details'
  | 'search'
  | 'addFriend'
  | 'createRoom'
  | 'joinRoom'
  | 'createSpace'
  | 'applyList'
  | 'spaceChildren'
  | 'chat'

export const RIGHT_VIEW_TYPES: ReadonlyArray<RightViewType> = [
  'empty',
  'details',
  'search',
  'addFriend',
  'createRoom',
  'joinRoom',
  'createSpace',
  'applyList',
  'spaceChildren',
  'chat'
]

export function isRightViewType(value: unknown): value is RightViewType {
  return typeof value === 'string' && (RIGHT_VIEW_TYPES as string[]).includes(value)
}
