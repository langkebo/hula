import { useI18nGlobal } from '@/services/i18n'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useMatrixStore } from '../stores/domains/chat/matrix'
import { useUserStore } from '../stores/domains/user/user'

export type Settings = {
  database: {
    sqlite_file: string
  }
  backend: {
    base_url: string
    ws_url: string
  }
  youdao?: {
    app_key: string
    app_secret: string
  }
  tencent?: {
    api_key: string
    secret_id: string
    map_key: string
  }
  minio?: {
    endpoint: string
    bucket: string
    access_key: string
    secret_key: string
    region: string
    download_domain: string
  }
  ice_server?: {
    urls: string[]
    username: string
    credential: string
  }
}

export type UpdateSettingsParams = {
  baseUrl: string
  wsUrl: string
}

export const getSettings = async (): Promise<Settings> => {
  return await invokeWithErrorHandler('get_settings')
}

export const updateSettings = async (settings: UpdateSettingsParams) => {
  await ensureAppStateReady()
  return await invokeWithErrorHandler('update_settings', { settings })
}

/**
 * 切换用户数据库
 * 根据用户ID切换到对应的数据库文件，如果数据库不存在则创建
 * @param uid 用户ID
 */
export const switchUserDatabase = async (uid: string): Promise<void> => {
  await ensureAppStateReady()
  return await invokeWithErrorHandler('switch_user_database', { uid })
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
  displayDate: string
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

export type FileManagerQueryResponse = {
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
