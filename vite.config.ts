import { type ConfigEnv, defineConfig, loadEnv, mergeConfig } from 'vite'
import { atStartup } from './build/config/console'
import { getLocalIP } from './build/config/utils'
import { desktopConfig } from './build/config/vite.config.desktop'
import { createMobileConfig } from './build/config/vite.config.mobile'

export default defineConfig(({ mode }: ConfigEnv) => {
  const config = loadEnv(mode, process.cwd(), '')
  const currentPlatform = config.TAURI_ENV_PLATFORM || 'windows'
  const isPC = ['windows', 'darwin', 'linux'].includes(currentPlatform)

  // 1. 获取基础/平台配置
  let viteConfig = isPC ? desktopConfig : createMobileConfig(currentPlatform, config)

  // 2. 动态注入模式相关的配置 (如 esbuild drop)
  viteConfig = mergeConfig(viteConfig, {
    build: {
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : []
      }
    }
  })

  // 3. 启动信息打印
  const host = isPC ? 'localhost' : getLocalIP() || '127.0.0.1'
  atStartup(config, mode, host)()

  return viteConfig
})
