import { describe, expect, it, vi } from 'vitest'
import { type MxcResolverClient, resolveMxcToHttp } from '../mxcUrl'

/**
 * SDK-1（2026-11-05）：SDK 补齐 `MatrixClient.mxcUrlToHttp` 后，
 * 解析必须**优先**走 client 级方法 —— 它不依赖 ProfileManager 扩展是否装载。
 *
 * 历史缺陷：只走 `getProfileManager()`，manager 未装载时返回 null，
 * 调用方兜底成原始 `mxc://`，webview 里图片/头像静默加载不出来。
 */
describe('resolveMxcToHttp', () => {
  const mxc = 'mxc://example.org/abc123'

  it('优先使用 client 级 mxcUrlToHttp（不触碰 ProfileManager）', () => {
    const direct = vi.fn(() => 'https://hs.example.org/_matrix/media/v3/download/example.org/abc123')
    const getProfileManager = vi.fn(() => ({ mxcUrlToHttp: vi.fn(() => 'https://manager.example/x') }))

    const url = resolveMxcToHttp({ mxcUrlToHttp: direct, getProfileManager } as MxcResolverClient, mxc)

    expect(url).toBe('https://hs.example.org/_matrix/media/v3/download/example.org/abc123')
    expect(direct).toHaveBeenCalledWith(mxc)
    expect(getProfileManager).not.toHaveBeenCalled()
  })

  it('带宽高时按 scale 传参', () => {
    const direct = vi.fn(() => 'https://hs.example.org/thumb')
    resolveMxcToHttp({ mxcUrlToHttp: direct } as MxcResolverClient, mxc, 96, 96)
    expect(direct).toHaveBeenCalledWith(mxc, 96, 96, 'scale')
  })

  it('client 级方法返回 null 时回退 ProfileManager（不直接放弃）', () => {
    const managerResolve = vi.fn(() => 'https://manager.example/y')
    const url = resolveMxcToHttp(
      {
        mxcUrlToHttp: vi.fn(() => null),
        getProfileManager: () => ({ mxcUrlToHttp: managerResolve })
      } as MxcResolverClient,
      mxc
    )
    expect(url).toBe('https://manager.example/y')
    expect(managerResolve).toHaveBeenCalled()
  })

  it('client 级方法抛错时回退 ProfileManager', () => {
    const url = resolveMxcToHttp(
      {
        mxcUrlToHttp: () => {
          throw new Error('boom')
        },
        getProfileManager: () => ({ mxcUrlToHttp: () => 'https://manager.example/z' })
      } as MxcResolverClient,
      mxc
    )
    expect(url).toBe('https://manager.example/z')
  })

  it('没有 client / 非 mxc 输入一律 null', () => {
    expect(resolveMxcToHttp(null, mxc)).toBeNull()
    expect(
      resolveMxcToHttp({ mxcUrlToHttp: () => 'https://x' } as MxcResolverClient, 'https://example.org/a.png')
    ).toBeNull()
  })
})
