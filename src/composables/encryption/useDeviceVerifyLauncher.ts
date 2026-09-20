import { readonly, ref } from 'vue'

/**
 * 设备验证对话框的启动目标。
 *
 * `userId` 缺省表示「验证本账号的其它设备」（沿用 `DeviceVerifyDialog` 原有语义）；
 * 传入 `userId` 时表示「验证指定用户的设备」，对话框会去拉取该用户的设备列表。
 */
export interface DeviceVerifyTarget {
  userId?: string
  deviceId?: string
  deviceName?: string
}

/**
 * 设备验证对话框启动器（模块级单例）
 *
 * 背景：需要从**消息列表内部**（`MessageLockBadge` 的点击）唤起验证对话框，
 * 而消息列表按条渲染组件，逐条挂载对话框会实例爆炸（每条消息一个 `n-modal`
 * 且各自触发一次 `getPendingVerifications`）。因此对话框只在会话容器
 * （`ChatMain.vue`，桌面/移动共用的唯一实例）挂载一次，由本模块承载
 * 「谁要打开 + 验证谁」的共享状态。
 *
 * 用模块级 ref 而非 pinia：状态只有两个字段，且需要能在单元测试里直接
 * `reset()` 干净重来，不依赖 store 初始化顺序。
 */
const visible = ref(false)
const target = ref<DeviceVerifyTarget>({})

/** 打开验证对话框；未指定目标时走「验证本账号其它设备」流程 */
export function openDeviceVerification(next: DeviceVerifyTarget = {}): void {
  target.value = { ...next }
  visible.value = true
}

/** 关闭验证对话框并清空目标，避免下次打开残留上一条消息的 userId */
export function closeDeviceVerification(): void {
  visible.value = false
  target.value = {}
}

/** 仅测试使用：把单例状态归零，防止用例间串扰 */
export function resetDeviceVerificationLauncher(): void {
  closeDeviceVerification()
}

export function useDeviceVerifyLauncher() {
  return {
    visible: readonly(visible),
    target: readonly(target),
    open: openDeviceVerification,
    close: closeDeviceVerification
  }
}
