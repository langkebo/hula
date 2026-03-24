import { ImUrlEnum, TauriCommand, type NotificationTypeEnum } from '@/enums'
import type { RegisterUserReq, UserItem } from '@/services/types'
import { ErrorType, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useChatStore } from '../stores/chat'
import { useGroupStore } from '../stores/group'
import { Result, err } from '@/common/result'
import { AppException } from '@/common/exception'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'

/**
 * ============================================================================
 * ⚠️ 废弃警告 (Deprecation Warning)
 * ============================================================================
 *
 * 本文件包含的所有函数均为遗留 IM API，已被 Matrix 原生服务替代。
 *
 * 请使用以下 Matrix 原生服务代替本文件中的相应功能：
 *
 * | 旧 ImRequestUtils 函数 | 替代 Matrix 服务 |
 * |----------------------|------------------|
 * | sendMessageStream | MatrixMessageService.sendTextMessage |
 * | getMessageList | MatrixMessageService.getMessageEvents |
 * | addFriend | MatrixContactService.inviteUser |
 * | searchFriend | MatrixContactService.searchUsers |
 * | getGroupList | MatrixGroupService.getAllRooms |
 * | createGroup | MatrixGroupService.createRoom |
 * | getQrCode | MatrixQrLoginService.generateQR |
 * | loginByQrCode | MatrixQrLoginService.handleConfirm |
 *
 * 新的 Matrix 服务位于: src/services/matrix/
 *
 * 导入示例:
 * ```typescript
 * import { matrixMessageService, matrixContactService, matrixGroupService } from '@/services/matrix'
 * ```
 *
 * ============================================================================
 */

/**
 * IM 请求参数接口
 */
interface ImRequestParams {
  url: ImUrlEnum
  body?: Record<string, unknown>
  params?: Record<string, string | number | number[]>
}

/**
 * IM 请求选项接口
 */
interface ImRequestOptions {
  showError?: boolean
  customErrorMessage?: string
  errorType?: ErrorType
  silent?: boolean
  retry?: {
    maxRetries?: number
    retryDelay?: number
  }
}

export async function imRequest<T = any>(
  requestParams: ImRequestParams,
  options?: Omit<ImRequestOptions, 'silent'>
): Promise<T> {
  const { retry, ...invokeOptions } = options || {}

  // 构建调用参数
  const args = {
    url: requestParams.url,
    body: requestParams.body || null,
    params: requestParams.params || null
  }

  // 如果需要重试
  if (retry) {
    const { invokeWithRetry } = await import('@/utils/TauriInvokeHandler')
    return await invokeWithRetry<T>('im_request_command', args, {
      ...retry,
      showError: invokeOptions.showError,
      customErrorMessage: invokeOptions.customErrorMessage
    })
  }

  // 普通调用
  return await invokeWithErrorHandler<T>('im_request_command', args, {
    ...invokeOptions,
    errorType: invokeOptions.errorType || ErrorType.Network
  })
}

/**
 * 使用 Result 模型的新版 IM API 请求工具
 */
