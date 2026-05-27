/// <reference types="node" />
import { expect, type Page } from '@playwright/test'

const MATRIX_HOMESERVER_STORAGE_KEY = 'hula-homeserver-url'
const MATRIX_IDENTITY_SERVER_STORAGE_KEY = 'hula-identity-server-url'
const MATRIX_SESSION_HOMESERVER_STORAGE_KEY = 'hula-session-homeserver-url'
const MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY = 'hula-session-identity-server-url'
const E2E_STORAGE_KEY = 'hula:e2e:enabled'
const PLATFORM_STORAGE_KEY = 'hula:e2e:platform'
const MOCK_AUTH_STORAGE_KEY = 'hula:e2e:mock-auth'
const SEEDED_WORKBENCH_STORAGE_KEY = 'hula:e2e:seed-workbench'
const GUIDE_STORAGE_KEY = 'guide'

export type MatrixLiveAuthStrategy = 'password-api' | 'restore-token' | 'ui'

export interface MatrixLiveEnv {
  enabled: boolean
  authStrategy: MatrixLiveAuthStrategy
  homeserverUrl: string
  appUrl: string
  identityServerUrl: string
  username: string
  password: string
  userId: string
  accessToken: string
  refreshToken: string
  displayName: string
  roomId: string
  roomName: string
  expectedTimelineText: string
  messagePrefix: string
  peerUsername: string
  peerPassword: string
  peerUserId: string
  peerAccessToken: string
  peerRefreshToken: string
  peerDisplayName: string
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let pendingPasswordLoginSlot: Promise<void> = Promise.resolve()
let nextPasswordLoginAllowedAt = 0

const isRateLimitError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /429|Too Many Requests|M_LIMIT_EXCEEDED|retry[_ -]?after/i.test(message)
}

