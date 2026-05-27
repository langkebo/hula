import { chromium } from 'playwright'

const APP_URL = 'http://127.0.0.1:5210'
const HOMESERVER_URL = 'https://matrix.test'
const USER_ID = process.env.MATRIX_LIVE_USER_ID ?? ''
const ACCESS_TOKEN = process.env.MATRIX_LIVE_ACCESS_TOKEN ?? ''

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

page.on('console', (message) => {
  console.log(`[browser:${message.type()}] ${message.text()}`)
})

await page.addInitScript(({ homeserverUrl }) => {
  const runtimeWindow = window

  if (!runtimeWindow.__TAURI_INTERNALS__) {
    runtimeWindow.__HULA_TAURI_CALLBACKS__ = new Map()
    runtimeWindow.__HULA_TAURI_CALLBACK_ID__ = 0
    runtimeWindow.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'home' },
        currentWebview: { label: 'home' }
      },
      async invoke(cmd) {
        if (cmd === 'is_app_state_ready') return true
        if (cmd === 'plugin:window|get_all_windows' || cmd === 'plugin:webview|get_all_webviews') return []
        if (cmd === 'plugin:window|title') return 'HuLa'
        if (cmd.includes('register_listener') || cmd.includes('registerListener') || cmd.includes('remove_listener')) {
          return null
        }
        return undefined
      },
      transformCallback(callback) {
        const nextId = (runtimeWindow.__HULA_TAURI_CALLBACK_ID__ ?? 0) + 1
        runtimeWindow.__HULA_TAURI_CALLBACK_ID__ = nextId
        runtimeWindow.__HULA_TAURI_CALLBACKS__?.set(nextId, callback)
        return nextId
      },
      unregisterCallback(id) {
        runtimeWindow.__HULA_TAURI_CALLBACKS__?.delete(id)
      },
      convertFileSrc(filePath) {
        return filePath
      }
    }
  }

  window.localStorage.setItem('hula:e2e:enabled', '1')
  window.localStorage.setItem('hula:e2e:platform', 'desktop')
  window.localStorage.removeItem('hula:e2e:mock-auth')
  window.localStorage.removeItem('hula:e2e:seed-workbench')
  window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
  window.localStorage.setItem('hula-homeserver-url', homeserverUrl)
}, { homeserverUrl: HOMESERVER_URL })

await page.goto(APP_URL)
await page.waitForFunction(() => window.__HULA_APP_READY__ === true, undefined, { timeout: 120_000 })

const importResult = await Promise.race([
  page.evaluate(async () => {
    window.__MATRIX_LIVE_RESTORE_STAGE__ = 'loading-session-orchestrator'
    await import('/src/services/matrix/auth/SessionOrchestrator.ts')
    window.__MATRIX_LIVE_RESTORE_STAGE__ = 'session-orchestrator-loaded'
    return {
      ok: true,
      stage: window.__MATRIX_LIVE_RESTORE_STAGE__
    }
  }),
  new Promise((resolve) => {
    setTimeout(async () => {
      const stage = await page.evaluate(() => window.__MATRIX_LIVE_RESTORE_STAGE__ ?? 'unset')
      resolve({
        ok: false,
        timeout: true,
        stage
      })
    }, 30_000)
  })
])

console.log(JSON.stringify({ step: 'import', result: importResult }))

if (USER_ID && ACCESS_TOKEN) {
  const restoreResult = await page.evaluate(
    async ({ userId, accessToken }) => {
      const runtimeWindow = window
      runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'loading-session-orchestrator'

      const [{ sessionOrchestrator }, { useInitialSyncStore }, routerModule] = await Promise.all([
        import('/src/services/matrix/auth/SessionOrchestrator.ts'),
        import('/src/stores/domains/chat/initialSync.ts'),
        import('/src/router/index.ts')
      ])

      runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'restoring'
      await Promise.race([
        sessionOrchestrator.restoreWithAccessToken({
          uid: userId,
          accessToken,
          refreshToken: undefined,
          displayName: userId,
          account: userId,
          client: 'PC',
          persistTokens: false,
          persistUserInfo: false,
          switchDatabase: false,
          bootstrapAfterRestore: false
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`restore stage timeout: ${runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__}`))
          }, 45_000)
        })
      ])

      runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__ = 'restored'
      useInitialSyncStore(window.pinia).markSynced(userId)
      await routerModule.default.push('/message')
      await new Promise((resolve) => setTimeout(resolve, 5000))

      const [{ useMatrixStore }, { useRoomStore }, { useSessionStore }, { getMatrixSessionSnapshot }, { getCurrentUserInfo }] =
        await Promise.all([
          import('/src/stores/domains/chat/matrix.ts'),
          import('/src/stores/domains/chat/room.ts'),
          import('/src/stores/domains/chat/chat/session.ts'),
          import('/src/services/matrix/matrixSessionState.ts'),
          import('/src/common/currentUserState.ts')
        ])

      const matrixStore = useMatrixStore(window.pinia)
      const roomStore = useRoomStore(window.pinia)
      const sessionStore = useSessionStore(window.pinia)
      const sessionSnapshot = getMatrixSessionSnapshot()
      const currentUser = getCurrentUserInfo()

      return {
        route: window.location.pathname,
        stage: runtimeWindow.__MATRIX_LIVE_RESTORE_STAGE__,
        messageListPage: !!document.querySelector('.message-list-page'),
        messageToolbar: !!document.querySelector('.message-session-toolbar'),
        domSessionItems: document.querySelectorAll('[role="list"] [role="listitem"]').length,
        overlayVisible: !!document.querySelector('#layout .absolute.inset-0.z-10'),
        matrix: {
          isLoggedIn: matrixStore.isLoggedIn,
          userId: matrixStore.userId,
          accessTokenPresent: !!matrixStore.accessToken,
          connectionState: matrixStore.connectionState,
          syncState: matrixStore.syncState,
          lastError: matrixStore.lastError
        },
        sessionSnapshot,
        currentUser,
        rooms: {
          count: roomStore.roomList.length,
          sample: roomStore.roomList.slice(0, 5).map((room) => ({
            roomId: room.roomId,
            name: room.name,
            lastMessage: room.lastMessage,
            unreadCount: room.unreadCount
          }))
        },
        sessions: {
          count: sessionStore.sessionList.length,
          sample: sessionStore.sessionList.slice(0, 5).map((session) => ({
            roomId: session.roomId,
            name: session.name,
            unreadCount: session.unreadCount,
            activeTime: session.activeTime
          }))
        },
        bodyText: document.body.innerText.slice(0, 1500)
      }
    },
    {
      userId: USER_ID,
      accessToken: ACCESS_TOKEN
    }
  )

  console.log(JSON.stringify({ step: 'restore', result: restoreResult }))
}

await browser.close()
