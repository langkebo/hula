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
  'node_modules/vant/': 'vant',
  'node_modules/@vant/': 'vant',

  // Matrix SDK 相关
  // tarball（file:vendor/matrix-js-sdk.tgz）安装后，vite alias 指向 node_modules 内
  // 包路径（.pnpm 真实路径同样包含 '/matrix-js-sdk/src/' 子串，两种形态均可命中）
  '/matrix-js-sdk/src/': 'matrix-sdk',
  'node_modules/matrix-js-sdk': 'matrix-sdk',
  'node_modules/@matrix-org/': 'matrix-sdk',
  'node_modules/matrix-widget-api': 'matrix-widget',
  'node_modules/another-json': 'matrix-sdk',
  'src/workers/matrixSdk.worker': 'matrix-sdk-worker',
  'src/workers/MatrixSdkWorkerService': 'matrix-sdk-worker',
  'src/workers/matrixWorkerTypes': 'matrix-sdk-worker',

  // 编辑器与渲染增强 (Shiki, Katex)
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

  // 图形与 3D
  'node_modules/three': 'three',

  // 工具库
  'node_modules/es-toolkit': 'utils-es-toolkit',
  'node_modules/dayjs': 'dayjs',
  'node_modules/digest-wasm': 'crypto',
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
  'node_modules/driver.js': 'driver',

  // 业务逻辑与大型组件
  'src/enums/': 'enums',
  'src/utils/TauriInvokeHandler.ts': 'tauri-invoke',
  'src/router/index.ts': 'router',
  'node_modules/hula-emojis': 'hula-emojis',

  // capture 独立入口的共享基础闭包
  // 这些模块同时被聊天域（chatBox）与 capture 窗口引用。若不显式指定 chunk，
  // 打包器会把它们并入 chat-domain，使只做截图/取词的 capture 窗口被迫加载
  // 整条 Matrix 栈（MatrixClientService 等）。此处分包保证 capture 只拉取基础运行时。
  'src/utils/Logger.ts': 'logger',
  'src/utils/logArgSerialize.ts': 'logger',
  // app-errors 必须先于 i18n 声明：chunk 优先级由首次出现的顺序决定，
  // 否则 `src/locales/errors/` 会被 i18n 的 `src/locales/` 规则抢先命中。
  'src/common/errors.ts': 'app-errors',
  'src/common/exception.ts': 'app-errors',
  'src/common/matrixErrorTranslator.ts': 'app-errors',
  'src/common/matrixUnknownSemantics.ts': 'app-errors',
  'src/locales/errors/': 'app-errors',
  'src/services/i18n.ts': 'i18n',
  'src/utils/ComputedTime.ts': 'i18n',
  // i18n 语言包（仓库根 locales/）由 services/i18n.ts 以 eager glob 静态引入，
  // 必须与入口服务同 chunk，否则每个语言文件都会变成独立 chunk 并被 modulepreload
  // 预加载（capture 窗口会多出上百个请求）。
  '/locales/': 'i18n',
  'src/utils/AppHarness.ts': 'app-runtime',
  'src/utils/PlatformConstants.ts': 'app-runtime',
  'src/utils/platformDetection.ts': 'app-runtime',
  'src/utils/storageKeys.ts': 'app-runtime',
  'src/utils/PerformanceReporter.ts': 'app-runtime',
  'src/utils/HttpClient.ts': 'app-runtime',
  'src/utils/backoff.ts': 'app-runtime',
  'src/utils/hostAllowlist.ts': 'app-runtime',
  'src/utils/httpAllowlistConfig.ts': 'app-runtime',
  'src/utils/performanceTier.ts': 'app-runtime',
  'src/utils/StringUtils.ts': 'app-runtime',
  'src/utils/webCompat.ts': 'app-runtime',
  'src/services/matrix/network/runtimeFetch.ts': 'app-runtime',
  'src/services/matrix/MatrixRateLimitInterceptor.ts': 'app-runtime',
  'src/services/matrix/paths/prefixes.ts': 'app-runtime',
  'src/composables/common/useTauriListener.ts': 'app-runtime',
  'src/composables/common/useActionFeedback.ts': 'app-runtime',
  'src/composables/common/useAriaLive.ts': 'app-runtime',
  'src/stores/domains/settings/settings-helpers.ts': 'theme',
  'src/stores/domains/settings/settingThemeActions.ts': 'theme',

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
 * rolldown 原生分包分组（`output.codeSplitting.groups`）。
 *
 * 不能用 `output.manualChunks`：rolldown 只把它当作 Rollup 兼容层，内部会转成一个
 * `includeDependenciesRecursively: true` 的分组，且分组顺序按模块发现顺序而非配置顺序，
 * 于是 chat-domain 之类的分组会递归吞掉 enums / settings-helpers 等共享模块，
 * 导致 capture 窗口被迫加载整条 Matrix 栈（见 F2）。
 */
export interface CodeSplittingGroup {
  name: string | ((moduleId: string) => string | null)
  test: (moduleId: string) => boolean
  priority: number
  /**
   * 必须关闭递归：rolldown 默认会把分组内模块的全部依赖一起吞进来，
   * 早期分组（如 matrix-sdk）就会把 Logger / app-runtime 等共享基础模块拖走。
   * 关闭后每个模块只按自身命中的规则归属，与原 `manualChunks` 逐模块返回的语义一致。
   */
  includeDependenciesRecursively: false
}

const normalizeModuleId = (id: string): string => id.split('?')[0].replace(/\\/g, '/')

/**
 * 由 `manualChunkConfig` 生成 rolldown 原生分组。
 *
 * 同名规则合并为一个分组，保持原「chunk 名 → 一组路径」语义；
 * 声明越靠前 priority 越高，等价于原 manualChunks「先匹配者胜出」。
 */
export function createCodeSplittingGroups(): CodeSplittingGroup[] {
  const pathsByChunk = new Map<string, string[]>()
  for (const [modulePath, chunkName] of Object.entries(manualChunkConfig)) {
    const paths = pathsByChunk.get(chunkName)
    if (paths) {
      paths.push(modulePath)
    } else {
      pathsByChunk.set(chunkName, [modulePath])
    }
  }

  const groups: CodeSplittingGroup[] = []
  let index = 0
  for (const [chunkName, paths] of pathsByChunk) {
    groups.push({
      name: chunkName,
      test: (moduleId) => {
        const cleanId = normalizeModuleId(moduleId)
        return paths.some((modulePath) => cleanId.includes(modulePath))
      },
      priority: pathsByChunk.size - index,
      includeDependenciesRecursively: false
    })
    index += 1
  }

  // 动态规则（@vue-office/*）：优先级低于全部静态规则
  for (const rule of dynamicChunkRules) {
    groups.push({
      name: (moduleId) => {
        const match = normalizeModuleId(moduleId).match(rule.test)
        return match ? rule.chunkName(match) : null
      },
      test: (moduleId) => rule.test.test(normalizeModuleId(moduleId)),
      priority: 1,
      includeDependenciesRecursively: false
    })
  }

  // 兜底：剩余 node_modules 合并进 vendor
  groups.push({
    name: 'vendor',
    test: (moduleId) => normalizeModuleId(moduleId).includes('node_modules'),
    priority: 0,
    includeDependenciesRecursively: false
  })

  return groups
}
