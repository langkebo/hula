import { expect, type Page, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'
import { dismissLocalUnlockDialog } from './support/localUnlockGate'

/**
 * 空间树 UI（报告 §3-15 的验收项）：**建空间 + 子房间 → 树形渲染 → 进入子房间**。
 *
 * 之前只有 HTTP 层证据（空间房里 1 条 `m.space.child`），UI 侧没有任何用例：
 * 移动端 `SpaceView` 连子房间都不渲染（只显示「N 房间」计数），
 * `useSpaceRooms` 的 `rooms` / `load` / `createRoomInSpace` 三个能力全都没被接线。
 * 本轮补上 `SpaceChildrenList`（空间 → 子房间，带内联新建），本用例即其验收。
 *
 * 判据（四层，缺一层都不算通）：
 * 1. UI：空间卡片出现 → 详情层出现「子房间」行；
 * 2. 结构：子房间行**挂在**空间卡片对应的详情层内（父容器 `[data-testid="space-children"]`）；
 * 3. 服务端：`GET /rooms/{spaceId}/state/m.space.child/{roomId}` 200（真建了关系，不是前端自造）；
 * 4. 导航：点子房间进入聊天页，路由带的是该 roomId。
 *
 * 默认不跑（需要可用 homeserver + 会注册临时账号）：`TJG_MOBILE_LIVE=1` 开启。
 */

const APP_URL = (process.env.TJG_MOBILE_APP_URL ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const SKIP_REASON = process.env.TJG_MOBILE_LIVE ? null : '未设置 TJG_MOBILE_LIVE（需可用的本地 homeserver）'

interface Account {
  userId: string
  accessToken: string
  username: string
  password: string
}

const registerAccount = async (prefix: string): Promise<Account> => {
  const password = `Xsp!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 10)}`
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

/** 按可见文本点一个按钮（vant 的 pointer-events 包装层会让 locator.click 卡在 actionability 上） */
const clickByText = async (page: Page, selector: string, text: string): Promise<void> => {
  const clicked = await page.evaluate(
    ({ selector: sel, text: label }) => {
      const candidates = [...document.querySelectorAll(sel)] as HTMLElement[]
      const target = candidates.find((el) => (el.innerText || '').trim() === label)
      if (!target) return false
      target.scrollIntoView({ block: 'center' })
      target.click()
      return true
    },
    { selector, text }
  )
  if (!clicked) throw new Error(`找不到文本为「${text}」的元素: ${selector}`)
  await page.waitForTimeout(400)
}

test.describe('空间树 UI：建空间 → 建子房间 → 树形渲染 → 进入', () => {
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? '')
  test.setTimeout(300_000)

  test('空间下能新建子房间并在树里看到、点进去', async ({ page }) => {
    const self = await registerAccount('spacetree')
    const stamp = Date.now().toString(36)
    const spaceName = `space-${stamp}`
    const roomName = `child-${stamp}`

    await loginOnMobileUi(page, { appUrl: APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 5_000)

    // 进空间 Tab（用应用 router，避免整页重载掉登录）
    await page.evaluate(async () => {
      const router = (
        document.querySelector('#app') as
          | (HTMLElement & {
              __vue_app__?: { config: { globalProperties: { $router?: { push: (t: unknown) => Promise<unknown> } } } }
            })
          | null
      )?.__vue_app__?.config?.globalProperties?.$router
      if (!router) throw new Error('应用 router 实例不可达')
      await router.push({ name: 'mobileSpaceView' })
    })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe('/mobile/space')

    // ── 1) 建空间（走 UI 表单，不直连 API）
    await clickByText(page, '.space-view button', '创建空间')
    const nameInput = page.locator('input[placeholder="请输入空间名称"]')
    await expect(nameInput, '创建空间表单未出现').toBeVisible({ timeout: 15_000 })
    await nameInput.fill(spaceName)
    await clickByText(page, '.van-action-sheet .form-actions button', '创建')

    const spaceCard = page.locator('.space-card').filter({ hasText: spaceName }).first()
    await expect(spaceCard, `空间「${spaceName}」未出现在空间列表`).toBeVisible({ timeout: 60_000 })

    // ── 2) 进详情层 → 新建子房间
    await spaceCard.click()
    const children = page.locator('[data-testid="space-children"]')
    await expect(children, '空间详情层没有子房间区块（useSpaceRooms 未接线）').toBeVisible({ timeout: 20_000 })

    await page.locator('[data-testid="space-create-room"]').dispatchEvent('click')
    const roomInput = page.locator('[data-testid="space-room-name"] input')
    await expect(roomInput, '子房间新建表单未出现').toBeVisible({ timeout: 15_000 })
    await roomInput.fill(roomName)
    await page.locator('[data-testid="space-room-submit"]').dispatchEvent('click')

    // ── 3) 树形渲染：子房间行必须挂在 space-children 里
    const childRow = children.locator('.child-row').filter({ hasText: roomName }).first()
    await expect(childRow, `子房间「${roomName}」未渲染到空间树中`).toBeVisible({ timeout: 60_000 })
    const roomId = await childRow.getAttribute('data-room-id')
    expect(roomId, '子房间行没有绑定 roomId').toMatch(/^!/)

    // ── 4) 服务端事实：m.space.child 关系真的写进去了
    // 服务端事实：这台后端的空间结构存在**注册表**（vendor `/spaces`），
    // 不是 room state 里的 `m.space.child`（见报告 §4.7 的 D18）。
    const spaceId = await page.evaluate(async (name) => {
      const { matrixSpaceService } = (await import(
        /* @vite-ignore */ '/src/services/matrix/room/MatrixSpaceService.ts'
      )) as {
        matrixSpaceService: { getSpaces: () => Promise<Array<{ spaceId: string; name: string }>> }
      }
      const spaces = await matrixSpaceService.getSpaces()
      return spaces.find((s) => s.name === name)?.spaceId ?? null
    }, spaceName)
    expect(spaceId, '空间列表里找不到刚创建的空间').toMatch(/^space_|^!/)

    const childState = await fetch(
      `${APP_URL}/_matrix/vendor/v1/spaces/${encodeURIComponent(spaceId ?? '')}/children`,
      { headers: { Authorization: `Bearer ${self.accessToken}` } }
    )
    expect(childState.status, '注册表里查不到该空间的 children').toBe(200)
    const childList = (await childState.json()) as Array<{ room_id?: string }>
    expect(
      childList.map((c) => c.room_id),
      '服务端没有该空间的子房间关系（前端自造了树）'
    ).toContain(roomId)

    // ── 5) 导航：点子房间进聊天页
    await childRow.click()
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
      .toBe(`/mobile/chatRoom/chatMain/${roomId}`)

    // 返回空间后子房间仍在（树是数据驱动的，不是一次性渲染）
    await page.evaluate(async () => {
      const router = (
        document.querySelector('#app') as
          | (HTMLElement & {
              __vue_app__?: { config: { globalProperties: { $router?: { push: (t: unknown) => Promise<unknown> } } } }
            })
          | null
      )?.__vue_app__?.config?.globalProperties?.$router
      await router?.push({ name: 'mobileSpaceView' })
    })
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe('/mobile/space')
    await page.locator('.space-card').filter({ hasText: spaceName }).first().click()
    await expect(
      page.locator('[data-testid="space-children"] .child-row').filter({ hasText: roomName }).first(),
      '返回空间后子房间消失（重新加载失败）'
    ).toBeVisible({ timeout: 30_000 })
  })
})
