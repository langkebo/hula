/**
 * 需要强制分离到独立 chunk 的模块配置
 * 格式: { 模块路径片段: chunk 名称 }
 */
export const manualChunkConfig: Record<string, string> = {
  'src/enums/index.ts': 'enums',
  'src/utils/TauriInvokeHandler.ts': 'tauri-invoke',
  'src/hooks/useLogin.ts': 'login-hook',
  'src/mobile/components/ImagePreview.vue': 'image-preview',
  'src/router/index.ts': 'router'
}

/**
 * 创建 manualChunks 函数
 * @param dependencies - 项目依赖列表，用于处理 node_modules 的分离
 * @returns manualChunks 函数
 */
export function createManualChunks(dependencies: string[]) {
  return (id: string): string | undefined => {
    const cleanId = id.split('?')[0]

    for (const [modulePath, chunkName] of Object.entries(manualChunkConfig)) {
      if (cleanId.includes(modulePath)) {
        return chunkName
      }
    }

    if (id.includes('node_modules')) {
      if (id.includes('node_modules/@vue-office/')) {
        const officeType = id.match(/@vue-office\/(\w+)/)?.[1]
        if (officeType) {
          return `vue-office-${officeType}`
        }
        return 'office-vendor'
      }

      if (id.includes('node_modules/mermaid')) {
        return 'mermaid'
      }

      if (id.includes('node_modules/three')) {
        return 'three'
      }

      if (id.includes('node_modules/monaco-editor') || id.includes('node_modules/stream-monaco')) {
        return 'monaco-editor'
      }

      if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
        return 'chart-vendor'
      }

      if (id.includes('node_modules/hula-emojis')) {
        return 'hula-emojis'
      }

      if (id.includes('node_modules/lodash-es') || id.includes('node_modules/es-toolkit')) {
        return 'utils-lodash'
      }

      if (id.includes('node_modules/dayjs')) {
        return 'dayjs'
      }

      if (id.includes('node_modules/axios')) {
        return 'axios'
      }

      if (id.includes('node_modules/crypto-js') || id.includes('node_modules/digest-wasm')) {
        return 'crypto'
      }

      if (
        id.includes('node_modules/naive-ui') ||
        id.includes('node_modules/vueuc') ||
        id.includes('node_modules/vooks') ||
        id.includes('node_modules/@css-render') ||
        id.includes('node_modules/css-render') ||
        id.includes('node_modules/seemly')
      ) {
        return 'naive-ui'
      }

      if (id.includes('node_modules/vant') || id.includes('node_modules/@vant/')) {
        return 'vant'
      }

      if (
        id.includes('node_modules/matrix-js-sdk') ||
        id.includes('node_modules/@matrix-org/') ||
        id.includes('node_modules/another-json')
      ) {
        return 'matrix'
      }

      if (id.includes('node_modules/markstream-vue') || id.includes('node_modules/stream-markdown')) {
        return 'markdown'
      }

      if (id.includes('node_modules/breezystack-lamejs')) {
        return 'audio-encoder'
      }

      if (
        id.includes('node_modules/vue') ||
        id.includes('node_modules/@vue/') ||
        id.includes('node_modules/pinia') ||
        id.includes('node_modules/vue-router') ||
        id.includes('node_modules/@vueuse/')
      ) {
        return 'vue-core'
      }

      if (id.includes('node_modules/@tauri-apps/')) {
        return 'tauri'
      }

      if (id.includes('node_modules/@fingerprintjs/') || id.includes('node_modules/fingerprintjs')) {
        return 'fingerprint'
      }

      if (id.includes('node_modules/dompurify')) {
        return 'dompurify'
      }

      if (id.includes('node_modules/driver.js')) {
        return 'driver'
      }

      if (id.includes('node_modules/grapheme-splitter')) {
        return 'grapheme-splitter'
      }

      if (id.includes('node_modules/file-type')) {
        return 'file-type'
      }

      if (id.includes('node_modules/idb')) {
        return 'idb'
      }

      if (id.includes('node_modules/mitt')) {
        return 'mitt'
      }

      if (id.includes('node_modules/qrcode')) {
        return 'qrcode'
      }

      if (id.includes('node_modules/uuid')) {
        return 'uuid'
      }

      if (id.includes('node_modules/colorthief')) {
        return 'colorthief'
      }

      if (id.includes('node_modules/tlbs-map-vue')) {
        return 'map'
      }

      if (id.includes('node_modules/vue-virtual-scroller')) {
        return 'virtual-scroller'
      }

      if (id.includes('node_modules/vue-cropper')) {
        return 'cropper'
      }

      if (id.includes('node_modules/vue-i18n')) {
        return 'i18n'
      }

      if (id.includes('node_modules/matrix-widget-api')) {
        return 'widget-api'
      }

      if (id.includes('node_modules/p-limit') || id.includes('node_modules/yocto-queue')) {
        return 'p-limit'
      }

      const matchedDep = dependencies.find((dep) => id.includes(`node_modules/${dep}`))
      if (matchedDep) {
        return matchedDep.replace(/[@/]/g, '-')
      }
      return 'vendor'
    }

    return undefined
  }
}
