#!/usr/bin/env node
/**
 * SAS 设备验证联调（两台 Android 模拟器，全自动）。
 *
 * 覆盖报告 §3 第 14 项「设备验证（SAS）」：双端在线完成一次 SAS，并**比对 emoji/decimal**。
 * 这是唯一不能靠单端成立的断言 —— 必须两边拿到同一组 SAS 才能确认密钥交换未被中间人替换。
 *
 * 流程（全部走 app 自己的 `matrixVerificationService`，不自己拼协议）：
 *   B 先 `initialize()` 挂上 VerificationRequestReceived 监听
 *   → A `startSasVerification(bUser, bDevice)` 拿 transactionId
 *   → B 轮询 `getPendingVerifications()` 并 `acceptVerification(txId)`
 *   → 两端轮询 `getSasView(txId)`，比对 emoji / decimal（必须完全相同）
 *   → 两端 `confirmSas(txId)`
 *   → 两端 `isDeviceVerified(对方)` 应为 true
 *   → 服务端证据：to_device_messages 出现 m.key.verification.{request,ready,accept,key,mac,done}
 *
 * 用法：node scripts/sas-verify-two-androids.mjs
 */

import { execFileSync } from 'node:child_process'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const CDP_A = Number(process.env.CDP_A ?? 9222)
const CDP_B = Number(process.env.CDP_B ?? 9223)

const results = []
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail })
  const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
  console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (evidence && level === 'fail') console.log('    证据：', JSON.stringify(evidence).slice(0, 400))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function openCdp(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error(`:${port} 没有 WebView target`)
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res)
    ws.addEventListener('error', () => rej(new Error(`:${port} CDP 连接失败`)))
  })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result?.value
  }
  return { evaluate, close: () => ws.close() }
}

const IDENTITY_FN = `
  (async () => {
    const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
    const svc = m.matrixVerificationService;
    svc.initialize();
    return { uid: svc.getCurrentUserId(), dev: svc.getCurrentDeviceId() };
  })()
`

const pendingListFn = `
  (async () => {
    const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
    const list = await m.matrixVerificationService.getPendingVerifications();
    return list.map((v) => ({ txId: v.transactionId, userId: v.userId ?? null, deviceId: v.deviceId ?? null, methods: v.methods ?? [] }));
  })()
`

const sasFn = (txId) => `
  (async () => {
    try {
      const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
      const v = await m.matrixVerificationService.getSasView(${JSON.stringify(txId)});
      return { ok: true, emoji: v.emoji, decimal: v.decimal };
    } catch (e) { return { ok: false, err: String(e).slice(0, 160) }; }
  })()
`

const txStateFn = (txId) => `
  (async () => {
    const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
    const req = m.matrixVerificationService.transactions?.get?.(${JSON.stringify(txId)})?.request;
    return req ? { phase: req.phase, pending: req.pending, initiatedByMe: req.initiatedByMe, verifier: Boolean(req.verifier) } : null;
  })()
`

const toDeviceStats = (sinceMs) => {
  try {
    const sql = `select event_type, count(*) from to_device_messages where created_ts >= ${sinceMs} and event_type like 'm.key.verification%' group by 1 order by 2 desc`
    const container = process.env.SYNAPSE_DB_CONTAINER ?? 'synapse-e2e-postgres'
    const out = execFileSync('docker', ['exec', container, 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc', sql], {
      encoding: 'utf8',
      timeout: 15000
    }).trim()
    return out
      ? out
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [type, count] = line.split('|')
            return { type, count: Number(count) }
          })
      : []
  } catch (e) {
    return [{ error: String(e).slice(0, 120) }]
  }
}

