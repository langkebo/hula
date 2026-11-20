import type {
  CreateSessionResponse,
  GetMessagesResponse,
  RendezvousMessage,
  RendezvousSession,
  SendMessageResponse,
  UpdateSessionResponse
} from '../../MatrixRendezvousService'

type RendezvousServiceModule = typeof import('../../MatrixRendezvousService')

/**
 * `completeSession()` 的返回契约。服务没有导出命名类型，直接从方法签名推导，
 * 避免手写一份可能与服务脱节的凭证结构。
 */
export type RendezvousLoginCredentials = NonNullable<
  Awaited<ReturnType<RendezvousServiceModule['matrixRendezvousService']['completeSession']>>
>

/** `createSession()` 的响应（`CreateSessionResponse`） */
export function makeCreateSessionResponse(overrides: Partial<CreateSessionResponse> = {}): CreateSessionResponse {
  return { url: 'https://hs.test/rendezvous/s1', session_id: 's1', key: 'k1', ...overrides }
}

/** `getSession()` 的会话详情（`RendezvousSession`），`created_ts` 为必填 */
export function makeRendezvousSession(overrides: Partial<RendezvousSession> = {}): RendezvousSession {
  return {
    session_id: 's1',
    intent: 'login.start',
    transport: 'http.v1',
    status: 'connected',
    created_ts: 1_700_000_000_000,
    ...overrides
  }
}

/** `updateSession()` / `connectToSession()` 的响应（`UpdateSessionResponse`） */
export function makeUpdateSessionResponse(overrides: Partial<UpdateSessionResponse> = {}): UpdateSessionResponse {
  return { session_id: 's1', status: 'connected', ...overrides }
}

/** Rendezvous 消息（`RendezvousMessage`），type 与 content 均由后端原样透传 */
export function makeRendezvousMessage(overrides: Partial<RendezvousMessage> = {}): RendezvousMessage {
  return {
    type: 'm.login.protocol',
    content: { protocol: 'org.matrix.msc3906.v1' },
    ...overrides
  }
}

/** `sendMessage()` 的响应（`SendMessageResponse`） */
export function makeSendMessageResponse(overrides: Partial<SendMessageResponse> = {}): SendMessageResponse {
  return { session_id: 's1', message_id: 'm1', sent_ts: 1, ...overrides }
}

/** `getMessages()` 的响应（`GetMessagesResponse`） */
export function makeGetMessagesResponse(messages: RendezvousMessage[]): GetMessagesResponse {
  return { messages }
}

/** `completeSession()` 的成功返回（登录凭证） */
export function makeRendezvousLoginCredentials(
  overrides: Partial<RendezvousLoginCredentials> = {}
): RendezvousLoginCredentials {
  return { access_token: 'at', device_id: 'DEV', user_id: '@u:hs', ...overrides }
}
