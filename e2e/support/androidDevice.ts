/// <reference types="node" />
import { type Browser, chromium, expect, type Page } from '@playwright/test'
import { dismissLocalUnlockDialog as dismissLocalUnlockGate } from './localUnlockGate'

/**
 * Android 真机（模拟器）侧的 Playwright 支撑。
 *
 * 与 `matrixLive.ts` 的关系：那边内联了一份功能更全的 Tauri shim（还带 storage 播种），
 * 是桌面 live 用例的既有路径。这里只保留「真机 Chrome + 移动 UI」必需的最小集合，
 * **不重复实现那套 storage 播种**（drift 风险见报告 F-8）。
 * 两份 shim 若日后分叉，以本文件的 `invoke` 白名单为移动端判据。
 */

/**
 * 关闭「设置本地解锁密码」门禁弹窗。
 *
 * 实现放在 `localUnlockGate.ts`（`matrixLive.ts` 的 bootstrap 也用它），
 * 这里保留同名出口，让跨设备用例只依赖 `androidDevice` 一个模块。
 */
export const dismissLocalUnlockDialog = (page: Page, timeoutMs?: number): Promise<boolean> =>
  dismissLocalUnlockGate(page, timeoutMs)

export interface AndroidDevice {
  browser: Browser
  page: Page
  /** 关掉 CDP 连接（不 kill 模拟器） */
  close: () => Promise<void>
}

const APP_ORIGIN_HINT = '5210'

/**
 * 连接设备 Chrome 的 DevTools（需先 `adb forward tcp:9222 localabstract:chrome_devtools_remote`）。
 *
 * 复用已停在目标站点的标签，否则新开一个 —— 设备上常残留历史错误页
 * （`chrome-error://chromewebdata`），`pages()[0]` 会随机命中它。
 */
export const connectAndroidDevice = async (cdpUrl: string, appUrl: string): Promise<AndroidDevice> => {
  const browser = await chromium.connectOverCDP(cdpUrl)
  const context = browser.contexts()[0]
  if (!context) {
    throw new Error('设备上没有可用的浏览器上下文（Chrome 是否已启动？）')
  }
  const origin = new URL(appUrl).origin
  const existing = context.pages().find((p) => p.url().startsWith(origin) || p.url().includes(APP_ORIGIN_HINT))
  const page = existing ?? context.pages()[0] ?? (await context.newPage())
  return { browser, page, close: () => browser.close() }
}

/**
 * 注入 Tauri 运行时 shim。
 *
 * 为什么必须：移动 UI 启动时要等 `is_app_state_ready`（Rust 侧命令）。纯浏览器里该 invoke
 * 永远没有响应 ⇒ 启动停在 splash（进度 0），路由与登录表单都不会渲染。
 */
export const installBrowserTauriShim = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const runtimeWindow = window as Window & {
      __TAURI_INTERNALS__?: Record<string, unknown>
      __TJG_TAURI_CALLBACKS__?: Map<number, unknown>
      __TJG_TAURI_CALLBACK_ID__?: number
      __TJG_TAURI_EVENT_LISTENERS__?: Map<string, Set<number>>
      __TAURI_EVENT_PLUGIN_INTERNALS__?: { unregisterListener: (event: string, id: number) => void }
    }
    if (runtimeWindow.__TAURI_INTERNALS__) return

    runtimeWindow.__TJG_TAURI_CALLBACKS__ = new Map()
    runtimeWindow.__TJG_TAURI_CALLBACK_ID__ = 0
    runtimeWindow.__TJG_TAURI_EVENT_LISTENERS__ = new Map()
    runtimeWindow.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} }
    runtimeWindow.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      async invoke(cmd: string, args?: Record<string, unknown>) {
        if (cmd === 'is_app_state_ready') return true
        // 与真实 Rust 侧保持同形：会话恢复会读这个命令，返回 undefined 会被误判成「未登录」。
        if (cmd === 'get_user_tokens') {
          return { token: localStorage.getItem('tjg.matrix.accessToken'), refreshToken: null }
        }
        if (cmd.includes('get_all_windows') || cmd.includes('get_all_webviews')) return []
        if (cmd === 'plugin:window|title') return 'HuLa'
        if (cmd === 'plugin:event|listen') return args?.handler ?? 0
        if (cmd === 'plugin:event|unlisten') return null
        return undefined
      },
      transformCallback: () => 1,
      unregisterCallback: () => {},
      callbacks: new Map(),
      convertFileSrc: (path: string) => path
    }
  })
}