async function main() {
  const startedAt = Date.now()
  let a = null
  let b = null
  try {
    a = await openCdp(CDP_A)
    b = await openCdp(CDP_B)

    const idA = await a.evaluate(IDENTITY_FN)
    const idB = await b.evaluate(IDENTITY_FN)
    record('V0', '两端身份', idA?.uid && idB?.uid ? 'pass' : 'fail', `A=${idA?.uid}/${idA?.dev} · B=${idB?.uid}/${idB?.dev}`)
    if (!idA?.uid || !idB?.uid) throw new Error('两端必须都已登录且 crypto 可用')

    // 清掉历史事务：上一次跑剩余的 request 会一直挂在 pending 里，
    // 按 `seen[0]` 兜底会接受**旧事务**（实测踩过），导致新事务永远停在 Requested。
    for (const [tag, cdp] of [['A', a], ['B', b]]) {
      const cleared = await cdp.evaluate(`
        (async () => {
          const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
          m.matrixVerificationService.reset();
          m.matrixVerificationService.initialize();
          return true;
        })()
      `)
      record('V0', `${tag} 清理历史验证事务`, cleared ? 'pass' : 'fail', 'reset + initialize')
    }

    // ── 1) A 发起
    const txId = await a.evaluate(`
      (async () => {
        try {
          const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
          return await m.matrixVerificationService.startSasVerification(${JSON.stringify(idB.uid)}, ${JSON.stringify(idB.dev)});
        } catch (e) { return 'ERR ' + String(e).slice(0, 200); }
      })()
    `)
    record('V1', 'A 发起验证请求', typeof txId === 'string' && !txId.startsWith('ERR') && txId ? 'pass' : 'fail', String(txId).slice(0, 120))
    if (!txId || String(txId).startsWith('ERR')) throw new Error('发起失败')

    // ── 2) B 接受（等请求通过 to-device 送达）
    //    注意：rust-crypto 里两边都在线时，accept 之后事务可能**直接进入 Started**，
    //    此时再次 accept 会抛 `Cannot accept a verification request in phase 3` ——
    //    这是「已经在 SAS 阶段」的信号，不是失败，必须容错继续读 SAS。
    let accepted = false
    let acceptNote = ''
    let seen = []
    for (let i = 0; i < 30; i += 1) {
      seen = await b.evaluate(pendingListFn)
      // 严格匹配：绝不接受别的 txId（历史残留会污染判据）
      const hit = (seen ?? []).find((v) => v.txId === txId)
      if (hit) {
        const r = await b.evaluate(`
          (async () => {
            try {
              const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
              await m.matrixVerificationService.acceptVerification(${JSON.stringify(hit.txId)});
              return 'ok';
            } catch (e) { return 'ERR ' + String(e).slice(0, 140); }
          })()
        `)
        accepted = r === 'ok' || /phase 3/i.test(String(r))
        acceptNote = String(r)
        const phase = await b.evaluate(`
          (async () => {
            const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
            const req = m.matrixVerificationService.transactions?.get?.(${JSON.stringify(txId)})?.request;
            return req ? { phase: req.phase, pending: req.pending, initiatedByMe: req.initiatedByMe } : null;
          })()
        `).catch(() => null)
        acceptNote += ` phase=${JSON.stringify(phase)}`
        break
      }
      await sleep(2000)
    }
    record('V2', 'B 收到请求并接受', accepted ? 'pass' : 'fail', accepted ? `txId=${txId}，accept=${acceptNote}` : `B 未收到请求（pending=${JSON.stringify(seen)}）`)

    // ── 3) 服务层自动驱动 SAS
    //    accept 之后由 MatrixVerificationService 自动发起 startVerification('m.sas.v1') 并调用
    //    verifier.verify()，页面不需要（也不应该）再直接调 SDK——重复 verify 会让事务停在
    //    Started 直到 m.timeout（实测踩过，旧版 V4 就踩了这个坑）。
    let sasA = null
    let sasB = null
    let phaseA = null
    let phaseB = null
    for (let i = 0; i < 30; i += 1) {
      sasA = await a.evaluate(sasFn(txId))
      sasB = await b.evaluate(sasFn(txId))
      if (sasA?.ok && sasB?.ok) break
      await sleep(2000)
    }
    phaseA = await a.evaluate(txStateFn(txId)).catch(() => null)
    phaseB = await b.evaluate(txStateFn(txId)).catch(() => null)
    record('V3', '服务层自动产出 SAS', sasA?.ok && sasB?.ok ? 'pass' : 'fail', `A=${sasA?.ok ? 'ok' : sasA?.err} / B=${sasB?.ok ? 'ok' : sasB?.err}`)
    record(
      'V4',
      '两端事务进入 Started 且持有 verifier',
      phaseA?.phase === 4 && phaseA?.verifier && phaseB?.phase === 4 && phaseB?.verifier ? 'pass' : 'fail',
      `A=${JSON.stringify(phaseA)} / B=${JSON.stringify(phaseB)}`
    )

    const emojiSA = (sasA?.emoji ?? []).map((e) => (Array.isArray(e) ? e[0] : e)).join(' ')
    const emojiSB = (sasB?.emoji ?? []).map((e) => (Array.isArray(e) ? e[0] : e)).join(' ')
    const decSA = (sasA?.decimal ?? []).join(' ')
    const decSB = (sasB?.decimal ?? []).join(' ')
    record('V5', '两端 SAS 一致（emoji）', emojiSA && emojiSA === emojiSB ? 'pass' : 'fail', `A=[${emojiSA}] · B=[${emojiSB}]`)
    record(
      'V5',
      '两端 SAS 一致（decimal）',
      decSA || decSB ? (decSA === decSB ? 'pass' : 'fail') : 'skip',
      decSA || decSB ? `A=${decSA} · B=${decSB}` : '两端都没有 decimal'
    )

    if (emojiSA && emojiSA === emojiSB) {
      const confirmFn = (txId) => `
        (async () => { try {
          const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
          await m.matrixVerificationService.confirmSas(${JSON.stringify(txId)});
          return 'ok';
        } catch (e) { return String(e).slice(0, 140) } })()
      `
      const cA = await a.evaluate(confirmFn(txId))
      await sleep(2500)
      const cB = await b.evaluate(confirmFn(txId))
      record('V6', '两端确认 SAS', cA === 'ok' && cB === 'ok' ? 'pass' : 'fail', `A=${cA} / B=${cB}`)

      const verifyFn = (uid, dev) => `
        (async () => {
          const m = await import('/src/services/matrix/crypto/MatrixVerificationService.ts');
          return await m.matrixVerificationService.isDeviceVerified(${JSON.stringify(uid)}, ${JSON.stringify(dev)});
        })()
      `
      let okA = false
      let okB = false
      for (let i = 0; i < 20; i += 1) {
        okA = await a.evaluate(verifyFn(idB.uid, idB.dev))
        okB = await b.evaluate(verifyFn(idA.uid, idA.dev))
        if (okA && okB) break
        await sleep(2000)
      }
      record('V7', 'A 端把 B 的设备标为已验证', okA ? 'pass' : 'fail', String(okA))
      record('V7', 'B 端把 A 的设备标为已验证', okB ? 'pass' : 'fail', String(okB))
    } else {
      record('V6', '两端确认 SAS', 'skip', 'SAS 未就绪或两端不一致（不伪造结论）')
      record('V7', '设备互信', 'skip', '同上')
    }

    const stats = toDeviceStats(startedAt - 5000)
    const types = (stats ?? []).map((x) => x.type ?? x.error)
    record('V8', '服务端 to-device 流转', types.length ? 'pass' : 'fail', types.length ? types.join(', ') : '窗口内无 m.key.verification.* 记录', stats)
  } catch (error) {
    record('XX', '流程中断', 'fail', error instanceof Error ? error.message : String(error))
  } finally {
    a?.close()
    b?.close()
  }

  const pass = results.filter((r) => r.level === 'pass').length
  const fail = results.filter((r) => r.level === 'fail').length
  const skip = results.filter((r) => r.level === 'skip').length
  console.log(`\n== SAS 汇总：${pass} passed / ${fail} failed / ${skip} skip ==`)
  process.exitCode = fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exitCode = 2
})
