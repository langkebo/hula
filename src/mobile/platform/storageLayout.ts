import { appDataDir } from '@tauri-apps/api/path'
import { BaseDirectory } from '@tauri-apps/plugin-fs'
import type { StorageLayout } from '@/platform/contracts'

/**
 * 移动端存储布局：沙箱内只有应用私有数据目录可写，下载、缓存与作用域路径全部收敛到 AppData。
 * 惰性构造，避免模块加载期读取 BaseDirectory（测试常对 plugin-fs 做部分 mock）。
 */
export const createMobileStorageLayout = (): StorageLayout => ({
  downloadBaseDir: BaseDirectory.AppData,
  resolveDownloadBaseDirPath: appDataDir,
  cacheBaseDir: BaseDirectory.AppData,
  cacheBaseDirName: 'AppData',
  scopedBaseDirs: [{ baseDir: BaseDirectory.AppData, resolvePath: appDataDir }]
})