const getRateLimitDelayMs = (error: unknown, attempt: number): number => {
  const message = error instanceof Error ? error.message : String(error)
  const retryAfterMatch = message.match(/retry[_ -]?after(?:_ms)?["':=\s]+(\d+)/i)
  const parsedDelay = retryAfterMatch ? Number.parseInt(retryAfterMatch[1], 10) : NaN
  if (Number.isFinite(parsedDelay) && parsedDelay > 0) {
    return parsedDelay
  }
  return Math.max(1200 * attempt, 1200)
}

const withPasswordLoginSlot = async <T>(task: () => Promise<T>): Promise<T> => {
  const previousSlot = pendingPasswordLoginSlot
  let releaseSlot = () => {}
  pendingPasswordLoginSlot = new Promise<void>((resolve) => {
    releaseSlot = resolve
  })

  await previousSlot

  try {
    const delay = nextPasswordLoginAllowedAt - Date.now()
    if (delay > 0) {
      await sleep(delay)
    }

    const result = await task()
    nextPasswordLoginAllowedAt = Date.now() + 1200
    return result
  } finally {
    releaseSlot()
  }
}

const readEnv = (name: string): string => process.env[name]?.trim() ?? ''

const isEnabledFlag = (value: string): boolean => value === '1' || value.toLowerCase() === 'true'

const resolveBrowserProxyHomeserverUrl = (homeserverUrl: string, appUrl: string): string => {
  if (!homeserverUrl || !appUrl) {
    return homeserverUrl
  }

  try {
    const homeserver = new URL(homeserverUrl)
    const app = new URL(appUrl)
    if (!/^https?:$/i.test(app.protocol) || !/^https?:$/i.test(homeserver.protocol)) {
      return homeserverUrl
    }

    if (homeserver.origin === app.origin) {
      return homeserverUrl
    }

    return app.origin
  } catch {
    return homeserverUrl
  }
}

export const readMatrixLiveEnv = (): MatrixLiveEnv => ({
  enabled: isEnabledFlag(readEnv('MATRIX_LIVE_E2E')),
  authStrategy: (readEnv('MATRIX_LIVE_AUTH_STRATEGY') || 'password-api') as MatrixLiveAuthStrategy,
  homeserverUrl: resolveBrowserProxyHomeserverUrl(
    readEnv('MATRIX_LIVE_HOMESERVER_URL'),
    readEnv('MATRIX_LIVE_APP_URL') || readEnv('PLAYWRIGHT_TEST_BASE_URL') || 'http://127.0.0.1:5210'
  ),
  appUrl: readEnv('MATRIX_LIVE_APP_URL') || readEnv('PLAYWRIGHT_TEST_BASE_URL') || 'http://127.0.0.1:5210',
  identityServerUrl: readEnv('MATRIX_LIVE_IDENTITY_SERVER_URL'),
  username: readEnv('MATRIX_LIVE_USERNAME'),
  password: readEnv('MATRIX_LIVE_PASSWORD'),
  userId: readEnv('MATRIX_LIVE_USER_ID'),
  accessToken: readEnv('MATRIX_LIVE_ACCESS_TOKEN'),
  refreshToken: readEnv('MATRIX_LIVE_REFRESH_TOKEN'),
  displayName: readEnv('MATRIX_LIVE_DISPLAY_NAME'),
  roomId: readEnv('MATRIX_LIVE_ROOM_ID'),
  roomName: readEnv('MATRIX_LIVE_ROOM_NAME'),
  expectedTimelineText: readEnv('MATRIX_LIVE_EXPECTED_TIMELINE_TEXT'),
  messagePrefix: readEnv('MATRIX_LIVE_MESSAGE_PREFIX') || '[pw-matrix-live]',
  peerUsername: readEnv('MATRIX_LIVE_PEER_USERNAME'),
  peerPassword: readEnv('MATRIX_LIVE_PEER_PASSWORD'),
  peerUserId: readEnv('MATRIX_LIVE_PEER_USER_ID'),
  peerAccessToken: readEnv('MATRIX_LIVE_PEER_ACCESS_TOKEN'),
  peerRefreshToken: readEnv('MATRIX_LIVE_PEER_REFRESH_TOKEN'),
  peerDisplayName: readEnv('MATRIX_LIVE_PEER_DISPLAY_NAME')
})

export const getMatrixLiveSkipReason = (env: MatrixLiveEnv): string | null => {
  if (!env.enabled) {
    return '未启用 MATRIX_LIVE_E2E'
  }

  if (!env.homeserverUrl) {
    return '缺少 MATRIX_LIVE_HOMESERVER_URL'
  }

  if (env.authStrategy === 'restore-token') {
    if (!env.userId) {
      return 'restore-token 模式缺少 MATRIX_LIVE_USER_ID'
    }
    if (!env.accessToken) {
      return 'restore-token 模式缺少 MATRIX_LIVE_ACCESS_TOKEN'
    }
    return null
  }

  if (!env.username) {
    return '缺少 MATRIX_LIVE_USERNAME'
  }

  if (!env.password) {
    return '缺少 MATRIX_LIVE_PASSWORD'
  }

  return null
}

export const getMatrixLivePeerSkipReason = (env: MatrixLiveEnv): string | null => {
  if (env.authStrategy === 'restore-token') {
    if (!env.peerUserId) {
      return '双账号 restore-token 模式缺少 MATRIX_LIVE_PEER_USER_ID'
    }
    if (!env.peerAccessToken) {
      return '双账号 restore-token 模式缺少 MATRIX_LIVE_PEER_ACCESS_TOKEN'
    }
    return null
  }

  if (!env.peerUsername) {
    return '缺少 MATRIX_LIVE_PEER_USERNAME'
  }

  if (!env.peerPassword) {
    return '缺少 MATRIX_LIVE_PEER_PASSWORD'
  }

  return null
}

type MatrixLiveActor = 'primary' | 'peer'

interface MatrixLiveActorCredentials {
  username: string
  password: string
  userId: string
  accessToken: string
  refreshToken: string
  displayName: string
}

const resolveActorCredentials = (env: MatrixLiveEnv, actor: MatrixLiveActor): MatrixLiveActorCredentials => {
  if (actor === 'peer') {
    return {
      username: env.peerUsername,
      password: env.peerPassword,
      userId: env.peerUserId,
      accessToken: env.peerAccessToken,
      refreshToken: env.peerRefreshToken,
      displayName: env.peerDisplayName
    }
  }

  return {
    username: env.username,
    password: env.password,
    userId: env.userId,
    accessToken: env.accessToken,
    refreshToken: env.refreshToken,
    displayName: env.displayName
  }
}

export const bootstrapMatrixLivePage = async (page: Page, env: MatrixLiveEnv): Promise<void> => {
  await page.addInitScript(
    ({
      homeserverUrl,
      identityServerUrl,
      storageKeys
    }: {
      homeserverUrl: string
      identityServerUrl: string
      storageKeys: { homeserver: string; sessionHomeserver: string; identity: string; sessionIdentity: string }
    }) => {
      const runtimeWindow = window as Window & {
        __TAURI_INTERNALS__?: {
          metadata: {
            currentWindow: { label: string }
            currentWebview: { label: string }
          }
          invoke: (cmd: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>
          transformCallback: (callback: unknown, once?: boolean) => number
          unregisterCallback: (id: number) => void
          convertFileSrc: (filePath: string, protocol?: string) => string
          callbacks?: Map<number, (data: unknown) => void>
          runCallback?: (id: number, data: unknown) => void
        }
        __HULA_TAURI_CALLBACKS__?: Map<number, unknown>
        __HULA_TAURI_CALLBACK_ID__?: number
        __HULA_TAURI_EVENT_LISTENERS__?: Map<string, Set<number>>
        __TAURI_EVENT_PLUGIN_INTERNALS__?: {
          unregisterListener: (event: string, eventId: number) => void
        }
      }

      if (!runtimeWindow.__TAURI_INTERNALS__) {
        runtimeWindow.__HULA_TAURI_CALLBACKS__ = new Map()
        runtimeWindow.__HULA_TAURI_CALLBACK_ID__ = 0
        runtimeWindow.__HULA_TAURI_EVENT_LISTENERS__ = new Map()
        const unregisterCallback = (id: number) => {
          runtimeWindow.__HULA_TAURI_CALLBACKS__?.delete(id)
        }
        const unregisterListener = (event: string, eventId: number) => {
          runtimeWindow.__HULA_TAURI_EVENT_LISTENERS__?.get(event)?.delete(eventId)
          unregisterCallback(eventId)
        }
        const emitEvent = (event: string, payload?: unknown) => {
          const listenerIds = runtimeWindow.__HULA_TAURI_EVENT_LISTENERS__?.get(event)
          if (!listenerIds?.size) {
            return
          }
          listenerIds.forEach((listenerId) => {
            const callback = runtimeWindow.__HULA_TAURI_CALLBACKS__?.get(listenerId)
            if (typeof callback === 'function') {
              ;(callback as (data: unknown) => void)({
                event,
                id: listenerId,
                payload
              })
            }
          })
        }
        runtimeWindow.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
          unregisterListener
        }
        runtimeWindow.__TAURI_INTERNALS__ = {
          metadata: {
            currentWindow: { label: 'home' },
            currentWebview: { label: 'home' }
          },
          async invoke(cmd: string, args?: Record<string, unknown>) {
            if (cmd === 'is_app_state_ready') {
              return true
            }
            if (cmd === 'plugin:window|get_all_windows' || cmd === 'plugin:webview|get_all_webviews') {
              return []
            }
            if (cmd === 'plugin:window|title') {
              return 'HuLa'
            }
            if (cmd === 'plugin:event|listen') {
              const event = typeof args?.event === 'string' ? args.event : ''
              const handlerId = typeof args?.handler === 'number' ? args.handler : 0
              if (!event || !handlerId) {
                return handlerId
              }
              const listeners = runtimeWindow.__HULA_TAURI_EVENT_LISTENERS__?.get(event) ?? new Set<number>()
              listeners.add(handlerId)
              runtimeWindow.__HULA_TAURI_EVENT_LISTENERS__?.set(event, listeners)
              return handlerId
            }
            if (cmd === 'plugin:event|unlisten') {
              const event = typeof args?.event === 'string' ? args.event : ''
              const eventId = typeof args?.eventId === 'number' ? args.eventId : 0
              if (event && eventId) {
                unregisterListener(event, eventId)
              }
              return null
            }
            if (cmd === 'plugin:event|emit' || cmd === 'plugin:event|emit_to') {
              const event = typeof args?.event === 'string' ? args.event : ''
              if (event) {
                emitEvent(event, args?.payload)
              }
              return null
            }
            if (
              cmd.includes('register_listener') ||
              cmd.includes('registerListener') ||
              cmd.includes('remove_listener')
            ) {
              return null
            }
            return undefined
          },
          transformCallback(callback: unknown) {
            const nextId = (runtimeWindow.__HULA_TAURI_CALLBACK_ID__ ?? 0) + 1
            runtimeWindow.__HULA_TAURI_CALLBACK_ID__ = nextId
            runtimeWindow.__HULA_TAURI_CALLBACKS__?.set(nextId, callback)
            return nextId
          },
          unregisterCallback,
          callbacks: runtimeWindow.__HULA_TAURI_CALLBACKS__ as Map<number, (data: unknown) => void>,
          runCallback(id: number, data: unknown) {
            const callback = runtimeWindow.__HULA_TAURI_CALLBACKS__?.get(id)
            if (typeof callback === 'function') {
              ;(callback as (data: unknown) => void)(data)
            }
          },
          convertFileSrc(filePath: string) {
            return filePath
          }
        }
      }

      window.localStorage.setItem(E2E_STORAGE_KEY, '1')
      window.localStorage.setItem(PLATFORM_STORAGE_KEY, 'desktop')
      window.localStorage.removeItem(MOCK_AUTH_STORAGE_KEY)
      window.localStorage.removeItem(SEEDED_WORKBENCH_STORAGE_KEY)
      window.localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify({ isGuideCompleted: true }))
      window.localStorage.setItem(storageKeys.homeserver, homeserverUrl)
      window.localStorage.setItem(storageKeys.sessionHomeserver, homeserverUrl)
      if (identityServerUrl) {
        window.localStorage.setItem(storageKeys.identity, identityServerUrl)
        window.localStorage.setItem(storageKeys.sessionIdentity, identityServerUrl)
      } else {
        window.localStorage.removeItem(storageKeys.identity)
        window.localStorage.removeItem(storageKeys.sessionIdentity)
      }
    },
    {
      homeserverUrl: env.homeserverUrl,
      identityServerUrl: env.identityServerUrl,
      storageKeys: {
        homeserver: MATRIX_HOMESERVER_STORAGE_KEY,
        sessionHomeserver: MATRIX_SESSION_HOMESERVER_STORAGE_KEY,
        identity: MATRIX_IDENTITY_SERVER_STORAGE_KEY,
        sessionIdentity: MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY
      }
    }
  )

  await page.goto(env.appUrl)
  await page.waitForSelector('#app', { state: 'visible' })
  await waitForHulaAppReady(page)
  await waitForPinia(page)
  await page.evaluate(async () => {
    const runtimeWindow = window as Window & { pinia?: unknown }

    if (runtimeWindow.pinia == null) {
      throw new Error('Pinia is not available on window. Cannot bootstrap guide store.')
    }

    const modulePath = '/src/stores/domains/settings/guide.ts'
    const { useGuideStore } = (await import(/* @vite-ignore */ modulePath)) as {
      useGuideStore: (pinia?: unknown) => { markGuideCompleted: () => void }
    }
    useGuideStore(runtimeWindow.pinia).markGuideCompleted()
    document
      .querySelectorAll('.driver-overlay, .driver-popover, .driver-popover-footer, .driver-active-element')
      .forEach((node) => node.remove())
  })
}

const waitForHulaAppReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => (window as Window & { __HULA_APP_READY__?: boolean }).__HULA_APP_READY__ === true,
    undefined,
    {
      timeout: 120_000
    }
  )
}

