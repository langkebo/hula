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
  let viteConfig = isPC ? desktopConfig : createMobileConfig(currentPlatform)

  // 2. 动态注入模式相关的配置 (如 esbuild drop)
  viteConfig = mergeConfig(viteConfig, {
    build: {
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : []
      }
    }
  })

  // 3. 让 dev 代理目标跟随 VITE_HOMESERVER_URL，支持自签名 https
  //    例：VITE_HOMESERVER_URL=https://matrix.test 时，自动走代理 + 关掉 TLS 校验。
  //    Tauri 运行时由 runtimeFetch.ts 的 .test 域名白名单处理；这里只影响浏览器 dev。
  //    如果有独立代理目标（如 nginx 未启动时直连后端），用 VITE_PROXY_TARGET 覆盖。
  const homeserverTarget =
    config.VITE_PROXY_TARGET?.trim() || config.VITE_HOMESERVER_URL?.trim() || 'http://localhost:8008'
  const isHttps = homeserverTarget.startsWith('https://')
  viteConfig = mergeConfig(viteConfig, {
    server: {
      proxy: {
        '/_matrix': {
          target: homeserverTarget,
          changeOrigin: true,
          ws: true,
          secure: !isHttps
        },
        '/_synapse': {
          target: homeserverTarget,
          changeOrigin: true,
          secure: !isHttps
        },
        '/.well-known/matrix': {
          target: homeserverTarget,
          changeOrigin: true,
          secure: !isHttps
        }
      }
    }
  })

  // 4. 启动信息打印
  const host = isPC ? 'localhost' : getLocalIP() || '127.0.0.1'
  atStartup(config, mode, host)()

  return viteConfig
})
