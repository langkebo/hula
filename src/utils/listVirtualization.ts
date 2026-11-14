/**
 * 列表虚拟化统一阈值（需求文档 16.1）。
 * 扁平列表、分组列表与空间列表共用，避免各自维护魔法数字导致阈值不一致。
 */
export const LIST_VIRTUALIZATION_THRESHOLD = 100
