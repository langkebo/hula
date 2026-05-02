import { I18nKeys } from './i18n'

declare module 'vue-i18n' {
  // 定义全局的翻译消息结构
  export interface DefineLocaleMessage extends I18nKeys {}
}
