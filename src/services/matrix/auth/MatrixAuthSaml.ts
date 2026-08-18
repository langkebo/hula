import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { PREFIX_V3 } from '../paths'
import { normalizeSdkMatrixError } from './authErrors'
import { type MatrixLoginResult, postMatrixJson } from './authHelpers'

/** 获取 SAML 登录重定向地址
 *
 * NOTE: SDK getSamlAuthManager().getLoginRedirectUrl() 不支持 idpId 参数，
 * 暂保留 authedRequestWithPath 以传递 idp_id 查询参数。
 */
export async function getSamlRedirect(idpId?: string, redirectUrl?: string): Promise<string> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  try {
    const queryParams: Record<string, string> = {}
    if (idpId) queryParams.idp_id = idpId
    if (redirectUrl) queryParams.redirectUrl = redirectUrl
    const result = await authedRequestWithPath<{ redirect_url?: string }>(
      client,
      'GET',
      '/login/saml/redirect',
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    )
    return result.redirect_url ?? ''
  } catch (err) {
    throw normalizeSdkMatrixError(err, '获取 SAML 重定向失败')
  }
}

/** 处理 SAML 登录回调
 */
export async function handleSamlCallback(
  samlResponse: string,
  relayState?: string,
  sessionId?: string
): Promise<MatrixLoginResult> {
  const body: Record<string, unknown> = { saml_response: samlResponse }
  if (relayState) body.relay_state = relayState
  if (sessionId) body.session_id = sessionId

  return postMatrixJson<MatrixLoginResult>(`${PREFIX_V3}/login/saml/callback`, body, 'SAML 回调处理失败')
}

/** SAML 登出
 */
export async function samlLogout(redirectUrl?: string): Promise<string | null> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  try {
    const manager = client.getSamlAuthManager()
    const result = await manager.logout(redirectUrl)
    return result.redirect_url ?? null
  } catch (err) {
    throw normalizeSdkMatrixError(err, 'SAML 登出失败')
  }
}

/** 获取 SAML 元数据
 *
 * NOTE: SDK getSamlAuthManager().getIdpMetadata() 使用 /_matrix/client/r0/saml/metadata，
 * 与现有 /_matrix/client/v3/login/saml/metadata 路径不一致，暂保留 authedRequestWithPath。
 */
export async function getSamlMetadata(): Promise<Record<string, unknown>> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  try {
    const result = await authedRequestWithPath<Record<string, unknown>>(client, 'GET', '/login/saml/metadata')
    return result
  } catch (err) {
    throw normalizeSdkMatrixError(err, '获取 SAML 元数据失败')
  }
}
