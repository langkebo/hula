/**
 * 需要强制分离到独立 chunk 的模块配置
 * 格式: { 模块路径片段: chunk 名称 }
 */
export const manualChunkConfig: Record<string, string> = {
  'src/enums/index.ts': 'enums',
  'src/utils/TauriInvokeHandler.ts': 'tauri-invoke',
  'src/mobile/components/ImagePreview.vue': 'image-preview',
  'src/router/index.ts': 'router',
  // TD-12: 拆分 vendor-sub (11MB+)
  'node_modules/matrix-js-sdk': 'matrix-sdk',
  'node_modules/@matrix-org/': 'matrix-sdk',
  'node_modules/matrix-widget-api': 'matrix-widget',
  // Matrix SDK Worker 懒加载
  'src/workers/matrixSdk.worker': 'matrix-sdk-worker',
  'src/workers/MatrixSdkWorkerService': 'matrix-sdk-worker',
  'src/workers/matrixWorkerTypes': 'matrix-sdk-worker',
  'node_modules/axios': 'axios',
  'node_modules/idb': 'idb',
  'node_modules/pinia': 'pinia',
  'node_modules/vue-router': 'vue-router',
  'node_modules/@vueuse/': 'vue-use',
  'node_modules/dayjs': 'dayjs',
  'node_modules/crypto-js': 'crypto-js',
  'node_modules/digest-wasm': 'digest-wasm',
  'node_modules/uuid': 'uuid',
  'node_modules/qrcode': 'qrcode',
  'node_modules/mitt': 'mitt',
  'node_modules/lodash-es': 'lodash-es',
  'node_modules/es-toolkit': 'es-toolkit',
  'node_modules/file-type': 'file-type',
  'node_modules/dompurify': 'dompurify',
  'node_modules/grapheme-splitter': 'grapheme-splitter',
  'node_modules/colorthief': 'colorthief',
  'node_modules/p-limit': 'p-limit',
  'node_modules/yocto-queue': 'yocto-queue'
}

/**
 * 创建 manualChunks 函数
 * @param dependencies - 项目依赖列表，用于处理 node_modules 的分离
 * @returns manualChunks 函数
 */
