/** 能力三态：ready 可用 / degraded 降级可用 / unavailable 不可用 */
export type CapabilityState = 'ready' | 'degraded' | 'unavailable'

/**
 * 能力面板展示条目。
 * 只承载展示数据，能力判定与请求由服务层负责（见 MatrixCapabilityService）。
 */
export interface CapabilityItem {
  /** 能力标识，用于回调定位（retry / openSettings） */
  key: string
  /** 展示名称，由调用方完成 i18n 解析后传入 */
  label: string
  state: CapabilityState
  /** 补充说明，例如降级原因或不可用限制 */
  hint?: string
}
