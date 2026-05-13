/**
 * 需要强制分离到独立 chunk 的模块配置
 * 格式: { 模块路径片段: chunk 名称 }
 */
export const manualChunkConfig: Record<string, string> = {
  // 核心框架与基础库
  'node_modules/vue/': 'vue-core',
  'node_modules/@vue/': 'vue-core',
  'node_modules/pinia': 'pinia',
  'node_modules/vue-router': 'vue-router',
  'node_modules/@vueuse/': 'vue-use',

  // UI 框架
  'node_modules/naive-ui/': 'naive-ui',
  'node_modules/vueuc/': 'naive-ui',
  'node_modules/vooks/': 'naive-ui',
  'node_modules/@css-render/': 'naive-ui',
  'node_modules/css-render/': 'naive-ui',
  'node_modules/seemly/': 'naive-ui',
  'node_modules/vant/': 'vant',
  'node_modules/@vant/': 'vant',

  // Matrix SDK 相关
  'node_modules/matrix-js-sdk': 'matrix-sdk',
  'node_modules/@matrix-org/': 'matrix-sdk',
  'node_modules/matrix-widget-api': 'matrix-widget',
  'node_modules/another-json': 'matrix-sdk',
  'src/workers/matrixSdk.worker': 'matrix-sdk-worker',
  'src/workers/MatrixSdkWorkerService': 'matrix-sdk-worker',
  'src/workers/matrixWorkerTypes': 'matrix-sdk-worker',

  // 编辑器与渲染增强 (Shiki, Mermaid, Katex)
  'node_modules/mermaid': 'mermaid',
  'node_modules/@shikijs/themes': 'shiki-themes',
  'node_modules/@shikijs/core': 'shiki-core',
  'node_modules/@shikijs/engine-': 'shiki-engine',
  'node_modules/@shikijs/langs': 'shiki-langs',
  'node_modules/@shikijs/types': 'shiki-core',
  'node_modules/@shikijs/vscode-textmate': 'shiki-core',
  'node_modules/shiki/langs/': 'shiki-langs',
  'node_modules/shiki/themes/': 'shiki-themes',
  'node_modules/shiki/engine/': 'shiki-engine',
  'node_modules/shiki/core': 'shiki-core',
  'node_modules/shiki/': 'shiki-core',
  'node_modules/cytoscape': 'mermaid-deps',
  'node_modules/katex': 'mermaid-deps',
  'node_modules/@mermaid-js/': 'mermaid-deps',
  'node_modules/dagre': 'mermaid-deps',
  'node_modules/layout-base': 'mermaid-deps',
  'node_modules/cose-base': 'mermaid-deps',
  'node_modules/langium': 'mermaid-deps',
  'node_modules/chevrotain': 'mermaid-deps',

  // 图形与 3D
  'node_modules/three': 'three',
  'node_modules/echarts': 'chart-vendor',
  'node_modules/zrender': 'chart-vendor',

  // 工具库
  'node_modules/es-toolkit': 'utils-lodash',
  'node_modules/dayjs': 'dayjs',
  'node_modules/axios': 'axios',
  'node_modules/crypto-js': 'crypto',
  'node_modules/digest-wasm': 'crypto',
  'node_modules/idb': 'idb',
  'node_modules/qrcode': 'qrcode',
  'node_modules/mitt': 'mitt',
  'node_modules/file-type': 'file-type',
  'node_modules/dompurify': 'dompurify',
  'node_modules/grapheme-splitter': 'grapheme-splitter',
  'node_modules/colorthief': 'colorthief',
  'node_modules/p-limit': 'p-limit',
  'node_modules/yocto-queue': 'yocto-queue',
  'node_modules/@tauri-apps/': 'tauri-sdk',
  'node_modules/@fingerprintjs/': 'fingerprint',
  'node_modules/markstream-vue': 'markdown-vendor',
  'node_modules/stream-markdown': 'markdown-vendor',
  'node_modules/tlbs-map-vue': 'map-vendor',
  'node_modules/driver.js': 'driver',

  // 业务逻辑与大型组件
  'src/enums/index.ts': 'enums',
  'src/utils/TauriInvokeHandler.ts': 'tauri-invoke',
  'src/router/index.ts': 'router',
  'node_modules/hula-emojis': 'hula-emojis',

  // 聊天域核心组件与逻辑
  'src/strategy/strategies/': 'msg-strategies',
  'src/components/rightBox/renderMessage/index.vue': 'render-message',
  'src/components/rightBox/MsgInput.vue': 'msg-input',
  'src/components/rightBox/chatBox/': 'chat-domain'
}

/**
 * 特殊正则表达式匹配规则
 */
const dynamicChunkRules: Array<{ test: RegExp; chunkName: (match: RegExpMatchArray) => string }> = [
  {
    test: /node_modules\/@vue-office\/(\w+)/,
    chunkName: (match) => `vue-office-${match[1]}`
  }
]

/**
 * 创建 manualChunks 函数
 * @param _dependencies - 项目依赖列表 (保留参数以维持 API 兼容性)
 * @returns manualChunks 函数
 */
export function createManualChunks(_dependencies: string[]) {
  return (id: string): string | undefined => {
    const cleanId = id.split('?')[0].replace(/\\/g, '/')

    // 1. 优先从静态配置匹配
    for (const [modulePath, chunkName] of Object.entries(manualChunkConfig)) {
      if (cleanId.includes(modulePath)) {
        return chunkName
      }
    }

    // 2. 匹配动态正则规则
    for (const rule of dynamicChunkRules) {
      const match = cleanId.match(rule.test)
      if (match) {
        return rule.chunkName(match)
      }
    }

    // 3. 兜底逻辑：剩余的 node_modules 统一合并
    if (cleanId.includes('node_modules')) {
      return 'vendor'
    }

    return undefined
  }
}
