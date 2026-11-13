/**
 * 移动端公告编辑草稿：按 roomId + noticeId 落在 sessionStorage。
 * 保存失败后组件销毁（返回/切页）仍可回填，成功后由调用方清除。
 */

const DRAFT_KEY_PREFIX = 'tjg.mobile.notice.draft'

export interface NoticeDraft {
  content: string
  top: boolean
}

export const buildNoticeDraftKey = (roomId: string, noticeId?: string): string =>
  `${DRAFT_KEY_PREFIX}:${roomId}:${noticeId || 'new'}`

const getStorage = (): Storage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export const readNoticeDraft = (key: string): NoticeDraft | null => {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<NoticeDraft> | null
    if (typeof parsed?.content !== 'string') return null

    return { content: parsed.content, top: parsed.top === true }
  } catch {
    return null
  }
}

export const saveNoticeDraft = (key: string, draft: NoticeDraft): void => {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(key, JSON.stringify(draft))
  } catch {
    // 存储不可用/超限时不阻断编辑
  }
}

export const clearNoticeDraft = (key: string): void => {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(key)
  } catch {
    // 存储不可用时不阻断编辑
  }
}
