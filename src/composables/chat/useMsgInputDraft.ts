import { useDebounceFn } from '@vueuse/core'
import type { Ref } from 'vue'
import { onMounted, onScopeDispose, watch } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MsgInputDraft')

const DRAFT_STORAGE_PREFIX = 'tjg:msg-input-draft'

interface UseMsgInputDraftOptions {
  /** 当前会话房间 id */
  roomId: Ref<string | undefined>
  /** 当前登录账号 id，用于隔离多账号草稿 */
  accountId: Ref<string | undefined>
  /** 编辑器 HTML 内容 */
  msgInput: Ref<string>
  /** 将纯文本草稿写回编辑器（空字符串表示清空） */
  applyDraft: (text: string) => void
}

/**
 * 会话草稿本地持久化：按「账号 + 房间」维度保存纯文本草稿，
 * 切换会话时落盘上一会话并恢复下一会话，避免输入内容随窗口关闭丢失。
 *
 * 只保存纯文本：编辑器 HTML 内的 @ 提及占位与临时 blob 图片无法跨会话复用，
 * 直接回填会产生悬空状态与裂图。
 */
export function useMsgInputDraft(options: UseMsgInputDraftOptions) {
  const buildKey = (roomId?: string, accountId?: string): string | null => {
    if (!roomId || !accountId) return null
    return `${DRAFT_STORAGE_PREFIX}:${accountId}:${roomId}`
  }

  const extractPlainText = (html: string): string => {
    if (!html) return ''
    const container = document.createElement('div')
    container.innerHTML = html
    return container.textContent?.replace(/\u00a0/g, ' ') ?? ''
  }

  const readDraft = (roomId: string | undefined): string => {
    const key = buildKey(roomId, options.accountId.value)
    if (!key) return ''
    try {
      return localStorage.getItem(key) ?? ''
    } catch (error) {
      logger.warn('读取消息草稿失败:', error)
      return ''
    }
  }

  const writeDraft = (roomId: string | undefined, text: string): void => {
    const key = buildKey(roomId, options.accountId.value)
    if (!key) return
    try {
      if (text.trim()) {
        localStorage.setItem(key, text)
      } else {
        localStorage.removeItem(key)
      }
    } catch (error) {
      logger.warn('写入消息草稿失败:', error)
    }
  }

  const persistCurrent = () => {
    writeDraft(options.roomId.value, extractPlainText(options.msgInput.value))
  }

  const persistDebounced = useDebounceFn(persistCurrent, 300)

  const load = (roomId: string | undefined) => {
    const draft = readDraft(roomId)
    if (draft) {
      options.applyDraft(draft)
      return
    }
    if (options.msgInput.value) {
      options.applyDraft('')
    }
  }

  // 编辑器挂载后 DOM 才可用，故首屏恢复放在 onMounted
  onMounted(() => load(options.roomId.value))

  watch(
    () => options.roomId.value,
    (next, prev) => {
      if (prev !== undefined && prev !== next) {
        persistDebounced.cancel()
        writeDraft(prev, extractPlainText(options.msgInput.value))
      }
      load(next)
    }
  )

  watch(options.msgInput, () => {
    if (!options.roomId.value) return
    persistDebounced()
  })

  onScopeDispose(() => {
    persistDebounced.cancel()
    persistCurrent()
  })
}
