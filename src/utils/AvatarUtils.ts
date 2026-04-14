import { LRUCache } from '@/utils/LRUCache'

export class AvatarUtils {
  private static readonly DEFAULT_AVATAR_RANGE = {
    start: '001',
    end: '022'
  }

  private static readonly RANGE_START = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.start, 10)
  private static readonly RANGE_END = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.end, 10)

  private static readonly urlCache = new LRUCache<string, string>(200)

  public static isDefaultAvatar(avatar: string): boolean {
    if (!avatar || avatar.length !== 3) return false
    const num = parseInt(avatar, 10)
    if (isNaN(num)) return false
    return num >= AvatarUtils.RANGE_START && num <= AvatarUtils.RANGE_END
  }

  public static getAvatarUrl(avatar: string | null | undefined): string {
    const DEFAULT = '/logoD.png'

    if (!avatar) return DEFAULT
    const rawAvatar = avatar.trim()

    const cached = AvatarUtils.urlCache.get(rawAvatar)
    if (cached !== undefined) return cached

    let result = DEFAULT

    if (AvatarUtils.isDefaultAvatar(rawAvatar)) {
      result = `/avatar/${rawAvatar}.webp`
    } else {
      try {
        const parsed = new URL(avatar)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          result = parsed.toString()
        }
      } catch {
        if (/^[a-z0-9_-]+$/i.test(avatar)) {
          result = `/avatar/${avatar}.webp`
        }
      }
    }

    AvatarUtils.urlCache.set(rawAvatar, result)
    return result
  }

  public static clearCache(): void {
    AvatarUtils.urlCache.clear()
  }
}
