import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SettingsFullWindowEntry')

/**
 * 设置视图作为 home 子路由（meta.fullWindow）时的布局桥接：
 * - isFullWindowRoute：layout 据此隐藏三栏，把内容区交给根级 router-view；
 * - setupMenuListener：接管原生菜单 menu:open-settings（Settings... / Cmd+,），
 *   此前前端无监听导致该入口无效。
 */
export const useSettingsFullWindowEntry = () => {
  const route = useRoute()
  const router = useRouter()
  const isFullWindowRoute = computed(() => Boolean(route.meta?.fullWindow))
  let unlistenMenuSettings: UnlistenFn | null = null

  const setupMenuListener = async () => {
    if (!hasTauriRuntime() || unlistenMenuSettings) return
    try {
      unlistenMenuSettings = await listen('menu:open-settings', () => {
        if (route.name !== 'settings') void router.push('/settings')
      })
    } catch (error) {
      logger.warn('监听原生菜单设置入口失败:', error)
    }
  }

  const cleanupMenuListener = () => {
    unlistenMenuSettings?.()
    unlistenMenuSettings = null
  }

  return { isFullWindowRoute, setupMenuListener, cleanupMenuListener }
}
