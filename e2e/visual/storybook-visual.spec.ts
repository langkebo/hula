import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'

/**
 * Storybook 视觉基线用例。
 *
 * 选取原则：覆盖原子 / 业务 / 工作台 / 房间四个层级，且不依赖真实网络、
 * 定时器与异步数据（Loading 态、动画类 story 不纳入），保证截图可复现。
 *
 * 基线更新：`pnpm test:visual:update`（会在当前平台生成同名 PNG）。
 */
const STORIES = [
  { name: 'atomic-inline-edit', id: 'atomic-inlineedit--default' },
  { name: 'atomic-federation-badge', id: 'atomic-federationbadge--local-server' },
  { name: 'atomic-message-lock-badge', id: 'atomic-messagelockbadge--verified' },
  { name: 'common-user-identity', id: 'common-useridentity--federated-user' },
  { name: 'friend-list-item', id: 'components-friend-friendlistitem--default' },
  { name: 'friend-search-bar', id: 'components-friend-friendsearchbar--default' },
  { name: 'room-membership-tabs', id: 'room-roommembershiptabs--joined-tab' },
  { name: 'room-homeserver-label', id: 'room-roomhomeserverlabel--federated-room' },
  { name: 'workbench-space-list-item', id: 'components-workbench-spacelistitemcard--default' },
  { name: 'workbench-space-list-pane', id: 'components-workbench-spacelistpane--default' }
] as const

test.describe('Storybook visual baseline', () => {
  for (const story of STORIES) {
    test(`${story.name} (${story.id})`, async ({ page }, testInfo) => {
      const snapshot = testInfo.snapshotPath(`${story.name}.png`)
      // `--update-snapshots` 时要放行，否则首次生成基线也会被 skip 掉
      const updatingSnapshots = testInfo.config.updateSnapshots !== 'none'
      test.skip(
        !updatingSnapshots && !existsSync(snapshot),
        `当前平台缺少视觉基线 ${snapshot}；运行 pnpm test:visual:update 生成`
      )

      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`)
      await page.waitForSelector('#storybook-root > *', { timeout: 20_000 })
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      // 等待装饰器里的隐藏标题与 story 挂载稳定，避免首帧字体回填导致抖动
      await page.waitForTimeout(300)

      await expect(page.locator('#storybook-root')).toHaveScreenshot(`${story.name}.png`)
    })
  }
})
