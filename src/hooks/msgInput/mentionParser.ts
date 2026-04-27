import type { UserItem } from '@/services/types'

/**
 * Safely parse an HTML string into a Document. Returns null if the environment
 * has no DOMParser (e.g. certain SSR contexts) or the input is empty.
 */
export function parseHtmlSafely(html: string): Document | null {
  if (!html) return null
  if (typeof DOMParser === 'undefined') return null
  return new DOMParser().parseFromString(html, 'text/html')
}

type MentionUser = UserItem & Partial<{ myName: string }>

/**
 * Extract the UIDs of @-mentioned users from a rich-text HTML fragment.
 *
 * Resolution order:
 * 1. `<span id="aitSpan">` / `[data-ait-uid]` nodes — if a node carries a uid
 *    we trust it directly, otherwise we resolve by display name.
 * 2. Falls back to plain-text `@name` scanning when no mention nodes are found.
 *
 * Name resolution requires a unique match against either `myName` (group alias)
 * or `name` (origin name). Ambiguous or missing matches are silently dropped.
 */
export function extractAtUserIds(content: string, userList: MentionUser[]): string[] {
  const atUserIds: string[] = []

  const resolveUidByName = (rawName?: string | null): string | undefined => {
    const normalized = rawName?.trim()
    if (!normalized) return undefined
    const matches = userList.filter((user) => {
      const groupName = user.myName?.trim()
      const originName = user.name?.trim()
      return groupName === normalized || originName === normalized
    })
    if (matches.length === 1) return matches[0].uid
    return undefined
  }

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = content

  const mentionNodes = tempDiv.querySelectorAll<HTMLElement>('#aitSpan, [data-ait-uid]')
  mentionNodes.forEach((node) => {
    const uid = node.dataset.aitUid
    if (uid) {
      atUserIds.push(uid)
      return
    }
    const name = node.textContent?.replace(/^@/, '')?.trim()
    if (!name) return
    const resolvedUid = resolveUidByName(name)
    if (resolvedUid) atUserIds.push(resolvedUid)
  })

  if (atUserIds.length > 0) return [...new Set(atUserIds)]

  const textContent = tempDiv.textContent || ''
  const matches = textContent.match(/@([^\s]+)/g)
  if (matches) {
    matches.forEach((match) => {
      const resolvedUid = resolveUidByName(match.slice(1))
      if (resolvedUid) atUserIds.push(resolvedUid)
    })
  }

  return [...new Set(atUserIds)]
}
