import { appCacheDir, appDataDir, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory } from '@tauri-apps/plugin-fs'
import type { StorageLayout } from '@/platform/contracts'

/**
 * 桌面端存储布局：下载与缓存统一落到应用数据目录（AppData），
 * 缓存临时文件优先 AppCache，作用域路径按 AppData → AppCache → Resource 依次匹配。
 *
 * 下载目录必须与 fs 能力白名单（`$APPDATA/**`、`$APPCACHE/**`）和
 * `ensureUserDataRoot()` 的建目录位置保持一致；此前指向 Resource 会让
 * 写入越过能力作用域被拒，导致加密图片解密后无法落盘、无内联预览。
 * 惰性构造，避免模块加载期读取 BaseDirectory（测试常对 plugin-fs 做部分 mock）。
 */
export const createDesktopStorageLayout = (): StorageLayout => ({
  downloadBaseDir: BaseDirectory.AppData,
  resolveDownloadBaseDirPath: appDataDir,
  cacheBaseDir: BaseDirectory.AppCache,
  cacheBaseDirName: 'AppCache',
  scopedBaseDirs: [
    { baseDir: BaseDirectory.AppData, resolvePath: appDataDir },
    { baseDir: BaseDirectory.AppCache, resolvePath: appCacheDir },
    { baseDir: BaseDirectory.Resource, resolvePath: resourceDir }
  ]
})