const waitForPinia = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () =>
      (window as Window & { __HULA_PINIA_READY__?: boolean; pinia?: unknown }).__HULA_PINIA_READY__ === true &&
      (window as Window & { pinia?: unknown }).pinia != null,
    undefined,
    {
      timeout: 30_000
    }
  )
}

const waitForMatrixLoggedIn = async (page: Page): Promise<void> => {
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const runtimeWindow = window as Window & { pinia?: unknown }
          const matrixStoreModulePath = '/src/stores/domains/chat/matrix.ts'
          const sessionStateModulePath = '/src/services/matrix/matrixSessionState.ts'
          const currentUserStateModulePath = '/src/common/currentUserState.ts'
          const { useMatrixStore } = (await import(/* @vite-ignore */ matrixStoreModulePath)) as {
            useMatrixStore: (pinia?: unknown) => {
              isLoggedIn: boolean
              userId?: string | null
              accessToken?: string | null
              getClient?: () => {
                getUserId?: () => string | null
                getAccessToken?: () => string | null
              } | null
            }
          }
          const { getMatrixSessionSnapshot } = (await import(/* @vite-ignore */ sessionStateModulePath)) as {
            getMatrixSessionSnapshot: () => { userId: string | null; accessToken: string | null }
          }
          const { getCurrentUserInfo } = (await import(/* @vite-ignore */ currentUserStateModulePath)) as {
            getCurrentUserInfo: () => { uid?: string | null } | undefined
          }
          const matrixStore = useMatrixStore(runtimeWindow.pinia)
          const sessionSnapshot = getMatrixSessionSnapshot()
          const currentUser = getCurrentUserInfo()
          const client = matrixStore.getClient?.() ?? null
          const accessToken =
            matrixStore.accessToken ?? sessionSnapshot.accessToken ?? client?.getAccessToken?.() ?? null
          const userId =
            matrixStore.userId ?? sessionSnapshot.userId ?? client?.getUserId?.() ?? currentUser?.uid ?? null
          return Boolean(
            client &&
              accessToken &&
              userId &&
              (matrixStore.isLoggedIn || Boolean(sessionSnapshot.userId) || Boolean(currentUser?.uid))
          )
        }),
      {
        timeout: 120_000,
        message: '等待 Matrix 登录状态完成'
      }
    )
    .toBe(true)
}

