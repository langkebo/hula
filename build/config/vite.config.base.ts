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
      'monaco-editor': fileURLToPath(new URL('../empty-module.js', import.meta.url))
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
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
    esbuild: {
      target: 'es2020'
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