/**
 * 点击一个「Playwright actionability 判定不过」的元素。
 *
 * 为什么不用 `locator.click()`：vant 控件外层有 pointer-events 包装层，
 * naive-ui 的弹窗 teleport 容器（`.n-modal-container`，实测 0×0）又留在 hit-test 链上，
 * `click()` 会一直等可点击性直到超时。
 *
 * 为什么也不用坐标 `mouse.click()`：实测被透明遮罩拦截时坐标点击**静默无效**
 * （表单照旧渲染、按钮照旧 enabled、无 toast），排查成本极高；
 * `el.click()` 直接派发到元素、绕过 hit-test，表单提交与 checkbox 切换都能生效。
 */
const clickAt = async (page: Page, selector: string): Promise<void> => {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return false
    el.scrollIntoView({ block: 'center' })
    el.click()
    return true
  }, selector)
  if (!clicked) throw new Error(`找不到可点击元素: ${selector}`)
  await page.waitForTimeout(150) // 留一帧给 Vue 的响应式更新
}

/**
 * 尽力清掉设备上已有的登录态（失败不致命）。
 *
 * 场景：上一轮用例留在设备上的会话会让客户端处于「已初始化」状态，此时移动端登录页虽然
 * 正常渲染，但点击「登录」不会有任何反应（无 toast、无跳转），排查成本很高。
 * 这里先调用应用自己的 logout（清理 token + 停客户端），再走登录表单。
 */
const clearExistingSession = async (page: Page, appUrl: string): Promise<void> => {
  if (!page.url().startsWith(appUrl)) return
  await page
    .evaluate(async () => {
      const modulePath = '/src/services/matrix/MatrixClientService.ts'
      const { matrixClientService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixClientService: { getClient: () => unknown; logout: () => Promise<void> }
      }
      if (!matrixClientService.getClient()) return
      await matrixClientService.logout()
    })
    .catch(() => {})
  await page.waitForTimeout(500)
}

export interface MobileLoginOptions {
  appUrl: string
  account: string
  password: string
  timeoutMs?: number
}

/** 移动登录表单的锚点（表单容器先出现、input 后挂载）。 */
const MOBILE_LOGIN_FORM_SELECTOR = 'form[data-testid="mobile-login-form"]'

/** 登录成功后的落点：消息列表或聊天页。 */
const MOBILE_LANDED_PATH_RE = /\/mobile\/(message|chatRoom)/

/**
 * 「已登录视图」判据（F5 修法的第二判据）。
 *
 * 只看 URL 会漏掉「页面已登录但 SPA 重定向没跟上」的情况；这里用**与语言无关**的结构判据：
 * 主导航里出现 `/mobile/message` 或 `/mobile/my` 链接，且登录表单已消失。
 * 不用 `aria-label` 文案（会随语言变化）。
 */
const isMobileLoggedInView = async (page: Page): Promise<boolean> => {
  try {
    return await page.evaluate(
      ({ formSelector }) => {
        const hasNav = Boolean(document.querySelector('nav a[href="/mobile/message"], nav a[href="/mobile/my"]'))
        const hasLoginForm = Boolean(document.querySelector(formSelector))
        return hasNav && !hasLoginForm
      },
      { formSelector: MOBILE_LOGIN_FORM_SELECTOR }
    )
  } catch {
    return false
  }
}

