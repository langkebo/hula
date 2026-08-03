import { beforeEach, describe, expect, it, vi } from 'vitest'

const digestMock = vi.fn()

vi.mock('digest-wasm', () => ({
  Md5: { digest_u8: digestMock }
}))

import { md5FromString } from '../Md5Util'

describe('md5FromString', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns digest from wasm module for simple string', async () => {
    digestMock.mockResolvedValue('d41d8cd98f00b204e9800998ecf8427e')
    const result = await md5FromString('')
    expect(result).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  it('encodes string to UTF-8 bytes before digest', async () => {
    digestMock.mockResolvedValue('hash')
    await md5FromString('hello')
    expect(digestMock).toHaveBeenCalledTimes(1)
    const arg = digestMock.mock.calls[0][0]
    expect(arg).toBeInstanceOf(Uint8Array)
    // 'hello' UTF-8 = [104, 101, 108, 108, 111]
    expect(Array.from(arg)).toEqual([104, 101, 108, 108, 111])
  })

  it('encodes non-ASCII characters as multi-byte UTF-8', async () => {
    digestMock.mockResolvedValue('hash')
    await md5FromString('中')
    const arg = digestMock.mock.calls[0][0]
    // '中' in UTF-8 = [228, 184, 173]
    expect(Array.from(arg)).toEqual([228, 184, 173])
  })

  it('caches the wasm instance across calls', async () => {
    digestMock.mockResolvedValue('hash')
    await md5FromString('a')
    await md5FromString('b')
    await md5FromString('c')
    // digest_u8 is called 3 times (one per md5FromString call)
    expect(digestMock).toHaveBeenCalledTimes(3)
  })

  it('propagates errors from digest_u8', async () => {
    digestMock.mockRejectedValue(new Error('wasm failed'))
    await expect(md5FromString('x')).rejects.toThrow('wasm failed')
  })

  it('handles emoji correctly via UTF-8 encoding', async () => {
    digestMock.mockResolvedValue('hash')
    await md5FromString('😀')
    const arg = digestMock.mock.calls[0][0]
    // 😀 in UTF-8 = [240, 159, 152, 128]
    expect(Array.from(arg)).toEqual([240, 159, 152, 128])
  })
})
