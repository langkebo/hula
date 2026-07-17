import { expect, type Page, test } from '@playwright/test'

type RuntimeIssueCollector = {
  componentResolveErrors: string[]
  lazyLoadErrors: string[]
}

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

const bootstrapMobileHarness = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hula:e2e:enabled', '1')
    window.localStorage.setItem('hula:e2e:mock-auth', '1')
    window.localStorage.setItem('hula:e2e:platform', 'mobile')
  })
}

const createRuntimeIssueCollector = (page: Page): RuntimeIssueCollector => {
  const collector: RuntimeIssueCollector = {
    componentResolveErrors: [],
    lazyLoadErrors: []
  }

  page.on('console', (message) => {
    const text = message.text()
    if (text.includes('Failed to resolve component')) {
      collector.componentResolveErrors.push(text)
    }
    if (
      /Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module/i.test(text)
    ) {
      collector.lazyLoadErrors.push(text)
    }
  })

  page.on('pageerror', (error) => {
    const text = String(error)
    if (
      /Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module/i.test(text)
    ) {
      collector.lazyLoadErrors.push(text)
    }
  })

  return collector
}

const expectNoRouteRuntimeIssues = (collector: RuntimeIssueCollector) => {
  expect(collector.componentResolveErrors, '入口页不应出现移动端组件解析失败').toEqual([])
  expect(collector.lazyLoadErrors, '入口页不应出现懒加载 chunk 拉取失败').toEqual([])
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
      expectNoRouteRuntimeIssues(runtimeIssues)
    })
  }
})
