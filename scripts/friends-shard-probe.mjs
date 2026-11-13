#!/usr/bin/env node
/**
 * B2 / B3 / B4 专项复验（2026-11-13，镜像 `6.3.0-7d61dbffa`）。
 *
 * 背景（报告 §4.13-⑤）：
 * - B2 同一 shard 追加好友会**覆盖**该 shard 已有好友（`af…` 后再加 `ag…`，shard A 只剩 1 人）；
 * - B3 好友列表读缓存不失效（fingerprint 取 shard `version`，B2 场景下 version 恒 2 ⇒ 最长 300s 旧数据）；
 * - B4 `M_UNKNOWN` 同码多义（400/409/500/501/503 共用，客户端只能靠 HTTP 状态猜）。
 *
 * 本脚本的判据是**双层**的（服务端 DB + API 读回），只满足一层不算通过：
 *   B2：shard 的 `friends` 是并集且 `version` 单调递增；API 列表条数同步增长。
 *   B3：每次写入后**立即** `GET /friends` 就能看到新好友（不等 5 分钟 TTL）。
 *   B4：`M_UNKNOWN` 响应体带机器可读 `meaning`，且同一 code 不同状态码含义唯一。
 *
 * 用法：node scripts/friends-shard-probe.mjs
 * 前置：后端在 http://127.0.0.1:8008，且容器名 synapse-postgres（DB 直查用）。
 */
import { execFileSync } from 'node:child_process'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const PW = 'Shard!probe9x8y7z'
const FRIENDS_LIST = '/_matrix/vendor/v1/friends'

