import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { PREFIX_V3 } from '../paths'
import { normalizeSdkMatrixError } from './authErrors'
import { type MatrixLoginResult, postMatrixJson } from './authHelpers'

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

export async function samlLogout(redirectUrl?: string): Promise<string | null> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  try {
    const queryParams = redirectUrl ? { redirectUrl } : undefined
    const result = await authedRequestWithPath<{ redirect_url?: string }>(
      client,
      'POST',
      '/login/saml/logout',
      queryParams
    )
    return result.redirect_url ?? null
  } catch (err) {
    throw normalizeSdkMatrixError(err, 'SAML 登出失败')
  }
}

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