const loginWithPasswordApi = async (page: Page, env: MatrixLiveEnv, actor: MatrixLiveActor): Promise<void> => {
  const credentials = resolveActorCredentials(env, actor)
  await waitForHulaAppReady(page)
  await waitForPinia(page)

  const loginOptions = {
    username: credentials.username,
    password: credentials.password,
    displayName: credentials.displayName,
    homeserverUrl: env.homeserverUrl,
    identityServerUrl: env.identityServerUrl
  }

  const maxAttempts = 4

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await withPasswordLoginSlot(async () => {
        await page.evaluate(async (options: Record<string, string>) => {
          const runtimeWindow = window as Window & { pinia?: unknown }

          if (runtimeWindow.pinia == null) {
            throw new Error('Pinia is not available on window. Cannot login with password.')
          }

          const modulePath = '/src/services/matrix/auth/SessionOrchestrator.ts'
          const { sessionOrchestrator } = (await import(/* @vite-ignore */ modulePath)) as {
            sessionOrchestrator: {
              loginWithPassword: (options: Record<string, unknown>) => Promise<unknown>
            }
          }

          await sessionOrchestrator.loginWithPassword({
            username: options.username,
            password: options.password,
            homeserverUrl: options.homeserverUrl,
            identityServerUrl: options.identityServerUrl,
            deviceName: 'HuLa Playwright Matrix Live',
            account: options.username,
            displayName: options.displayName || options.username,
            client: 'PC',
            persistTokens: false,
            persistUserInfo: false,
            switchDatabase: false
          })

          const initialSyncModulePath = '/src/stores/domains/chat/initialSync.ts'
          const currentUserStateModulePath = '/src/common/currentUserState.ts'
          const { useInitialSyncStore } = (await import(/* @vite-ignore */ initialSyncModulePath)) as {
            useInitialSyncStore: (pinia?: unknown) => { markSynced: (uid: string) => void }
          }
          const { getCurrentUserInfo } = (await import(/* @vite-ignore */ currentUserStateModulePath)) as {
            getCurrentUserInfo: () => { uid?: string | null } | undefined
          }
          const currentUserId = getCurrentUserInfo()?.uid ?? ''
          if (currentUserId && runtimeWindow.pinia != null) {
            useInitialSyncStore(runtimeWindow.pinia).markSynced(currentUserId)
          }
        }, loginOptions)
      })
      return
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxAttempts) {
        throw error
      }

      const retryDelay = getRateLimitDelayMs(error, attempt)
      nextPasswordLoginAllowedAt = Date.now() + retryDelay
      await sleep(retryDelay)
    }
  }
}

const restoreWithAccessToken = async (page: Page, env: MatrixLiveEnv, actor: MatrixLiveActor): Promise<void> => {
  const credentials = resolveActorCredentials(env, actor)
  await waitForHulaAppReady(page)
  await waitForPinia(page)

  await page.evaluate(
    async (options: Record<string, string>) => {
      const runtimeWindow = window as Window & {
        pinia?: unknown
        __MATRIX_LIVE_RESTORE_STAGE__?: string
      }

      if (runtimeWindow.pinia == null) {
        throw new Error('Pinia is not available on window. Cannot restore session.')
      }

      const modulePath = '/src/services/matrix/auth/SessionOrchestrator.ts'
      const matrixStoreModulePath = '/src/stores/domains/chat/matrix.ts'
      runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'loading-session-orchestrator'
      const { sessionOrchestrator } = (await import(/* @vite-ignore */ modulePath)) as {
        sessionOrchestrator: {
          restoreWithAccessToken: (options: Record<string, unknown>) => Promise<unknown>
        }
      }
      runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'session-orchestrator-loaded'
      const { useMatrixStore } = (await import(/* @vite-ignore */ matrixStoreModulePath)) as {
        useMatrixStore: (pinia?: unknown) => {
          initialize: (options: Record<string, unknown>) => Promise<void>
          loginWithToken: (accessToken: string, userId: string, refreshToken?: string) => Promise<boolean>
        }
      }
      const matrixStore = useMatrixStore(runtimeWindow.pinia)
      const originalInitialize = matrixStore.initialize.bind(matrixStore)
      const originalLoginWithToken = matrixStore.loginWithToken.bind(matrixStore)

      matrixStore.initialize = async (config: Record<string, unknown>) => {
        runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'matrix-store.initialize:start'
        try {
          const result = await originalInitialize(config)
          runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'matrix-store.initialize:done'
          return result
        } catch (error) {
          runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = `matrix-store.initialize:error:${String(error)}`
          throw error
        }
      }

      matrixStore.loginWithToken = async (accessToken: string, userId: string, refreshToken?: string) => {
        runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'matrix-store.loginWithToken:start'
        try {
          const result = await originalLoginWithToken(accessToken, userId, refreshToken)
          runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = `matrix-store.loginWithToken:done:${String(result)}`
          return result
        } catch (error) {
          runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = `matrix-store.loginWithToken:error:${String(error)}`
          throw error
        }
      }

      window.localStorage.setItem(options.homeserverStorageKey, options.homeserverUrl)
      window.localStorage.setItem(options.sessionHomeserverStorageKey, options.homeserverUrl)
      if (options.identityServerUrl) {
        window.localStorage.setItem(options.identityStorageKey, options.identityServerUrl)
        window.localStorage.setItem(options.sessionIdentityStorageKey, options.identityServerUrl)
      } else {
        window.localStorage.removeItem(options.identityStorageKey)
        window.localStorage.removeItem(options.sessionIdentityStorageKey)
      }

      runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'session-orchestrator.restore:start'
      await Promise.race([
        sessionOrchestrator.restoreWithAccessToken({
          uid: options.userId,
          accessToken: options.accessToken,
          // Skip refresh-token bootstrap in browser Playwright runs; token refresh is not
          // required for the immediate live-session validation and can stall on real backends.
          refreshToken: undefined,
          displayName: options.displayName || options.username || options.userId,
          account: options.username || options.userId,
          client: 'PC',
          persistTokens: false,
          persistUserInfo: false,
          switchDatabase: false,
          // Bootstrap rooms and sessions immediately so SlidingSync listeners are
          // registered and the session list populates before the test proceeds.
          bootstrapAfterRestore: true
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`restoreWithAccessToken stage timeout: ${runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__}`))
          }, 45_000)
        })
      ])
      runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'session-orchestrator.restore:done'

      const initialSyncModulePath = '/src/stores/domains/chat/initialSync.ts'
      const { useInitialSyncStore } = (await import(/* @vite-ignore */ initialSyncModulePath)) as {
        useInitialSyncStore: (pinia?: unknown) => { markSynced: (uid: string) => void }
      }
      if (options.userId && runtimeWindow.pinia != null) {
        useInitialSyncStore(runtimeWindow.pinia).markSynced(options.userId)
      }
    },
    {
      username: credentials.username,
      userId: credentials.userId,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      displayName: credentials.displayName,
      homeserverUrl: env.homeserverUrl,
      identityServerUrl: env.identityServerUrl,
      homeserverStorageKey: MATRIX_HOMESERVER_STORAGE_KEY,
      identityStorageKey: MATRIX_IDENTITY_SERVER_STORAGE_KEY,
      sessionHomeserverStorageKey: MATRIX_SESSION_HOMESERVER_STORAGE_KEY,
      sessionIdentityStorageKey: MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY
    }
  )
}

