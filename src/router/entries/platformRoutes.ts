/**
 * 平台路由入口（默认装配：桌面）。
 *
 * 移动端构建与移动端 dev server 由 vite alias 把本模块整体替换为 `./mobileRoutes.ts`
 * （见 vite.config.ts），因此桌面产物不会静态引入移动端页面，移动产物也不会引入
 * 桌面路由；运行期不再做平台分派。
 *
 * 注意：浏览器 dev 用 `?platform=mobile` 覆盖平台时，仅影响布局/平台检测，
 * 不再切换路由集；需要移动端路由请使用移动端 dev server（5210）。
 */
export { getPlatformRoutes, platformIsMobile } from './desktopRoutes'
