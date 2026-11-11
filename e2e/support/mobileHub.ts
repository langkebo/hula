import type { Page } from '@playwright/test'
import { E2E_STORAGE_KEYS, WEB_SESSION_FALLBACK_STORAGE_KEY } from '../../src/utils/storageKeys'

/**
 * 移动端「我的」页相关用例的共用工具。
 *
 * 存在的意义：`my-hub-live`（功能断言）与 `my-hub-metrics`（体验指标采集）需要
 * 同一套注册 / 播种 / 路由操作；复制两份迟早会漂移（改了一处忘了另一处）。
 */

export const MOBILE_APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')

export interface MobileTestAccount {
  userId: string
  accessToken: string
  username: string
  password: string
}

/** 用 REST 注册一个临时账号（登录仍走真实 UI，保证会话链路真实） */
export const registerMobileAccount = async (
  prefix: string,
  appUrl: string = MOBILE_APP_URL
): Promise<MobileTestAccount> => {
  const password = `Xhub!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
    const res = await fetch(`${appUrl}/_matrix/client/v3/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, auth: { type: 'm.login.dummy' } })
    })
    if (res.ok) {
      const data = (await res.json()) as { user_id: string; access_token: string }
      return { userId: data.user_id, accessToken: data.access_token, username, password }
    }
    lastError = `HTTP ${res.status} ${await res.text()}`
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`注册账号失败: ${lastError}`)
}

/**
 * 播 e2e 标记。
 *
 * - `platform=mobile`：整页重载可能丢掉 `?platform=mobile`，此时 `detectAppPlatform()`
 *   会把纯浏览器判成桌面，守卫随之把用户踢到桌面登录页。
 * - `mockAuth`：开发态 `hasAuthenticatedSession()` 会偶发读空（既有缺陷），
 *   导航会被随机甩到登录页 —— 与 UI 改动无关。
 *
 * 只用于「入口可达 / 体验指标」类用例；鉴权行为由 `authGuard` 单测覆盖。
 */
export const seedE2EStorage = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ fallbackKey, e2eKeys }) => {
      window.localStorage.setItem('guide', JSON.stringify({ isGuideCompleted: true }))
      window.localStorage.setItem(fallbackKey, '1')
      window.localStorage.setItem(e2eKeys.platform, 'mobile')
      window.localStorage.setItem(e2eKeys.enabled, '1')
      window.localStorage.setItem(e2eKeys.mockAuth, '1')
    },
    {
      fallbackKey: WEB_SESSION_FALLBACK_STORAGE_KEY,
      e2eKeys: E2E_STORAGE_KEYS
    }
  )
}

type RouterSnapshot = { name?: unknown; path?: string }

/** 读应用 router 的当前路由（URL 可能是重定向后的中间态，路由真相在 router 里） */
export const readMobileRoute = async (page: Page): Promise<{ name: string | null; path: string | null }> =>
  page.evaluate(() => {
    const router = (
      document.querySelector('#app') as
        | (HTMLElement & {
            __vue_app__?: { config: { globalProperties: { $router?: { currentRoute?: { value?: unknown } } } } }
          })
        | null
    )?.__vue_app__?.config?.globalProperties?.$router
    const raw = router?.currentRoute?.value as RouterSnapshot | undefined
    return { name: typeof raw?.name === 'string' ? raw.name : null, path: raw?.path ?? null }
  })

/** 用应用 router 推一条路由，等重定向收敛后返回最终路由 */
export const pushMobileRoute = async (
  page: Page,
  target: unknown,
  attempt = 0
): Promise<{ name: string | null; path: string | null }> => {
  try {
    await page.evaluate(async (to) => {
      const router = (
        document.querySelector('#app') as
          | (HTMLElement & {
              __vue_app__?: { config: { globalProperties: { $router?: { push: (t: unknown) => Promise<unknown> } } } }
            })
          | null
      )?.__vue_app__?.config?.globalProperties?.$router
      if (!router) throw new Error('应用 router 实例不可达（$router 未挂载）')
      try {
        await router.push(to)
      } catch {
        // 重定向/导航中止会 reject，路由真相以 currentRoute 为准
      }
    }, target)
  } catch (error) {
    // 登录后 SPA 重定向尚在进行时，evaluate 会撞上 "Execution context was destroyed"
    if (attempt < 3) {
      await page.waitForTimeout(1500)
      return pushMobileRoute(page, target, attempt + 1)
    }
    throw error
  }
  await page.waitForTimeout(1200)
  return readMobileRoute(page)
}
