import { fileURLToPath, URL } from 'node:url'
import UnoCSS from '@unocss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import type { UserConfig } from 'vite'
import VueSetupExtend from 'vite-plugin-vue-setup-extend'
import packageJson from '../../package.json'
import { createManualChunks } from './chunks'

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
        { 'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar', 'useModal'] }
      ],
      dts: 'src/typings/auto-imports.d.ts'
    }),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    })
  ],
  worker: {
    format: 'es'
  },
  build: {
    target: ['chrome90', 'edge90', 'firefox90', 'safari15'],
    cssCodeSplit: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 500,
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_filename, deps) => {
        const heavyChunks = [
          'shiki-core',
          'shiki-themes',
          'shiki-langs',
          'shiki-engine',
          'mermaid',
          'mermaid-deps',
          'three',
          'chart-vendor',
          'vue-office',
          'vue-demi'
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
      'mermaid',
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
    proxy: {
      '/_matrix': {
        target: 'http://localhost:8008',
        changeOrigin: true
      },
      '/_synapse': {
        target: 'http://localhost:8008',
        changeOrigin: true
      },
      '/.well-known/matrix': {
        target: 'http://localhost:8008',
        changeOrigin: true
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
