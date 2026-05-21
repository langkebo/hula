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

  /**
   * 检查头像字符串是否为默认头像 (001-022)
   * @param avatar - 要检查的头像字符串
   * @returns 布尔值指示是否是默认头像
   */
  public static isDefaultAvatar(avatar: string): boolean {
    // 快速判断：如果为空或长度不是3，直接返回false
    if (!avatar || avatar.length !== 3) return false

    // 检查是否全是数字
    const num = parseInt(avatar, 10)
    if (isNaN(num)) return false

    // 数字范围检查 (001-021)
    return num >= AvatarUtils.RANGE_START && num <= AvatarUtils.RANGE_END
  }

  /**
   * 根据头像值获取头像URL（带 memoization 缓存）
   * @param avatar - 头像字符串或URL
   * @returns 头像字符串或URL
   */
  public static getAvatarUrl(avatar: string | null | undefined): string {
    if (!avatar) return AvatarUtils.DEFAULT
    const rawAvatar = avatar.trim()

    const cached = AvatarUtils.cache.get(rawAvatar)
    if (cached !== undefined) return cached

    const result = AvatarUtils.resolveAvatarUrl(rawAvatar)
    AvatarUtils.cache.set(rawAvatar, result)
    return result
  }

  /**
   * 批量预解析头像 URL，适用于列表渲染前调用
   * 避免渲染时逐个调用 getAvatarUrl 导致的重复计算
   * @param avatars - 头像字符串数组
   */
  public static batchResolve(avatars: (string | null | undefined)[]): void {
    for (const avatar of avatars) {
      if (avatar) {
        const rawAvatar = avatar.trim()
        if (!AvatarUtils.cache.has(rawAvatar)) {
          AvatarUtils.cache.set(rawAvatar, AvatarUtils.resolveAvatarUrl(rawAvatar))
        }
      }
    }
  }

  /**
   * 清除缓存（通常不需要调用，仅在头像更新时使用）
   */
  public static clearCache(avatar?: string): void {
    if (avatar) {
      AvatarUtils.cache.delete(avatar.trim())
    } else {
      AvatarUtils.cache.clear()
    }
  }

  private static resolveAvatarUrl(avatar: string): string {
    if (AvatarUtils.isDefaultAvatar(avatar)) {
      return `/avatar/${avatar}.webp`
    }

    try {
      const parsed = new URL(avatar)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString()
      }
    } catch {
      // 如果是自家预置文件名，可进一步做白名单/正则校验
      if (/^[a-z0-9_-]+$/i.test(avatar)) {
        return `/avatar/${avatar}.webp`
      }
    }
    return AvatarUtils.DEFAULT
  }
}
