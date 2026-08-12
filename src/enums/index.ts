/**
 * 全局枚举 barrel re-export
 *
 * 枚举按业务域拆分到独立文件，此处统一 re-export 保持向后兼容。
 * 新代码建议直接从域文件导入：`import { MsgEnum } from '@/enums/chat'`
 *
 * 定义规则：
 *  枚举名：XxxEnum
 *  枚举值：全部大写，单词间用下划线分割
 */

export * from './ai'
export * from './app'
export * from './chat'
export * from './media'
export * from './mobile'
export * from './notification'
export * from './room'
export * from './tauri'
export * from './user'
export * from './webrtc'
