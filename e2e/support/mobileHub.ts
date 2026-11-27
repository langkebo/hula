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

/**
 * 用应用 router 推一条路由，等重定向收敛后返回最终路由。
 *
 * `settleMs` 是导航后固定等待的沉降时间，默认 1200ms（给懒加载区块/请求收尾留余量）。
 * **计时类用例必须传 0**：否则固定等待会被算进导航耗时，指标恒高、门禁永远红。
 *
 * `expectPath` 是**落点校验**（字符串按前缀匹配，正则按 test）。不传时：`target` 是字符串路径
 * 就默认用它校验，是 `{ name }` 对象则不校验（没有路径可比）。校验只读一次 `currentRoute`，
 * 不引入额外等待 ⇒ 计时用例传 `settleMs: 0` 时依然零成本。
 */
export const pushMobileRoute = async (
  page: Page,
  target: unknown,
  {
    settleMs = 1200,
    attempt = 0,
    expectPath
  }: { settleMs?: number; attempt?: number; expectPath?: string | RegExp | undefined } = {}
): Promise<{ name: string | null; path: string | null }> => {
  // 登录后 SPA 会重建 app，`#app.__vue_app__` 在新实例 mount 前短暂缺失；
  // 旧实现靠 3×1.5s 固定重试，实测 4.5s 内仍可能没挂上 ⇒ my-hub-live 4 条用例稳定报
  // 「应用 router 实例不可达」。改为显式等待挂载（首次即已挂载时立即返回，不引入额外等待）。
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#app') as
        | (HTMLElement & {
            __vue_app__?: { config: { globalProperties: { $router?: unknown } } }
          })
        | null
      return Boolean(el?.__vue_app__?.config?.globalProperties?.$router)
    },
    undefined,
    { timeout: 20_000 }
  )

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
      return pushMobileRoute(page, target, { settleMs, attempt: attempt + 1, expectPath })
    }
    throw error
  }
  if (settleMs > 0) await page.waitForTimeout(settleMs)
  const route = await readMobileRoute(page)

  // 落点校验：上面的 catch 有意吞掉 `router.push` 的 reject（重定向/导航中止是正常语义），
  // 副作用是「压根没跳过去」也会静默成功 —— 调用方接着等页面元素，报出来的是「页面缺元素」。
  // 2026-11-19 实测：`my-hub-live` 的「推送设置」就是这样，页面还停在消息页，失败信息却是
  // 「推送设置页没有免打扰开关」。这里把落点差异变成可读的一手失败。
  const expected = expectPath ?? (typeof target === 'string' ? target : null)
  if (expected && route.path) {
    const matched = typeof expected === 'string' ? route.path.startsWith(expected) : expected.test(route.path)
    if (!matched) {
      throw new Error(
        `pushMobileRoute 未落到目标路由：期望 ${String(expected)}，实际 ${route.path}` +
          `（name=${route.name ?? 'null'}）。` +
          'router.push 的异常会被上面的 catch 吞掉，所以只有这里能发现「没跳转」'
      )
    }
  }
  return route
}
