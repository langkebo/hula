import { describe, expect, it } from 'vitest'
import { MATRIX_PATHS, PREFIX_V3 } from '../index'

describe('paths/index aggregate', () => {
  it('re-exports PREFIX_V3', () => {
    expect(PREFIX_V3).toBe('/_matrix/client/v3')
  })

  it('MATRIX_PATHS exposes all module groups', () => {
    expect(MATRIX_PATHS.AUTH).toBeDefined()
    expect(MATRIX_PATHS.ROOM).toBeDefined()
    expect(MATRIX_PATHS.FRIENDS).toBeDefined()
    expect(MATRIX_PATHS.SPACE).toBeDefined()
    expect(MATRIX_PATHS.SYNC).toBeDefined()
    expect(MATRIX_PATHS.NOTIFICATION).toBeDefined()
    expect(MATRIX_PATHS.VOICE).toBeDefined()
    expect(MATRIX_PATHS.WELL_KNOWN).toBeDefined()
    expect(MATRIX_PATHS.CLIENT_CONFIG).toBeDefined()
  })

  // C-2（§7/§8）：清理 10 个生产零引用的命名空间常量。此处锁定删除结果，
  // 防止维护者误将死命名空间重新引入聚合对象。
  it('MATRIX_PATHS 不再包含已清理的 10 个零引用命名空间', () => {
    for (const dead of [
      'ADMIN',
      'MODERATION',
      'USER',
      'BURN',
      'RELATIONS',
      'RENDEZVOUS',
      'ACCOUNT_DATA',
      'WIDGET',
      'GUEST',
      'MEDIA'
    ]) {
      expect(MATRIX_PATHS).not.toHaveProperty(dead)
    }
  })

  it('MATRIX_PATHS.EXTENSIONS is populated from backend endpoints', () => {
    expect(MATRIX_PATHS.EXTENSIONS).toBeDefined()
    expect(Object.keys(MATRIX_PATHS.EXTENSIONS).length).toBeGreaterThan(0)
  })
})