export function createManualChunks(dependencies: string[]) {
  return (id: string): string | undefined => {
    const cleanId = id.split('?')[0]

    // TD-12: 优先从 manualChunkConfig 匹配，拆分子依赖
    for (const [modulePath, chunkName] of Object.entries(manualChunkConfig)) {
      if (cleanId.includes(modulePath)) {
        return chunkName
      }
    }

    // matrix-js-sdk 专用处理 (包含自定义模块)
    if (id.includes('matrix-js-sdk') || id.includes('@matrix-org/') || id.includes('another-json')) {
      return 'matrix'
    }

    if (id.includes('node_modules')) {
      // 大型独立库单独拆分
      if (id.includes('node_modules/@vue-office/')) {
        const officeType = id.match(/@vue-office\/(\w+)/)?.[1]
        if (officeType) {
          return `vue-office-${officeType}`
        }
        return 'office-vendor'
      }

      if (id.includes('node_modules/mermaid')) return 'mermaid'
      if (id.includes('node_modules/@shikijs/langs')) return undefined
      if (id.includes('node_modules/@shikijs/themes')) return 'shiki-themes'
      if (id.includes('node_modules/@shikijs/') || id.includes('node_modules/shiki')) return 'shiki-core'
      if (
        id.includes('node_modules/cytoscape') ||
        id.includes('node_modules/katex') ||
        id.includes('node_modules/@mermaid-js/') ||
        id.includes('node_modules/dagre') ||
        id.includes('node_modules/layout-base') ||
        id.includes('node_modules/cose-base') ||
        id.includes('node_modules/langium') ||
        id.includes('node_modules/chevrotain')
      )
        return 'mermaid-deps'
      if (id.includes('node_modules/three')) return 'three'
      if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) return 'chart-vendor'
      if (id.includes('node_modules/hula-emojis')) return 'hula-emojis'
      if (id.includes('node_modules/lodash-es') || id.includes('node_modules/es-toolkit')) return 'utils-lodash'
      if (id.includes('node_modules/dayjs')) return 'dayjs'
      if (id.includes('node_modules/axios')) return 'axios'
      if (id.includes('node_modules/crypto-js') || id.includes('node_modules/digest-wasm')) return 'crypto'
      if (
        id.includes('node_modules/naive-ui') ||
        id.includes('node_modules/vueuc') ||
        id.includes('node_modules/vooks') ||
        id.includes('node_modules/@css-render') ||
        id.includes('node_modules/css-render') ||
        id.includes('node_modules/seemly')
      )
        return 'naive-ui'
      if (id.includes('node_modules/vant') || id.includes('node_modules/@vant/')) return 'vant'
      if (id.includes('node_modules/markstream-vue') || id.includes('node_modules/stream-markdown')) return 'markdown'
      if (id.includes('node_modules/breezystack-lamejs') || id.includes('node_modules/@breezystack/lamejs'))
        return 'audio-encoder'
      if (
        id.includes('node_modules/vue') ||
        id.includes('node_modules/@vue/') ||
        id.includes('node_modules/pinia') ||
        id.includes('node_modules/vue-router') ||
        id.includes('node_modules/@vueuse/')
      )
        return 'vue-core'
      if (id.includes('node_modules/@tauri-apps/')) return 'tauri'
      if (id.includes('node_modules/@fingerprintjs/') || id.includes('node_modules/fingerprintjs')) return 'fingerprint'
      if (id.includes('node_modules/dompurify')) return 'dompurify'
      if (id.includes('node_modules/driver.js')) return 'driver'
      if (id.includes('node_modules/grapheme-splitter')) return 'grapheme-splitter'
      if (id.includes('node_modules/file-type')) return 'file-type'
      if (id.includes('node_modules/idb')) return 'idb'
      if (id.includes('node_modules/mitt')) return 'mitt'
      if (id.includes('node_modules/qrcode')) return 'qrcode'
      if (id.includes('node_modules/uuid')) return 'uuid'
      if (id.includes('node_modules/colorthief')) return 'colorthief'
      if (id.includes('node_modules/tlbs-map-vue')) return 'map'
      if (id.includes('node_modules/vue-virtual-scroller')) return 'virtual-scroller'
      if (id.includes('node_modules/vue-cropper')) return 'cropper'
      if (id.includes('node_modules/vue-i18n')) return 'i18n'
      if (id.includes('node_modules/matrix-widget-api')) return 'matrix-widget'
      if (id.includes('node_modules/p-limit') || id.includes('node_modules/yocto-queue')) return 'p-limit'

      // 提取 node_modules 中的包名 - TD-12: 关键修改
      const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
      if (match) {
        const depName = match[1]

        // matrix 相关
        if (depName.includes('@matrix-org') || depName.includes('matrix-')) return 'matrix-deps'
        // babel polyfill
        if (depName.includes('@babel') || depName.includes('core-js')) return 'babel-polyfill'

        // 检查是否是顶级依赖
        const matchedDep = dependencies.find((dep) => dep === depName)
        if (matchedDep) {
          return matchedDep.replace(/[@/]/g, '-')
        }

        // TD-12: 子依赖按范围分组，避免全部进入 vendor-sub
        // @types 开头的
        if (depName.startsWith('@types')) return 'vendor-types'
        // @babel 开头的
        if (depName.startsWith('@babel')) return 'vendor-babel'
        // @vitejs 开头的
        if (depName.startsWith('@vitejs')) return 'vendor-vite'
        // @unocss 开头的
        if (depName.startsWith('@unocss')) return 'vendor-unocss'
        // @iconify 开头的
        if (depName.startsWith('@iconify')) return 'vendor-iconify'
        // @vue 相关的
        if (depName.startsWith('@vue')) return 'vendor-vue'
        // @tauri-apps 相关的
        if (depName.startsWith('@tauri-apps')) return 'vendor-tauri'
        // @fingerprintjs 相关的
        if (depName.startsWith('@fingerprintjs')) return 'vendor-fingerprint'
        // @vant 相关的
        if (depName.startsWith('@vant')) return 'vendor-vant'
        // 其他 @ 开头的包
        if (depName.startsWith('@')) return 'vendor-misc'

        // 非 @ 开头的子依赖 - 根据关键词分组
        if (depName.includes('lodash') || depName.includes('es-toolkit')) return 'utils-lodash'
        if (depName.includes('axios')) return 'axios'
        if (depName.includes('dayjs')) return 'dayjs'
        if (depName.includes('uuid')) return 'uuid'
        if (depName.includes('qrcode')) return 'qrcode'
        if (depName.includes('mitt')) return 'mitt'
        if (depName.includes('idb')) return 'idb'
        if (depName.includes('pinia')) return 'pinia'
        if (depName.includes('vue-router')) return 'vue-router'
        if (depName.includes('vueuse')) return 'vue-use'
        if (depName.includes('crypto') || depName.includes('digest')) return 'crypto-js'
        if (depName.includes('file-type')) return 'file-type'
        if (depName.includes('dompurify')) return 'dompurify'
        if (depName.includes('grapheme')) return 'grapheme-splitter'
        if (depName.includes('colorthief')) return 'colorthief'
        if (depName.includes('p-limit') || depName.includes('yocto-queue')) return 'p-limit'
        if (depName.includes('@shikijs+themes') || depName.includes('shikijs+themes')) return 'shiki-themes'
        if (
          depName.includes('shiki') ||
          depName.includes('oniguruma') ||
          depName.includes('vscode-') ||
          depName.includes('langium') ||
          depName.includes('chevrotain')
        )
          return 'shiki-core'
        if (
          depName.includes('mermaid') ||
          depName.includes('cytoscape') ||
          depName.includes('katex') ||
          depName.includes('dagre') ||
          depName.includes('layout-base') ||
          depName.includes('cose-base')
        )
          return 'mermaid-deps'

        // 其他子依赖归入 vendor-sub (减少体积)
        return 'vendor-sub'
      }

      return 'vendor'
    }

    return undefined
  }
}
