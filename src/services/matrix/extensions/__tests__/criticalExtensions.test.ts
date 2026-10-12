import { describe, expect, it } from 'vitest'
import { DEFAULT_CORE_EXTENSIONS, type MatrixClient } from '@/services/matrix/sdk'
import {
  CRITICAL_EXTENSION_IDS,
  deriveExtensionAccessors,
  EXTENSION_ACCESSOR_OVERRIDES,
  extensionOptionToAccessor,
  FRIEND_EXTENSION_ID,
  findUnregisteredExtensions,
  isExtensionRegistered
} from '../criticalExtensions'

describe('extensionOptionToAccessor', () => {
  it('按 include<Pascal> -> get<Pascal>Manager 规则派生', () => {
    expect(extensionOptionToAccessor('includeProfile')).toBe('getProfileManager')
    expect(extensionOptionToAccessor('includeRoomSummary')).toBe('getRoomSummaryManager')
  })

  it('应用 3 处显式白名单映射（Dm / SyncManagement / TagsManagement）', () => {
    expect(EXTENSION_ACCESSOR_OVERRIDES).toEqual({
      includeDm: 'getDirectMessageManager',
      includeSyncManagement: 'getSyncManager',
      includeTagsManagement: 'getTagsManager'
    })
    expect(extensionOptionToAccessor('includeDm')).toBe('getDirectMessageManager')
    expect(extensionOptionToAccessor('includeSyncManagement')).toBe('getSyncManager')
    expect(extensionOptionToAccessor('includeTagsManagement')).toBe('getTagsManager')
  })
})

describe('CRITICAL_EXTENSION_IDS 派生', () => {
  it('长度恒等于 SDK 扩展清单长度', () => {
    expect(CRITICAL_EXTENSION_IDS.length).toBe(Object.keys(DEFAULT_CORE_EXTENSIONS).length)
    expect(CRITICAL_EXTENSION_IDS.length).toBeGreaterThan(0)
  })

  it('全部遵循 getXxxManager 命名且无重复', () => {
    for (const id of CRITICAL_EXTENSION_IDS) {
      expect(id).toMatch(/^get[A-Za-z0-9]+Manager$/)
    }
    expect(new Set(CRITICAL_EXTENSION_IDS).size).toBe(CRITICAL_EXTENSION_IDS.length)
  })

  it('包含 FriendManager 探针 ID（保留专用降级遥测）', () => {
    expect(FRIEND_EXTENSION_ID).toBe('getFriendManager')
    expect(CRITICAL_EXTENSION_IDS).toContain(FRIEND_EXTENSION_ID)
  })
})

describe('findUnregisteredExtensions', () => {
  it('null client 时全部视为未注册', () => {
    expect(findUnregisteredExtensions(null, ['getFriendManager', 'getProfileManager'])).toEqual([
      'getFriendManager',
      'getProfileManager'
    ])
  })

  it('新增扩展未登记 -> 出现在未注册列表（防止 SDK 升级漏检）', () => {
    // 模拟 SDK 清单新增一个扩展：派生器必须自动纳入，未注册时被检出
    const extendedManifest = { ...DEFAULT_CORE_EXTENSIONS, includeBrandNewFeature: true }
    const accessors = deriveExtensionAccessors(extendedManifest)
    expect(accessors).toContain('getBrandNewFeatureManager')

    const client = { getFriendManager: () => ({}) } as unknown as MatrixClient
    const unregistered = findUnregisteredExtensions(client, accessors)

    expect(unregistered).toContain('getBrandNewFeatureManager')
    expect(unregistered).not.toContain('getFriendManager')
  })
})

describe('isExtensionRegistered', () => {
  it('访问器为函数时视为已注册', () => {
    const client = { getFriendManager: () => ({}) } as unknown as MatrixClient
    expect(isExtensionRegistered(client, 'getFriendManager')).toBe(true)
    expect(isExtensionRegistered(client, 'getProfileManager')).toBe(false)
  })

  it('null client 恒为 false', () => {
    expect(isExtensionRegistered(null, 'getFriendManager')).toBe(false)
  })
})
