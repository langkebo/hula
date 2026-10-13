/**
 * MatrixHttpClient 的 AI 扩展端点闸门。
 *
 * 从 `MatrixHttpClient.ts` 抽出：该文件已达 400 行的新文件上限（`check:file-size`），
 * 而本轮要把媒体原始 body 上传通道并入同一客户端，必须先腾出等量空间。
 * 这里只承载「AI 扩展端点清单 + 是否启用」这一组无状态判据，行为与抽出前完全一致。
 */

/** AI 扩展开关（构建期常量；关闭时相关端点直接短路，不打网络）。 */
export const AI_EXTENSION_ENABLED = import.meta.env.VITE_AI_EXTENSION_ENABLED === 'true'

/** 受 AI 扩展开关管辖的端点路径（URL 末段，不含前缀与查询串）。 */
export const AI_EXTENSION_ENDPOINTS = new Set<string>([
  'getAssistantModelList',
  'mapCoordTranslate',
  'mapReverseGeocode',
  'mapStatic',
  'messageSendStream',
  'messageSaveGeneratedContent',
  'messageListByConversationId',
  'messageDelete',
  'messageDeleteByConversationId',
  'conversationPage',
  'conversationGetMy',
  'conversationCreateMy',
  'conversationUpdateMy',
  'conversationDeleteMy',
  'modelRemainingUsage',
  'modelPage',
  'modelUpdate',
  'modelDelete',
  'imageMyPage',
  'imageMyListByIds',
  'imageDraw',
  'videoMyPage',
  'videoMyListByIds',
  'videoGenerate',
  'audioMyPage',
  'audioMyListByIds',
  'audioGenerate',
  'audioVoices',
  'apiKeyPage',
  'apiKeySimpleList',
  'apiKeyCreate',
  'apiKeyUpdate',
  'apiKeyDelete',
  'apiKeyBalance',
  'platformList',
  'platformAddModel',
  'chatRolePage',
  'chatRoleCategoryList',
  'chatRoleCreate',
  'chatRoleUpdate',
  'chatRoleDelete'
])

/**
 * 判断请求路径是否命中受开关管辖的 AI 扩展端点。
 *
 * @param url 请求路径（可含前导斜杠与查询串）
 */
export function isAiExtensionEndpoint(url: string): boolean {
  const trimmed = url.replace(/^\/+/, '').split(/[?#]/)[0]
  return AI_EXTENSION_ENDPOINTS.has(trimmed)
}

/** AI 扩展被构建期开关关闭时抛出，用于把「未启用」与真实网络错误区分开。 */
export class AIExtensionDisabledError extends Error {
  constructor(endpoint: string) {
    super(`AI extension endpoint disabled: ${endpoint}`)
    this.name = 'AIExtensionDisabledError'
  }
}
