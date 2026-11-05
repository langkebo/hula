import { describe, expect, it } from 'vitest'
import { resolveSessionListState } from '../useMobileSessionList'

/**
 * 会话列表四态判定。
 *
 * 关键约定：**有数据就永远显示列表**（下拉刷新期间不能把已有列表换成骨架），
 * 只有「一条都没有」时才按 loadError / isLoading 区分失败与加载中 —— 否则用户会把
 * 「还没拉到」「拉失败」误读成「你没有会话」。
 */
describe('resolveSessionListState', () => {
  it('有数据时恒为 list（刷新中 / 刷新失败都不遮挡已有列表）', () => {
    expect(resolveSessionListState({ count: 3, isLoading: true, loadError: null })).toBe('list')
    expect(resolveSessionListState({ count: 3, isLoading: false, loadError: 'network' })).toBe('list')
  })

  it('空列表 + 失败 → error（优先于 loading，避免失败后一直转圈）', () => {
    expect(resolveSessionListState({ count: 0, isLoading: true, loadError: 'network' })).toBe('error')
    expect(resolveSessionListState({ count: 0, isLoading: false, loadError: 'network' })).toBe('error')
  })

  it('空列表 + 加载中 → loading（不能显示成「暂无会话」）', () => {
    expect(resolveSessionListState({ count: 0, isLoading: true, loadError: null })).toBe('loading')
  })

  it('空列表 + 未加载 + 没错误 → empty（真正的没有会话）', () => {
    expect(resolveSessionListState({ count: 0, isLoading: false, loadError: null })).toBe('empty')
    expect(resolveSessionListState({ count: 0, isLoading: false, loadError: undefined })).toBe('empty')
  })
})
