import type { StorageLayout } from '@/platform/contracts'
import { platformStorageLayout } from '@/platform/entries/storageLayout'

let currentStorageLayout: StorageLayout | null = null

/**
 * 注册运行期存储布局。
 * 默认取构建期平台入口（`@/platform/entries/storageLayout`，移动构建已被 alias 替换）；
 * 显式传参只用于测试注入。
 */
export const registerStorageLayout = (layout: StorageLayout = platformStorageLayout()): void => {
  currentStorageLayout = layout
}

/**
 * 读取当前存储布局。未注册时惰性取平台入口默认值。
 */
export const getStorageLayout = (): StorageLayout => {
  if (!currentStorageLayout) {
    currentStorageLayout = platformStorageLayout()
  }
  return currentStorageLayout
}
