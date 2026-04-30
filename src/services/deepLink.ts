import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeepLink')

interface ParsedTarget {
  roomIdOrAlias?: string
  userId?: string
  eventId?: string
}

export function parseMatrixDeepLink(url: string): ParsedTarget | null {
  try {
    const decoded = decodeURIComponent(url.trim())

    const matrixToMatch = decoded.match(/^https?:\/\/matrix\.to\/#\/([^/?#]+)(?:\/([^?#]+))?/i)
    if (matrixToMatch) {
      const target = matrixToMatch[1]
      const eventId = matrixToMatch[2]?.startsWith('$') ? matrixToMatch[2] : undefined
      return classifyTarget(target, eventId)
    }

    const matrixSchemeMatch = decoded.match(/^matrix:(?:\/\/)?(?:r|roomid)\/([^/?#]+)(?:\/e\/([^?#]+))?/i)
    if (matrixSchemeMatch) {
      const prefix = decoded.toLowerCase().includes('roomid/') ? '!' : '#'
      return { roomIdOrAlias: `${prefix}${matrixSchemeMatch[1]}`, eventId: matrixSchemeMatch[2] }
    }

    const matrixUserMatch = decoded.match(/^matrix:(?:\/\/)?u\/([^/?#]+)/i)
    if (matrixUserMatch) {
      return { userId: `@${matrixUserMatch[1]}` }
    }

    const hulaMatch = decoded.match(/^hula:\/\/(?:room|r)\/([^/?#]+)/i)
    if (hulaMatch) {
      return classifyTarget(hulaMatch[1])
    }

    return null
  } catch (err) {
    logger.warn(`解析深链失败: ${url}`, err)
    return null
  }
}

function classifyTarget(target: string, eventId?: string): ParsedTarget {
  if (target.startsWith('@')) return { userId: target }
  if (target.startsWith('!') || target.startsWith('#')) return { roomIdOrAlias: target, eventId }
  return { roomIdOrAlias: `#${target}`, eventId }
}

async function handleUrl(url: string): Promise<void> {
  const target = parseMatrixDeepLink(url)
  if (!target) {
    logger.info(`忽略未识别的深链: ${url}`)
    return
  }

  if (target.roomIdOrAlias) {
    const globalStore = useGlobalStore()
    globalStore.updateCurrentSessionRoomId(target.roomIdOrAlias)
    await router.push({ name: 'message' }).catch(() => {})
    logger.info(`深链跳转房间: ${target.roomIdOrAlias}`)
    return
  }

  if (target.userId) {
    logger.info(`深链跳转用户(暂未实现路由): ${target.userId}`)
  }
}

export async function installDeepLinkListener(): Promise<void> {
  if (!hasTauriRuntime()) return
  try {
    const unlisten = await onOpenUrl((urls: string[]) => {
      for (const url of urls) {
        void handleUrl(url)
      }
    })
    void unlisten
  } catch (err) {
    logger.warn('注册深链监听失败', err)
  }
}
