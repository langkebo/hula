import { fileURLToPath, URL } from 'node:url'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { mergeConfig, type UserConfig } from 'vite'
import { getComponentsDirs, getComponentsDtsPath, getComponentsGlobs } from './components.ts'
import { baseConfig } from './vite.config.base.ts'

const entry = (file: string) => fileURLToPath(new URL(`../../${file}`, import.meta.url))

export const desktopConfig: UserConfig = mergeConfig(baseConfig, {
  // 截图窗口使用独立轻量入口：capture.html 只装配 Capture.vue 与主题/i18n，
  // 不引入 src/main.ts 的 Matrix 模块图（详见 src/entries/capture.ts）。
  build: {
    rollupOptions: {
      input: {
        main: entry('index.html'),
        capture: entry('capture.html')
      }
    }
  },
  server: {
    port: 6130,
    ws: {
      protocol: 'ws',
      host: 'localhost',
      port: 6130
    }
  },
  plugins: [
    Components({
      dirs: getComponentsDirs('windows'), // 桌面端通用目录
      globs: getComponentsGlobs('windows'),
      resolvers: [NaiveUiResolver()],
      dts: getComponentsDtsPath('windows')
    })
  ]
})
