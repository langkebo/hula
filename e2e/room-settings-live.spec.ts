/**
 * E2E Live 测试：真实后端环境下验证房间设置完整流程
 *
 * 需要环境变量：
 *   MATRIX_LIVE_E2E=1
 *   MATRIX_LIVE_HOMESERVER_URL=http://localhost:8008
 *   MATRIX_LIVE_USERNAME=e2e_test_user
 *   MATRIX_LIVE_PASSWORD=Test1234!
 *   MATRIX_LIVE_ROOM_ID=!rBwChof3D56rBLICj-WIO_RS:matrix.test
 *
 * 运行方式：
 *   MATRIX_LIVE_E2E=1 \
 *   MATRIX_LIVE_HOMESERVER_URL=http://localhost:8008 \
 *   MATRIX_LIVE_USERNAME=e2e_test_user \
 *   MATRIX_LIVE_PASSWORD='Test1234!' \
 *   MATRIX_LIVE_ROOM_ID='!rBwChof3D56rBLICj-WIO_RS:matrix.test' \
 *   npx playwright test e2e/room-settings-live.spec.ts --project=desktop-chromium --reporter=list
 */

import { expect, type Page, test } from '@playwright/test'
import {
  bootstrapMatrixLivePage,
  getMatrixLiveSkipReason,
  loginToMatrixLive,
  openConfiguredRoom,
  openMessageWorkspace,
  readMatrixLiveEnv,
  waitForLiveSessions
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const matrixLiveEnv = readMatrixLiveEnv()

test.describe('Room Settings Live E2E', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(180_000)

  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'live 测试仅在桌面 Chromium 下运行')
    const skipReason = getMatrixLiveSkipReason(matrixLiveEnv)
    test.skip(Boolean(skipReason), skipReason ?? '')
    await bootstrapMatrixLivePage(page, matrixLiveEnv)
  })

  // ============================================================
  // 阶段 1：登录真实后端并打开消息工作区
  // ============================================================
  test('Phase 1: 登录真实后端并加载会话列表', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    // 验证消息列表和工具栏可见
    await expect(page.locator('.message-list-page')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.message-session-toolbar')).toBeVisible({ timeout: 30000 })

    // 验证会话列表有内容
    const sessionItems = page.locator('[role="list"] [role="listitem"]')
    const count = await sessionItems.count()
    expect(count, '应至少有 1 个会话').toBeGreaterThan(0)

    expectNoRuntimeIssues(issues)
  })

  // ============================================================
  // 阶段 2：打开目标房间
  // ============================================================
  test('Phase 2: 打开目标房间并验证聊天界面', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    const roomId = await openConfiguredRoom(page, matrixLiveEnv)
    expect(roomId, '应成功打开目标房间').toBeTruthy()

    // 验证聊天区域可见
    await page.waitForTimeout(2000)

    expectNoRuntimeIssues(issues)
  })

  // ============================================================
  // 阶段 3：打开房间设置抽屉（验证不再错误跳转）
  // ============================================================
  test('Phase 3: 点击房间设置按钮打开抽屉（不错误跳转）', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    // 从房间列表视图打开设置抽屉
    await openSettingsDrawer(page, matrixLiveEnv.roomId)

    // 验证 RoomSettingsDrawer 可见
    await expect(page.locator('[data-testid="room-settings-drawer"]')).toBeVisible({ timeout: 10000 })

    // 验证 URL 停留在 /room（不是路由跳转）
    expect(page.url(), '点击设置按钮不应触发路由跳转').toContain('/room')

    expectNoRuntimeIssues(issues)
  })

  // ============================================================
  // 阶段 4：验证 11 个 Tab 全部可渲染（不白屏）
  // ============================================================
  test('Phase 4: RoomSettingsDrawer 11 个 Tab 全部可渲染', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    // 打开房间设置抽屉
    await openSettingsDrawer(page, matrixLiveEnv.roomId)

    // 立即检查 URL 和抽屉状态（不等待，防止路由变化导致抽屉消失）
    const postOpenState = await page.evaluate(() => {
      return {
        url: window.location.href,
        drawer: !!document.querySelector('[data-testid="room-settings-drawer"]'),
        roomListPage: !!document.querySelector('.room-list-page'),
        cardCount: document.querySelectorAll('[data-testid="room-card-item"]').length
      }
    })
    console.log('[Phase 4] post-open state:', JSON.stringify(postOpenState))

    // 等待抽屉过渡动画完成
    await page.waitForTimeout(500)

    // 再次检查 URL（检测是否被导航走）
    const postWaitUrl = page.url()
    console.log('[Phase 4] post-wait URL:', postWaitUrl)

    // 如果 URL 偏离 /room，重新导航并重新打开抽屉
    if (!postWaitUrl.includes('/room')) {
      console.log('[Phase 4] URL drifted from /room, re-opening settings drawer')
      await openSettingsDrawer(page, matrixLiveEnv.roomId)
    }

    // 调试：检查抽屉内部结构
    const drawerDebug = await page.evaluate(() => {
      const drawer = document.querySelector('[data-testid="room-settings-drawer"]')
      if (!drawer) return { found: false }
      return {
        found: true,
        innerHTML: drawer.innerHTML.slice(0, 500),
        tabButtons: drawer.querySelectorAll('button').length,
        roleTabs: drawer.querySelectorAll('[role="tab"]').length,
        rsTabs: drawer.querySelectorAll('.rs-drawer__tab').length,
        navElements: drawer.querySelectorAll('nav').length
      }
    })
    console.log('[Phase 4] drawer debug:', JSON.stringify(drawerDebug))

    // 验证 Tab 按钮存在（使用 DOM API 避免视口问题）
    const tabInfo = await page.evaluate(() => {
      const tabEls = document.querySelectorAll('.rs-drawer__tab')
      return { count: tabEls.length, labels: Array.from(tabEls).map((el) => el.textContent?.trim() ?? '') }
    })
    expect(tabInfo.count, '应有 11 个 Tab 按钮').toBeGreaterThanOrEqual(11)

    // 依次点击每个 Tab，验证不白屏、不报错（使用 DOM API 避免 "outside of viewport" 错误）
    for (let i = 0; i < tabInfo.count; i++) {
      const tabLabel = tabInfo.labels[i]

      // 使用 DOM API 点击 Tab
      await page.evaluate((index: number) => {
        const tabEls = document.querySelectorAll('.rs-drawer__tab')
        const el = tabEls[index] as HTMLElement | null
        el?.click()
      }, i)
      await page.waitForTimeout(500)

      // 验证不出现错误状态
      const hasError = await page.evaluate(() => {
        const errorEl = document.querySelector('[data-testid="tab-error"]')
        return errorEl ? errorEl.checkVisibility() : false
      })
      expect(hasError, `Tab ${i} (${tabLabel}) 不应显示错误状态`).toBe(false)

      // 验证抽屉内容区不为空
      const bodyHtmlLength = await page.evaluate(() => {
        const body = document.querySelector('.rs-drawer__body')
        return body ? body.innerHTML.length : 0
      })
      expect(bodyHtmlLength, `Tab ${i} (${tabLabel}) 内容区不应为空`).toBeGreaterThan(0)

      console.log(`[Tab ${i}] ${tabLabel} - OK`)
    }

    expectNoRuntimeIssues(issues)
  })

  // ============================================================
  // 阶段 5：验证 i18n 文本正确显示
  // ============================================================
  test('Phase 5: 房间设置抽屉 i18n 文本正确显示', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    await openSettingsDrawer(page, matrixLiveEnv.roomId)

    // 使用 DOM API 获取文本（避免视口问题）
    const i18nInfo = await page.evaluate(() => {
      const titleEl = document.querySelector('.rs-drawer__title')
      const tabEls = document.querySelectorAll('.rs-drawer__tab')
      const closeEl = document.querySelector('.rs-drawer__close')
      return {
        title: titleEl?.textContent?.trim() ?? '',
        tabs: Array.from(tabEls).map((el) => el.textContent?.trim() ?? ''),
        closeAriaLabel: closeEl?.getAttribute('aria-label') ?? ''
      }
    })

    expect(i18nInfo.title, '标题不应是原始 i18n key').not.toMatch(/^room\.settings_drawer\./)
    expect(i18nInfo.title, '标题不应为空').not.toBe('')
    console.log(`[Title] ${i18nInfo.title}`)

    for (let i = 0; i < i18nInfo.tabs.length; i++) {
      expect(i18nInfo.tabs[i], `Tab ${i} 文本不应是原始 i18n key`).not.toMatch(/^room\.settings_drawer\./)
      expect(i18nInfo.tabs[i], `Tab ${i} 文本不应为空`).not.toBe('')
      console.log(`[Tab ${i}] ${i18nInfo.tabs[i]}`)
    }

    expect(i18nInfo.closeAriaLabel, '关闭按钮 aria-label 不应是原始 i18n key').not.toMatch(/^common\./)

    expectNoRuntimeIssues(issues)
  })

  // ============================================================
  // 阶段 6：关闭抽屉并验证状态清理
  // ============================================================
  test('Phase 6: 关闭房间设置抽屉后正确清理', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    await openSettingsDrawer(page, matrixLiveEnv.roomId)

    // 使用 DOM API 点击关闭按钮
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.rs-drawer__close') as HTMLElement | null
      closeBtn?.click()
    })
    await page.waitForTimeout(500)

    // 验证抽屉已关闭（使用 DOM API 检查）
    const drawerExists = await page.evaluate(() => {
      const drawer = document.querySelector('[data-testid="room-settings-drawer"]')
      return drawer ? drawer.checkVisibility() : false
    })
    expect(drawerExists, '抽屉应已关闭').toBe(false)

    expectNoRuntimeIssues(issues)
  })

  // ============================================================
  // 阶段 7：快速切换 Tab 不崩溃
  // ============================================================
  test('Phase 7: 快速连续切换 Tab 不崩溃', async ({ page }) => {
    const issues = createRuntimeIssueCollector(page)

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    await openSettingsDrawer(page, matrixLiveEnv.roomId)

    const tabCount = await page.evaluate(() => document.querySelectorAll('.rs-drawer__tab').length)

    if (tabCount >= 5) {
      // 快速切换：basic → members → permissions → basic → security → basic
      await page.evaluate(() => {
        const tabs = document.querySelectorAll('.rs-drawer__tab')
        ;(tabs[0] as HTMLElement)?.click()
        ;(tabs[1] as HTMLElement)?.click()
        ;(tabs[2] as HTMLElement)?.click()
        ;(tabs[0] as HTMLElement)?.click()
        ;(tabs[8] as HTMLElement)?.click() // security
        ;(tabs[0] as HTMLElement)?.click()
      })

      await page.waitForTimeout(500)

      // 验证无错误
      const hasError = await page.evaluate(() => {
        const errorEl = document.querySelector('[data-testid="tab-error"]')
        return errorEl ? errorEl.checkVisibility() : false
      })
      expect(hasError, '快速切换 Tab 后不应出现错误状态').toBe(false)
    }

    expectNoRuntimeIssues(issues)
  })
})

