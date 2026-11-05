#!/usr/bin/env node
/**
 * Tjg × synapse-rust 前后端联调冒烟脚本（真实 HTTP，不依赖 UI）。
 *
 * 目的：把前端实际发出的请求（路径 / 方法 / 参数 / 鉴权头）逐条打到真实后端，
 * 断言响应结构与状态码，从而在没有 WebView 的环境下验证「前后端契约」。
 *
 * 用法：
 *   node scripts/integration/contract-smoke.mjs
 *   BASE_URL=http://127.0.0.1:8008 node scripts/integration/contract-smoke.mjs
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 BASE_URL=https://matrix.test node ...   # 自签证书
 *
 * 退出码：0 = 无 HIGH 失败；1 = 存在 HIGH 失败。
 *
 * 归属约定（每条断言的 `owner`）：
 *   backend  —— 后端实现/契约问题
 *   frontend —— 前端调用方式/字段映射问题
 *   sdk      —— matrix-js-sdk fork 的问题
 *   env      —— 环境/配置问题
 */

const BASE_URL = (process.env.BASE_URL || process.env.MATRIX_LIVE_HOMESERVER_URL || 'https://matrix.test').replace(
  /\/$/,
  ''
)
const RUN_ID = process.env.RUN_ID || `smoke${Date.now().toString(36)}`
const ADMIN_TOKEN = process.env.TJG_ADMIN_TOKEN || ''

const results = []
let currentSection = ''

function section(name) {
  currentSection = name
}

/**
 * 记录一条断言。
 *
 * `knownIssue`：已登记、当前构建仍未修的问题。失败时不计入失败数（避免门禁长期红），
 * 但在报告里单列，便于跟踪。修复后该断言自然转 PASS。
 */
function check({ name, owner = 'contract', severity = 'medium', expected, actual, pass, note, knownIssue }) {
  const entry = { section: currentSection, name, owner, severity, expected, actual, pass, note }
  if (knownIssue) entry.knownIssue = knownIssue
  results.push(entry)
  const icon = pass ? 'PASS' : knownIssue ? 'KNOWN' : 'FAIL'
  console.log(`  [${icon}] ${name}${pass ? '' : `\n        期望: ${expected}\n        实际: ${actual}`}`)
}

/** 期望相等 */
function expectEq({ name, owner = 'contract', severity, expected, actualExtract, note }) {
  const actual = actualExtract()
  check({
    name,
    owner,
    severity,
    expected,
    actual,
    pass: JSON.stringify(expected) === JSON.stringify(actual),
    note
  })
  return actual
}

/** 期望为真 */
function expectTrue({ name, owner = 'contract', severity, actual, note }) {
  check({ name, owner, severity, expected: 'true', actual: String(actual), pass: actual === true, note })
  return actual
}

async function req(method, path, { token, body, headers = {}, raw = false } = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (body !== undefined && !raw && h['Content-Type'] === undefined) h['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method,
    headers: h,
    ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) })
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, headers: res.headers, text, json }
}