const results = []
const rec = (id, name, level, detail, evidence) => {
  results.push({ id, name, level, detail })
  const tag = { pass: '✅', fail: '❌', info: 'ℹ️' }[level] ?? '·'
  console.log(`${tag} [${id}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (evidence && level === 'fail') console.log('    证据：', JSON.stringify(evidence).slice(0, 500))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function rest(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000)
  })
  const text = await res.text()
  let parsed = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    /* raw */
  }
  return { status: res.status, body: parsed, raw: text }
}

/** 注册一个**可控首字母**的账号：同 shard 用例要求 localpart 首字母相同。 */
async function registerWithPrefix(prefix) {
  const username = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  for (let i = 0; i < 6; i += 1) {
    const r = await rest('POST', '/_matrix/client/v3/register', {
      body: { username, password: PW, auth: { type: 'm.login.dummy' } }
    })
    if (r.status === 200) return { username, userId: r.body.user_id, token: r.body.access_token }
    if (r.status === 429) {
      await sleep(1500)
      continue
    }
    throw new Error(`register ${username}: ${r.status} ${r.raw.slice(0, 160)}`)
  }
  throw new Error(`register ${username}: 连续 429`)
}

/** 直查 shard 事件：给定好友 id 定位到「包含该好友」的那条 state。 */
function shardRows(friendUserId) {
  const sql = `
    select state_key || '|' || (content::jsonb->>'version') || '|' ||
           jsonb_array_length(content::jsonb->'friends')
    from events
    where event_type = 'm.friends.list'
      and content::jsonb->'friends' @> jsonb_build_array(jsonb_build_object('user_id', '${friendUserId}'))
    order by stream_ordering desc
    limit 1`
  try {
    const out = execFileSync(
      'docker',
      ['exec', 'synapse-postgres', 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc', sql],
      { encoding: 'utf-8', timeout: 20000 }
    ).trim()
    if (!out) return null
    const [stateKey, version, friends] = out.split('|')
    return { stateKey, version: Number(version), friends: Number(friends) }
  } catch (err) {
    return { error: String(err).slice(0, 200) }
  }
}

/** 读好友列表（返回 { ids, keys, cached }）。 */
async function readFriends(token) {
  const r = await rest('GET', FRIENDS_LIST, { token })
  const body = r.body ?? {}
  const list = Array.isArray(body.friends) ? body.friends : Array.isArray(body) ? body : []
  const ids = list.map((item) => item?.user_id ?? item?.userId).filter(Boolean)
  return { status: r.status, ids, keys: Object.keys(body), cached: body.cached ?? null, raw: r.raw }
}

const main = async () => {
  const owner = await registerWithPrefix('a')
  console.log(`owner=${owner.userId}\n`)

  // 同 shard 的三个好友：af…/ag…/ah… 首字母都是 A ⇒ 都路由到 shard "A"
  const friends = []
  for (const prefix of ['af', 'ag', 'ah']) {
    friends.push(await registerWithPrefix(prefix))
  }
  console.log(`同 shard 好友：${friends.map((f) => f.username).join(', ')}\n`)

  const progression = []
  for (const [index, friend] of friends.entries()) {
    await rest('POST', '/_matrix/vendor/v1/friends/request', {
      token: owner.token,
      body: { user_id: friend.userId }
    })
    const acc = await rest(
      'POST',
      `/_matrix/vendor/v1/friends/request/${encodeURIComponent(owner.userId)}/accept`,
      { token: friend.token }
    )
    if (acc.status !== 200) {
      rec('B2', `第 ${index + 1} 个好友 accept`, 'fail', `status=${acc.status}`, acc.body)
      break
    }

    const row = shardRows(friends[0].userId)
    progression.push({ step: index + 1, row })

    // B3：写入后**立即**读列表（不给缓存 5 分钟窗口）
    const list = await readFriends(owner.token)
    const visible = friends.slice(0, index + 1).every((f) => list.ids.includes(f.userId))
    rec(
      'B3',
      `第 ${index + 1} 次写入后立即读列表`,
      visible ? 'pass' : 'fail',
      `期望 ${index + 1} 人，实际 ${list.ids.length} 人，cached=${String(list.cached)}`,
      visible ? undefined : { expected: friends.slice(0, index + 1).map((f) => f.userId), got: list.ids }
    )
  }

  // ── B2 判定：shard 行必须是并集，且 version 单调递增
  const last = progression.at(-1)?.row
  const versions = progression.map((item) => item.row?.version ?? null)
  const monotonic = versions.every((v, i) => i === 0 || (typeof v === 'number' && typeof versions[i - 1] === 'number' && v > versions[i - 1]))
  rec(
    'B2',
    '同 shard 连续追加：shard 内容为并集',
    last && last.friends === friends.length ? 'pass' : 'fail',
    `shard=${last?.stateKey ?? '?'}，friends=${last?.friends ?? '?'}（期望 ${friends.length}）`,
    last
  )
  rec(
    'B2',
    '同 shard 连续追加：version 单调递增',
    monotonic ? 'pass' : 'fail',
    `version 序列=${versions.join(' → ')}`,
    { versions }
  )
  rec(
    'B2',
    'shard 路由正确（三个同首字母好友都在同一个 shard）',
    progression.every((item) => item.row?.stateKey === 'A') ? 'pass' : 'fail',
    `state_key=${progression.map((item) => item.row?.stateKey ?? '?').join(',')}`,
    progression
  )

  // ── B4：M_UNKNOWN 是否带机器可读 meaning
  //
  // 触发点必须是**真会走 M_UNKNOWN** 的路径。踩过的坑：`join !nonexistent:matrix.test`
  // 在本环境会走联邦 make_join 失败 ⇒ 返回 `M_BAD_JSON`（不是 M_UNKNOWN），拿它验 B4 会误判。
  // 稳定触发：`POST /login` 用不存在的 login type ⇒ 400 `M_UNKNOWN`。
  const unknown = await rest('POST', '/_matrix/client/v3/login', {
    body: {
      type: 'm.login.not_a_real_type',
      identifier: { type: 'm.id.user', user: 'nobody' },
      password: 'x'
    }
  })
  const errcode = unknown.body?.errcode
  const meaning = unknown.body?.meaning
  rec(
    'B4',
    'M_UNKNOWN 响应带机器可读 meaning',
    errcode === 'M_UNKNOWN' && typeof meaning === 'string' && meaning.length > 0 ? 'pass' : 'fail',
    `status=${unknown.status} errcode=${errcode} meaning=${String(meaning)} keys=${Object.keys(unknown.body ?? {}).join(',')}`,
    unknown.body
  )

  // 负向：非 M_UNKNOWN 的响应体必须保持 `{errcode,error}` 原形状（不多出 meaning）
  const nonUnknown = await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent('!nonexistent:matrix.test')}`, {
    token: owner.token,
    body: {}
  })
  const nonUnknownCode = nonUnknown.body?.errcode
  rec(
    'B4',
    '非 M_UNKNOWN 响应不携带 meaning（形状不变）',
    nonUnknownCode !== 'M_UNKNOWN' && !('meaning' in (nonUnknown.body ?? {})) ? 'pass' : 'fail',
    `status=${nonUnknown.status} errcode=${nonUnknownCode} keys=${Object.keys(nonUnknown.body ?? {}).join(',')}`,
    nonUnknown.body
  )

  // ── 汇总
  const passed = results.filter((r) => r.level === 'pass').length
  const failed = results.filter((r) => r.level === 'fail').length
  const info = results.filter((r) => r.level === 'info').length
  console.log(`\n== 汇总：${passed} passed / ${failed} failed / ${info} info ==`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('❌ 探针异常：', err)
  process.exitCode = 1
})
