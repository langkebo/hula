import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import UnoCSS from '@unocss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import type { UserConfig } from 'vite'
import compression from 'vite-plugin-compression'
import VueSetupExtend from 'vite-plugin-vue-setup-extend'
import packageJson from '../../package.json' with { type: 'json' }
import { cspNoncePlugin } from '../plugins/vite-plugin-csp-nonce.ts'
import { createManualChunks } from './chunks.ts'

const dependencies = Object.keys(packageJson.dependencies || {})

// SDK 去 link 化（2026-08-09）：matrix-js-sdk 以 tarball（file:vendor/matrix-js-sdk.tgz）
// 安装进 node_modules，构建不再依赖仓库外 sibling 目录。以下 alias 将 fork 自定义子路径
// 指向已安装包内的 TS 源码（tarball 的 files 包含 src/），保持"从源码编译 SDK"的
// 既有运行时行为不变（lib 产物中 logger 访问 process.env 在浏览器/Worker 下会失败）。
// 注意：不能用 require.resolve('matrix-js-sdk/package.json')——SDK 的 exports 未导出
// './package.json' 子路径；顶级依赖的 node_modules/matrix-js-sdk 软链由 pnpm 保证存在。
const sdkPackageRoot = path.join(fileURLToPath(new URL('../../', import.meta.url)), 'node_modules', 'matrix-js-sdk')
const sdkSrc = (...segments: string[]) => path.join(sdkPackageRoot, 'src', ...segments)

