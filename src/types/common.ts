/**
 * 通用类型映射 - 替代部分 any
 */

// ==================== 业务特定类型 ====================

/** 位置信息数据 */
export type LocationData = {
  latitude: number
  longitude: number
  address?: string
  timestamp: number
}
