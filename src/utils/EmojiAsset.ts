/**
 * 集中式表情资源路径工具
 *
 * 统一管理 `public/msgAction/` 和 `public/emoji/` 目录下的静态表情资源路径。
 * 避免在代码中硬编码路径字符串，方便后续迁移或重命名。
 */
export class EmojiAsset {
  /** 反应表情目录前缀 (msgAction, PNG 格式) */
  public static readonly MSG_ACTION_PREFIX = '/msgAction'

  /** 通用表情目录前缀 (emoji, WebP 格式) */
  public static readonly EMOJI_PREFIX = '/emoji'

  /**
   * 构建 msgAction 目录下的反应表情 URL
   *
   * msgAction 目录存放消息快捷反应表情，格式为 PNG。
   *
   * @param name - 表情文件名（不含扩展名，如 `like`、`heart-on-fire`）
   * @returns 完整 URL 路径，如 `/msgAction/like.png`
   */
  static reactionUrl(name: string): string {
    return `${EmojiAsset.MSG_ACTION_PREFIX}/${name.trim()}.png`
  }

  /**
   * 构建 emoji 目录下的通用表情 URL
   *
   * emoji 目录存放通用表情图标，格式为 WebP。
   *
   * @param name - 表情文件名（不含扩展名，如 `party-popper`、`rocket`）
   * @returns 完整 URL 路径，如 `/emoji/party-popper.webp`
   */
  static emojiUrl(name: string): string {
    return `${EmojiAsset.EMOJI_PREFIX}/${name.trim()}.webp`
  }
}
