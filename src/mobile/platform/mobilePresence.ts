import type { AsyncComponentLoader, Component } from 'vue'
import { computed, defineAsyncComponent } from 'vue'
import type { MobilePresence } from '@/platform/contracts'

/**
 * 移动端移动能力存在性：移动产物中判定恒为 true、移动端专属异步组件恒加载。
 */
export const mobileMobilePresence: MobilePresence = {
  useIsMobile: () => computed(() => true),
  mobileOnlyAsyncComponent: <T extends Component>(loader: AsyncComponentLoader<T>): T | undefined =>
    defineAsyncComponent(loader)
}
