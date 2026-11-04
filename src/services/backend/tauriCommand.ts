import { useI18nGlobal } from '@/services/i18n'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { invokeWithErrorHandler, invokeWithResult } from '@/utils/TauriInvokeHandler'
import { useMatrixStore } from '../../stores/domains/chat/matrix'
import { useUserStore } from '../../stores/domains/user/user'

type UpdateSettingsParams = {
  baseUrl: string
  wsUrl: string
}

export const updateSettings = async (settings: UpdateSettingsParams) => {
  await ensureAppStateReady()
  return await invokeWithErrorHandler('update_settings', { settings })
}

/**
 * 切换用户数据库
 * 根据用户ID切换到对应的数据库文件，如果数据库不存在则创建
 * @param uid 用户ID
 *
 * 浏览器环境（非 Tauri）下此操作为 no-op：浏览器模式通过 Pinia store + localStorage
 * 持久化用户状态，无需 SQLite 数据库切换。
 */
export const switchUserDatabase = async (uid: string): Promise<void> => {
  if (!hasTauriRuntime()) {
    return
  }
  await ensureAppStateReady()
  return await invokeWithErrorHandler('switch_user_database', { uid })
}

/**
 * 把 `fromUid` 的本地库迁移成 `toUid` 的库（访客升级为正式账号专用）。
 *
 * 为什么需要：本地库按 uid 分文件，而访客升级返回的是**新 MXID**。不迁移就会出现
 * 「运行期继续写访客库 → 重启后切到 newUid 的空库」，聊天记录窗口 / 文件索引 / 本地搜索全部读不到。
 *
 * @returns `true` = 已迁移（或此前已完成，幂等），运行期连接已切到新库；
 *          `false` = 未迁移（无源库 / 目标库已有新账号数据 / 浏览器环境），调用方应退回直接切库。
 * 失败不抛：服务端账号升级已经成功，本地库迁移失败不应连带升级失败，由调用方降级并记录。
 */
export const migrateUserDatabase = async (fromUid: string, toUid: string): Promise<boolean> => {
  if (!hasTauriRuntime()) {
    return false
  }
  await ensureAppStateReady()
  const result = await invokeWithResult<boolean>('migrate_user_database', { fromUid, toUid })
  if (result.isErr()) {
    throw new Error(String(result.error))
  }
  return result.value === true
}

export type FileQueryParam = {
  navigationType: string
  selectedUser?: string
  searchKeyword?: string
  roomId?: string
  page: number
  pageSize: number
}

export type FileManagerFileItem = {
  id: string
  fileName?: string
  name?: string
  originalName?: string
  title?: string
  fileType?: string
  fileSize?: number
  downloadUrl?: string
  url?: string
  uploadTime: string
  sender?: {
    id: string
    name?: string
  }
}

export type FileManagerTimeGroup = {
  date: string
  files: FileManagerFileItem[]
}

export type FileManagerUser = {
  id: string
  name: string
  [key: string]: unknown
}

export type FileManagerNavigationItem = {
  key: string
  label?: string
  icon?: string
  active?: boolean
  [key: string]: unknown
}

type FileManagerQueryResponse = {
  timeGroupedFiles: FileManagerTimeGroup[]
  userList: FileManagerUser[]
}

export const queryFiles = async (param: FileQueryParam): Promise<FileManagerQueryResponse> => {
  return await invokeWithErrorHandler('query_files', { param })
}

export const getNavigationItems = async (): Promise<FileManagerNavigationItem[]> => {
  return await invokeWithErrorHandler('get_navigation_items')
}

export const loginCommand = async (
  info: Partial<{
    account: string
    name: string
    uid: string
  }>
) => {
  const matrixStore = useMatrixStore()
  const userStore = useUserStore()

  await ensureAppStateReady()

  const uid = info.uid || userStore.userInfo?.uid || matrixStore.userId || ''
  if (!uid) {
    throw new Error(useI18nGlobal().t('matrix_error.auth.user_id_missing'))
  }

  const { sessionOrchestrator } = await import('@/services/matrix/auth/SessionOrchestrator')
  const tokens = await sessionOrchestrator.getStoredTokens()

  if (!tokens.token) {
    throw new Error(useI18nGlobal().t('matrix_error.auth.access_token_missing'))
  }

  await sessionOrchestrator.restoreWithAccessToken({
    uid,
    accessToken: tokens.token,
    refreshToken: tokens.refreshToken ?? undefined,
    displayName: info.name,
    account: info.account,
    client: 'PC',
    bootstrapAfterRestore: true
  })

  await sessionOrchestrator.completeDesktopLoginTransition()
}
