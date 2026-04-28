/// <reference types="node" />
import { expect, type Page } from '@playwright/test'

const MATRIX_HOMESERVER_STORAGE_KEY = 'hula-homeserver-url'
const MATRIX_IDENTITY_SERVER_STORAGE_KEY = 'hula-identity-server-url'
const E2E_STORAGE_KEY = 'hula:e2e:enabled'
const PLATFORM_STORAGE_KEY = 'hula:e2e:platform'
const MOCK_AUTH_STORAGE_KEY = 'hula:e2e:mock-auth'
const SEEDED_WORKBENCH_STORAGE_KEY = 'hula:e2e:seed-workbench'

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

const readEnv = (name: string): string => process.env[name]?.trim() ?? ''

const isEnabledFlag = (value: string): boolean => value === '1' || value.toLowerCase() === 'true'

export const readMatrixLiveEnv = (): MatrixLiveEnv => ({
  enabled: isEnabledFlag(readEnv('MATRIX_LIVE_E2E')),
  authStrategy: (readEnv('MATRIX_LIVE_AUTH_STRATEGY') || 'password-api') as MatrixLiveAuthStrategy,
  homeserverUrl: readEnv('MATRIX_LIVE_HOMESERVER_URL'),
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
    ({ homeserverUrl, identityServerUrl }: { homeserverUrl: string; identityServerUrl: string }) => {
      window.localStorage.setItem(E2E_STORAGE_KEY, '1')
      window.localStorage.setItem(PLATFORM_STORAGE_KEY, 'desktop')
      window.localStorage.removeItem(MOCK_AUTH_STORAGE_KEY)
      window.localStorage.removeItem(SEEDED_WORKBENCH_STORAGE_KEY)
      window.localStorage.setItem(MATRIX_HOMESERVER_STORAGE_KEY, homeserverUrl)
      if (identityServerUrl) {
        window.localStorage.setItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY, identityServerUrl)
      } else {
        window.localStorage.removeItem(MATRIX_IDENTITY_SERVER_STORAGE_KEY)
      }
    },
    {
      homeserverUrl: env.homeserverUrl,
      identityServerUrl: env.identityServerUrl
    }
  )

  await page.goto(env.appUrl)
  await page.waitForSelector('#app', { state: 'visible' })
}

const waitForMatrixLoggedIn = async (page: Page): Promise<void> => {
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const modulePath = '/src/stores/domains/chat/matrix.ts'
          const { useMatrixStore } = (await import(/* @vite-ignore */ modulePath)) as {
            useMatrixStore: () => { isLoggedIn: boolean; userId?: string | null }
          }
          const matrixStore = useMatrixStore()
          return Boolean(matrixStore.isLoggedIn && matrixStore.userId)
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

  await page.evaluate(
    async (options: Record<string, string>) => {
      const modulePath = '/src/services/matrix/auth/MatrixRuntimeSessionService.ts'
      const { matrixRuntimeSessionService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixRuntimeSessionService: {
          loginWithPassword: (options: Record<string, unknown>) => Promise<unknown>
        }
      }

      await matrixRuntimeSessionService.loginWithPassword({
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
    },
    {
      username: credentials.username,
      password: credentials.password,
      displayName: credentials.displayName,
      homeserverUrl: env.homeserverUrl,
      identityServerUrl: env.identityServerUrl
    }
  )
}

const restoreWithAccessToken = async (page: Page, env: MatrixLiveEnv, actor: MatrixLiveActor): Promise<void> => {
  const credentials = resolveActorCredentials(env, actor)

  await page.evaluate(
    async (options: Record<string, string>) => {
      const modulePath = '/src/services/matrix/auth/MatrixRuntimeSessionService.ts'
      const { matrixRuntimeSessionService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixRuntimeSessionService: {
          restoreWithAccessToken: (options: Record<string, unknown>) => Promise<unknown>
        }
      }

      await matrixRuntimeSessionService.restoreWithAccessToken({
        uid: options.userId,
        accessToken: options.accessToken,
        refreshToken: options.refreshToken || undefined,
        displayName: options.displayName || options.username || options.userId,
        account: options.username || options.userId,
        client: 'PC',
        persistTokens: false,
        persistUserInfo: false,
        switchDatabase: false,
        bootstrapAfterRestore: true
      })
    },
    {
      username: credentials.username,
      userId: credentials.userId,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      displayName: credentials.displayName
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
  await expect(page.locator('[data-test="message-page"]')).toBeVisible()
}

export const waitForLiveSessions = async (page: Page): Promise<void> => {
  await expect
    .poll(() => page.locator('[data-test^="session-item-"]').count(), {
      timeout: 120_000,
      message: '等待消息会话列表加载'
    })
    .toBeGreaterThan(0)
}

export const openConfiguredRoom = async (page: Page, env: MatrixLiveEnv): Promise<void> => {
  if (env.roomId) {
    const roomLocator = page.locator(`[data-test="session-item-${env.roomId}"]`).first()
    await expect(roomLocator).toHaveCount(1, { timeout: 120_000 })
    await roomLocator.dispatchEvent('click')
    return
  }

  if (env.roomName) {
    await page.getByText(env.roomName, { exact: false }).first().click()
    return
  }

  throw new Error('缺少 MATRIX_LIVE_ROOM_ID 或 MATRIX_LIVE_ROOM_NAME，无法定位目标房间')
}

export const sendTextMessageToRoom = async (page: Page, roomId: string, text: string): Promise<string> => {
  return page.evaluate(
    async ({ targetRoomId, body }: { targetRoomId: string; body: string }) => {
      const modulePath = '/src/stores/domains/chat/room.ts'
      const { useRoomStore } = (await import(/* @vite-ignore */ modulePath)) as {
        useRoomStore: () => {
          sendMessage: (roomId: string, content: { type: 'text'; text: string }) => Promise<string>
        }
      }
      const roomStore = useRoomStore()
      return roomStore.sendMessage(targetRoomId, { type: 'text', text: body })
    },
    { targetRoomId: roomId, body: text }
  )
}

export const roomContainsMessage = async (page: Page, roomId: string, text: string): Promise<boolean> => {
  return page.evaluate(
    async ({ targetRoomId, expectedText }: { targetRoomId: string; expectedText: string }) => {
      const modulePath = '/src/stores/domains/chat/chat/index.ts'
      const { useChatStore } = (await import(/* @vite-ignore */ modulePath)) as {
        useChatStore: () => {
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
      const chatStore = useChatStore()

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

export const createLiveProbeMessage = (env: MatrixLiveEnv): string => {
  return `${env.messagePrefix} ${new Date().toISOString()}`
}