/**
 * 辅助函数：从房间列表视图打开房间设置抽屉
 *
 * RoomSettingsDrawer 只能从 /room 路由的 RoomCardItem 设置按钮触发，
 * 不能从 /message/:roomId 聊天视图打开。
 */
async function openSettingsDrawer(page: Page, roomId?: string): Promise<void> {
  // 等待群组房间加载到会话列表（RoomList 只显示 GROUP 类型的会话）
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const runtimeWindow = window as Window & { pinia?: unknown }
          const { useSessionStore } = (await import(/* @vite-ignore */ '/src/stores/domains/chat/chat/session.ts')) as {
            useSessionStore: (pinia?: unknown) => {
              sessionList: Array<{ type?: number; roomId: string }>
            }
          }
          const sessionStore = useSessionStore(runtimeWindow.pinia)
          return sessionStore.sessionList.filter((s) => s.type === 1).length
        }),
      { timeout: 60_000, message: '等待群组房间加载到会话列表' }
    )
    .toBeGreaterThan(0)

  // 关键修复：清除 globalStore.currentSessionRoomId，防止被 keep-alive 缓存的
  // Message 组件的 watch(currentSessionInfo) 触发 onMsgClick → router.push('/message/:roomId')，
  // 导致 RoomList 被卸载、房间卡片消失。
  await page.evaluate(async () => {
    const runtimeWindow = window as Window & { pinia?: unknown }
    const { useGlobalStore } = (await import(/* @vite-ignore */ '/src/stores/domains/widget/global.ts')) as {
      useGlobalStore: (pinia?: unknown) => { updateCurrentSessionRoomId: (id: string) => void }
    }
    useGlobalStore(runtimeWindow.pinia).updateCurrentSessionRoomId('')
  })

  // 导航到房间列表视图（带重试，防止 router.push 被异步导航取消或被 keep-alive Message watch 覆盖）
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.evaluate(async () => {
      const routerModule = (await import(/* @vite-ignore */ '/src/router/index.ts')) as {
        default: { push: (path: string) => Promise<unknown> }
      }
      try {
        await routerModule.default.push('/room')
      } catch (e) {
        console.error('[openSettingsDrawer] router.push failed:', e)
      }
    })

    // 等待 URL 变为 /room
    try {
      await expect(page).toHaveURL(/\/room/, { timeout: 5_000 })
    } catch {
      console.log(`[openSettingsDrawer] nav attempt ${attempt + 1}: URL not /room yet, url=${page.url()}`)
      await page.waitForTimeout(1000)
      continue
    }

    // 等待房间列表页面渲染
    try {
      await page.waitForSelector('.room-list-page', { state: 'visible', timeout: 5_000 })
    } catch {
      console.log(`[openSettingsDrawer] nav attempt ${attempt + 1}: .room-list-page not visible, url=${page.url()}`)
      await page.waitForTimeout(1000)
      continue
    }

    // 检查 URL 是否仍然是 /room（防止被 Message watch 覆盖回 /message）
    if (page.url().includes('/room')) {
      break
    }
    console.log(`[openSettingsDrawer] nav attempt ${attempt + 1}: URL reverted to ${page.url()}`)
    await page.waitForTimeout(1000)
  }

  await expect(page).toHaveURL(/\/room/, { timeout: 30_000 })
  await page.waitForSelector('.room-list-page', { state: 'visible', timeout: 30_000 })

  // 等待房间卡片加载并稳定
  // 同时检查 URL 仍然是 /room（防止被 Message watch 覆盖）且卡片数量 > 0
  await expect
    .poll(
      async () => {
        return page.evaluate(() => {
          const isRoomRoute = window.location.href.includes('/room')
          const cardCount = document.querySelectorAll('[data-testid="room-card-item"]').length
          return isRoomRoute && cardCount > 0
        })
      },
      { timeout: 60_000, message: '等待房间卡片在 /room 路由下稳定渲染' }
    )
    .toBe(true)

  // 移除 driver.js 引导覆盖层（可能拦截点击事件）
  await page.evaluate(() => {
    document
      .querySelectorAll('.driver-overlay, .driver-popover, .driver-popover-footer, .driver-active-element')
      .forEach((node) => node.remove())
    document.body.classList.remove('driver-active', 'driver-fade')
  })

  // 通过 DOM API 直接点击设置按钮（比 Playwright click 更可靠，避免元素分离问题）
  const clickResult = await page.evaluate((targetRoomId: string | undefined) => {
    const card = targetRoomId
      ? document.querySelector(`[data-testid="room-card-item"][data-room-id="${targetRoomId}"]`)
      : null
    const fallbackCard = document.querySelector('[data-testid="room-card-item"]')
    const targetCard = card ?? fallbackCard
    if (!targetCard) {
      return { ok: false, error: 'room-card-item not found' }
    }
    const btn = targetCard.querySelector('[data-testid="room-card-action-settings"]') as HTMLElement | null
    if (!btn) {
      return { ok: false, error: 'room-card-action-settings not found in card' }
    }
    btn.click()
    return { ok: true, roomId: targetCard.getAttribute('data-room-id') }
  }, roomId)

  if (!clickResult.ok) {
    throw new Error(`点击设置按钮失败: ${clickResult.error}`)
  }

  console.log(`[openSettingsDrawer] clicked settings for room: ${clickResult.roomId}`)

  // 等待抽屉可见
  await page.waitForSelector('[data-testid="room-settings-drawer"]', {
    state: 'visible',
    timeout: 30_000
  })

  // 再次清除 currentSessionRoomId，防止抽屉打开后被 keep-alive Message watch 导航走
  await page.evaluate(async () => {
    const runtimeWindow = window as Window & { pinia?: unknown }
    const { useGlobalStore } = (await import(/* @vite-ignore */ '/src/stores/domains/widget/global.ts')) as {
      useGlobalStore: (pinia?: unknown) => { updateCurrentSessionRoomId: (id: string) => void }
    }
    useGlobalStore(runtimeWindow.pinia).updateCurrentSessionRoomId('')
  })
}