/**
 * 在移动 UI 上完成一次真实登录（走页面表单，不走 API 直连）。
 *
 * 三个已知的交互细节，都是实测出来的，不是猜的：
 * 1. 必须带 `?platform=mobile` —— 浏览器里 `getOsType()` 不可用（`@tauri-apps/plugin-os` 抛错），
 *    平台会 fallback 成 desktop，`/mobile/*` 路由根本没注册（直接 404）。
 * 2. 协议勾选要点 `.van-checkbox__icon` 的坐标：`.van-checkbox` wrapper 的中心落在图标左侧，
 *    Playwright 认为命中目标不是它，点击会超时。
 * 3. 提交按钮用坐标点击，理由同上（vant 按钮外层有 `pointer-events` 包装层）。
 */
export const loginOnMobileUi = async (page: Page, options: MobileLoginOptions): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? 120_000
  // 分段超时（修 F5）：以前「表单可见」和「落点」共用 120s，前一段慢掉后一段就没时间了，
  // 最终被测试级超时打断，拿不到我们自己的诊断信息。现在每段独立封顶 60s。
  const formTimeoutMs = Math.min(timeoutMs, 60_000)
  const landingTimeoutMs = Math.min(timeoutMs, 60_000)
  await installBrowserTauriShim(page)

  // 浏览器态必须把 homeserver 指到应用同源（Vite 的 `/_matrix` 代理）。
  // 因为注入了 Tauri shim，`shouldUseMatrixDevProxy()` 会判定"处于 Tauri 运行时"而不做代理重写，
  // 页面会直连 8008，被 index.html 的 CSP `connect-src` 拦截（登录表现为 Failed to fetch）。
  await page.addInitScript((appUrl: string) => {
    try {
      window.localStorage.setItem('tjg-homeserver-url', appUrl)
      window.localStorage.setItem('tjg-session-homeserver-url', appUrl)
    } catch {
      // localStorage 不可用时保持默认配置，后续登录失败会给出更直接的错误
    }
  }, options.appUrl)

  // 设备上可能残留上一轮的会话：客户端已初始化时，登录页照常渲染但点击提交不会有任何反应
  // （`normalLogin` 走不通，也看不到错误提示）。所以先尽量把旧会话登出，保证「干净登录」。
  await clearExistingSession(page, options.appUrl)

  // 登录失败时页面只剩一张空表单（toast 早已消失），没有日志几乎无法定位。
  // 这里保留最近的 console 错误与失败请求，失败时拼进异常信息。
  const diagnostics: string[] = []
  const onConsole = (message: { type: () => string; text: () => string }): void => {
    if (message.type() === 'error') diagnostics.push(`console: ${message.text().slice(0, 300)}`)
  }
  const onRequestFailed = (request: { url: () => string; failure: () => { errorText: string } | null }): void => {
    diagnostics.push(`request-failed: ${request.url().slice(0, 200)} ${request.failure()?.errorText ?? ''}`)
  }
  const onResponse = (response: { url: () => string; status: () => number }): void => {
    const url = response.url()
    if (url.includes('/_matrix/') && response.status() >= 400) {
      diagnostics.push(`HTTP ${response.status()}: ${url.slice(0, 200)}`)
    }
  }
  page.on('console', onConsole)
  page.on('requestfailed', onRequestFailed)
  page.on('response', onResponse)

  await page.goto(`${options.appUrl}/mobile/login?platform=mobile`, { waitUntil: 'domcontentloaded' })
  await dismissLocalUnlockDialog(page)

  const form = page.locator(MOBILE_LOGIN_FORM_SELECTOR)
  // ⚠️ 只等 `attached`，不等 visible：解锁门禁弹层会把登录表单**盖住**
  // （元素在 DOM 里但不可见），等 visible 会白等到超时（实测 120s 超时，页面其实是好的）。
  await form.waitFor({ state: 'attached', timeout: formTimeoutMs })
  // 表单容器先出现、内部 input 稍后才挂载（Vue 分步渲染 + 首屏资源竞争）。
  // 直接 nth(1).fill() 会在 input 尚未存在时抛 "element(s) not found"，
  // 看起来像登录失败，实际是时序问题。等够 3 个 input 再填；等待期间顺手点掉门禁弹层。
  //
  // ⚠️ 门禁处置的两个坑（2026-11-19 实测，`my-hub-live` 多条用例因此 flaky）：
  // 1. `dismissLocalUnlockDialog` 的 timeout 是「等弹窗出现」的上限；原先给 300ms，
  //    而弹窗有进场动画，常常等不到 attached 就返回 false ⇒ 「点了但没点到」，
  //    下一轮表单照样被遮，直到吃满 formTimeoutMs。这里给 1s。
  // 2. 只要门禁仍在，就**直接返回 0**：逼 poll 继续等到它真的消失。否则可能数到
  //    「被遮住时的中间态 input 数量」，把尚未完成的渲染当成结果。
  //    门禁会在 App 启动与 crypto 初始化两个阶段各出现一次（见 `localUnlockGate.ts`）。
  const GATE_SKIP_SELECTOR = '[data-test="local-unlock-skip"]'
  await expect
    .poll(
      async () => {
        await dismissLocalUnlockDialog(page, 1_000)
        const gateStillThere = await page
          .locator(GATE_SKIP_SELECTOR)
          .first()
          .isVisible()
          .catch(() => false)
        if (gateStillThere) return 0
        return form.locator('input').count()
      },
      { timeout: formTimeoutMs, message: '登录表单未渲染出 3 个输入框（可能被解锁门禁遮住）' }
    )
    .toBeGreaterThanOrEqual(3)
  // 第 0 个 input 是服务器地址（通常已由 env 预填），第 1/2 个才是账号与密码
  await form.locator('input').nth(1).fill(options.account)
  await form.locator('input').nth(2).fill(options.password)

  const submit = page.locator('[data-testid="mobile-login-submit"]')
  if (await submit.isDisabled()) {
    await clickAt(page, '.van-checkbox__icon')
    await page.waitForTimeout(300)
  }
  if (await submit.isDisabled()) {
    throw new Error('登录按钮仍为禁用态（账号/密码/协议勾选未全部满足）')
  }
  await clickAt(page, '[data-testid="mobile-login-submit"]')

  // 登录提交后 crypto 初始化会再次触发「设置本地解锁密码」门禁，弹窗会挡住路由跳转；
  // 只在跳转成功后才 dismiss 会永远等不到 URL 变化，所以等待期间持续「发现即点掉」。
  //
  // 落点判据是**双判据**（修 F5）：
  // - `url`：pathname 命中 `/mobile/(message|chatRoom)`；
  // - `view`：已渲染登录后的主导航且登录表单已消失（URL 尚未跟上，SPA 重定向慢/被覆盖）。
  //   以前只认 URL ⇒ 页面明明已登录却一直轮询到超时（两轮对照里 2 条用例就是这么红的）。
  const deadline = Date.now() + landingTimeoutMs
  let landed = false
  let landedBy: 'url' | 'view' | null = null
  while (Date.now() < deadline) {
    if (MOBILE_LANDED_PATH_RE.test(new URL(page.url()).pathname)) {
      landed = true
      landedBy = 'url'
      break
    }
    if (await isMobileLoggedInView(page)) {
      landed = true
      landedBy = 'view'
      break
    }
    await dismissLocalUnlockDialog(page, 500)
    await page.waitForTimeout(200)
  }
  // URL 没跟上但已登录：纠正落点，避免后续断言一直停在 `/mobile/login`
  if (landed && landedBy === 'view' && !MOBILE_LANDED_PATH_RE.test(new URL(page.url()).pathname)) {
    await page
      .evaluate(async () => {
        const router = (
          document.querySelector('#app') as
            | (HTMLElement & {
                __vue_app__?: { config: { globalProperties: { $router?: { push?: (p: string) => Promise<unknown> } } } }
              })
            | null
        )?.__vue_app__?.config?.globalProperties?.$router
        await router?.push?.('/mobile/message')
      })
      .catch(() => {})
    await page.waitForTimeout(500)
  }
  if (!landed) {
    const state = await page.evaluate(
      ({ formSelector }) => ({
        url: `${location.pathname}${location.search}`,
        hasLoginForm: Boolean(document.querySelector(formSelector)),
        hasLoggedInNav: Boolean(document.querySelector('nav a[href="/mobile/message"]')),
        text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
        submitDisabled: (document.querySelector('[data-testid="mobile-login-submit"]') as HTMLButtonElement | null)
          ?.disabled
      }),
      { formSelector: MOBILE_LOGIN_FORM_SELECTOR }
    )
    page.off('console', onConsole)
    page.off('requestfailed', onRequestFailed)
    page.off('response', onResponse)
    throw new Error(
      `移动端登录后未跳转（landingTimeout=${landingTimeoutMs}ms）：${JSON.stringify(state)}\n诊断：${diagnostics.slice(-10).join('\n')}`
    )
  }
  page.off('console', onConsole)
  page.off('requestfailed', onRequestFailed)
  page.off('response', onResponse)
  // 登录后可能再次弹出解锁门禁（crypto 初始化在登录之后），再关一次
  await dismissLocalUnlockDialog(page, 5000)
}

