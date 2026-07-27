import { expect, test } from '@playwright/test'
import { createRuntimeIssueCollector, expectNoRuntimeIssues } from './support/runtimeIssues'
import { bootstrapMobileHarness } from './support/session'

type MobileEntryCase = {
  name: string
  path: string
  readyPattern: RegExp
}

const mobileEntryCases: MobileEntryCase[] = [
  {
    name: 'mobile login entry',
    path: '/mobile/login',
    readyPattern: /Login|登录/
  },
  {
    name: 'mobile service agreement entry',
    path: '/mobile/serviceAgreement',
    readyPattern: /HuLa服务协议|服务协议/
  },
  {
    name: 'mobile sync confirm entry',
    path: '/mobile/syncData',
    readyPattern: /登录确认|确定登录|Confirm/
  },
  {
    name: 'mobile dynamic entry',
    path: '/mobile/dynamic',
    // /mobile/dynamic 页面已改造为空间(Space)列表页
    readyPattern: /空间|Space/
  },
  {
    name: 'mobile settings entry',
    path: '/mobile/mobileMy/settings',
    readyPattern: /Edit Profile|编辑资料|Settings/
  },
  {
    name: 'mobile add friends entry',
    path: '/mobile/mobileFriends/addFriends',
    readyPattern: /添加好友\/群|输入关键词搜索|Add Friends|Search/
  }
]

const ENTRY_RUNTIME_ISSUE_OPTIONS = {
  componentResolveErrorMessage: '入口页不应出现移动端组件解析失败'
}

test.describe('Mobile Auto-Registered Entry Smoke', () => {
  for (const entryCase of mobileEntryCases) {
    test(entryCase.name, async ({ page }) => {
      test.skip(!test.info().project.name.startsWith('mobile-'), '移动端入口 smoke 仅在移动项目下运行')

      const runtimeIssues = createRuntimeIssueCollector(page)
      await bootstrapMobileHarness(page)
      await page.goto(entryCase.path)

      await expect(page).toHaveURL(new RegExp(entryCase.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      await expect(page.locator('body')).toContainText(entryCase.readyPattern)
      expectNoRuntimeIssues(runtimeIssues, ENTRY_RUNTIME_ISSUE_OPTIONS)
    })
  }
})
