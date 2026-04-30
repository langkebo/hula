import { readImage, readText } from '@tauri-apps/plugin-clipboard-manager'
import { nextTick, type Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MsgEnum } from '@/enums'
import { processClipboardImage } from '@/utils/ImageUtils.ts'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ClipboardPaste')

export interface ClipboardPasteOptions {
  /** 输入框 DOM 引用 */
  messageInputDom: Ref<HTMLElement | null | undefined> | Ref<HTMLElement>
  /** 将剪贴板图片以 File 对象形式写入输入框（走 `useCommon.imgPaste`） */
  imgPaste: (file: File, dom: HTMLElement) => void
  /** 通用插入节点（走 `useCommon.insertNode`），仅用文本分支 */
  insertNode: (type: MsgEnum, content: string, dom: HTMLElement) => void
  /** 触发 input 事件（走 `useCommon.triggerInputEvent`） */
  triggerInputEvent: (dom: HTMLElement) => void
}

interface EditorMenuItem {
  label: () => string
  icon: string
  disabled?: boolean
  click?: () => void | Promise<void>
}

/**
 * 剪贴板粘贴处理 hook。
 *
 * - `handlePaste`：依次尝试读取剪贴板图片 → 文本，图片优先走 `imgPaste`
 *   把 `File` 对象插入输入框，文本走 `insertNode(MsgEnum.TEXT, content)`；
 *   两者均失败时弹提示让用户使用键盘快捷键。
 * - `menuList`：输入框右键菜单项（剪切 / 复制 / 粘贴 / 另存为 / 全选），
 *   粘贴项绑定 `handlePaste`，其余占位符按原实现保持 `disabled`。
 *
 * 迁移自 `useMsgInput.ts` 的 `menuList` 内联定义。
 */
export function useClipboardPaste(options: ClipboardPasteOptions) {
  const { messageInputDom, imgPaste, insertNode, triggerInputEvent } = options
  const { t } = useI18n()

  const handlePaste = async () => {
    const dom = messageInputDom.value
    if (!dom) return
    try {
      let imageProcessed = false

      const clipboardImage = await readImage().catch(() => null)
      if (clipboardImage) {
        try {
          const file = await processClipboardImage(clipboardImage)
          dom.focus()
          nextTick(() => {
            imgPaste(file, dom)
          })
          imageProcessed = true
        } catch (error) {
          logger.error('Tauri处理图片数据失败:', error)
        }
      }

      if (!imageProcessed) {
        const content = await readText().catch(() => null)
        if (content) {
          dom.focus()
          nextTick(() => {
            insertNode(MsgEnum.TEXT, content, dom)
            triggerInputEvent(dom)
          })
          return
        }
        alert('无法获取当前剪贴板中对于的类型的内容，请使用 ctrl/command + v')
      }
    } catch (error) {
      logger.error('粘贴失败:', error)
    }
  }

  const menuList = ref<EditorMenuItem[]>([
    { label: () => t('editor.menu.cut'), icon: 'screenshot', disabled: true },
    { label: () => t('editor.menu.copy'), icon: 'copy', disabled: true },
    { label: () => t('editor.menu.paste'), icon: 'intersection', click: handlePaste },
    { label: () => t('editor.menu.save_as'), icon: 'Importing', disabled: true },
    { label: () => t('editor.menu.select_all'), icon: 'check-one' }
  ])

  return { menuList, handlePaste }
}
