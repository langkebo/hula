/**
 * MEDIA 路径常量。
 *
 * 上传 / 配额 / 配置 / 删除 / 具名上传 / 预览端点已全部迁移到
 * `client.getMediaManager()`（MediaManager 内部维护 SDK 路由表），
 * 此处仅保留 L2 服务仍直接引用的两个非 SDK 路由常量：
 *   - DOWNLOAD_PREFIX：MatrixUrlPreviewService 拼接 mxc→http 下载 URL
 *   - MEDIA_PREFIX：MatrixUrlPreviewService 排除媒体链接
 *
 * 新增媒体路径常量前，请优先评估是否应通过 MediaManager 暴露。
 */
export const MEDIA = {
  DOWNLOAD_PREFIX: '/_matrix/media/r0/download/',
  MEDIA_PREFIX: '/_matrix/media/'
} as const
