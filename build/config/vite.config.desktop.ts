import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { mergeConfig, type UserConfig } from 'vite'
import { getComponentsDirs, getComponentsDtsPath, getComponentsGlobs } from './components'
import { baseConfig } from './vite.config.base'

export const desktopConfig: UserConfig = mergeConfig(baseConfig, {
  server: {
    port: 6130,
    hmr: {
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
