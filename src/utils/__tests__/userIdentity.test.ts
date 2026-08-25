import { describe, expect, it } from 'vitest'
import { normalizeMatrixUserId, resolveDmIdentityKey, toLocalpart } from '../userIdentity'

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
})
