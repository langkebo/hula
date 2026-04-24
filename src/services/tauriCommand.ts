import { invoke } from '@tauri-apps/api/core'
import { matrixRuntimeSessionService } from '@/services/matrix'
import { useMatrixStore } from '../stores/domains/chat/matrix'
import { useUserStore } from '../stores/domains/user/user'
import { ensureAppStateReady } from '@/utils/AppStateReady'

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
  return await invoke('get_settings')
}

export const updateSettings = async (settings: UpdateSettingsParams) => {
  return await invoke('update_settings', { settings })
}

/**
 * 切换用户数据库
 * 根据用户ID切换到对应的数据库文件，如果数据库不存在则创建
 * @param uid 用户ID
 */
export const switchUserDatabase = async (uid: string): Promise<void> => {
  await ensureAppStateReady()
  return await invoke('switch_user_database', { uid })
}

export type FileQueryParam = {
  navigationType: string
  selectedUser?: string
  searchKeyword?: string
  roomId?: string
  page: number
  pageSize: number
}

export const queryFiles = async (param: FileQueryParam) => {
  return await invoke('query_files', { param })
}

export const getNavigationItems = async () => {
  return await invoke('get_navigation_items')
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
    throw new Error('缺少用户ID，无法恢复登录会话')
  }

  const tokens = await matrixRuntimeSessionService.getStoredTokens()

  if (!tokens.token) {
    throw new Error('缺少访问令牌，无法恢复登录会话')
  }

  await matrixRuntimeSessionService.restoreWithAccessToken({
    uid,
    accessToken: tokens.token,
    refreshToken: tokens.refreshToken ?? undefined,
    displayName: info.name,
    account: info.account,
    client: 'PC',
    bootstrapAfterRestore: true
  })

  await matrixRuntimeSessionService.completeDesktopLoginTransition()
}
