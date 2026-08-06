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

export const baseConfig: UserConfig = {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
      '#': fileURLToPath(new URL('../../src/mobile', import.meta.url)),
      '~': fileURLToPath(new URL('../../', import.meta.url)),
      'stream-monaco': fileURLToPath(new URL('../empty-module.js', import.meta.url)),
      'monaco-editor': fileURLToPath(new URL('../empty-module.js', import.meta.url)),
      'matrix-js-sdk/src': fileURLToPath(new URL('../../../matrix-js-sdk/src', import.meta.url)),
      'matrix-js-sdk/friend': fileURLToPath(new URL('../../../matrix-js-sdk/src/friend/index.ts', import.meta.url)),
      'matrix-js-sdk/crypto': fileURLToPath(new URL('../../../matrix-js-sdk/src/crypto-api/index.ts', import.meta.url)),
      'matrix-js-sdk/dm': fileURLToPath(new URL('../../../matrix-js-sdk/src/dm/index.ts', import.meta.url)),
      'matrix-js-sdk/voice': fileURLToPath(new URL('../../../matrix-js-sdk/src/voice/index.ts', import.meta.url)),
      'matrix-js-sdk/notification': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/notification/index.ts', import.meta.url)
      ),
      'matrix-js-sdk/push': fileURLToPath(new URL('../../../matrix-js-sdk/src/push/index.ts', import.meta.url)),
      'matrix-js-sdk/space': fileURLToPath(new URL('../../../matrix-js-sdk/src/space/index.ts', import.meta.url)),
      'matrix-js-sdk/admin': fileURLToPath(new URL('../../../matrix-js-sdk/src/admin/index.ts', import.meta.url)),
      'matrix-js-sdk/beacon': fileURLToPath(new URL('../../../matrix-js-sdk/src/beacon/index.ts', import.meta.url)),
      'matrix-js-sdk/client': fileURLToPath(new URL('../../../matrix-js-sdk/src/client.ts', import.meta.url)),
      'matrix-js-sdk/sync': fileURLToPath(new URL('../../../matrix-js-sdk/src/sync.ts', import.meta.url)),
      'matrix-js-sdk/models/room': fileURLToPath(new URL('../../../matrix-js-sdk/src/models/room.ts', import.meta.url)),
      'matrix-js-sdk/models/room-state': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/models/room-state.ts', import.meta.url)
      ),
      'matrix-js-sdk/models': fileURLToPath(new URL('../../../matrix-js-sdk/src/models/index.ts', import.meta.url)),
      'matrix-js-sdk/http-api': fileURLToPath(new URL('../../../matrix-js-sdk/src/http-api/index.ts', import.meta.url)),
      'matrix-js-sdk/manager-extensions': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/manager-extensions/index.ts', import.meta.url)
      ),
      'matrix-js-sdk/store/worker': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/store/indexeddb-store-worker.ts', import.meta.url)
      ),
      'matrix-js-sdk/credentials': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/credentials/index.ts', import.meta.url)
      ),
      'matrix-js-sdk/account': fileURLToPath(new URL('../../../matrix-js-sdk/src/account/index.ts', import.meta.url)),
      'matrix-js-sdk/auth': fileURLToPath(new URL('../../../matrix-js-sdk/src/auth/index.ts', import.meta.url)),
      'matrix-js-sdk/capabilities': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/capabilities/index.ts', import.meta.url)
      ),
      'matrix-js-sdk/room': fileURLToPath(new URL('../../../matrix-js-sdk/src/room/index.ts', import.meta.url)),
      'matrix-js-sdk/media': fileURLToPath(new URL('../../../matrix-js-sdk/src/media/index.ts', import.meta.url)),
      'matrix-js-sdk/message': fileURLToPath(new URL('../../../matrix-js-sdk/src/message/index.ts', import.meta.url)),
      'matrix-js-sdk/profile': fileURLToPath(new URL('../../../matrix-js-sdk/src/profile/index.ts', import.meta.url)),
      'matrix-js-sdk/presence': fileURLToPath(new URL('../../../matrix-js-sdk/src/presence/index.ts', import.meta.url)),
      'matrix-js-sdk/sending': fileURLToPath(new URL('../../../matrix-js-sdk/src/sending/index.ts', import.meta.url)),
      'matrix-js-sdk/crypto-keys': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/crypto-keys/index.ts', import.meta.url)
      ),
      'matrix-js-sdk/device': fileURLToPath(new URL('../../../matrix-js-sdk/src/device/index.ts', import.meta.url)),
      'matrix-js-sdk/telemetry': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/telemetry/index.ts', import.meta.url)
      ),
      'matrix-js-sdk/qr-login': fileURLToPath(new URL('../../../matrix-js-sdk/src/qr-login/index.ts', import.meta.url)),
      'matrix-js-sdk/rendezvous': fileURLToPath(
        new URL('../../../matrix-js-sdk/src/rendezvous/index.ts', import.meta.url)
      ),
      'matrix-js-sdk': fileURLToPath(new URL('../../../matrix-js-sdk/src/index.ts', import.meta.url))
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
      'matrix-js-sdk'
    ],
    exclude: [
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
      allow: [
        fileURLToPath(new URL('../../', import.meta.url)),
        fileURLToPath(new URL('../../../matrix-js-sdk', import.meta.url))
      ]
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