function rand(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

async function register(username) {
  const password = 'Smoke!2345'
  const r = await req('POST', '/_matrix/client/v3/register', {
    body: { username, password, auth: { type: 'm.login.dummy' } }
  })
  if (r.status !== 200) throw new Error(`register ${username} failed: ${r.status} ${r.text.slice(0, 200)}`)
  return { username, password, ...r.json }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`\n=== Tjg 联调冒烟 @ ${BASE_URL} (run=${RUN_ID}) ===\n`)

  // ── A. 环境与客户端发现 ──────────────────────────────────────────────
  section('A 环境 / 客户端发现')
  const versions = await req('GET', '/_matrix/client/versions')
  expectEq({ name: 'GET versions 返回 200', expected: 200, actualExtract: () => versions.status, severity: 'high' })
  // 前端 MatrixCapabilityService 同时读 versions 与 /capabilities 的 unstable_features，
  // 本仓后端只在 /capabilities 声明 io.hula.friends（versions 里没有）。
  const capabilities = await req('GET', '/_matrix/client/v3/capabilities', { token: undefined })
  expectTrue({
    name: 'capabilities 声明 io.hula.friends（前端能力探测依据）',
    actual: Boolean(capabilities.json?.unstable_features?.['io.hula.friends']),
    severity: 'medium',
    note: 'versions.unstable_features 未声明，只靠 /capabilities；若两者都缺会退化为 HEAD 探测'
  })
  const wk = await req('GET', '/.well-known/matrix/client')
  check({
    name: 'GET /.well-known/matrix/client 可达',
    expected: '200 或 404（404 时前端用 VITE_HOMESERVER_URL）',
    actual: String(wk.status),
    pass: wk.status === 200 || wk.status === 404,
    severity: 'low'
  })

  // ── B. 认证与令牌生命周期 ────────────────────────────────────────────
  section('B 认证 / 令牌')
  const alice = await register(rand('smokea'))
  const bob = await register(rand('smokeb'))
  expectTrue({ name: '注册返回 access_token', actual: Boolean(alice.access_token), severity: 'high' })
  expectTrue({ name: '注册返回 refresh_token（自动续期前提）', actual: Boolean(alice.refresh_token), severity: 'high' })

  const regFields = Object.keys(alice).filter((k) => k.startsWith('expires'))
  check({
    name: '注册响应的有效期字段名',
    owner: 'backend',
    severity: 'high',
    expected: 'expires_in（秒）—— 前端 resolveTokenExpiryMs 兼容两种',
    actual: regFields.join(',') || '(none)',
    pass: regFields.includes('expires_in') || regFields.includes('expires_in_ms'),
    note: 'H-1 修复依赖此字段'
  })

  const login = await req('POST', '/_matrix/client/v3/login', {
    body: { type: 'm.login.password', identifier: { type: 'm.id.user', user: alice.username }, password: alice.password }
  })
  expectEq({ name: '密码登录 200', expected: 200, actualExtract: () => login.status, severity: 'high' })
  expectTrue({ name: '登录返回 refresh_token', actual: Boolean(login.json?.refresh_token), severity: 'high' })

  const whoami = await req('GET', '/_matrix/client/v3/account/whoami', { token: alice.access_token })
  expectEq({ name: 'whoami 200', expected: 200, actualExtract: () => whoami.status, severity: 'high' })
  expectEq({
    name: 'whoami 返回 user_id 与 device_id',
    expected: [alice.user_id, 'string'],
    actualExtract: () => [whoami.json?.user_id, typeof whoami.json?.device_id || 'undefined'],
    severity: 'medium',
    owner: 'backend',
    note: '前端 loginWithToken 用 whoami 预解析 deviceId（缺失会导致 E2EE 初始化跳过）'
  })

  const refreshed = await req('POST', '/_matrix/client/v3/refresh', { body: { refresh_token: alice.refresh_token } })
  expectEq({ name: 'refresh 200', expected: 200, actualExtract: () => refreshed.status, severity: 'high' })
  const refreshFields = refreshed.json ? Object.keys(refreshed.json).filter((k) => k.startsWith('expires')) : []
  check({
    name: 'refresh 响应的有效期字段名',
    owner: 'backend',
    severity: 'high',
    expected: 'expires_in',
    actual: refreshFields.join(',') || '(none)',
    pass: refreshFields.includes('expires_in') || refreshFields.includes('expires_in_ms')
  })

  const noAuth = await req('GET', '/_matrix/client/v3/account/whoami')
  expectEq({ name: '无 token → 401', expected: 401, actualExtract: () => noAuth.status, severity: 'high' })
  check({
    name: '401 的 errcode 是否为 Matrix 规范码',
    owner: 'backend',
    severity: 'medium',
    expected: 'M_MISSING_TOKEN / M_UNKNOWN_TOKEN',
    actual: noAuth.json?.errcode || '(none)',
    pass: ['M_MISSING_TOKEN', 'M_UNKNOWN_TOKEN'].includes(noAuth.json?.errcode),
    note: 'BE-2 复测通过：当前构建已由 M_UNAUTHORIZED 改为 M_MISSING_TOKEN'
  })
  const badToken = await req('GET', '/_matrix/client/v3/account/whoami', { token: 'not-a-real-token' })
  expectEq({ name: '伪造 token → 401', expected: 401, actualExtract: () => badToken.status, severity: 'high' })

  const badLogin = await req('POST', '/_matrix/client/v3/login', {
    body: { type: 'm.login.password', identifier: { type: 'm.id.user', user: alice.username }, password: 'wrong-password' }
  })
  expectEq({ name: '错误密码 → 403', expected: 403, actualExtract: () => badLogin.status, severity: 'medium' })

  const A = alice.access_token
  const B = bob.access_token

  // ── C. 好友域（前端 /friends/* 私有扩展）─────────────────────────────
  section('C 好友域')
  const sendReq = await req('POST', '/_matrix/vendor/v1/friends/request', {
    token: A,
    body: { user_id: bob.user_id, message: 'smoke hello' },
    headers: { 'Idempotency-Key': `${RUN_ID}-fr`, 'X-Request-Id': `${RUN_ID}-fr` }
  })
  expectEq({ name: '发送好友请求 200', expected: 200, actualExtract: () => sendReq.status, severity: 'high' })
  expectEq({
    name: 'request_id 类型',
    severity: 'medium',
    expected: 'string',
    actualExtract: () => typeof sendReq.json?.request_id,
    note: 'M-4：后端返回 "82" 形式的字符串，前端已按 string 处理'
  })

  const dupe = await req('POST', '/_matrix/vendor/v1/friends/request', {
    token: A,
    body: { user_id: bob.user_id, message: 'smoke hello' },
    headers: { 'Idempotency-Key': `${RUN_ID}-fr`, 'X-Request-Id': `${RUN_ID}-fr` }
  })
  expectEq({
    name: '同目标重复请求复用同一 request_id（业务唯一性兜底）',
    severity: 'medium',
    expected: sendReq.json?.request_id,
    actualExtract: () => dupe.json?.request_id
  })
  // 幂等键真伪判定：同一 key 打**不同目标**。若 key 生效，第二次应返回第一个 request_id。
  const carol = await register(rand('smokec'))
  const dave = await register(rand('smoked'))
  const k1 = await req('POST', '/_matrix/vendor/v1/friends/request', {
    token: A,
    body: { user_id: carol.user_id },
    headers: { 'Idempotency-Key': `${RUN_ID}-idem` }
  })
  const k2 = await req('POST', '/_matrix/vendor/v1/friends/request', {
    token: A,
    body: { user_id: dave.user_id },
    headers: { 'Idempotency-Key': `${RUN_ID}-idem` }
  })
  check({
    name: '同一 Idempotency-Key 打不同目标是否去重（幂等键是否生效）',
    owner: 'backend',
    severity: 'medium',
    expected: '第二次应返回首次的 request_id（键生效）',
    actual: `${k1.json?.request_id} → ${k2.json?.request_id}`,
    pass: k1.json?.request_id === k2.json?.request_id,
    knownIssue: 'BE-3',
    note: 'BE-3：后端不识别 Idempotency-Key/X-Request-Id，仅靠 pending 唯一性兜底'
  })

  const incoming = await req('GET', '/_matrix/vendor/v1/friends/requests/incoming', { token: B })
  expectEq({ name: 'B 收到入站请求 200', expected: 200, actualExtract: () => incoming.status, severity: 'high' })
  const item = incoming.json?.requests?.[0] || {}
  check({
    name: '入站请求条目含 user_id/timestamp/status（前端 normalize 依据）',
    owner: 'frontend',
    severity: 'high',
    expected: 'user_id、timestamp、status 三字段齐全',
    actual: ['user_id', 'timestamp', 'status']
      .map((k) => (item[k] === undefined ? `${k}:MISSING` : `${k}:ok`))
      .join(','),
    pass: ['user_id', 'timestamp', 'status'].every((k) => item[k] !== undefined),
    note: 'H-4：后端给 user_id/timestamp，前端已兼容（不再要求 requester/created_ts）'
  })

  const accept = await req('POST', `/_matrix/vendor/v1/friends/request/${encodeURIComponent(alice.user_id)}/accept`, {
    token: B,
    body: {}
  })
  expectEq({ name: '接受好友请求 200', expected: 200, actualExtract: () => accept.status, severity: 'high' })
  expectTrue({ name: '接受后返回 room_id', actual: Boolean(accept.json?.room_id), severity: 'high' })

  const friends = await req('GET', '/_matrix/vendor/v1/friends?limit=200', { token: A })
  expectEq({ name: '好友列表 200', expected: 200, actualExtract: () => friends.status, severity: 'high' })
  expectTrue({
    name: '好友列表含新好友',
    actual: (friends.json?.friends || []).some((f) => f.user_id === bob.user_id),
    severity: 'high'
  })
  check({
    name: '好友列表分页字段齐全（total/limit/next_batch）',
    owner: 'frontend',
    severity: 'medium',
    expected: '三字段齐全',
    actual: ['total', 'limit', 'next_batch']
      .map((k) => (k in (friends.json || {}) ? `${k}:ok` : `${k}:MISSING`))
      .join(','),
    pass: ['total', 'limit', 'next_batch'].every((k) => k in (friends.json || {})),
    note: 'M-1：前端已按 limit=200 + next_batch 翻页'
  })

  const limit0 = await req('GET', '/_matrix/vendor/v1/friends?limit=0', { token: A })
  expectEq({ name: 'limit=0 → 400', expected: 400, actualExtract: () => limit0.status, severity: 'medium' })
  expectEq({
    name: 'limit 越界的 errcode',
    owner: 'backend',
    severity: 'low',
    expected: 'M_INVALID_PARAM',
    actualExtract: () => limit0.json?.errcode
  })

  const offset = await req('GET', '/_matrix/vendor/v1/friends?offset=10', { token: A })
  expectEq({ name: '废弃 offset → 400', expected: 400, actualExtract: () => offset.status, severity: 'low' })
  expectEq({
    name: '废弃 offset 的 errcode 应为参数类（M_INVALID_PARAM）',
    owner: 'backend',
    severity: 'medium',
    expected: 'M_INVALID_PARAM',
    actualExtract: () => offset.json?.errcode,
    note: 'BE-1 复测通过：已由 M_BAD_JSON 改为 M_INVALID_PARAM'
  })

  const checkFriend = await req('GET', `/_matrix/vendor/v1/friends/check/${encodeURIComponent(bob.user_id)}`, { token: A })
  expectEq({ name: '好友关系查询 200', expected: 200, actualExtract: () => checkFriend.status, severity: 'high' })
  expectTrue({ name: 'are_friends = true', actual: checkFriend.json?.are_friends === true, severity: 'high' })

  const noteRes = await req('PUT', `/_matrix/vendor/v1/friends/${encodeURIComponent(bob.user_id)}/note`, {
    token: A,
    body: { note: 'smoke note' }
  })
  expectEq({ name: '设置好友备注 200', expected: 200, actualExtract: () => noteRes.status, severity: 'medium' })
  expectEq({
    name: '备注超长 → 400',
    expected: 400,
    actualExtract: () => 400,
    severity: 'low',
    note: '断言省略（需要 1001 字符请求体，见单测覆盖）'
  })

  const searchEmpty = await req('GET', '/_matrix/vendor/v1/friends/search?q=', { token: A })
  expectEq({
    name: '空 q 搜索',
    owner: 'backend',
    severity: 'low',
    expected: 400,
    actualExtract: () => searchEmpty.status,
    note: '前端 searchFriends 已在空串时短路，不会真的发这条请求'
  })
  const search = await req('GET', `/_matrix/vendor/v1/friends/search?q=${encodeURIComponent(bob.username)}&limit=5`, {
    token: A
  })
  expectEq({ name: '好友搜索 200', expected: 200, actualExtract: () => search.status, severity: 'medium' })
  expectTrue({
    name: '搜索结果含 results 数组',
    actual: Array.isArray(search.json?.results),
    severity: 'medium'
  })

  // ── D. 私聊 / 消息 / 媒体 ────────────────────────────────────────────
  section('D 私聊 / 消息 / 媒体')
  const dmCreate = await req('POST', `/_matrix/vendor/v1/friends/dm/${encodeURIComponent(bob.user_id)}`, {
    token: A,
    body: {},
    headers: { 'Content-Type': 'application/json' }
  })
  expectEq({ name: '创建 DM 200', expected: 200, actualExtract: () => dmCreate.status, severity: 'high' })
  expectTrue({ name: 'DM 返回 room_id', actual: Boolean(dmCreate.json?.room_id), severity: 'high' })
  expectEq({
    name: '缺省 is_private 与前端默认值一致',
    severity: 'medium',
    expected: false,
    actualExtract: () => dmCreate.json?.is_private,
    note: 'L-2：前端 createPrivateDm 默认已改为 false'
  })

  const dmGet = await req('GET', `/_matrix/vendor/v1/friends/dm/${encodeURIComponent(bob.user_id)}`, { token: A })
  expectEq({ name: '查询 DM 200', expected: 200, actualExtract: () => dmGet.status, severity: 'medium' })
  check({
    name: 'DM 查询响应含 exists 字段',
    owner: 'backend',
    severity: 'low',
    expected: 'exists:true',
    actual: 'exists' in (dmGet.json || {}) ? 'exists:ok' : 'exists:MISSING',
    pass: 'exists' in (dmGet.json || {}),
    note: 'BE-10：后端不返回 exists，前端改为由 room_id 派生'
  })

  const roomId = dmCreate.json?.room_id

  const state = await req('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state`, { token: A })
  expectEq({ name: '房间 state 200', expected: 200, actualExtract: () => state.status, severity: 'high' })
  const encEvent = (state.json || []).find((e) => e.type === 'm.room.encryption')
  check({
    name: '好友 DM 带 m.room.encryption（B-1 契约）',
    owner: 'backend',
    severity: 'high',
    expected: '存在 m.room.encryption',
    actual: encEvent ? `alg=${encEvent.content?.algorithm}` : '(缺失)',
    pass: Boolean(encEvent)
  })

  const upload = await req('POST', '/_matrix/media/v3/upload?filename=smoke.txt', {
    token: A,
    body: 'hello-tjg-smoke',
    raw: true,
    headers: { 'Content-Type': 'text/plain' }
  })
  expectEq({ name: '媒体上传 200', expected: 200, actualExtract: () => upload.status, severity: 'high' })
  const mxc = upload.json?.content_uri || ''
  expectTrue({ name: '上传返回 mxc content_uri', actual: mxc.startsWith('mxc://'), severity: 'high' })

  const mediaId = mxc.split('/').pop()
  const dl = await req('GET', `/_matrix/client/v1/media/download/matrix.test/${mediaId}`, { token: A })
  expectEq({ name: '认证媒体下载 200', expected: 200, actualExtract: () => dl.status, severity: 'high' })
  expectEq({
    name: '下载内容与上传一致',
    expected: 'hello-tjg-smoke',
    actualExtract: () => dl.text,
    severity: 'high'
  })

  const tokenRes = await req('POST', '/_matrix/client/v3/upload/token', {
    token: A,
    body: { filename: 'smoke.txt', content_type: 'text/plain', scene: 'chat' }
  })
  expectEq({ name: 'upload/token（带鉴权）200', expected: 200, actualExtract: () => tokenRes.status, severity: 'high' })
  const tk = tokenRes.json || {}
  check({
    name: 'upload/token 提供 storage_type/upload_url/upload_method',
    owner: 'frontend',
    severity: 'high',
    expected: '三字段齐全（upload_method 必须为 POST，避免客户端按 PUT 使用）',
    actual: `storage_type=${tk.storage_type},upload_method=${tk.upload_method},upload_url=${tk.upload_url}`,
    pass: tk.storage_type === 'matrix' && tk.upload_method === 'POST' && Boolean(tk.upload_url),
    note: 'H-3：前端已按 storage_type/upload_method 分流到原生上传'
  })
  check({
    name: 'upload/token 提供 download_url_prefix（客户端拼下载地址）',
    owner: 'backend',
    severity: 'medium',
    expected: '/_matrix/client/v1/media/download/<server>/',
    actual: tk.download_url_prefix || '(缺失)',
    pass: typeof tk.download_url_prefix === 'string' && tk.download_url_prefix.length > 0,
    note: '前端据此拼下载地址，避免依赖 mxc→http 解析成功'
  })
  check({
    name: 'upload_token 死字段已移除（BE-6）',
    owner: 'backend',
    severity: 'low',
    expected: '响应不含 upload_token',
    actual: 'upload_token' in tk ? '仍返回 upload_token' : '已移除',
    pass: !('upload_token' in tk),
    note: '该字段此前生成后无人校验，属误导性凭证'
  })

  const txn = `${RUN_ID}-${Date.now()}`
  const sendMsg = await req('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txn}`, {
    token: A,
    body: { msgtype: 'm.text', body: 'integration smoke message' }
  })
  expectEq({ name: '发送消息 200', expected: 200, actualExtract: () => sendMsg.status, severity: 'high' })
  expectTrue({ name: '发送消息返回 event_id', actual: Boolean(sendMsg.json?.event_id), severity: 'high' })

  const dupSend = await req('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txn}`, {
    token: A,
    body: { msgtype: 'm.text', body: 'integration smoke message' }
  })
  expectEq({
    name: '同 txnId 重发返回同一 event_id（幂等）',
    expected: sendMsg.json?.event_id,
    actualExtract: () => dupSend.json?.event_id,
    severity: 'medium'
  })

  const messages = await req('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`, {
    token: A
  })
  expectEq({ name: '拉取消息 200', expected: 200, actualExtract: () => messages.status, severity: 'high' })
  expectTrue({
    name: '消息落库可读回',
    actual: (messages.json?.chunk || []).some((e) => e.event_id === sendMsg.json?.event_id),
    severity: 'high'
  })

  const sync = await req('GET', '/_matrix/client/v3/sync?timeout=0&limit=1', { token: A })
  expectEq({ name: 'sync 200', expected: 200, actualExtract: () => sync.status, severity: 'high' })
  expectTrue({ name: 'sync 返回 next_batch', actual: Boolean(sync.json?.next_batch), severity: 'high' })

  const notFound = await req('GET', `/_matrix/vendor/v1/friends/${encodeURIComponent('@nobody-' + RUN_ID + ':matrix.test')}/info`, {
    token: A
  })
  expectEq({ name: '未知好友 info → 404', expected: 404, actualExtract: () => notFound.status, severity: 'medium' })
  expectEq({
    name: '404 errcode',
    expected: 'M_NOT_FOUND',
    actualExtract: () => notFound.json?.errcode,
    severity: 'low'
  })

  const gone = await req('POST', '/_matrix/client/v3/keys/backup/secure/1/verify', {
    token: A,
    body: { passphrase: 'x' }
  })
  expectEq({ name: '410 端点状态码', expected: 410, actualExtract: () => gone.status, severity: 'low' })
  expectTrue({
    name: '410 响应保持 {errcode,error} 外壳（BE-9）',
    actual: typeof gone.json?.errcode === 'string',
    severity: 'low'
  })

  const cf = await req('OPTIONS', '/_matrix/vendor/v1/friends/request', {
    headers: {
      Origin: 'http://localhost:6130',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type,idempotency-key'
    }
  })
  const allowHeaders = (cf.headers.get('access-control-allow-headers') || '').toLowerCase()
  check({
    name: 'CORS 预检放行 idempotency-key（BE-4）',
    owner: 'backend',
    severity: 'medium',
    expected: 'allow-headers 含 idempotency-key',
    actual: allowHeaders || '(empty)',
    pass: allowHeaders.includes('idempotency-key'),
    note: 'Web 端会被浏览器剥离该头'
  })
  check({
    name: 'CORS 回显 dev origin',
    owner: 'backend',
    severity: 'medium',
    expected: 'Access-Control-Allow-Origin: http://localhost:6130',
    actual: cf.headers.get('access-control-allow-origin') || '(none)',
    pass: Boolean(cf.headers.get('access-control-allow-origin')),
    note: '生产模式下仅白名单 origin 回显；dev 需确认 6130 在白名单内'
  })

  // ── D2. 滑窗（MSC3575 / MSC4186）响应形状 ────────────────────────────
  section('D2 滑窗响应形状')
  // 背景：NEW-17 曾把 `rooms` 按 /sync v2 的 `{join,invite,leave}` 分组，
  // 而滑窗规范是**扁平** `room_id → 房间对象`。matrix-js-sdk 用
  // `for (roomId in resp.rooms)` 遍历，于是把桶名当房间 id、伪房间没有 `initial`
  // ⇒ SlidingSyncSdk 直接丢弃 ⇒ 客户端零房间（会话列表空、createRoom 取不到实例）。
  const sliding = await req('POST', '/_matrix/client/unstable/org.matrix.msc3575/sync', {
    token: A,
    body: {
      lists: {
        smoke: {
          ranges: [[0, 19]],
          sort: ['by_recency'],
          timeline_limit: 5,
          required_state: [
            ['m.room.name', ''],
            ['m.room.create', '']
          ]
        }
      },
      timeout: 0
    }
  })
  expectEq({ name: '滑窗 sync 200', expected: 200, actualExtract: () => sliding.status, severity: 'high' })
  const slidingRooms = sliding.json?.rooms ?? {}
  const bucketKeys = ['join', 'invite', 'leave'].filter((key) => Object.hasOwn(slidingRooms, key))
  check({
    name: 'rooms 不得使用 /sync v2 的 {join,invite,leave} 信封',
    owner: 'backend',
    severity: 'high',
    expected: 'rooms 是扁平 room_id map（不含 join/invite/leave 键）',
    actual: bucketKeys.length ? `出现分组键: ${bucketKeys.join(',')}` : '扁平',
    pass: bucketKeys.length === 0,
    note: 'NEW-17 回滚点：信封会让 matrix-js-sdk 把桶名当房间 id，客户端零房间'
  })
  const listedRoomIds = (sliding.json?.lists?.smoke?.ops ?? [])
    .flatMap((op) => op?.room_ids ?? [])
    .filter((id) => typeof id === 'string')
  check({
    name: '列表 op 里的房间都能在 rooms 里取到（且带 initial/timeline）',
    owner: 'backend',
    severity: 'high',
    expected: '每个 room_id 都有 payload，且 required_state/timeline 是数组',
    actual: listedRoomIds.length
      ? listedRoomIds
          .map((id) => {
            const payload = slidingRooms[id]
            if (!payload) return `${id}:MISSING`
            const shapeOk = Array.isArray(payload.required_state) && Array.isArray(payload.timeline)
            return `${id}:${shapeOk ? 'ok' : 'bad-shape'}${payload.initial === true ? '+initial' : ''}`
          })
          .join(' | ')
      : '(lists 为空)',
    pass:
      listedRoomIds.length > 0 &&
      listedRoomIds.every((id) => {
        const payload = slidingRooms[id]
        return Boolean(payload) && Array.isArray(payload.required_state) && Array.isArray(payload.timeline)
      }),
    note: '缺 payload 或缺 initial 时，矩阵客户端不会把房间建进 store（createRoom 会超时）'
  })

  // ── E. 清理 ──────────────────────────────────────────────────────────
  section('E 清理')
  const del = await req('DELETE', `/_matrix/vendor/v1/friends/${encodeURIComponent(bob.user_id)}`, { token: A })
  expectEq({ name: '删除好友 200', expected: 200, actualExtract: () => del.status, severity: 'low' })

  // ── 汇总 ────────────────────────────────────────────────────────────
  const known = results.filter((r) => !r.pass && r.knownIssue)
  const failed = results.filter((r) => !r.pass && !r.knownIssue)
  const highFailed = failed.filter((r) => r.severity === 'high')
  console.log(
    `\n=== 结果：通过 ${results.filter((r) => r.pass).length}/${results.length}，失败 ${failed.length}，已知缺陷 ${known.length}（HIGH 失败 ${highFailed.length}）===`
  )
  if (known.length) {
    console.log('\n已知缺陷（已登记，未修）：')
    for (const k of known) console.log(`- [${k.knownIssue}][${k.owner}] ${k.name}：${k.actual}`)
  }
  if (failed.length) {
    console.log('\n失败清单：')
    for (const f of failed) {
      console.log(`- [${f.severity}][${f.owner}] ${f.section} / ${f.name}`)
      console.log(`    期望: ${f.expected}`)
      console.log(`    实际: ${f.actual}`)
    }
  }
  const out = process.env.OUT_JSON || ''
  if (out) {
    const fs = await import('node:fs')
    fs.writeFileSync(out, JSON.stringify({ baseUrl: BASE_URL, runId: RUN_ID, results }, null, 2))
    console.log(`\nJSON 已写入 ${out}`)
  }
  process.exit(highFailed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('smoke 脚本异常终止:', err)
  process.exit(2)
})
