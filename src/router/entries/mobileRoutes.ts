import type { RouteRecordRaw } from 'vue-router'
import { getMobileRoutes } from '@/router/routes/mobile'

/** 当前 router entry 是否为移动端装配（构建期由 vite alias 决定） */
export const platformIsMobile = true

export const getPlatformRoutes: () => Array<RouteRecordRaw> = getMobileRoutes