/** 读取设备端当前登录用户（SDK 侧，不依赖 UI 文本） */
export const readLoggedInUserId = async (page: Page): Promise<string | null> =>
  page.evaluate(async () => {
    const modulePath = '/src/services/matrix/MatrixClientService.ts'
    const { matrixClientService } = (await import(/* @vite-ignore */ modulePath)) as {
      matrixClientService: { getClient: () => { getUserId?: () => string | null } | null }
    }
    return matrixClientService.getClient()?.getUserId?.() ?? null
  })

/**
 * 读取某房间在**该客户端**上的消息正文（live timeline）。
 *
 * 用 timeline 而不是 chat store：chat store 只保留「打开过/已加载」的房间，
 * 而 timeline 反映的是 SDK 是否真的把事件同步到了这台设备 —— 正是跨设备要验的东西。
 */
export const readTimelineBodies = async (page: Page, roomId: string): Promise<string[]> =>
  page.evaluate(
    async ({ targetRoomId }) => {
      const modulePath = '/src/services/matrix/MatrixClientService.ts'
      const { matrixClientService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixClientService: {
          getClient: () => {
            getRoom?: (id: string) => {
              getLiveTimeline?: () => {
                getEvents?: () => Array<{
                  getType?: () => string
                  getContent?: () => Record<string, unknown>
                }>
              }
            } | null
          } | null
        }
      }
      const room = matrixClientService.getClient()?.getRoom?.(targetRoomId)
      const events = room?.getLiveTimeline?.()?.getEvents?.() ?? []
      return events
        .filter((event) => event.getType?.() === 'm.room.message')
        .map((event) => String(event.getContent?.()?.body ?? ''))
    },
    { targetRoomId: roomId }
  )

/** 用设备端自己的 session 往房间发一条文本消息（返回 event_id） */
export const sendTextFromDevice = async (page: Page, roomId: string, body: string): Promise<string> =>
  page.evaluate(
    async ({ targetRoomId, text }) => {
      const modulePath = '/src/services/matrix/MatrixEventService.ts'
      const { matrixEventService } = (await import(/* @vite-ignore */ modulePath)) as {
        matrixEventService: { sendTextMessage: (roomId: string, body: string) => Promise<string> }
      }
      return await matrixEventService.sendTextMessage(targetRoomId, text)
    },
    { targetRoomId: roomId, text: body }
  )
