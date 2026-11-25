/**
 * 截图窗口独立入口。
 *
 * capture 窗口只负责截图/取词，不需要 Matrix 客户端。若复用 `index.html` 的
 * `src/main.ts`，会静态装配整条 Matrix 模块图（matrixClientService 及其子服务在
 * 导入期即构造），让一个透明浮层窗口付出完整 SDK 的加载与内存成本。
 * 因此这里只挂载 `Capture.vue` 与它真正依赖的主题/i18n/样式。
 */
import 'uno.css'
import '@unocss/reset/eric-meyer.css'
import '@/styles/css/design-tokens.css'
import '@/styles/scss/global/base.scss'
import '@/styles/scss/global/typography.scss'
import { createApp } from 'vue'
import { StoresEnum, ThemeEnum } from '@/enums'
import { setupI18n } from '@/services/i18n'
import { pinia } from '@/stores'
import { normalizeTheme } from '@/stores/domains/settings/settings-helpers'
import { toggleTheme } from '@/stores/domains/settings/settingThemeActions'
import { createLogger } from '@/utils/Logger'
import { initializePlatform } from '@/utils/PlatformConstants'
import Capture from '@/views/Capture.vue'

const logger = createLogger('CaptureEntry')

/**
 * 读取主窗口持久化的主题偏好。
 *
 * capture 与主窗口同 origin，共享 localStorage，因此直接读 setting store 的落盘 key。
 * 刻意不 import `useSettingStore`：该 store 依赖 secretChatActions → secretChatCrypto
 * → Matrix SDK，会把整条 SDK 栈静态拉进只做截图/取词的窗口。
 */
function readPersistedTheme(): string {
  try {
    const raw = localStorage.getItem(StoresEnum.SETTING)
    if (!raw) return ThemeEnum.OS
    const persisted: { themes?: { pattern?: string } } = JSON.parse(raw)
    return normalizeTheme(persisted.themes?.pattern ?? ThemeEnum.OS)
  } catch {
    return ThemeEnum.OS
  }
}

initializePlatform()

const app = createApp(Capture)
app.use(pinia)
setupI18n(app)

// 主题只作用于本窗口文档，无需 store 参与
toggleTheme({ content: ThemeEnum.OS, pattern: ThemeEnum.OS }, readPersistedTheme())

// 与主窗口保持一致的桌面主题（旧实现经 App.vue 注入）
import('@/styles/scss/global/desktop.scss').catch((error) => {
  logger.warn('load desktop styles failed:', error)
})
import('@/styles/scss/theme/simple.scss')
  .then(() => {
    document.querySelector('#app')?.classList.add('simple')
  })
  .catch((error) => {
    logger.warn('load simple styles failed:', error)
  })

app.mount('#app')
