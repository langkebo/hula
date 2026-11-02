import type { RouteRecordRaw } from 'vue-router'

/**
 * 移动端产物中 `@/router/routes/desktop` 的替身实现（alias 配置见 vite.config.ts）。
 *
 * 移动端按 R2 硬性约束裁剪 admin 与 AI 功能，桌面路由模块若被解析进模块图，
 * 其内部的动态 import（admin 页面、AI 插件、TrendRadar 等）会以 chunk 形式残留在产物里。
 * 因此移动端构建在解析期直接把该模块替换为空实现，桌面路由模块不进入移动端构建图。
 */
export const getDesktopRoutes = (): Array<RouteRecordRaw> => []
