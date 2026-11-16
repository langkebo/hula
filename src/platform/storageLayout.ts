import { createMobileStorageLayout } from '@/mobile/platform/storageLayout'
import type { StorageLayout } from '@/platform/contracts'
import { createDesktopStorageLayout } from '@/platform/desktop/storageLayout'

let currentStorageLayout: StorageLayout | null = null

/**
 * 注册运行期存储布局。
 * 平台在运行期恒定，组合根（main.ts）在 initializePlatform 之后调用一次；
 * 传入 false 时回退桌面默认值，便于测试重置。
 */
export const registerStorageLayout = (mobile: boolean): void => {
  currentStorageLayout = mobile ? createMobileStorageLayout() : createDesktopStorageLayout()
}

/**
 * 读取当前存储布局。未注册时惰性返回桌面布局，行为与迁移前一致。
 */
export const getStorageLayout = (): StorageLayout => {
  if (!currentStorageLayout) {
    currentStorageLayout = createDesktopStorageLayout()
  }
  return currentStorageLayout
}
