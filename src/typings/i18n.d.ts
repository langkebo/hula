import 'vue-i18n'

/**
 * i18n 类型安全定义
 * 
 * 通过扩展 DefineLocaleMessage，可以让 useI18n() 和 $t 具备基础的类型提示。
 * 后续可以通过脚本从 zh-CN 自动生成完整的 Schema。
 */

declare module 'vue-i18n' {
  export interface DefineLocaleMessage {
    [key: string]: any
  }
}
