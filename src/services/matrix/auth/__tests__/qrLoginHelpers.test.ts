import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64, generateDeviceId } from '../qrLoginHelpers'

describe('bytesToBase64', () => {
  it('returns an empty string for an empty array', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('')
  })

  it('encodes a single byte correctly', () => {
    // 65 ('A') -> btoa('A') === 'QQ=='
    expect(bytesToBase64(new Uint8Array([65]))).toBe('QQ==')
  })

  it('encodes multiple bytes correctly', () => {
    // 'Hello' -> btoa('Hello') === 'SGVsbG8='
    const hello = new Uint8Array([72, 101, 108, 108, 111])
    expect(bytesToBase64(hello)).toBe('SGVsbG8=')
  })

  it('encodes all 256 byte values and round-trips through base64ToBytes', () => {
    const allBytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) {
      allBytes[i] = i
    }

    const encoded = bytesToBase64(allBytes)
    const decoded = base64ToBytes(encoded)

    expect(decoded).toEqual(allBytes)
  })

  it('round-trips arbitrary binary data through base64ToBytes', () => {
    const data = new Uint8Array([0, 1, 2, 254, 255, 128, 64, 32])
    const encoded = bytesToBase64(data)
    const decoded = base64ToBytes(encoded)

    expect(decoded).toEqual(data)
  })
})

describe('base64ToBytes', () => {
  it('returns an empty Uint8Array for an empty string', () => {
    const result = base64ToBytes('')
    expect(result).toEqual(new Uint8Array([]))
    expect(result.length).toBe(0)
  })

  it('decodes a known base64 string correctly', () => {
    // 'QQ==' -> 'A' -> [65]
    expect(Array.from(base64ToBytes('QQ=='))).toEqual([65])
  })

  it('decodes a multi-byte base64 string correctly', () => {
    // 'SGVsbG8=' -> 'Hello' -> [72, 101, 108, 108, 111]
    expect(Array.from(base64ToBytes('SGVsbG8='))).toEqual([72, 101, 108, 108, 111])
  })

  it('round-trips with bytesToBase64', () => {
    const original = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    const encoded = bytesToBase64(original)
    const decoded = base64ToBytes(encoded)

    expect(decoded).toEqual(original)
  })

  it('returns a Uint8Array instance', () => {
    const result = base64ToBytes('QQ==')
    expect(result).toBeInstanceOf(Uint8Array)
  })
})

describe('generateDeviceId', () => {
  it('returns a 16-character string (8 bytes * 2 hex chars)', () => {
    const id = generateDeviceId()
    expect(id).toHaveLength(16)
  })

  it('returns only uppercase characters', () => {
    const id = generateDeviceId()
    expect(id).toBe(id.toUpperCase())
    expect(id).toMatch(/^[0-9A-F]+$/)
  })

  it('contains only hex characters [0-9A-F]', () => {
    // Run several times to exercise the random space.
    for (let i = 0; i < 50; i++) {
      const id = generateDeviceId()
      expect(id).toMatch(/^[0-9A-F]{16}$/)
    }
  })

  it('returns different values on consecutive calls (randomness)', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateDeviceId())
    }

    // With 8 random bytes, collisions across 100 draws are astronomically
    // unlikely; require a healthy variety to confirm randomness.
    expect(ids.size).toBeGreaterThan(90)
  })
})
