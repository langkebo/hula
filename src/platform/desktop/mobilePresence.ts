import { computed } from 'vue'
import type { MobilePresence } from '@/platform/contracts'

/**
 * 桌面端移动能力存在性：桌面产物中移动端专属 UI 恒不存在。
 *
 * 这里只返回常量，不再保留运行期平台谓词——打包后的桌面端不可能变成移动端，
 * 运行期判断只会让两端实现同时进入产物。
 */
export const desktopMobilePresence: MobilePresence = {
  useIsMobile: () => computed(() => false),
  mobileOnlyAsyncComponent: () => undefined
}