export const baseConfig: UserConfig = {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
      '#': fileURLToPath(new URL('../../src/mobile', import.meta.url)),
      '~': fileURLToPath(new URL('../../', import.meta.url)),
      'stream-monaco': fileURLToPath(new URL('../empty-module.js', import.meta.url)),
      'monaco-editor': fileURLToPath(new URL('../empty-module.js', import.meta.url)),
      'matrix-js-sdk/src': sdkSrc(),
      'matrix-js-sdk/friend': sdkSrc('friend', 'index.ts'),
      'matrix-js-sdk/crypto': sdkSrc('crypto-api', 'index.ts'),
      'matrix-js-sdk/dm': sdkSrc('dm', 'index.ts'),
      'matrix-js-sdk/voice': sdkSrc('voice', 'index.ts'),
      'matrix-js-sdk/notification': sdkSrc('notification', 'index.ts'),
      'matrix-js-sdk/push': sdkSrc('push', 'index.ts'),
      'matrix-js-sdk/space': sdkSrc('space', 'index.ts'),
      'matrix-js-sdk/admin': sdkSrc('admin', 'index.ts'),
      'matrix-js-sdk/beacon': sdkSrc('beacon', 'index.ts'),
      'matrix-js-sdk/client': sdkSrc('client.ts'),
      'matrix-js-sdk/sync': sdkSrc('sync.ts'),
      'matrix-js-sdk/models/room': sdkSrc('models', 'room.ts'),
      'matrix-js-sdk/models/room-state': sdkSrc('models', 'room-state.ts'),
      'matrix-js-sdk/models': sdkSrc('models', 'index.ts'),
      'matrix-js-sdk/http-api': sdkSrc('http-api', 'index.ts'),
      'matrix-js-sdk/manager-extensions': sdkSrc('manager-extensions', 'index.ts'),
      'matrix-js-sdk/store/worker': sdkSrc('store', 'indexeddb-store-worker.ts'),
      'matrix-js-sdk/credentials': sdkSrc('credentials', 'index.ts'),
      'matrix-js-sdk/account': sdkSrc('account', 'index.ts'),
      'matrix-js-sdk/auth': sdkSrc('auth', 'index.ts'),
      'matrix-js-sdk/capabilities': sdkSrc('capabilities', 'index.ts'),
      'matrix-js-sdk/room': sdkSrc('room', 'index.ts'),
      'matrix-js-sdk/media': sdkSrc('media', 'index.ts'),
      'matrix-js-sdk/message': sdkSrc('message', 'index.ts'),
      'matrix-js-sdk/profile': sdkSrc('profile', 'index.ts'),
      'matrix-js-sdk/presence': sdkSrc('presence', 'index.ts'),
      'matrix-js-sdk/sending': sdkSrc('sending', 'index.ts'),
      'matrix-js-sdk/crypto-keys': sdkSrc('crypto-keys', 'index.ts'),
      'matrix-js-sdk/device': sdkSrc('device', 'index.ts'),
      'matrix-js-sdk/telemetry': sdkSrc('telemetry', 'index.ts'),
      'matrix-js-sdk/qr-login': sdkSrc('qr-login', 'index.ts'),
      'matrix-js-sdk/rendezvous': sdkSrc('rendezvous', 'index.ts'),
      'matrix-js-sdk': sdkSrc('index.ts')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@/styles/scss/global/variable.scss" as *;'
      }
    }
  },
  plugins: [
    vue(),
    VueSetupExtend(),
    vueJsx(),
    UnoCSS(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        { 'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar', 'useModal'] },
        { '@/utils/CssUtils': ['cssVar', 'getCssVar'] }
      ],
      dts: 'src/typings/auto-imports.d.ts'
    }),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false
    }),
    cspNoncePlugin()
  ],
  worker: {
    format: 'es'
  },
  build: {
    target: ['chrome90', 'edge90', 'firefox90', 'safari15'],
    cssCodeSplit: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false,
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_filename, deps) => {
        const heavyChunks = [
          'shiki-core',
          'shiki-themes',
          'shiki-langs',
          'shiki-engine',
          'three',
          'chart-vendor',
          'vue-office'
        ]
        return deps.filter((dep) => {
          if (heavyChunks.some((chunk) => dep.includes(chunk))) {
            return false
          }
          return true
        })
      }
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
        manualChunks: createManualChunks(dependencies)
      }
    }
  },
  optimizeDeps: {
    // 注意：matrix-js-sdk 经 vite alias 指向包内 TS 源码（见 resolve.alias 注释），
    // 若加入 include，Vite 预打包会改写 import 路径并绕过 alias，且其 lib 产物中
    // logger 访问 process.env 在浏览器/Worker 下会失败。因此必须 exclude，
    // 让 Vite 直接按源码路径即时转换。
    // 'events' 必须 include：SDK 源码 typed-event-emitter.ts 对 Node builtin events
    // 做值导入（import { EventEmitter }），tarball 模式下 SDK 位于 node_modules 内，
    // Vite 不会对 excluded 包的 CJS 依赖做运行时发现优化，不预打包就会以裸 CJS
    // 直发浏览器，报 "does not provide an export named 'EventEmitter'"（2026-08-09
    // 登录页白屏事故）。同理 include SDK src 直接值导入的其余 CJS 包：
    // loglevel / content-type / matrix-events-sdk / matrix-widget-api / sdp-transform。
    // 这些都是独立小包，include 不影响 SDK 的 alias 编译链。
    // '@tauri-apps/api/*' 子路径必须 include：webviewWindow 是静态导入，但其内部传递
    // 依赖 @tauri-apps/api/webview 初始依赖扫描抓不到，运行时"迟到发现"会触发 Vite
    // 重新预构建 + 整页 reload，在 reload 竞态里出现 "Importing a module script failed."
    // （2026-08-09 调试日志复现）。预打包所有子路径后不再有运行时发现，消除该竞态。
    include: [
      'vue',
      'vue-router',
      'pinia',
      '@vueuse/core',
      'naive-ui',
      'dayjs',
      'es-toolkit',
      'dompurify',
      'mitt',
      'events',
      'loglevel',
      'content-type',
      'matrix-events-sdk',
      'matrix-widget-api',
      'sdp-transform',
      '@tauri-apps/api',
      '@tauri-apps/api/webviewWindow',
      '@tauri-apps/api/webview',
      '@tauri-apps/api/core',
      '@tauri-apps/api/event',
      '@tauri-apps/api/path',
      '@tauri-apps/api/window',
      '@tauri-apps/api/app',
      '@tauri-apps/api/dpi',
      '@tauri-apps/api/tray'
    ],
    exclude: [
      'matrix-js-sdk',
      '@matrix-org/matrix-sdk-crypto-wasm',
      'three',
      '@vue-office/docx',
      '@vue-office/excel',
      '@vue-office/pdf',
      '@vue-office/pptx',
      'shiki',
      'markstream-vue',
      'tlbs-map-vue',
      'echarts'
    ]
  },
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    strictPort: true,
    fs: {
      // SDK 去 link 化后源码经 node_modules 解析，无需再放行仓库外 sibling 目录
      allow: [fileURLToPath(new URL('../../', import.meta.url))]
    },
    proxy: {
      '/_matrix': {
        target: process.env.VITE_HOMESERVER_URL || 'http://localhost:8008',
        changeOrigin: true,
        secure: false
      },
      '/_synapse': {
        target: process.env.VITE_HOMESERVER_URL || 'http://localhost:8008',
        changeOrigin: true,
        secure: false
      },
      '/.well-known/matrix': {
        target: process.env.VITE_HOMESERVER_URL || 'http://localhost:8008',
        changeOrigin: true,
        secure: false
      }
    },
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
    }
  }
}
