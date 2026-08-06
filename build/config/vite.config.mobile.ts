import postcsspxtorem from 'postcss-pxtorem'
import { NaiveUiResolver, VantResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { mergeConfig, type UserConfig } from 'vite'
import { getComponentsDirs, getComponentsDtsPath, getComponentsGlobs } from './components.ts'
import { getLocalIP } from './utils.ts'
import { baseConfig } from './vite.config.base.ts'

export function createMobileConfig(platform: string, _env?: Record<string, string>): UserConfig {
  const rawIP = getLocalIP() || '127.0.0.1'
  const serverPort = 5210

  const host = (() => {
    if (rawIP && !rawIP.endsWith('.0') && !rawIP.endsWith('.255')) {
      return rawIP
    }
    return platform === 'ios' ? (rawIP ?? '127.0.0.1') : platform === 'android' ? '0.0.0.0' : '127.0.0.1'
  })()

  return mergeConfig(baseConfig, {
    server: {
      port: serverPort,
      ws: {
        protocol: 'ws',
        host: host,
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
