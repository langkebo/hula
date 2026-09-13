import postcsspxtorem from 'postcss-pxtorem'
import { NaiveUiResolver, VantResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { mergeConfig, type UserConfig } from 'vite'
import { getComponentsDirs, getComponentsDtsPath, getComponentsGlobs } from './components.ts'
import { baseConfig } from './vite.config.base.ts'

export function createMobileConfig(platform: string, _env?: Record<string, string>): UserConfig {
  const serverPort = 5210
  return mergeConfig(baseConfig, {
    server: {
      port: serverPort,
      strictPort: true,
      host: '0.0.0.0',
      cors: true,
      ws: {
        protocol: 'ws',
        host: '0.0.0.0',
        port: serverPort
      }
    },
    css: {
      postcss: {
        plugins: [
          postcsspxtorem({
            rootValue: 16,
            propList: ['*'],
            unitPrecision: 5,
            selectorBlackList: [],
            replace: true,
            mediaQuery: false,
            minPixelValue: 0
          })
        ]
      }
    },
    plugins: [
      Components({
        dirs: getComponentsDirs(platform),
        globs: getComponentsGlobs(platform),
        resolvers: [NaiveUiResolver(), VantResolver()],
        dts: getComponentsDtsPath(platform)
      })
    ]
  })
}
