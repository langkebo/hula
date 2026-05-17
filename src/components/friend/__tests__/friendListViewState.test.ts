import { describe, expect, it } from 'vitest'
import { resolveFriendListViewState } from '../friendListViewState'

describe('resolveFriendListViewState', () => {
  it('能力关闭时优先返回 capability', () => {
    expect(
      resolveFriendListViewState({
        isCapabilityReady: true,
        canUseFriendList: false,
        hasError: true,
        hasFriends: false
      })
    ).toBe('capability')
  })

  it('列表为空且存在加载错误时返回 error', () => {
    expect(
      resolveFriendListViewState({
        isCapabilityReady: true,
        canUseFriendList: true,
        hasError: true,
        hasFriends: false
      })
    ).toBe('error')
  })

  it('列表为空且无错误时返回 empty', () => {
    expect(
      resolveFriendListViewState({
        isCapabilityReady: true,
        canUseFriendList: true,
        hasError: false,
        hasFriends: false
      })
    ).toBe('empty')
  })

  it('存在好友数据时保持 normal，即使最近一次刷新报错也不降级为空白错误页', () => {
    expect(
      resolveFriendListViewState({
        isCapabilityReady: true,
        canUseFriendList: true,
        hasError: true,
        hasFriends: true
      })
    ).toBe('normal')
  })
})
