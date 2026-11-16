import { appCacheDir, appDataDir, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory } from '@tauri-apps/plugin-fs'
import type { StorageLayout } from '@/platform/contracts'

/**
 * 桌面端存储布局：下载落到安装资源目录，缓存优先 AppCache，
 * 作用域路径按 AppData → AppCache → Resource 依次匹配。
 * 惰性构造，避免模块加载期读取 BaseDirectory（测试常对 plugin-fs 做部分 mock）。
 */
export const createDesktopStorageLayout = (): StorageLayout => ({
  downloadBaseDir: BaseDirectory.Resource,
  resolveDownloadBaseDirPath: resourceDir,
  cacheBaseDir: BaseDirectory.AppCache,
  cacheBaseDirName: 'AppCache',
  scopedBaseDirs: [
    { baseDir: BaseDirectory.AppData, resolvePath: appDataDir },
    { baseDir: BaseDirectory.AppCache, resolvePath: appCacheDir },
    { baseDir: BaseDirectory.Resource, resolvePath: resourceDir }
  ]
})
