import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvatarUtils } from '../AvatarUtils'

describe('AvatarUtils', () => {
  describe('isDefaultAvatar', () => {
    it('returns true for valid default avatars (001-022)', () => {
      expect(AvatarUtils.isDefaultAvatar('001')).toBe(true)
      expect(AvatarUtils.isDefaultAvatar('010')).toBe(true)
      expect(AvatarUtils.isDefaultAvatar('022')).toBe(true)
    })

    it('returns false for out-of-range numbers', () => {
      expect(AvatarUtils.isDefaultAvatar('000')).toBe(false)
      expect(AvatarUtils.isDefaultAvatar('023')).toBe(false)
      expect(AvatarUtils.isDefaultAvatar('100')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(AvatarUtils.isDefaultAvatar('')).toBe(false)
    })

    it('returns false for non-3-digit strings', () => {
      expect(AvatarUtils.isDefaultAvatar('01')).toBe(false)
      expect(AvatarUtils.isDefaultAvatar('0001')).toBe(false)
      expect(AvatarUtils.isDefaultAvatar('a')).toBe(false)
    })

    it('returns false for non-numeric strings', () => {
      expect(AvatarUtils.isDefaultAvatar('abc')).toBe(false)
      expect(AvatarUtils.isDefaultAvatar('00a')).toBe(false)
    })
  })

  describe('getAvatarUrl', () => {
    it('returns default for null/undefined', () => {
      expect(AvatarUtils.getAvatarUrl(null)).toBe('/logoD.png')
      expect(AvatarUtils.getAvatarUrl(undefined)).toBe('/logoD.png')
    })

    it('returns default for empty string', () => {
      expect(AvatarUtils.getAvatarUrl('')).toBe('/logoD.png')
    })

    it('returns avatar path for default avatars', () => {
      expect(AvatarUtils.getAvatarUrl('005')).toBe('/avatar/005.webp')
      expect(AvatarUtils.getAvatarUrl('015')).toBe('/avatar/015.webp')
    })

    it('returns full URL for http URLs', () => {
      expect(AvatarUtils.getAvatarUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png')
      expect(AvatarUtils.getAvatarUrl('http://example.com/pic.jpg')).toBe('http://example.com/pic.jpg')
    })

    it('returns avatar path for valid filenames', () => {
      expect(AvatarUtils.getAvatarUrl('custom_avatar')).toBe('/avatar/custom_avatar.webp')
      expect(AvatarUtils.getAvatarUrl('my-pic-123')).toBe('/avatar/my-pic-123.webp')
    })

    it('returns default for invalid strings', () => {
      expect(AvatarUtils.getAvatarUrl('has spaces')).toBe('/logoD.png')
      expect(AvatarUtils.getAvatarUrl('has/slashes')).toBe('/logoD.png')
    })

    it('trims whitespace', () => {
      expect(AvatarUtils.getAvatarUrl('  005  ')).toBe('/avatar/005.webp')
    })

    it('handles URLs with query params and fragments', () => {
      const url = 'https://cdn.example.com/avatar.png?size=128&v=2#hash'
      expect(AvatarUtils.getAvatarUrl(url)).toBe(url)
    })

    it('rejects ftp and other protocols', () => {
      expect(AvatarUtils.getAvatarUrl('ftp://example.com/file')).toBe('/logoD.png')
    })
  })
})

describe('mxc:// URL handling', () => {
  afterEach(() => {
    AvatarUtils.setMxcResolver(null)
    AvatarUtils.clearCache()
  })

  it('returns default when mxc:// URL has no resolver registered', () => {
    AvatarUtils.setMxcResolver(null)
    expect(AvatarUtils.getAvatarUrl('mxc://example.org/abc123')).toBe('/logoD.png')
  })

  it('converts mxc:// URL using registered resolver', () => {
    AvatarUtils.setMxcResolver((url) => `https://cdn.example.com/${url.replace('mxc://', '')}`)
    expect(AvatarUtils.getAvatarUrl('mxc://example.org/abc123')).toBe('https://cdn.example.com/example.org/abc123')
  })

  it('returns default when resolver returns null', () => {
    AvatarUtils.setMxcResolver(() => null)
    expect(AvatarUtils.getAvatarUrl('mxc://example.org/abc123')).toBe('/logoD.png')
  })

  it('caches resolved mxc:// URLs', () => {
    let callCount = 0
    AvatarUtils.setMxcResolver((url) => {
      callCount++
      return `https://cdn.example.com/${url.replace('mxc://', '')}`
    })
    AvatarUtils.getAvatarUrl('mxc://example.org/cache-test')
    AvatarUtils.getAvatarUrl('mxc://example.org/cache-test')
    expect(callCount).toBe(1)
  })

  it('re-resolves after cache is cleared', () => {
    let callCount = 0
    AvatarUtils.setMxcResolver((url) => {
      callCount++
      return `https://cdn.example.com/${url.replace('mxc://', '')}`
    })
    AvatarUtils.getAvatarUrl('mxc://example.org/recheck')
    AvatarUtils.clearCache('mxc://example.org/recheck')
    AvatarUtils.getAvatarUrl('mxc://example.org/recheck')
    expect(callCount).toBe(2)
  })

  it('clearCache(avatar) clears size-variant entries too', () => {
    let callCount = 0
    AvatarUtils.setMxcResolver((url) => {
      callCount++
      return `https://cdn/${url}`
    })
    AvatarUtils.getAvatarUrl('mxc://example.org/variant', 96)
    AvatarUtils.getAvatarUrl('mxc://example.org/variant')       // base key
    AvatarUtils.clearCache('mxc://example.org/variant')        // Should clear both keys
    AvatarUtils.getAvatarUrl('mxc://example.org/variant', 96)
    AvatarUtils.getAvatarUrl('mxc://example.org/variant')
    expect(callCount).toBe(4)                                   // Both keys re-resolved
  })

  it('clears entire cache when a new resolver is registered', () => {
    let callCount = 0
    const r1 = (url: string) => { callCount++; return `https://cdn1/${url}` }
    const r2 = (url: string) => { callCount++; return `https://cdn2/${url}` }
    AvatarUtils.setMxcResolver(r1)
    AvatarUtils.getAvatarUrl('mxc://example.org/invalidate')
    AvatarUtils.setMxcResolver(r2)        // Should clear entire cache
    AvatarUtils.getAvatarUrl('mxc://example.org/invalidate')
    expect(callCount).toBe(2)             // r1 + r2 each called once
  })
})

describe('getAvatarUrl with size parameter', () => {
  afterEach(() => {
    AvatarUtils.setMxcResolver(null)
    AvatarUtils.clearCache()
  })

  it('passes size to resolver for mxc:// URLs', () => {
    const resolver = vi.fn((url: string) => `https://cdn.example.com/${url.replace('mxc://', '')}`)
    AvatarUtils.setMxcResolver(resolver)
    AvatarUtils.getAvatarUrl('mxc://example.org/sized', 96)
    expect(resolver).toHaveBeenCalledWith('mxc://example.org/sized', 96, 96)
  })

  it('ignores size for non-mxc URLs', () => {
    expect(AvatarUtils.getAvatarUrl('005', 96)).toBe('/avatar/005.webp')
    expect(AvatarUtils.getAvatarUrl('https://example.com/a.png', 96)).toBe('https://example.com/a.png')
  })
})

describe('getRandomDefaultAvatar', () => {
  it('returns a 3-digit string between 001 and 022', () => {
    for (let i = 0; i < 50; i++) {
      const result = AvatarUtils.getRandomDefaultAvatar()
      expect(result).toMatch(/^\d{3}$/)
      const num = parseInt(result, 10)
      expect(num).toBeGreaterThanOrEqual(1)
      expect(num).toBeLessThanOrEqual(22)
    }
  })

  it('returns a value that is a valid default avatar', () => {
    for (let i = 0; i < 20; i++) {
      expect(AvatarUtils.isDefaultAvatar(AvatarUtils.getRandomDefaultAvatar())).toBe(true)
    }
  })

  it('returns a URL that resolves to /avatar/NNN.webp', () => {
    const random = AvatarUtils.getRandomDefaultAvatar()
    expect(AvatarUtils.getAvatarUrl(random)).toBe(`/avatar/${random}.webp`)
  })
})
