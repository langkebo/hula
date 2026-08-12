/** 通话相关枚举 */

// 通话状态枚举
export enum RTCCallStatus {
  CALLING = 1, // 呼叫
  ACCEPT = 2, // 接听
  END = 3, // 结束
  REJECT = 4, // 拒绝
  ERROR = 5, // 错误中断
  BUSY = 6, // 忙线中
  CANCEL = 7 // 取消
}

// 通话类型枚举
export enum CallTypeEnum {
  AUDIO = 1, // 语音通话
  VIDEO = 2 // 视频通话
}