const loginViaUi = async (page: Page, env: MatrixLiveEnv, actor: MatrixLiveActor): Promise<void> => {
  const credentials = resolveActorCredentials(env, actor)
  const accountInput = page.locator('input').nth(0)
  const passwordInput = page.locator('input').nth(1)
  const loginButton = page.locator('button.gradient-button')

  await accountInput.fill(credentials.username)
  await passwordInput.fill(credentials.password)
  await loginButton.click()
}

export const loginToMatrixLive = async (
  page: Page,
  env: MatrixLiveEnv,
  actor: MatrixLiveActor = 'primary'
): Promise<void> => {
  if (env.authStrategy === 'restore-token') {
    await restoreWithAccessToken(page, env, actor)
  } else if (env.authStrategy === 'ui') {
    await loginViaUi(page, env, actor)
  } else {
    await loginWithPasswordApi(page, env, actor)
  }

  await waitForMatrixLoggedIn(page)
}

export const openMessageWorkspace = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const modulePath = '/src/router/index.ts'
    const routerModule = (await import(/* @vite-ignore */ modulePath)) as {
      default: { push: (path: string) => Promise<unknown> }
    }
    await routerModule.default.push('/message')
  })

  await expect(page).toHaveURL(/\/message(?:\?.*)?$/)
  await expect(page.locator('.message-list-page')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.message-session-toolbar')).toBeVisible({ timeout: 15_000 })
}

