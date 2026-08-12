import { test } from '@playwright/test'
import {
  bootstrapMatrixLivePage,
  loginToMatrixLive,
  openConfiguredRoom,
  openMessageWorkspace,
  readMatrixLiveEnv,
  waitForLiveSessions
} from './support/matrixLive'

const env = readMatrixLiveEnv()

test.describe
  .serial('Debug Phase 3', () => {
    test.beforeEach(async ({ page }) => {
      await bootstrapMatrixLivePage(page, env)
    })

    test('debug: open room and check state', async ({ page }) => {
      await loginToMatrixLive(page, env)
      await openMessageWorkspace(page)
      await waitForLiveSessions(page)

      console.log('URL before openConfiguredRoom:', page.url())
      await openConfiguredRoom(page, env)
      console.log('URL after openConfiguredRoom:', page.url())

      await page.waitForTimeout(3000)
      console.log('URL after 3s wait:', page.url())

      const bodyText = await page.locator('body').innerText()
      console.log('Has "No chat selected":', bodyText.includes('No chat selected'))
      console.log('Has "未选择会话":', bodyText.includes('未选择会话'))

      // Check for room detail pane or settings button
      const settingsBtn = page.locator('[data-testid="room-detail-action-settings"]')
      const drawerSettingsBtn = page.locator('[data-testid="room-drawer-settings"]')
      console.log('room-detail-action-settings count:', await settingsBtn.count())
      console.log('room-drawer-settings count:', await drawerSettingsBtn.count())
    })
  })
