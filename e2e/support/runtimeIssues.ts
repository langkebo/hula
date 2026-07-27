import { expect, type Page } from '@playwright/test'

export type RuntimeIssueCollector = {
  componentResolveErrors: string[]
  lazyLoadErrors: string[]
}

/**
 * 监听页面 console 与 pageerror 事件，收集组件解析失败和懒加载 chunk 拉取失败。
 * 集中实现以避免在多个 spec 文件中重复定义。
 */
export const createRuntimeIssueCollector = (page: Page): RuntimeIssueCollector => {
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

export interface ExpectNoRuntimeIssuesOptions {
  /** 需要过滤的已知 Vite HMR 时序问题关键词（如 'layout/right/index.vue'） */
  filterLazyLoadErrors?: string[]
  /** 自定义组件解析失败断言消息 */
  componentResolveErrorMessage?: string
  /** 自定义懒加载失败断言消息 */
  lazyLoadErrorMessage?: string
}

/**
 * 断言运行时问题收集器中没有错误。可通过 options 配置过滤规则和消息文案，
 * 以兼容不同 spec 文件中的变体实现。
 */
export const expectNoRuntimeIssues = (
  collector: RuntimeIssueCollector,
  options: ExpectNoRuntimeIssuesOptions = {}
): void => {
  const {
    filterLazyLoadErrors = [],
    componentResolveErrorMessage = '页面不应出现组件解析失败',
    lazyLoadErrorMessage = '页面不应出现懒加载 chunk 拉取失败'
  } = options

  const filteredLazyLoadErrors = collector.lazyLoadErrors.filter(
    (error) => !filterLazyLoadErrors.some((keyword) => error.includes(keyword))
  )
  expect(collector.componentResolveErrors, componentResolveErrorMessage).toEqual([])
  expect(filteredLazyLoadErrors, lazyLoadErrorMessage).toEqual([])
}
