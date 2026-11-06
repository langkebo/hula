import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'

/**
 * 移动端 TabBar 点击可用性 + 五个核心页面首访请求审计（真实后端 + 真实登录）。
 *
 * 为什么需要：TabBar 只依赖 RouterLink 自身导航，任何「点击无响应」都只会表现为
 * 路由不变或页面渲染失败，静态代码无法取证。这里用**真实 tap**（走 hit-test，
 * 被遮罩拦截会超时失败）连续切换 12 轮 × 5 个 Tab，并在每个页面首次访问时采集
 * `/_matrix` 请求的状态码、方法与渲染快照。
 *
 * 默认不跑（需要可用 homeserver + 会注册临时账号）：`TJG_MOBILE_LIVE=1` 开启。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'
const ROUNDS = Number(process.env.TJG_TABBAR_ROUNDS ?? 12)

const TABS = [
  { testId: 'mobile-tab-message', path: '/mobile/message', label: '消息' },
  { testId: 'mobile-tab-friends', path: '/mobile/friends', label: '好友' },
  { testId: 'mobile-tab-rooms', path: '/mobile/rooms', label: '房间' },
  { testId: 'mobile-tab-space', path: '/mobile/space', label: '空间' },
  { testId: 'mobile-tab-my', path: '/mobile/my', label: '我的' }
] as const

interface Account {
  userId: string
  accessToken: string
  username: string
  password: string
}

const registerAccount = async (prefix: string): Promise<Account> => {
  const password = `Xmobile!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const username = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
    const res = await fetch(`${APP_URL}/_matrix/client/v3/register`, {
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

interface RequestRecord {
  at: number
  method: string
  path: string
  status: number
  ok: boolean
  body?: string | undefined
}

interface TabSnapshot {
  label: string
  path: string
  textLength: number
  tabCount: number
  errorView: boolean
  textHead: string
}

test.describe('移动端 TabBar 点击与页面交互审计', () => {
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? '')
  test.setTimeout(900_000)

  test('12 轮 Tab 切换全部响应，五页面首访请求无异常', async ({ page }) => {
    const self = await registerAccount('mtab')
    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })

    const requests: RequestRecord[] = []
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const tapFailures: Array<{ round: number; label: string; error: string }> = []
    const routeMismatches: Array<{ round: number; label: string; expected: string; actual: string }> = []
    const hitFailures: Array<{ round: number; label: string; detail: string }> = []
    const snapshots: TabSnapshot[] = []
    const timings: Array<{ round: number; label: string; ms: number }> = []
    const perTabRequests: Record<string, RequestRecord[]> = {}
    const visited = new Set<string>()

    page.on('response', async (response) => {
      const url = response.url()
      if (!url.includes('/_matrix/')) return
      const request = response.request()
      requests.push({
        at: Date.now(),
        method: request.method(),
        path: url.replace(APP_URL, '').split('?')[0],
        status: response.status(),
        ok: response.ok(),
        body: request.postData()?.slice(0, 300)
      })
    })
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))

    // 主框架整页导航（含 Vite full-reload / ErrorBoundary 触发的 location.reload）
    const navigations: Array<{ at: number; from: string; to: string }> = []
    let lastUrl = page.url()
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return
      const to = frame.url()
      if (to === lastUrl) return
      navigations.push({ at: Date.now(), from: lastUrl, to })
      lastUrl = to
    })

    // 导航会销毁执行上下文：命中检测/快照这类只读评估在整页刷新后重试一次即可
    const evaluateWithRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
      let lastError: unknown
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          return await fn()
        } catch (error) {
          lastError = error
          if (!/Execution context was destroyed|navigat/i.test(String(error))) throw error
          await page.waitForLoadState('domcontentloaded').catch(() => {})
          await page.waitForTimeout(500)
        }
      }
      throw lastError
    }

    // 布局取证：为什么命中点落空（Tab 被撑宽/撑高、页面横向溢出）
    const layoutDebug = await page.evaluate(() => {
      const info = (el: Element) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return {
          node: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)}`,
          rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
          display: style.display,
          flexDirection: style.flexDirection
        }
      }
      const chain: ReturnType<typeof info>[] = []
      let el: Element | null = document.querySelector('[data-testid="mobile-tab-message"]')
      while (el) {
        chain.push(info(el))
        el = el.parentElement
      }
      const wide = Array.from(document.querySelectorAll('body *'))
        .map((node) => ({ node, rect: node.getBoundingClientRect() }))
        .filter((item) => item.rect.width > window.innerWidth + 1)
        .slice(0, 10)
        .map((item) => info(item.node))

      // 关键工具类是否真正进了样式表（区分「类名没生成」与「被覆盖」）
      const ruleState: Record<string, boolean> = {}
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (const rule of Array.from(rules)) {
          const text = rule.cssText ?? ''
          for (const key of ['w-26px', 'size-38px', 'flex-1']) {
            if (!ruleState[key] && text.includes(`.${key}`)) ruleState[key] = true
          }
        }
      }
      const svg = document.querySelector<SVGSVGElement>('[data-testid="mobile-tab-message"] svg')
      const avatar = Array.from(document.querySelectorAll('img')).find((node) =>
        String(node.className).includes('size-38px')
      )

      return {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        visualViewport: `${window.visualViewport?.width}x${window.visualViewport?.height}`,
        body: info(document.body),
        chain,
        wide,
        styleSheets: document.styleSheets.length,
        ruleState,
        svg: svg
          ? {
              class: String(svg.className.baseVal),
              widthAttr: svg.getAttribute('width'),
              computedWidth: getComputedStyle(svg).width,
              computedHeight: getComputedStyle(svg).height
            }
          : null,
        avatar: avatar
          ? {
              class: String(avatar.className),
              natural: `${avatar.naturalWidth}x${avatar.naturalHeight}`,
              computedWidth: getComputedStyle(avatar).width,
              computedHeight: getComputedStyle(avatar).height
            }
          : null
      }
    })

    // 登录落地在消息页：第一轮从「好友」开始，确保首个 Tab 必定产生真实跳转
    const order = [1, 2, 3, 4, 0]

    // 每步落盘：整体超时时仍能看到已完成的进度与失败项
    const persistProgress = (current: string) => {
      writeFileSync(
        '/tmp/tabbar-audit-progress.json',
        JSON.stringify(
          {
            done: timings.length,
            current,
            url: page.url(),
            timings,
            tapFailures,
            hitFailures,
            routeMismatches,
            pageErrors,
            consoleErrors,
            navigations,
            snapshots
          },
          null,
          2
        )
      )
    }

    for (let round = 0; round < ROUNDS; round += 1) {
      for (const index of order) {
        const tab = TABS[index]
        const before = page.url()
        const stepStart = Date.now()

        // 「设置本地解锁密码」门禁可能在任意时刻二次弹出并盖住 TabBar（浏览器态无密钥库）：
        // 出现即点「稍后」，否则后续 tap 会被弹窗遮罩吞掉，表现为「点击无响应」。
        await page
          .evaluate(() => {
            const skip = document.querySelector('[data-test="local-unlock-skip"]') as HTMLElement | null
            if (skip) skip.click()
          })
          .catch(() => {})

        const hit = await evaluateWithRetry(() =>
          page.evaluate((testId) => {
            const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
            if (!el) return { found: false, detail: 'element-not-found' }
            const rect = el.getBoundingClientRect()
            const x = rect.left + rect.width / 2
            const y = rect.top + rect.height / 2
            const top = document.elementFromPoint(x, y)
            const layout = {
              viewport: `${innerWidth}x${innerHeight}`,
              scroll: `${scrollX},${scrollY}`,
              docScrollHeight: document.documentElement.scrollHeight,
              bodyScrollHeight: document.body.scrollHeight,
              rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
              point: `${Math.round(x)},${Math.round(y)}`
            }
            if (!top) return { found: true, detail: `no-element-at-point ${JSON.stringify(layout)}` }
            const hitTestOk = top === el || el.contains(top)
            return {
              found: true,
              detail: hitTestOk
                ? 'ok'
                : `blocked-by:${top.tagName.toLowerCase()}.${String(top.className).slice(0, 120)} ${JSON.stringify(layout)}`
            }
          }, tab.testId)
        )
        if (!hit.found || hit.detail !== 'ok') {
          hitFailures.push({ round: round + 1, label: tab.label, detail: hit.detail })
        }

        const clickAt = Date.now()
        try {
          // tap 走完整 hit-test：透明遮罩 / pointer-events 拦截会直接超时
          await page.locator(`[data-testid="${tab.testId}"]`).tap({ timeout: 8000 })
        } catch (error) {
          tapFailures.push({ round: round + 1, label: tab.label, error: String(error).slice(0, 200) })
          persistProgress(`${tab.label}@r${round + 1} tap-failed`)
          continue
        }

        const landed = await page
          .waitForURL((url) => url.pathname === tab.path, { timeout: 4000 })
          .then(() => true)
          .catch(() => false)
        if (!landed) {
          routeMismatches.push({
            round: round + 1,
            label: tab.label,
            expected: tab.path,
            actual: `${new URL(page.url()).pathname} (was ${new URL(before).pathname})`
          })
        }

        if (!visited.has(tab.label)) {
          visited.add(tab.label)
          // 首访：给页面初始化请求留出窗口，再采集渲染快照
          await page.waitForTimeout(2500)
          perTabRequests[tab.label] = requests.filter((item) => item.at >= clickAt)
          const snapshot = await evaluateWithRetry(() =>
            page.evaluate(() => ({
              textLength: (document.body.innerText ?? '').replace(/\s+/g, ' ').trim().length,
              tabCount: document.querySelectorAll('[data-testid^="mobile-tab-"]').length,
              errorView: /加载失败|出错了|网络异常/.test(document.body.innerText ?? ''),
              textHead: (document.body.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160)
            }))
          )
          snapshots.push({ label: tab.label, path: tab.path, ...snapshot })
        } else {
          await page.waitForTimeout(200)
        }
        timings.push({ round: round + 1, label: tab.label, ms: Date.now() - stepStart })
        persistProgress(`${tab.label}@r${round + 1}`)
      }
    }

    const non2xx = requests.filter((item) => !item.ok)
    const report = {
      rounds: ROUNDS,
      taps: ROUNDS * TABS.length,
      layoutDebug,
      navigations,
      tapFailures,
      hitFailures,
      routeMismatches,
      pageErrors,
      consoleErrors,
      non2xx,
      perTabRequests: Object.fromEntries(
        Object.entries(perTabRequests).map(([label, list]) => [
          label,
          list.map(({ method, path, status, body }) => ({ method, path, status, body }))
        ])
      ),
      snapshots
    }
    writeFileSync('/tmp/tabbar-audit.json', JSON.stringify(report, null, 2))
    console.log(`AUDIT:${JSON.stringify(report)}`)

    expect(tapFailures, '存在点击超时（被拦截或无响应）的 Tab').toEqual([])
    expect(hitFailures, '存在命中链被拦截的 Tab').toEqual([])
    expect(routeMismatches, '存在点击后未跳转到目标路由的 Tab').toEqual([])
    expect(pageErrors, '存在未捕获的页面异常').toEqual([])
    expect(non2xx, '存在非 2xx 的 Matrix 请求').toEqual([])
    expect(consoleErrors, '存在控制台错误').toEqual([])
    expect(snapshots, '五个 Tab 页面都应完成首访快照').toHaveLength(TABS.length)
    expect(snapshots.filter((item) => item.textLength === 0 || item.errorView)).toEqual([])
    expect(snapshots.filter((item) => item.tabCount !== TABS.length)).toEqual([])
  })
})