export async function imRequestResult<T = any>(
  requestParams: ImRequestParams,
  options?: Omit<ImRequestOptions, 'silent'>
): Promise<Result<T, AppException>> {
  const { retry, ...invokeOptions } = options || {}

  // 构建调用参数
  const args = {
    url: requestParams.url,
    body: requestParams.body,
    params: requestParams.params
  }

  const { maxRetries = 3, retryDelay = 1000 } = retry || {}
  let attempt = 0

  while (attempt < maxRetries) {
    const isLastAttempt = attempt === maxRetries - 1

    // 最后一次尝试时使用用户配置的 showError，否则不显示错误（静默重试）
    const currentOptions = {
      ...invokeOptions,
      showError: isLastAttempt ? invokeOptions.showError : false,
      isRetryError: !isLastAttempt
    }

    const result = await invokeWithResult<T>((TauriCommand as any).IM_REQUEST || 'im_request', args, currentOptions)

    if (result.isOk()) {
      return result
    }

    const error = result.error

    // 如果不是最后一次尝试，且是网络或服务器错误，则进行重试
    if (!isLastAttempt && (error.type === ErrorType.Network || error.type === ErrorType.Server)) {
      console.warn(`请求失败，准备第 ${attempt + 1} 次重试...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
      attempt++
      continue
    }

    return result
  }

  return err(new AppException('Max retries exceeded'))
}

/**
 * 带重试机制的 IM 请求
 *
 * @example
 * ```typescript
 * const result = await imRequestWithRetry({
 *   url: ImUrlEnum.GET_CONTACT_LIST,
 *   params: { pageSize: 100 }
 * }, {
 *   maxRetries: 5,
 *   retryDelay: 2000
 * })
 * ```
 */
export async function imRequestWithRetry<T = any>(
  requestParams: ImRequestParams,
  retryOptions?: {
    maxRetries?: number
    retryDelay?: number
    showError?: boolean
    customErrorMessage?: string
  }
): Promise<T> {
  return await imRequest<T>(requestParams, {
    retry: retryOptions,
    showError: retryOptions?.showError,
    customErrorMessage: retryOptions?.customErrorMessage
  })
}

/**
 * 快捷方法：获取用户详情
 */
export async function getUserDetail() {
  return await imRequest({
    url: ImUrlEnum.GET_USER_INFO_DETAIL
  })
}

/**
 * 快捷方法：获取群组详情
 */
export async function getGroupDetail(roomId: string) {
  return await imRequest({
    url: ImUrlEnum.GROUP_DETAIL,
    params: { id: roomId }
  })
}

export async function getMsgReadCount(msgIds: number[]) {
  return await imRequest({
    url: ImUrlEnum.GET_MSG_READ_COUNT,
    params: {
      msgIds
    }
  })
}

export async function getBadgeList() {
  return await imRequest({
    url: ImUrlEnum.GET_BADGE_LIST
  })
}

export async function setUserBadge(body: { badgeId: string }) {
  return await imRequest({
    url: ImUrlEnum.SET_USER_BADGE,
    body
  })
}

export async function getAllUserState() {
  return await imRequest({
    url: ImUrlEnum.GET_ALL_USER_STATE
  })
}

export async function changeUserState(params: { id: string }) {
  return await imRequest({
    url: ImUrlEnum.CHANGE_USER_STATE,
    params
  })
}

export async function deleteFriend(body: { targetUid: string }) {
  return await imRequest({
    url: ImUrlEnum.DELETE_FRIEND,
    body
  })
}

export async function modifyFriendRemark(body: { targetUid: string; remark: string }) {
  return await imRequest({
    url: ImUrlEnum.MODIFY_FRIEND_REMARK,
    body
  })
}

export async function createGroup(body: { uidList: string[] }) {
  return await imRequest({
    url: ImUrlEnum.CREATE_GROUP,
    body
  })
}

export async function setSessionTop(body: { roomId: string; top: boolean }) {
  return await imRequest({
    url: ImUrlEnum.SET_SESSION_TOP,
    body
  })
}

export async function notification(body: { roomId: string; type: NotificationTypeEnum }) {
  return await imRequest({
    url: ImUrlEnum.NOTIFICATION,
    body
  })
}

export async function shield(body: { roomId: string; state: boolean }) {
  return await imRequest({
    url: ImUrlEnum.SHIELD,
    body
  })
}

export async function updateRoomInfo(body: { id: string; name?: string; avatar?: string; allowScanEnter?: boolean }) {
  const chatStore = useChatStore()
  const groupStore = useGroupStore()

  body.name = body.name ?? groupStore.countInfo?.groupName ?? groupStore.countInfo?.name
  body.avatar = body.avatar ?? groupStore.countInfo?.avatar ?? undefined
  body.allowScanEnter = body.allowScanEnter ?? groupStore.countInfo?.allowScanEnter

  await imRequest({
    url: ImUrlEnum.UPDATE_ROOM_INFO,
    body
  })

  chatStore.updateSession(body.id, body)
  groupStore.updateGroupDetail(body.id, body)

  window.$message.success('更新成功')
}

export async function initConfig() {
  return await imRequest({
    url: ImUrlEnum.INIT_CONFIG
  })
}

export async function getQiniuToken(params?: { scene?: string; fileName?: string }) {
  return await imRequest({
    url: ImUrlEnum.GET_QINIU_TOKEN,
    params: params || undefined
  })
}

/** 获取默认上传提供者 */
let __uploadProviderCache: { provider: 'qiniu' | 'minio' } | null = null
let __uploadProviderPending: Promise<{ provider: 'qiniu' | 'minio' }> | null = null

export async function getUploadProvider(): Promise<{ provider: 'qiniu' | 'minio' }> {
  if (__uploadProviderCache) return __uploadProviderCache
  if (__uploadProviderPending) return await __uploadProviderPending
  __uploadProviderPending = imRequest<{ provider: 'qiniu' | 'minio' }>({
    url: ImUrlEnum.STORAGE_PROVIDER
  }).then((res) => {
    __uploadProviderCache = res
    __uploadProviderPending = null
    return res
  })
  return await __uploadProviderPending
}

export async function register(body: RegisterUserReq) {
  return await imRequest({
    url: ImUrlEnum.REGISTER,
    body
  })
}

export async function logout(body: { autoLogin: boolean }) {
  return await imRequest({
    url: ImUrlEnum.LOGOUT,
    body
  })
}

export async function generateQRCode(): Promise<UserItem[]> {
  return await imRequest({
    url: ImUrlEnum.GENERATE_QR_CODE
  })
}

export async function checkQRStatus(params: {
  qrId: string
  clientId: string
  deviceHash: string
  deviceType: string
}): Promise<UserItem[]> {
  return await imRequest(
    {
      url: ImUrlEnum.CHECK_QR_STATUS,
      params
    },
    {
      showError: false
    }
  )
}

// 扫描二维码
export async function scanQRCodeAPI(data: { qrId: string }) {
  return await imRequest({
    url: ImUrlEnum.SCAN_QR_CODE,
    body: data
  })
}

// 确认登录
export async function confirmQRCodeAPI(data: { qrId: string }) {
  return await imRequest({
    url: ImUrlEnum.CONFIRM_QR_CODE,
    body: data
  })
}

// 查看单条朋友圈
// ==================== 朋友圈点赞相关 ====================
// ==================== 朋友圈评论相关 ====================

/**
 * SSE 流式数据事件类型
 */
interface SseStreamEvent {
  eventType: 'chunk' | 'done' | 'error'
  data?: string
  error?: string
  requestId: string
}

/**
 * 流式数据回调函数
 */
export interface StreamCallbacks {
  onChunk?: (chunk: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string) => void
  onStart?: (requestId: string) => void
}

// 获得指定对话的消息列表
// 删除单条消息
// 删除指定对话的消息
// 获取会话列表（我的）
// 获得【我的】聊天对话
// 创建会话（我的）
// 更新会话（我的）
// 删除会话（我的）- 支持批量删除
// 模型页面
// 更新模型
// 删除模型
// 获得模型剩余使用次数
// ==================== AI 图片生成 ====================
// 生成图片
// 根据ID列表获取【我的】图片记录
// 删除【我的】图片记录
// ==================== AI 视频生成 ====================

// 获取【我的】视频生成分页
// 获取【我的】视频生成记录
// 根据ID列表获取【我的】视频记录
// 生成视频
// 删除【我的】视频记录
// ==================== API 密钥管理 ====================

// API 密钥分页列表
// API 密钥简单列表（用于下拉选择）
// 创建 API 密钥
// 更新 API 密钥
// 删除 API 密钥
// 获取平台列表
// 添加平台模型到示例列表
// 查询 API 密钥余额
// ==================== 聊天角色管理 ====================

// 聊天角色分页列表
// 聊天角色类别列表
// 创建聊天角色
// 更新聊天角色
// 删除聊天角色
// ==================== AI 音频生成 ====================

// 生成音频
// 获取我的音频列表（根据ID列表）
// 获取我的音频分页
// 获取我的单个音频
// 删除我的音频
// 获取指定模型支持的声音列表
// 保存生成内容消息（用于音频、图片、视频等生成功能）
