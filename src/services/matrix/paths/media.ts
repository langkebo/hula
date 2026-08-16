/**
 * MEDIA 路径常量。
 *
 * 上传 / 配额 / 配置 / 删除 / 具名上传 / 预览端点已全部迁移到
 * `client.getMediaManager()`（MediaManager 内部维护 SDK 路由表）；
 * MatrixUrlPreviewService 已移除，此前由它引用的 DOWNLOAD_PREFIX / MEDIA_PREFIX
 * 已随之删除。当前没有 L2 服务直接引用的媒体路径常量。
 *
 * 新增媒体路径常量前，请优先评估是否应通过 MediaManager 暴露。
 */
export const MEDIA = {} as const
