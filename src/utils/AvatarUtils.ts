/**
 * 用于处理头像相关操作的实用类
 */
export class AvatarUtils {
  private static readonly DEFAULT_AVATAR_RANGE = {
    start: '001',
    end: '022'
  }

  private static readonly RANGE_START = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.start, 10)
  private static readonly RANGE_END = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.end, 10)

  private static readonly DEFAULT = '/logoD.png'

  /** Memoization cache: avatar input -> resolved URL */
  private static readonly cache = new Map<string, string>()

  /** Pluggable mxc:// resolver — registered by MatrixClientService at app startup */
  private static mxcResolver: ((mxcUrl: string, width?: number, height?: number) => string | null) | null = null

  /**
   * 注册 mxc:// URL 解析器（由 MatrixClientService 在客户端初始化后调用）
   * @param resolver - 将 mxc:// URL 转换为 HTTPS URL 的函数，返回 null 表示解析失败
   */
  static setMxcResolver(resolver: ((mxcUrl: string, width?: number, height?: number) => string | null) | null): void {
    AvatarUtils.mxcResolver = resolver
    AvatarUtils.cache.clear()
  }

  /**
   * 检查头像字符串是否为默认头像 (001-022)
   */
  public static isDefaultAvatar(avatar: string): boolean {
    if (avatar?.length !== 3) return false
    const num = parseInt(avatar, 10)
    if (isNaN(num)) return false
    return num >= AvatarUtils.RANGE_START && num <= AvatarUtils.RANGE_END
  }

  /**
   * 根据头像值获取头像URL（带 memoization 缓存）
   * @param avatar - 头像字符串、URL 或 mxc:// URI
   * @param size - 可选尺寸（像素），用于生成缩略图 URL
   */
  public static getAvatarUrl(avatar: string | null | undefined, size?: number): string {
    if (!avatar) return AvatarUtils.DEFAULT
    const rawAvatar = avatar.trim()

    const cacheKey = size ? `${rawAvatar}:${size}` : rawAvatar
    const cached = AvatarUtils.cache.get(cacheKey)
    if (cached !== undefined) return cached

    const result = AvatarUtils.resolveAvatarUrl(rawAvatar, size)
    AvatarUtils.cache.set(cacheKey, result)
    return result
  }

  /**
   * 批量预解析头像 URL
   */
  public static batchResolve(avatars: (string | null | undefined)[], size?: number): void {
    for (const avatar of avatars) {
      if (avatar) {
        const rawAvatar = avatar.trim()
        const cacheKey = size ? `${rawAvatar}:${size}` : rawAvatar
        if (!AvatarUtils.cache.has(cacheKey)) {
          AvatarUtils.cache.set(cacheKey, AvatarUtils.resolveAvatarUrl(rawAvatar, size))
        }
      }
    }
  }

  /**
   * 清除缓存
   */
  public static clearCache(avatar?: string): void {
    if (avatar) {
      const rawAvatar = avatar.trim()
      AvatarUtils.cache.delete(rawAvatar)
      for (const key of AvatarUtils.cache.keys()) {
        if (key.startsWith(`${rawAvatar}:`)) {
          AvatarUtils.cache.delete(key)
        }
      }
    } else {
      AvatarUtils.cache.clear()
    }
  }

  /**
   * 从本地头像库中随机选取一个默认头像编号 (001-022)
   */
  public static getRandomDefaultAvatar(): string {
    const range = AvatarUtils.RANGE_END - AvatarUtils.RANGE_START + 1
    const num = Math.floor(Math.random() * range) + AvatarUtils.RANGE_START
    return String(num).padStart(3, '0')
  }

  private static resolveAvatarUrl(avatar: string, size?: number): string {
    if (AvatarUtils.isDefaultAvatar(avatar)) {
      return `/avatar/${avatar}.webp`
    }

    if (avatar.startsWith('mxc://')) {
      if (AvatarUtils.mxcResolver) {
        const httpUrl = size ? AvatarUtils.mxcResolver(avatar, size, size) : AvatarUtils.mxcResolver(avatar)
        if (httpUrl) return httpUrl
      }
      return AvatarUtils.DEFAULT
    }

    try {
      const parsed = new URL(avatar)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString()
      }
    } catch {
      if (/^[a-z0-9_-]+$/i.test(avatar)) {
        return `/avatar/${avatar}.webp`
      }
    }

    return AvatarUtils.DEFAULT
  }
}
