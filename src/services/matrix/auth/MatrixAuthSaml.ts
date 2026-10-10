import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '../MatrixClientService'
import { PREFIX_V3 } from '../paths'
import { normalizeSdkMatrixError } from './authErrors'
import { type MatrixLoginResult, postMatrixJson } from './authHelpers'

/** 获取 SAML 登录重定向地址
 *
 * P2-2 收口（2026-10-10）：改走 `client.getSamlAuthManager().getLoginRedirectUrl()`。
 *
 * 旧实现自带 `GET /login/saml/redirect` 裸调 —— 该路径**后端根本不存在**
 * （`synapse-web/src/routes/saml.rs` 与镜像 route-manifest **双双零命中**，
 * 后端实际注册的是 `GET /_matrix/client/v3/login/sso/redirect/saml`）⇒ 恒 404；
 * 且它顺带下发的 `idp_id` 后端也不认（`SamlLoginQuery` 带 `deny_unknown_fields`，
 * 只声明 `redirectUrl`/`redirect_url`）。
 *
 * `idpId` 形参一并删除：本后端的 IdP 选择靠**字面量路径段**（`/saml`、`/cas`）
 * 而非查询参数，路由表中不存在 `{idp_id}` 形态 ⇒ 该参数无落点，留着即撒谎。
 * `getLoginRedirectUrl` 是纯 URL 拼接（无网络请求），返回的地址供浏览器跳转，
 * 与后端 `saml_login_redirect` 的 302 语义一致（浏览器访问 homeserver → 302 → IdP）。
 */
export async function getSamlRedirect(redirectUrl?: string): Promise<string> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  try {
    return client.getSamlAuthManager().getLoginRedirectUrl(redirectUrl ?? '')
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
 * P2-1 收口：使用 `client.getSamlAuthManager().getIdpMetadata()` 收口后端
 * `/_matrix/client/v3/saml/metadata`（SDK 内部以 ClientPrefix.V3 拼接，
 * 与 `synapse-web/src/routes/saml.rs` 注册的路由一致），移除裸调 authedRequestWithPath。
 */
export async function getSamlMetadata(): Promise<Record<string, unknown>> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  try {
    const manager = client.getSamlAuthManager()
    const result = await manager.getIdpMetadata()
    return result
  } catch (err) {
    throw normalizeSdkMatrixError(err, '获取 SAML 元数据失败')
  }
}
