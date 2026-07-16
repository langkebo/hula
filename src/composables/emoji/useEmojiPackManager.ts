import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type EmojiPack, matrixEmojiService } from '@/services/matrix/messaging/MatrixEmojiService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useEmojiPackManager')

/**
 * 新增表情数据(用于上传到指定表情包)
 */
export interface NewEmojiData {
  /** 表情图片文件,支持 PNG / GIF / WebP */
  file: File
  /** 表情名称 */
  name: string
}

/**
 * 跨端表情包管理 composable
 *
 * 封装表情包的加载、创建、删除、重命名,以及表情的上传与移除。
 * PC 端与移动端共用此逻辑,UI 层只负责调用与展示。
 *
 * 服务端能力来源:`MatrixEmojiService`
 * - `emojiList` 读取表情包列表
 * - `createPack` / `deletePack` / `renamePack` 管理表情包
 * - `emojiUpload` 上传表情并加入指定表情包
 * - `emojiDelete` 从指定表情包移除表情
 */
export function useEmojiPackManager() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  /** 已安装表情包列表 */
  const packs = ref<EmojiPack[]>([])
  /** 列表加载中 */
  const loading = ref(false)
  /** 创建/变更操作进行中 */
  const creating = ref(false)
  /** 错误信息(加载阶段) */
  const error = ref<string | null>(null)

  /**
   * 加载表情包列表
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      packs.value = await matrixEmojiService.emojiList()
    } catch (err) {
      logger.error('加载表情包列表失败', err)
      error.value = t('emoticon.packs.load_failed')
      showFeedback(error.value, 'error')
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建表情包
   *
   * @param name - 表情包名称
   * @returns 创建成功返回 true,失败返回 false
   */
  async function createPack(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) {
      showFeedback(t('emoticon.packs.create_failed'), 'error')
      return false
    }

    creating.value = true

    try {
      await matrixEmojiService.createPack(trimmed)
      showFeedback(t('emoticon.packs.create_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('创建表情包失败', err)
      showFeedback(t('emoticon.packs.create_failed'), 'error')
      return false
    } finally {
      creating.value = false
    }
  }

  /**
   * 删除表情包
   *
   * @param packId - 表情包 ID
   * @returns 删除成功返回 true,失败返回 false
   */
  async function deletePack(packId: string): Promise<boolean> {
    try {
      await matrixEmojiService.deletePack(packId)
      showFeedback(t('emoticon.packs.uninstall_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('删除表情包失败', err)
      showFeedback(t('emoticon.packs.uninstall_failed'), 'error')
      return false
    }
  }

  /**
   * 重命名表情包
   *
   * @param packId - 表情包 ID
   * @param name - 新名称
   * @returns 重命名成功返回 true,失败返回 false
   */
  async function renamePack(packId: string, name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) {
      showFeedback(t('emoticon.packs.rename_failed'), 'error')
      return false
    }

    try {
      await matrixEmojiService.renamePack(packId, trimmed)
      showFeedback(t('emoticon.packs.rename_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('重命名表情包失败', err)
      showFeedback(t('emoticon.packs.rename_failed'), 'error')
      return false
    }
  }

  /**
   * 上传表情并加入指定表情包
   *
   * @param packId - 目标表情包 ID
   * @param emojiData - 表情数据(文件 + 名称)
   * @returns 添加成功返回 true,失败返回 false
   */
  async function addEmoji(packId: string, emojiData: NewEmojiData): Promise<boolean> {
    try {
      await matrixEmojiService.emojiUpload(emojiData.file, emojiData.name, packId)
      showFeedback(t('emoticon.packs.add_emoji_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('添加表情失败', err)
      showFeedback(t('emoticon.packs.upload_failed'), 'error')
      return false
    }
  }

  /**
   * 从指定表情包移除表情
   *
   * @param packId - 表情包 ID
   * @param emojiId - 表情 ID
   * @returns 移除成功返回 true,失败返回 false
   */
  async function removeEmoji(packId: string, emojiId: string): Promise<boolean> {
    try {
      await matrixEmojiService.emojiDelete(emojiId, packId)
      showFeedback(t('emoticon.packs.remove_emoji_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('移除表情失败', err)
      showFeedback(t('emoticon.packs.remove_emoji_failed'), 'error')
      return false
    }
  }

  return {
    packs,
    loading,
    creating,
    error,
    load,
    createPack,
    deletePack,
    renamePack,
    addEmoji,
    removeEmoji
  }
}
