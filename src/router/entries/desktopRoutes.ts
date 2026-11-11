import type { RouteRecordRaw } from 'vue-router'
import { getDesktopRoutes } from '@/router/routes/desktop'

/** 当前 router entry 是否为移动端装配（构建期由 vite alias 决定） */
export const platformIsMobile = false

export const getPlatformRoutes: () => Array<RouteRecordRaw> = getDesktopRoutes