export const collectMatrixLiveSessionDebugSnapshot = async (
  page: Page,
  requestedRoomId?: string
): Promise<Record<string, unknown>> => {
  return page.evaluate(
    async ({ targetRoomId: requestedRoomId }) => {
      const runtimeWindow = window as Window & { pinia?: unknown; __MATRIX_LIVE_RESTORE_STAGE__?: string }
      const importBrowserModule = <T>(modulePath: string): Promise<T> =>
        import(/* @vite-ignore */ modulePath) as Promise<T>
      const [
        { useMatrixStore },
        { useRoomStore },
        { useSessionStore },
        { useGlobalStore },
        { useChatStore },
        { matrixClientService },
        { getMatrixSessionSnapshot },
        { getCurrentUserInfo },
        { resolveMatrixRuntimeEndpointConfig, resolveMatrixSessionEndpointConfig },
        { filterAndSortSessions, matchesKeyword, matchesSessionType, matchesSessionEngagement },
        {
          readSpaceWorkbenchSearch,
          readSpaceWorkbenchSessionTypeFilter,
          readSpaceWorkbenchSessionEngagementFilter,
          readSpaceWorkbenchSessionSort
        },
        { errorTracker }
      ] = await Promise.all([
        importBrowserModule<{ useMatrixStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/matrix.ts'),
        importBrowserModule<{ useRoomStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/room.ts'),
        importBrowserModule<{ useSessionStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/chat/session.ts'),
        importBrowserModule<{ useGlobalStore: (pinia?: unknown) => any }>('/src/stores/domains/widget/global.ts'),
        importBrowserModule<{ useChatStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/chat/index.ts'),
        importBrowserModule<{
          matrixClientService: {
            getRustCryptoDebugState: () => Record<string, unknown>
            getEventDecryptedDebugState: () => Record<string, unknown>
          }
        }>('/src/services/matrix/MatrixClientService.ts'),
        importBrowserModule<{ getMatrixSessionSnapshot: () => unknown }>('/src/services/matrix/matrixSessionState.ts'),
        importBrowserModule<{ getCurrentUserInfo: () => unknown }>('/src/common/currentUserState.ts'),
        importBrowserModule<{
          resolveMatrixRuntimeEndpointConfig: () => unknown
          resolveMatrixSessionEndpointConfig: () => unknown
        }>('/src/services/backend/config.ts'),
        importBrowserModule<{
          filterAndSortSessions: (sessions: any[], options: Record<string, unknown>) => any[]
          matchesKeyword: (session: any, keyword: string) => boolean
          matchesSessionType: (session: any, sessionTypeFilter: string) => boolean
          matchesSessionEngagement: (session: any, sessionEngagementFilter: string) => boolean
        }>('/src/composables/workbench/sessionListFilters.ts'),
        importBrowserModule<{
          readSpaceWorkbenchSearch: (query: Record<string, unknown>) => string
          readSpaceWorkbenchSessionTypeFilter: (query: Record<string, unknown>) => string
          readSpaceWorkbenchSessionEngagementFilter: (query: Record<string, unknown>) => string
          readSpaceWorkbenchSessionSort: (query: Record<string, unknown>) => string
        }>('/src/router/spaceNavigation.ts'),
        importBrowserModule<{
          errorTracker: {
            getTopErrors: (limit: number) => Array<{
              type: string
              message: string
              context?: Record<string, unknown>
            }>
          }
        }>('/src/utils/ErrorTracker.ts')
      ])

      const matrixStore = useMatrixStore(runtimeWindow.pinia)
      const roomStore = useRoomStore(runtimeWindow.pinia)
      const sessionStore = useSessionStore(runtimeWindow.pinia)
      const globalStore = useGlobalStore(runtimeWindow.pinia)
      const chatStore = useChatStore(runtimeWindow.pinia)
      const routeQuery = Object.fromEntries(new URLSearchParams(window.location.search).entries())
      const filters = {
        search: readSpaceWorkbenchSearch(routeQuery),
        type: readSpaceWorkbenchSessionTypeFilter(routeQuery),
        engagement: readSpaceWorkbenchSessionEngagementFilter(routeQuery),
        sort: readSpaceWorkbenchSessionSort(routeQuery)
      }
      const filteredSessions = filterAndSortSessions(sessionStore.sessionList, {
        keyword: filters.search.toLocaleLowerCase(),
        sessionTypeFilter: filters.type,
        sessionEngagementFilter: filters.engagement,
        sessionSort: filters.sort
      })
      const client = matrixStore.getClient?.()
      const crypto = client?.getCrypto?.() ?? null
      const activeRoomId = requestedRoomId || globalStore.currentSessionRoomId || null
      const activeRoom = activeRoomId ? (client?.getRoom?.(activeRoomId) ?? null) : null
      const encryptionStateEvent = activeRoom?.currentState?.getStateEvents?.('m.room.encryption', '') ?? null
      const chatMessages = activeRoomId ? chatStore.chatMessageListByRoomId(activeRoomId) : []
      const roomTimelineEvents = activeRoom?.getLiveTimeline?.()?.getEvents?.() ?? []

      return {
        route: `${window.location.pathname}${window.location.search}`,
        stage: runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ ?? null,
        browser: {
          origin: window.location.origin,
          indexedDBAvailable: typeof globalThis.indexedDB !== 'undefined',
          cryptoSubtleAvailable: typeof globalThis.crypto?.subtle !== 'undefined'
        },
        matrix: {
          isLoggedIn: matrixStore.isLoggedIn,
          userId: matrixStore.userId,
          deviceId: matrixStore.deviceId ?? null,
          accessTokenPresent: !!matrixStore.accessToken,
          connectionState: matrixStore.connectionState,
          syncState: matrixStore.syncState,
          lastError: matrixStore.lastError,
          clientReady: Boolean(client),
          clientUserId: client?.getUserId?.() ?? null,
          clientDeviceId: client?.getDeviceId?.() ?? null,
          hasInitRustCrypto: typeof client?.initRustCrypto === 'function',
          isCryptoEnabled: typeof client?.isCryptoEnabled === 'function' ? client.isCryptoEnabled() : null,
          cryptoAvailable: Boolean(crypto),
          cryptoBackendType:
            crypto && typeof crypto === 'object'
              ? ((crypto as { constructor?: { name?: string } }).constructor?.name ?? 'object')
              : crypto === null
                ? null
                : typeof crypto,
          rustCryptoDebug: matrixClientService.getRustCryptoDebugState(),
          eventDecryptedDebug: matrixClientService.getEventDecryptedDebugState()
        },
        sessionSnapshot: getMatrixSessionSnapshot(),
        currentUser: getCurrentUserInfo(),
        global: {
          currentSessionRoomId: globalStore.currentSessionRoomId ?? null
        },
        endpoints: {
          runtime: resolveMatrixRuntimeEndpointConfig(),
          session: resolveMatrixSessionEndpointConfig(),
          storedHomeserverUrl: window.localStorage.getItem('hula-homeserver-url'),
          storedSessionHomeserverUrl: window.localStorage.getItem('hula-session-homeserver-url')
        },
        rooms: {
          count: roomStore.roomList.length,
          sample: roomStore.roomList.slice(0, 5).map((room: { roomId: string; name?: string }) => ({
            roomId: room.roomId,
            name: room.name ?? ''
          }))
        },
        sessions: {
          count: sessionStore.sessionList.length,
          sample: sessionStore.sessionList
            .slice(0, 5)
            .map(
              (session: {
                roomId: string
                name?: string
                type?: unknown
                unreadCount?: number
                highlightCount?: number
                isInvite?: boolean
              }) => ({
                roomId: session.roomId,
                name: session.name ?? '',
                type: session.type ?? null,
                unreadCount: session.unreadCount ?? 0,
                highlightCount: session.highlightCount ?? 0,
                isInvite: Boolean(session.isInvite)
              })
            )
        },
        filters,
        filteredSessions: {
          count: filteredSessions.length,
          sample: filteredSessions.slice(0, 5).map((session: { roomId: string; name?: string }) => ({
            roomId: session.roomId,
            name: session.name ?? ''
          })),
          evaluation: sessionStore.sessionList
            .slice(0, 5)
            .map(
              (session: {
                roomId: string
                name?: string
                type?: unknown
                unreadCount?: number
                highlightCount?: number
                isInvite?: boolean
                lastMsg?: string
                remark?: string
                account?: string
              }) => ({
                roomId: session.roomId,
                name: session.name ?? '',
                type: session.type ?? null,
                unreadCount: session.unreadCount ?? 0,
                highlightCount: session.highlightCount ?? 0,
                isInvite: Boolean(session.isInvite),
                matchesType: matchesSessionType(session, filters.type),
                matchesEngagement: matchesSessionEngagement(session, filters.engagement),
                matchesKeyword: matchesKeyword(session, filters.search.toLocaleLowerCase())
              })
            )
        },
        targetRoom: {
          requestedRoomId: requestedRoomId ?? null,
          activeRoomId,
          found: Boolean(activeRoom),
          name: activeRoom?.name ?? null,
          hasEncryptionStateEvent: activeRoom?.hasEncryptionStateEvent?.() ?? false,
          isEncrypted: activeRoom?.isEncrypted?.() ?? false,
          encryptionEventContent: encryptionStateEvent?.getContent?.() ?? null,
          pendingEventCount: activeRoom?.getPendingEvents?.().length ?? null,
          timelineEventCount: roomTimelineEvents.length,
          timelineSample: roomTimelineEvents
            .slice(-5)
            .map(
              (event: {
                getId?: () => string
                getType?: () => string
                getContent?: () => Record<string, unknown>
                getTs?: () => number
                getSender?: () => string
              }) => ({
                eventId: event.getId?.() ?? null,
                type: event.getType?.() ?? null,
                sender: event.getSender?.() ?? null,
                timestamp: event.getTs?.() ?? null,
                content: event.getContent?.() ?? null
              })
            )
        },
        chatMessages: {
          count: chatMessages.length,
          sample: chatMessages
            .slice(-5)
            .map(
              (item: {
                message: { id?: string; type?: unknown; body?: unknown; sendTime?: number }
                fromUser?: { uid?: string }
              }) => ({
                eventId: item.message.id ?? null,
                sender: item.fromUser?.uid ?? null,
                type: item.message.type ?? null,
                sendTime: item.message.sendTime ?? null,
                body: item.message.body ?? null
              })
            )
        },
        runtimeErrors: errorTracker.getTopErrors(5).map((error) => ({
          type: error.type,
          message: error.message,
          context: error.context ?? {}
        })),
        dom: {
          sessionItems: document.querySelectorAll('[role="list"] [role="listitem"]').length,
          bodyText: document.body.innerText.slice(0, 800)
        }
      }
    },
    { targetRoomId: requestedRoomId }
  )
}

export const waitForLiveSessions = async (page: Page): Promise<void> => {
  try {
    await expect
      .poll(() => page.locator('[role="list"] [role="listitem"]').count(), {
        timeout: 120_000,
        message: '等待消息会话列表加载'
      })
      .toBeGreaterThan(0)
  } catch (error) {
    const snapshot = await collectMatrixLiveSessionDebugSnapshot(page)
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${message}\nmatrix-live snapshot: ${JSON.stringify(snapshot)}`)
  }
}

const resolveMatrixLiveRoomCandidates = async (
  page: Page,
  roomId?: string,
  roomName?: string
): Promise<{
  currentSessionRoomId: string | null
  requestedRoom: {
    clientHasRoom: boolean
    sessionHasRoom: boolean
    roomStoreHasRoom: boolean
  } | null
  roomNameMatches: string[]
}> => {
  return page.evaluate(
    async ({ targetRoomId, targetRoomName }: { targetRoomId?: string; targetRoomName?: string }) => {
      const runtimeWindow = window as Window & { pinia?: unknown }
      const importBrowserModule = <T>(modulePath: string): Promise<T> =>
        import(/* @vite-ignore */ modulePath) as Promise<T>
      const [{ useMatrixStore }, { useRoomStore }, { useSessionStore }, { useGlobalStore }] = await Promise.all([
        importBrowserModule<{ useMatrixStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/matrix.ts'),
        importBrowserModule<{ useRoomStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/room.ts'),
        importBrowserModule<{ useSessionStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/chat/session.ts'),
        importBrowserModule<{ useGlobalStore: (pinia?: unknown) => any }>('/src/stores/domains/widget/global.ts')
      ])

      const matrixStore = useMatrixStore(runtimeWindow.pinia)
      const roomStore = useRoomStore(runtimeWindow.pinia)
      const sessionStore = useSessionStore(runtimeWindow.pinia)
      const globalStore = useGlobalStore(runtimeWindow.pinia)
      const client = matrixStore.getClient?.()
      const currentSessionRoomId = globalStore.currentSessionRoomId || null

      const requestedRoom = targetRoomId
        ? {
            clientHasRoom: Boolean(client?.getRoom?.(targetRoomId)),
            sessionHasRoom: sessionStore.sessionList.some(
              (session: { roomId: string }) => session.roomId === targetRoomId
            ),
            roomStoreHasRoom: roomStore.roomList.some((room: { roomId: string }) => room.roomId === targetRoomId)
          }
        : null

      const roomNameMatches = targetRoomName
        ? (Array.from(
            new Set([
              ...sessionStore.sessionList
                .filter((session: { roomId: string; name?: string }) => session.name === targetRoomName)
                .map((session: { roomId: string }) => session.roomId),
              ...roomStore.roomList
                .filter((room: { roomId: string; name?: string }) => room.name === targetRoomName)
                .map((room: { roomId: string }) => room.roomId),
              ...(client?.getRooms?.() ?? [])
                .filter((room: { roomId: string; name?: string }) => room.name === targetRoomName)
                .map((room: { roomId: string }) => room.roomId)
            ])
          ) as string[])
        : []

      return {
        currentSessionRoomId,
        requestedRoom,
        roomNameMatches
      }
    },
    { targetRoomId: roomId, targetRoomName: roomName }
  )
}

export const getCurrentSessionRoomId = async (page: Page): Promise<string> => {
  return page.evaluate(async () => {
    const runtimeWindow = window as Window & { pinia?: unknown }
    const modulePath = '/src/stores/domains/widget/global.ts'
    const { useGlobalStore } = (await import(/* @vite-ignore */ modulePath)) as {
      useGlobalStore: (pinia?: unknown) => { currentSessionRoomId: string }
    }
    return useGlobalStore(runtimeWindow.pinia).currentSessionRoomId
  })
}

const selectRoomById = async (page: Page, targetRoomId: string): Promise<void> => {
  await page.evaluate(async (roomId: string) => {
    const runtimeWindow = window as Window & { pinia?: unknown }
    const modulePath = '/src/stores/domains/widget/global.ts'
    const { useGlobalStore } = (await import(/* @vite-ignore */ modulePath)) as {
      useGlobalStore: (pinia?: unknown) => { updateCurrentSessionRoomId: (roomId: string) => void }
    }
    useGlobalStore(runtimeWindow.pinia).updateCurrentSessionRoomId(roomId)
  }, targetRoomId)
}

export const openConfiguredRoom = async (page: Page, env: MatrixLiveEnv): Promise<string> => {
  const candidates = await resolveMatrixLiveRoomCandidates(page, env.roomId, env.roomName)
  const requestedRoomExists = Boolean(
    candidates.requestedRoom &&
      (candidates.requestedRoom.clientHasRoom ||
        candidates.requestedRoom.sessionHasRoom ||
        candidates.requestedRoom.roomStoreHasRoom)
  )

  if (env.roomId && requestedRoomExists) {
    const roomLocator = page.locator(`[data-test="session-item-${env.roomId}"]`).first()
    const visibleRoomCount = await roomLocator.count()
    if (visibleRoomCount > 0) {
      await roomLocator.dispatchEvent('click')
    } else {
      await selectRoomById(page, env.roomId)
    }

    await expect
      .poll(() => getCurrentSessionRoomId(page), {
        timeout: 120_000,
        message: '等待前端按 roomId 完成会话切换'
      })
      .toBe(env.roomId)

    return env.roomId
  }

  if (env.roomName) {
    const fallbackRoomId = candidates.roomNameMatches[0]
    if (fallbackRoomId) {
      await selectRoomById(page, fallbackRoomId)

      await expect
        .poll(() => getCurrentSessionRoomId(page), {
          timeout: 120_000,
          message: '等待前端按 roomName 匹配到实际 roomId 并完成会话切换'
        })
        .toBe(fallbackRoomId)

      return fallbackRoomId
    }

    await page.getByText(env.roomName, { exact: false }).first().click()
    await expect
      .poll(() => getCurrentSessionRoomId(page), {
        timeout: 120_000,
        message: '等待前端按 roomName 完成会话切换'
      })
      .not.toBe('')
    return await getCurrentSessionRoomId(page)
  }

  throw new Error('缺少 MATRIX_LIVE_ROOM_ID 或 MATRIX_LIVE_ROOM_NAME，无法定位目标房间')
}

export const sendTextMessageToRoom = async (page: Page, roomId: string, text: string): Promise<string> => {
  try {
    const result = await page.evaluate(
      async ({ targetRoomId, body }: { targetRoomId: string; body: string }) => {
        try {
          const modulePath = '/src/services/matrix/MatrixEventService.ts'
          const { matrixEventService } = (await import(/* @vite-ignore */ modulePath)) as {
            matrixEventService: {
              sendTextMessage: (roomId: string, body: string) => Promise<string>
            }
          }
          const eventId = await matrixEventService.sendTextMessage(targetRoomId, body)
          return { ok: true as const, eventId }
        } catch (error) {
          const plainError =
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack ?? null
                }
              : {
                  name: 'NonError',
                  message: String(error),
                  stack: null
                }
          return { ok: false as const, error: plainError }
        }
      },
      { targetRoomId: roomId, body: text }
    )
    if (!result.ok) {
      throw new Error(`${result.error.name}: ${result.error.message}`)
    }
    return result.eventId
  } catch (error) {
    const snapshot = await collectMatrixLiveSessionDebugSnapshot(page, roomId)
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${message}\nmatrix-live snapshot: ${JSON.stringify(snapshot)}`)
  }
}

export const roomContainsMessage = async (page: Page, roomId: string, text: string): Promise<boolean> => {
  return page.evaluate(
    async ({ targetRoomId, expectedText }: { targetRoomId: string; expectedText: string }) => {
      const runtimeWindow = window as Window & { pinia?: unknown }
      const modulePath = '/src/stores/domains/chat/chat/index.ts'
      const { useChatStore } = (await import(/* @vite-ignore */ modulePath)) as {
        useChatStore: (pinia?: unknown) => {
          chatMessageListByRoomId: (roomId: string) => Array<{
            message: {
              body:
                | string
                | {
                    content?: string
                    body?: string
                  }
            }
          }>
        }
      }
      const chatStore = useChatStore(runtimeWindow.pinia)

      return chatStore
        .chatMessageListByRoomId(targetRoomId)
        .some((item: { message: { body: string | { content?: string; body?: string } } }) => {
          const body = item.message.body
          if (typeof body === 'string') {
            return body.includes(expectedText)
          }
          if (body && typeof body === 'object') {
            const candidate =
              typeof body.content === 'string' ? body.content : typeof body.body === 'string' ? body.body : ''
            return candidate.includes(expectedText)
          }
          return false
        })
    },
    { targetRoomId: roomId, expectedText: text }
  )
}

export const resolveLiveTimelineTextCandidate = async (
  page: Page,
  roomId: string,
  preferredText?: string
): Promise<string | null> => {
  return page.evaluate(
    async ({ targetRoomId, configuredText }: { targetRoomId: string; configuredText?: string }) => {
      const runtimeWindow = window as Window & { pinia?: unknown }
      const importBrowserModule = <T>(modulePath: string): Promise<T> =>
        import(/* @vite-ignore */ modulePath) as Promise<T>
      const [{ useMatrixStore }, { useChatStore }] = await Promise.all([
        importBrowserModule<{ useMatrixStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/matrix.ts'),
        importBrowserModule<{ useChatStore: (pinia?: unknown) => any }>('/src/stores/domains/chat/chat/index.ts')
      ])

      const matrixStore = useMatrixStore(runtimeWindow.pinia)
      const chatStore = useChatStore(runtimeWindow.pinia)
      const client = matrixStore.getClient?.()
      const room = client?.getRoom?.(targetRoomId)
      const chatMessages = chatStore.chatMessageListByRoomId(targetRoomId) ?? []
      const timelineEvents = room?.getLiveTimeline?.()?.getEvents?.() ?? []

      const normalizeText = (value: unknown): string => {
        if (typeof value === 'string') {
          return value.trim()
        }
        return ''
      }
      const isUsableText = (value: string): boolean => {
        return Boolean(value) && !value.includes('Unable to decrypt')
      }

      if (configuredText) {
        const normalizedConfiguredText = normalizeText(configuredText)
        const configuredExistsInChat = chatMessages.some(
          (item: { message: { body?: string | { content?: string; body?: string } } }) => {
            const body = item.message.body
            const candidate =
              typeof body === 'string'
                ? body
                : typeof body?.content === 'string'
                  ? body.content
                  : typeof body?.body === 'string'
                    ? body.body
                    : ''
            return candidate.includes(normalizedConfiguredText)
          }
        )
        if (configuredExistsInChat) {
          return normalizedConfiguredText
        }
      }

      const timelineCandidate = [...timelineEvents]
        .reverse()
        .map((event: { getType?: () => string; getContent?: () => Record<string, unknown> }) => {
          const content = event.getContent?.() ?? {}
          if (event.getType?.() !== 'm.room.message') {
            return ''
          }
          return normalizeText(content.body)
        })
        .find(isUsableText)

      if (timelineCandidate) {
        return timelineCandidate
      }

      const chatCandidate = [...chatMessages]
        .reverse()
        .map((item: { message: { body?: string | { content?: string; body?: string } } }) => {
          const body = item.message.body
          return normalizeText(
            typeof body === 'string'
              ? body
              : typeof body?.content === 'string'
                ? body.content
                : typeof body?.body === 'string'
                  ? body.body
                  : ''
          )
        })
        .find(isUsableText)

      return chatCandidate ?? null
    },
    { targetRoomId: roomId, configuredText: preferredText }
  )
}

export const createLiveProbeMessage = (env: MatrixLiveEnv): string => {
  return `${env.messagePrefix} ${new Date().toISOString()}`
}
