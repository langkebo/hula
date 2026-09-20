import { describe, expect, it } from 'vitest'
import {
  extractServerName,
  normalizeMatrixUserId,
  resolveDmIdentityKey,
  resolveFederationPeer,
  sameHomeserver,
  toLocalpart
} from '../userIdentity'

describe('userIdentity', () => {
  describe('toLocalpart', () => {
    it('extracts localpart from a full MXID', () => {
      expect(toLocalpart('@hulatest:matrix.test')).toBe('hulatest')
    })

    it('returns the input unchanged when it is already a localpart', () => {
      expect(toLocalpart('hulatest')).toBe('hulatest')
    })

    it('returns empty string for empty input', () => {
      expect(toLocalpart('')).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(toLocalpart(undefined)).toBe('')
    })

    it('returns empty string for null', () => {
      expect(toLocalpart(null)).toBe('')
    })

    it('extracts localpart from a multi-segment server name', () => {
      expect(toLocalpart('@test:server.com')).toBe('test')
    })

    it('trims surrounding whitespace before extracting localpart', () => {
      expect(toLocalpart('  @hulatest:matrix.test  ')).toBe('hulatest')
    })
  })

  describe('normalizeMatrixUserId', () => {
    it('returns the value unchanged when it is already a full MXID', () => {
      expect(normalizeMatrixUserId('@ljf1:matrix.test', '@me:matrix.test')).toBe('@ljf1:matrix.test')
    })

    it('builds a full MXID from a localpart using the current user server name', () => {
      expect(normalizeMatrixUserId('ljf1', '@me:matrix.test')).toBe('@ljf1:matrix.test')
    })

    it('returns empty string for empty value', () => {
      expect(normalizeMatrixUserId('', '@me:matrix.test')).toBe('')
    })

    it('returns empty string for undefined value', () => {
      expect(normalizeMatrixUserId(undefined, '@me:matrix.test')).toBe('')
    })

    it('returns trimmed value when currentUserId is not provided', () => {
      expect(normalizeMatrixUserId('ljf1')).toBe('ljf1')
    })

    it('returns trimmed value when currentUserId has no server name', () => {
      expect(normalizeMatrixUserId('ljf1', 'ljf1')).toBe('ljf1')
    })
  })

  describe('resolveDmIdentityKey（DM 同人判定单一事实源）', () => {
    it('localpart 与完整 MXID 归一化到同一 key（根治同人漏判）', () => {
      expect(resolveDmIdentityKey({ detailId: 'test1' })).toBe(resolveDmIdentityKey({ detailId: '@test1:matrix.test' }))
      expect(resolveDmIdentityKey({ detailId: 'test1' })).toBe('test1')
      expect(resolveDmIdentityKey({ detailId: '@test1:matrix.test' })).toBe('test1')
    })

    it('detailId 优先，缺失时回退 account', () => {
      expect(resolveDmIdentityKey({ detailId: '@a:matrix.test', account: 'b' })).toBe('a')
      expect(resolveDmIdentityKey({ detailId: undefined, account: '@b:matrix.test' })).toBe('b')
      expect(resolveDmIdentityKey({ account: 'b' })).toBe('b')
    })

    it('两者皆缺失返回空串（调用方回退 roomId 兜底）', () => {
      expect(resolveDmIdentityKey({})).toBe('')
      expect(resolveDmIdentityKey({ detailId: null, account: null })).toBe('')
    })

    it('空壳 MXID（localpart 为空）回退 account', () => {
      expect(resolveDmIdentityKey({ detailId: '@:matrix.test', account: 'fallback' })).toBe('fallback')
    })
  })

  describe('sameHomeserver（联邦判定单一事实源）', () => {
    it('同一 homeserver 的两个 MXID 判定为同一服务器', () => {
      expect(sameHomeserver('@a:matrix.test', '@b:matrix.test')).toBe(true)
    })

    it('不同 homeserver 判定为不同', () => {
      expect(sameHomeserver('@a:matrix.test', '@b:other.test')).toBe(false)
    })

    it('MXID 与纯 server name 可混用', () => {
      expect(sameHomeserver('@a:matrix.test', 'matrix.test')).toBe(true)
      expect(sameHomeserver('matrix.test', '@a:matrix.test')).toBe(true)
    })

    it('房间 ID（!:opaque:server）也能参与判定', () => {
      expect(sameHomeserver('!room:matrix.test', '@a:matrix.test')).toBe(true)
    })

    it('大小写与首尾空白不影响判定（homeserver 名是 DNS 风格）', () => {
      expect(sameHomeserver('@a:Matrix.Test', '  matrix.test  ')).toBe(true)
    })

    it('任一方无法解析 server name 时返回 false（不轻易断言「同一服务器」）', () => {
      expect(sameHomeserver(undefined, '@a:matrix.test')).toBe(false)
      expect(sameHomeserver('@a:matrix.test', '')).toBe(false)
      expect(sameHomeserver('', '')).toBe(false)
    })
  })

  describe('resolveFederationPeer', () => {
    it('远端用户：server 正确且 isRemote 为 true', () => {
      expect(resolveFederationPeer('@a:other.test', 'matrix.test')).toEqual({
        server: 'other.test',
        isRemote: true
      })
    })

    it('本地用户：isRemote 为 false', () => {
      expect(resolveFederationPeer('@a:matrix.test', 'matrix.test')).toEqual({
        server: 'matrix.test',
        isRemote: false
      })
    })

    it('本机 homeserver 以 MXID 传入时同样成立', () => {
      expect(resolveFederationPeer('@a:matrix.test', '@me:matrix.test').isRemote).toBe(false)
    })

    it('本机 homeserver 未就绪时按本地处理（避免瞬时全量误报「联邦用户」）', () => {
      expect(resolveFederationPeer('@a:other.test', '')).toEqual({ server: 'other.test', isRemote: false })
      expect(resolveFederationPeer('@a:other.test', null).isRemote).toBe(false)
    })

    it('对端 MXID 解析不出 server 时返回空 server 且非远端', () => {
      expect(resolveFederationPeer('', 'matrix.test')).toEqual({ server: '', isRemote: false })
      expect(resolveFederationPeer(undefined, 'matrix.test').isRemote).toBe(false)
    })
  })

  describe('extractServerName', () => {
    it('从 MXID 提取 server name', () => {
      expect(extractServerName('@a:matrix.test')).toBe('matrix.test')
    })

    it('已是 server name 时无法提取（无冒号）返回空串', () => {
      expect(extractServerName('matrix.test')).toBe('')
    })

    it('空值返回空串', () => {
      expect(extractServerName(undefined)).toBe('')
      expect(extractServerName(null)).toBe('')
    })
  })
})
