import { expect, type Page } from '@playwright/test'

/**
 * 已知的「假阳性」懒加载错误关键词——**已清空**。
 *
 * 2026-11-19 订正：此前这里有 `'layout/right/index.vue'`，注释断言「这是 dev server 的时序现象，
 * 不是产品缺陷」。实测证明**该断言是错的**：`cc0fe2bda` 把 `TjgSpaceTree.vue` 的
 * `defineProps<{...}>()` 改成 `defineProps<TjgSpaceTreeProps>()`（类型从 `./useTjgSpaceTree` 导入），
 * 而 `vite-plugin-vue-setup-extend@0.4.0` 在 `enforce: 'pre'` 里调 `compileScript(descriptor, { id })`
 * **没有传 `fs`** ⇒ 解析跨文件类型时抛错 ⇒ vite 返回 **500** ⇒ `layout/right/index.vue` 依赖它
 * ⇒ 动态 import 失败 ⇒ 右侧面板整片不渲染、页面重置。
 *
 * 这个过滤因此在真缺陷出现后变成了「眼罩」：`room-settings-live` Phase 3、`account-keyboard-live`、
 * `my-hub-live` 的多条失败都被它兜住，表现为更难诊断的症状（`Execution context destroyed`、
 * `#message-input` 不出现、模块加载超时）。
 *
 * 根因已修（移除该插件，5 个文件改用 Vue 原生 `defineOptions({ name })`），故默认不再过滤任何关键词。
 * 若将来又出现该关键词，说明是**真的加载失败**，应修根因，而不是把关键词加回这里。
 */
export const HMR_LAZY_LOAD_FILTER: string[] = []

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
  /**
   * 需要忽略的懒加载错误关键词。默认取 `HMR_LAZY_LOAD_FILTER`，而它现在是**空数组**——
   * 即默认严格校验（2026-11-19 起；原因见该常量的注释）。仅在确有「非缺陷」关键词时显式传值。
   */
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
    filterLazyLoadErrors = HMR_LAZY_LOAD_FILTER,
    componentResolveErrorMessage = '页面不应出现组件解析失败',
    lazyLoadErrorMessage = '页面不应出现懒加载 chunk 拉取失败'
  } = options

  const filteredLazyLoadErrors = collector.lazyLoadErrors.filter(
    (error) => !filterLazyLoadErrors.some((keyword) => error.includes(keyword))
  )
  expect(collector.componentResolveErrors, componentResolveErrorMessage).toEqual([])
  expect(filteredLazyLoadErrors, lazyLoadErrorMessage).toEqual([])
}
