import { fileURLToPath, URL } from 'node:url'
import { type ConfigEnv, defineConfig, loadEnv, mergeConfig } from 'vite'
import { atStartup } from './build/config/console.ts'
import { getLocalIP } from './build/config/utils.ts'
import { desktopConfig } from './build/config/vite.config.desktop.ts'
import { createMobileConfig } from './build/config/vite.config.mobile.ts'

export default defineConfig(({ mode }: ConfigEnv) => {
  const config = loadEnv(mode, process.cwd(), '')
  const currentPlatform = config.TAURI_ENV_PLATFORM || 'windows'
  const isPC = ['windows', 'darwin', 'linux'].includes(currentPlatform)

  // 1. 获取基础/平台配置
  let viteConfig = isPC ? desktopConfig : createMobileConfig(currentPlatform)

  // 2. 动态注入模式相关的配置 (如 esbuild drop)
  //    __TJG_MOBILE_BUILD__ 仅在移动端生产构建中为 true：常量折叠后桌面专属模块
  //    （admin 路由与 admin store）被 tree-shaking 移除，满足移动端零残留要求。
  //    开发态保持 false，保留运行时分派（?platform=mobile 覆盖与浏览器 E2E 依赖）。
  viteConfig = mergeConfig(viteConfig, {
    define: {
      __TJG_MOBILE_BUILD__: JSON.stringify(!isPC && mode === 'production')
    },
    build: {
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : []
      }
    }
  })

  // 3. 路由 entry 按平台解析（dev 与 build 一致）：
  //    移动端把平台入口替换为移动装配，桌面构建不会静态引入移动端页面，移动构建
  //    也不会引入桌面路由；运行期不再做平台分派，因此桌面产物不含移动端路由代码。
  //    浏览器 dev 的 ?platform=mobile 覆盖只影响布局/平台检测，不再切换路由集，
  //    需要移动端路由请使用移动端 dev server（5210）。
  if (!isPC) {
    viteConfig = mergeConfig(viteConfig, {
      resolve: {
        alias: [
          {
            find: '@/router/entries/platformRoutes',
            replacement: fileURLToPath(new URL('./src/router/entries/mobileRoutes.ts', import.meta.url))
          }
        ]
      }
    })
  }

  // 4. 移动端生产构建裁剪桌面专属模块
  //    admin / AI 功能按 R2 不得进入移动端产物：桌面路由模块只做静态替换还不够，
  //    其内部的动态 import 仍会被解析成 chunk 落进 dist。这里在解析期把整个模块
  //    换成空实现，admin 页面、AI 插件、TrendRadar 等 chunk 不再产生。
  //    admin 路由校验器同理：桌面实现引用 admin store，移动端替身不注入校验器。
  //    仅限生产构建，dev（含浏览器 E2E）保留真实桌面模块，兼容 ?platform=desktop 覆盖。
  if (!isPC && mode === 'production') {
    viteConfig = mergeConfig(viteConfig, {
      resolve: {
        alias: [
          {
            find: '@/router/routes/desktop',
            replacement: fileURLToPath(new URL('./src/mobile/router/routes/desktop.ts', import.meta.url))
          },
          {
            find: '@/stores/domains/admin/bridge',
            replacement: fileURLToPath(new URL('./src/mobile/stores/adminBridge.ts', import.meta.url))
          },
          {
            // i18n 通过 glob 全量加载 locales，移动端不含后台管理与 AI 页面，
            // 其语言包整体替换为空 JSON，产物中不再残留相关文案。
            find: /^.*\/locales\/(zh-CN|en)\/(admin|trendradar|ai_assistant)\.json$/,
            replacement: fileURLToPath(new URL('./build/empty-locale.json', import.meta.url))
          }
        ]
      }
    })
  }

  // 5. 让 dev 代理目标跟随 VITE_HOMESERVER_URL，支持自签名 https
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

  // 6. 启动信息打印
  const host = isPC ? 'localhost' : getLocalIP() || '127.0.0.1'
  atStartup(config, mode, host)()

  return viteConfig
})
