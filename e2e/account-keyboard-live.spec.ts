/**
 * 路由集: desktop
 * 依据：断言桌面工作区 DOM（`#message-input`、`.message-list-page`、右侧 `SearchPane`），
 *       移动 dev server（5210）装配的是 `/mobile/*` 路由，没有这些页面。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 *
 * 账号型运行态取证（报告 §13.11 第 2 项「键盘可完成全部主流程」）：
 * 1. 回车发送消息（内容真的落到时间线、输入框清空）；
 * 2. 键盘切换会话（`aria-current` 从 A 迁移到 B）；
 * 3. 全局搜索快捷键 `Cmd/Ctrl+Shift+F` → `/search` 且右侧 `SearchPane` 渲染；
 * 4. `Cmd/Ctrl+F` → 焦点进入 `#center` 内的搜索输入框。
 *
 * 与 `desktop-keyboard-flows.spec.ts` 的分工：那边用 mock 会话验证焦点链与右键菜单，
 * 这里用真后端验证「键盘能真的完成一次完整消息闭环」。
 */
import { expect, type Locator, type Page, test } from '@playwright/test'
import {
  buildLiveEnv,
  createLiveRoom,
  getLiveAccountSkipReason,
  readLiveAppUrl,
  readLiveHomeserverUrl,
  registerLiveAccount,
  sendLiveRoomMessage
} from './support/liveAccount'
import {
  bootstrapMatrixLivePage,
  getCurrentSessionRoomId,
  loginToMatrixLive,
  openMessageWorkspace,
  waitForLiveSessions
} from './support/matrixLive'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'

const SEARCH_MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

const resolveDesktopAppUrl = (): string => readLiveAppUrl(test.info().project.use.baseURL ?? undefined)

/**
 * 聚焦会话项并回车切换。
 *
 * 切换会话会触发路由跳转与列表重渲染，紧接着的 Enter 偶发被丢弃（焦点随节点替换消失），
 * 因此这里用 `toPass` 重试「聚焦 → 回车 → aria-current 生效」整个动作，
 * 而不是把渲染时序问题当成产品缺陷。
 */
const selectSessionWithKeyboard = async (page: Page, item: Locator): Promise<void> => {
  await expect(async () => {
    await item.focus()
    await expect(item).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(item).toHaveAttribute('aria-current', 'true', { timeout: 5_000 })
  }).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] })
}

test.describe('账号内键盘主流程（真后端）', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chromium', '键盘主流程仅桌面项目运行')
    const skipReason = getLiveAccountSkipReason()
    test.skip(Boolean(skipReason), skipReason ?? '')
  })

  test('键盘完成发送、切会话、全局搜索', async ({ page }) => {
    test.setTimeout(180_000)
    const issues = createRuntimeIssueCollector(page)
    const homeserverUrl = readLiveHomeserverUrl()
    const appUrl = resolveDesktopAppUrl()

    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2ekbd' })
    const stamp = Date.now().toString(36)
    const roomA = await createLiveRoom(homeserverUrl, account.accessToken, { name: `键盘A-${stamp}` })
    const roomB = await createLiveRoom(homeserverUrl, account.accessToken, { name: `键盘B-${stamp}` })
    const seedText = `种子消息-${stamp}`
    await sendLiveRoomMessage(homeserverUrl, account.accessToken, roomA, seedText)

    const env = buildLiveEnv({ account, appUrl, homeserverUrl, roomId: roomA })
    await bootstrapMatrixLivePage(page, env)
    await loginToMatrixLive(page, env)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    const itemA = page.locator(`[data-test="session-item-${roomA}"]`)
    const itemB = page.locator(`[data-test="session-item-${roomB}"]`)
    await expect(itemA, 'A 房间应出现在会话列表').toBeVisible({ timeout: 30_000 })
    await expect(itemB, 'B 房间应出现在会话列表').toBeVisible({ timeout: 30_000 })

    // 1) 键盘选中 A：Enter 后成为当前会话并进入消息路由
    await selectSessionWithKeyboard(page, itemA)
    await expect.poll(async () => getCurrentSessionRoomId(page), { timeout: 15_000 }).toBe(roomA)

    // 2) 键盘切换会话 B：焦点迁移 + aria-current 迁移
    await selectSessionWithKeyboard(page, itemB)
    await expect(itemA).not.toHaveAttribute('aria-current', 'true')
    await expect.poll(async () => getCurrentSessionRoomId(page), { timeout: 15_000 }).toBe(roomB)

    // 回到 A 准备发送
    await selectSessionWithKeyboard(page, itemA)

    // 3) 回车发送：文本落到时间线，输入框清空
    const input = page.locator('#message-input')
    await expect(input).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(seedText).first(), 'A 房间种子消息应渲染').toBeVisible({ timeout: 30_000 })

    const outgoing = `键盘发送-${stamp}`
    await input.click()
    await page.keyboard.type(outgoing)
    await expect(input).toHaveText(outgoing)
    await page.keyboard.press('Enter')

    await expect(page.getByText(outgoing).first(), 'Enter 应把消息发到时间线').toBeVisible({ timeout: 30_000 })
    await expect(input, '发送后输入框应清空').toHaveText('', { timeout: 15_000 })

    // 4) 全局搜索快捷键 → /search 且右侧 SearchPane 渲染
    await page.keyboard.press(`${SEARCH_MODIFIER}+Shift+F`)
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000, message: 'Cmd/Ctrl+Shift+F 应跳转搜索页' })
      .toBe('/search')
    await expect(page.locator('.search-pane')).toBeVisible({ timeout: 30_000 })

    // 5) Cmd/Ctrl+F → 焦点进入 #center 内的文本输入框
    await page.keyboard.press(`${SEARCH_MODIFIER}+F`)
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const active = document.activeElement as HTMLElement | null
            if (!active) return 'null'
            const tag = active.tagName.toLowerCase()
            const editable = active.isContentEditable
            const insideCenter = Boolean(active.closest('#center'))
            return `${insideCenter ? 'center' : 'outside'}:${tag}${editable ? ':editable' : ''}`
          }),
        { timeout: 15_000, message: 'Cmd/Ctrl+F 应把焦点落到 #center 的输入控件上' }
      )
      .toMatch(/^center:(input|textarea)/)

    expectNoRuntimeIssues(issues)
  })
})
