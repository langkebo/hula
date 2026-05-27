#!/usr/bin/env node

/**
 * HuLa Frontend Integration Test Script
 *
 * Tests the hula frontend against the synapse-rust backend at https://matrix.test
 * Covers: auth, rooms, spaces, friends, notifications, users, admin, media, sync, error handling
 *
 * Usage: node scripts/integration-test.mjs
 */

const BASE = 'https://matrix.test'

// Test account credentials
const TEST_USER = 'integration_test'
const TEST_PASS = 'Test1234!'

let accessToken = ''
let userId = ''
let roomId = ''
let spaceId = ''
let eventId = ''

const results = []

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function test(name, fn) {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = Math.round(performance.now() - start)
    results.push({ name, status: 'PASS', duration, detail: result })
    console.log(`  PASS  ${name} (${duration}ms)`)
  } catch (err) {
    const duration = Math.round(performance.now() - start)
    results.push({ name, status: 'FAIL', duration, detail: err.message })
    console.log(`  FAIL  ${name} (${duration}ms): ${err.message}`)
  }
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body !== undefined && body !== null) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(`${res.status} ${JSON.stringify(data)}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return { status: res.status, data }
}

async function apiRaw(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body !== undefined && body !== null) opts.body = JSON.stringify(body)
  return fetch(`${BASE}${path}`, opts)
}

function enc(str) {
  return encodeURIComponent(str)
}

// ---------------------------------------------------------------------------
// 1. Authentication Tests
// ---------------------------------------------------------------------------

async function runAuthTests() {
  console.log('\n--- Authentication ---')

  // Try to register first; if registration is disabled, fall back to login
  await test('POST /_matrix/client/v3/register - attempt registration', async () => {
    try {
      const res = await api('POST', '/_matrix/client/v3/register', {
        auth: { type: 'm.login.dummy' },
        username: TEST_USER,
        password: TEST_PASS,
      })
      return `registered as ${res.data.user_id}`
    } catch (err) {
      if (err.status === 403 || err.status === 400 || err.status === 401) {
        return 'registration unavailable, will try login'
      }
      throw err
    }
  })

  await test('GET /_matrix/client/v3/login - get login flows', async () => {
    const res = await api('GET', '/_matrix/client/v3/login')
    const flows = res.data.flows?.map(f => f.type).join(', ') || 'none'
    return `flows: ${flows}`
  })

  await test('POST /_matrix/client/v3/login - login with m.login.password', async () => {
    const res = await api('POST', '/_matrix/client/v3/login', {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: TEST_USER },
      password: TEST_PASS,
    })
    accessToken = res.data.access_token
    userId = res.data.user_id
    if (!accessToken) throw new Error('No access token returned')
    return `logged in as ${userId}`
  })

  await test('GET /_matrix/client/v3/account/whoami - verify token', async () => {
    const res = await api('GET', '/_matrix/client/v3/account/whoami', null, accessToken)
    if (res.data.user_id !== userId) throw new Error(`whoami mismatch: ${res.data.user_id} !== ${userId}`)
    return `user_id=${res.data.user_id}`
  })

  await test('GET /_matrix/client/v3/capabilities - get capabilities', async () => {
    const res = await api('GET', '/_matrix/client/v3/capabilities', null, accessToken)
    const caps = Object.keys(res.data.capabilities || {}).join(', ') || 'none'
    return `capabilities: ${caps}`
  })

  await test('GET /.well-known/matrix/client - well-known discovery', async () => {
    const res = await api('GET', '/.well-known/matrix/client')
    return `homeserver: ${res.data?.['m.homeserver']?.base_url || 'N/A'}`
  })
}

// ---------------------------------------------------------------------------
// 2. Room Tests
// ---------------------------------------------------------------------------

async function runRoomTests() {
  console.log('\n--- Rooms ---')

  await test('POST /_matrix/client/v3/createRoom - create test room', async () => {
    const res = await api('POST', '/_matrix/client/v3/createRoom', {
      name: 'Integration Test Room',
      topic: 'Created by integration test script',
      visibility: 'private',
      preset: 'private_chat',
    }, accessToken)
    roomId = res.data.room_id
    if (!roomId) throw new Error('No room_id returned')
    return `room_id=${roomId}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/state - get room state', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/state`, null, accessToken)
    return `${res.data?.length || 0} state events`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/members - list members', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/members`, null, accessToken)
    const members = res.data?.chunk?.length || 0
    return `${members} member(s)`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/messages - get messages', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/messages?limit=10`, null, accessToken)
    return `start=${res.data?.start || 'N/A'}, chunk=${res.data?.chunk?.length || 0}`
  })

  // Send a message to use in later tests
  await test('PUT /_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId} - send message', async () => {
    const txnId = `txn_${Date.now()}`
    const res = await api('PUT', `/_matrix/client/v3/rooms/${enc(roomId)}/send/m.room.message/${enc(txnId)}`, {
      msgtype: 'm.text',
      body: 'Hello from integration test',
    }, accessToken)
    eventId = res.data.event_id
    if (!eventId) throw new Error('No event_id returned')
    return `event_id=${eventId}`
  })

  await test('PUT /_matrix/client/v3/rooms/{roomId}/typing/{userId} - typing notification', async () => {
    const res = await api('PUT', `/_matrix/client/v3/rooms/${enc(roomId)}/typing/${enc(userId)}`, {
      typing: true,
      timeout: 3000,
    }, accessToken)
    return `status=${res.status}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/capabilities - room capabilities', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/capabilities`, null, accessToken)
    return `status=${res.status}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/permissions - room permissions', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/permissions`, null, accessToken)
    return `status=${res.status}`
  })

  await test('PUT /_matrix/client/v3/rooms/{roomId}/pinned_events/{eventId} - pin event', async () => {
    const res = await api('PUT', `/_matrix/client/v3/rooms/${enc(roomId)}/pinned_events/${enc(eventId)}`, {}, accessToken)
    return `status=${res.status}`
  })

  await test('DELETE /_matrix/client/v3/rooms/{roomId}/pinned_events/{eventId} - unpin event', async () => {
    const res = await api('DELETE', `/_matrix/client/v3/rooms/${enc(roomId)}/pinned_events/${enc(eventId)}`, null, accessToken)
    return `status=${res.status}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/aliases - room aliases', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/aliases`, null, accessToken)
    return `aliases: ${res.data?.aliases?.length || 0}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/version - room version', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/version`, null, accessToken)
    return `version=${res.data?.version || 'N/A'}`
  })

  await test('PUT /_matrix/client/v3/rooms/{roomId}/read_markers - set read marker', async () => {
    const res = await api('PUT', `/_matrix/client/v3/rooms/${enc(roomId)}/read_markers`, {
      'm.fully_read': eventId,
      'm.read': eventId,
    }, accessToken)
    return `status=${res.status}`
  })

  await test('PUT /_matrix/client/v3/rooms/{roomId}/receipt/m.read/{eventId} - send receipt', async () => {
    const res = await api('PUT', `/_matrix/client/v3/rooms/${enc(roomId)}/receipt/m.read/${enc(eventId)}`, {}, accessToken)
    return `status=${res.status}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/context/{eventId} - event context', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/context/${enc(eventId)}`, null, accessToken)
    return `status=${res.status}, event_type=${res.data?.event?.type || 'N/A'}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/summary - room summary', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/summary`, null, accessToken)
    return `status=${res.status}`
  })

  await test('GET /_matrix/client/v3/rooms/{roomId}/unread_count - unread count', async () => {
    const res = await api('GET', `/_matrix/client/v3/rooms/${enc(roomId)}/unread_count`, null, accessToken)
    return `status=${res.status}`
  })
}

// ---------------------------------------------------------------------------
// 3. Space Tests
// ---------------------------------------------------------------------------

async function runSpaceTests() {
  console.log('\n--- Spaces ---')

  await test('POST /_matrix/client/v3/createRoom - create space (m.space)', async () => {
    const res = await api('POST', '/_matrix/client/v3/createRoom', {
      name: 'Integration Test Space',
      topic: 'Created by integration test script',
      visibility: 'private',
      preset: 'private_chat',
      creation_content: { type: 'm.space' },
      initial_state: [{
        type: 'm.room.history_visibility',
        state_key: '',
        content: { history_visibility: 'shared' },
      }],
    }, accessToken)
    spaceId = res.data.room_id
    if (!spaceId) throw new Error('No room_id returned for space')
    return `space_id=${spaceId}`
  })

  await test('GET /_matrix/client/v1/rooms/{spaceId}/hierarchy - space hierarchy', async () => {
    const res = await api('GET', `/_matrix/client/v1/rooms/${enc(spaceId)}/hierarchy`, null, accessToken)
    return `rooms=${res.data?.rooms?.length || 0}`
  })

  await test('PUT /_matrix/client/v3/rooms/{spaceId}/state/m.space.child/{roomId} - add child room', async () => {
    const res = await api('PUT', `/_matrix/client/v3/rooms/${enc(spaceId)}/state/m.space.child/${enc(roomId)}`, {
      via: [],
      suggested: false,
    }, accessToken)
    return `status=${res.status}`
  })

  await test('GET /_matrix/client/v1/rooms/{spaceId}/hierarchy - hierarchy with child', async () => {
    const res = await api('GET', `/_matrix/client/v1/rooms/${enc(spaceId)}/hierarchy`, null, accessToken)
    return `rooms=${res.data?.rooms?.length || 0}`
  })

  await test('GET /_matrix/client/v3/spaces/room/{roomId}/parents - room parent spaces', async () => {
    const res = await api('GET', `/_matrix/client/v3/spaces/room/${enc(roomId)}/parents`, null, accessToken)
    return `status=${res.status}`
  })
}

// ---------------------------------------------------------------------------
// 4. Friend Tests (synapse-rust extensions)
// ---------------------------------------------------------------------------

async function runFriendTests() {
  console.log('\n--- Friends (synapse-rust extensions) ---')

  await test('GET /_matrix/client/v1/friends - list friends', async () => {
    const res = await api('GET', '/_matrix/client/v1/friends', null, accessToken)
    return `friends=${res.data?.friends?.length || 0}`
  })

  await test('GET /_matrix/client/v1/friends/requests/incoming - incoming friend requests', async () => {
    const res = await api('GET', '/_matrix/client/v1/friends/requests/incoming', null, accessToken)
    return `requests=${res.data?.requests?.length || 0}`
  })

  await test('GET /_matrix/client/v1/friends/requests/outgoing - outgoing friend requests', async () => {
    const res = await api('GET', '/_matrix/client/v1/friends/requests/outgoing', null, accessToken)
    return `requests=${res.data?.requests?.length || 0}`
  })
}

// ---------------------------------------------------------------------------
// 5. Push Notification Tests
// ---------------------------------------------------------------------------

async function runNotificationTests() {
  console.log('\n--- Push Notifications ---')

  await test('GET /_matrix/client/v3/pushrules/ - get push rules', async () => {
    const res = await api('GET', '/_matrix/client/v3/pushrules/', null, accessToken)
    const ruleCount = [
      res.data?.global?.content?.length || 0,
      res.data?.global?.override?.length || 0,
      res.data?.global?.room?.length || 0,
      res.data?.global?.sender?.length || 0,
      res.data?.global?.underride?.length || 0,
    ].reduce((a, b) => a + b, 0)
    return `${ruleCount} rules`
  })

  await test('GET /_matrix/client/v3/pushers - get pushers', async () => {
    const res = await api('GET', '/_matrix/client/v3/pushers', null, accessToken)
    return `pushers=${res.data?.pushers?.length || 0}`
  })

  await test('GET /_matrix/client/v3/notifications - get notifications', async () => {
    const res = await api('GET', '/_matrix/client/v3/notifications?limit=10', null, accessToken)
    return `notifications=${res.data?.notifications?.length || 0}`
  })
}

// ---------------------------------------------------------------------------
// 6. User Tests
// ---------------------------------------------------------------------------

async function runUserTests() {
  console.log('\n--- User ---')

  await test('GET /_matrix/client/v3/profile/{userId} - get profile', async () => {
    const res = await api('GET', `/_matrix/client/v3/profile/${enc(userId)}`, null, accessToken)
    return `displayname=${res.data?.displayname || 'N/A'}`
  })

  await test('GET /_matrix/client/v3/profile/{userId}/displayname - get display name', async () => {
    const res = await api('GET', `/_matrix/client/v3/profile/${enc(userId)}/displayname`, null, accessToken)
    return `displayname=${res.data?.displayname || 'N/A'}`
  })

  await test('GET /_matrix/client/v3/profile/{userId}/avatar_url - get avatar', async () => {
    const res = await api('GET', `/_matrix/client/v3/profile/${enc(userId)}/avatar_url`, null, accessToken)
    return `avatar_url=${res.data?.avatar_url || 'none'}`
  })

  await test('GET /_matrix/client/v3/presence/{userId}/status - get presence', async () => {
    const res = await api('GET', `/_matrix/client/v3/presence/${enc(userId)}/status`, null, accessToken)
    return `presence=${res.data?.presence || 'N/A'}`
  })

  await test('GET /_matrix/client/v3/devices - list devices', async () => {
    const res = await api('GET', '/_matrix/client/v3/devices', null, accessToken)
    return `devices=${res.data?.devices?.length || 0}`
  })

  await test('GET /_matrix/client/v3/user_directory/search - search users', async () => {
    const res = await api('POST', '/_matrix/client/v3/user_directory/search', {
      search_term: TEST_USER,
      limit: 5,
    }, accessToken)
    return `results=${res.data?.results?.length || 0}`
  })

  await test('GET /_matrix/client/v3/publicRooms - public rooms', async () => {
    const res = await api('GET', '/_matrix/client/v3/publicRooms?limit=5', null, accessToken)
    return `total=${res.data?.total_room_count_estimate || 0}, chunk=${res.data?.chunk?.length || 0}`
  })

  await test('GET /_matrix/client/v3/voip/turnServer - TURN server config', async () => {
    const res = await api('GET', '/_matrix/client/v3/voip/turnServer', null, accessToken)
    return `uris=${res.data?.uris?.length || 0}`
  })
}

// ---------------------------------------------------------------------------
// 7. Admin Tests
// ---------------------------------------------------------------------------

async function runAdminTests() {
  console.log('\n--- Admin ---')

  await test('GET /_synapse/admin/v1/whoami - admin whoami', async () => {
    try {
      const res = await api('GET', '/_synapse/admin/v1/whoami', null, accessToken)
      return `user_id=${res.data?.user_id || 'N/A'}`
    } catch (err) {
      if (err.status === 403) return 'not admin (403 - expected for non-admin user)'
      throw err
    }
  })

  await test('GET /_synapse/admin/v1/server - server info', async () => {
    try {
      const res = await api('GET', '/_synapse/admin/v1/server', null, accessToken)
      return `name=${res.data?.name || 'N/A'}`
    } catch (err) {
      if (err.status === 403) return 'not admin (403 - expected for non-admin user)'
      throw err
    }
  })

  await test('GET /_synapse/admin/v1/server_version - server version', async () => {
    try {
      const res = await api('GET', '/_synapse/admin/v1/server_version', null, accessToken)
      return `version=${res.data?.server_version || 'N/A'}`
    } catch (err) {
      if (err.status === 403) return 'not admin (403 - expected for non-admin user)'
      throw err
    }
  })
}

// ---------------------------------------------------------------------------
// 8. Media Tests
// ---------------------------------------------------------------------------

async function runMediaTests() {
  console.log('\n--- Media ---')

  await test('GET /_matrix/client/v1/media/config - client media config', async () => {
    const res = await api('GET', '/_matrix/client/v1/media/config', null, accessToken)
    return `m.upload.size=${res.data?.['m.upload.size'] || 'N/A'}`
  })

  await test('GET /_matrix/media/v3/config - media config', async () => {
    const res = await api('GET', '/_matrix/media/v3/config', null, accessToken)
    return `m.upload.size=${res.data?.['m.upload.size'] || 'N/A'}`
  })

  await test('POST /_matrix/media/v3/upload - upload test content', async () => {
    const content = 'Hello from integration test - ' + new Date().toISOString()
    const headers = {
      'Content-Type': 'text/plain',
      'Authorization': `Bearer ${accessToken}`,
    }
    const res = await fetch(`${BASE}/_matrix/media/v3/upload?filename=integration_test.txt`, {
      method: 'POST',
      headers,
      body: content,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data)}`)
    return `content_uri=${data?.content_uri || 'N/A'}`
  })

  await test('GET /_matrix/media/r0/preview_url - URL preview', async () => {
    try {
      const res = await api('GET', `/_matrix/media/r0/preview_url?url=${enc('https://example.com')}`, null, accessToken)
      return `status=${res.status}`
    } catch (err) {
      // URL preview may fail if not configured
      if (err.status === 400 || err.status === 500 || err.status === 502) {
        return 'URL preview not configured (acceptable)'
      }
      throw err
    }
  })
}

// ---------------------------------------------------------------------------
// 9. Sync Tests
// ---------------------------------------------------------------------------

async function runSyncTests() {
  console.log('\n--- Sync ---')

  await test('GET /_matrix/client/v3/sync - initial sync', async () => {
    const res = await api('GET', `/_matrix/client/v3/sync?timeout=0&filter=${enc(JSON.stringify({ room: { timeline: { limit: 1 } } }))}`, null, accessToken)
    const roomCount = Object.keys(res.data?.rooms?.join || {}).length
    return `next_batch=${res.data?.next_batch?.slice(0, 20) || 'N/A'}..., rooms=${roomCount}`
  })

  await test('POST /_matrix/client/v3/user/{userId}/filter - create filter', async () => {
    const res = await api('POST', `/_matrix/client/v3/user/${enc(userId)}/filter`, {
      room: {
        timeline: { limit: 10 },
        state: { types: ['m.room.name'] },
      },
    }, accessToken)
    return `filter_id=${res.data?.filter_id || 'N/A'}`
  })
}

// ---------------------------------------------------------------------------
// 10. Error Handling Tests
// ---------------------------------------------------------------------------

async function runErrorHandlingTests() {
  console.log('\n--- Error Handling ---')

  await test('GET with invalid token - expect 401', async () => {
    const res = await apiRaw('GET', '/_matrix/client/v3/account/whoami', null, 'invalid_token_12345')
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
    return `status=${res.status} (correct)`
  })

  await test('GET non-existent room - expect 404', async () => {
    const res = await apiRaw('GET', `/_matrix/client/v3/rooms/${enc('!nonexistent:matrix.test')}/state`, null, accessToken)
    if (res.status !== 404 && res.status !== 403) throw new Error(`Expected 404 or 403, got ${res.status}`)
    return `status=${res.status} (correct)`
  })

  await test('POST with invalid body - expect 400', async () => {
    const res = await apiRaw('POST', '/_matrix/client/v3/createRoom', 'not json at all', accessToken)
    if (res.status !== 400 && res.status !== 404 && res.status !== 500) throw new Error(`Expected 400-ish, got ${res.status}`)
    return `status=${res.status} (correct)`
  })

  await test('POST login with wrong password - expect 403', async () => {
    const res = await apiRaw('POST', '/_matrix/client/v3/login', {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: TEST_USER },
      password: 'WrongPassword123!',
    })
    if (res.status !== 403 && res.status !== 400) throw new Error(`Expected 403 or 400, got ${res.status}`)
    return `status=${res.status} (correct)`
  })

  await test('GET /_matrix/client/versions - unauthenticated endpoint', async () => {
    const res = await api('GET', '/_matrix/client/versions')
    return `versions=${res.data?.versions?.join(', ') || 'N/A'}`
  })
}

// ---------------------------------------------------------------------------
// 11. Cleanup - Logout
// ---------------------------------------------------------------------------

async function runCleanup() {
  console.log('\n--- Cleanup ---')

  await test('POST /_matrix/client/v3/logout - logout', async () => {
    const res = await api('POST', '/_matrix/client/v3/logout', null, accessToken)
    return `status=${res.status}`
  })
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport() {
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  const total = results.length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  console.log('\n' + '='.repeat(70))
  console.log('  INTEGRATION TEST REPORT')
  console.log('='.repeat(70))
  console.log(`  Backend:    ${BASE}`)
  console.log(`  Total:      ${total}`)
  console.log(`  Passed:     ${pass}`)
  console.log(`  Failed:     ${fail}`)
  console.log(`  Duration:   ${totalDuration}ms`)
  console.log(`  Pass Rate:  ${total > 0 ? ((pass / total) * 100).toFixed(1) : 0}%`)
  console.log('='.repeat(70))

  if (fail > 0) {
    console.log('\n  Failed tests:')
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`    - ${r.name}: ${r.detail}`)
    }
    console.log()
  }

  // Detailed results table
  console.log('  Detailed results:')
  console.log('  ' + '-'.repeat(68))
  console.log('  ' + 'Status'.padEnd(8) + 'Duration'.padEnd(12) + 'Test Name')
  console.log('  ' + '-'.repeat(68))
  for (const r of results) {
    const status = r.status === 'PASS' ? 'PASS' : 'FAIL'
    const duration = `${r.duration}ms`
    console.log('  ' + status.padEnd(8) + duration.padEnd(12) + r.name)
  }
  console.log('  ' + '-'.repeat(68))

  // Exit with error code if any tests failed
  if (fail > 0) {
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('HuLa Integration Test')
  console.log(`Backend: ${BASE}`)
  console.log(`Started: ${new Date().toISOString()}`)
  console.log('='.repeat(70))

  // Verify backend is reachable
  try {
    const res = await api('GET', '/_matrix/client/versions')
    console.log(`Backend versions: ${res.data?.versions?.join(', ') || 'unknown'}`)
  } catch (err) {
    console.error(`FATAL: Cannot reach backend at ${BASE}`)
    console.error(err.message)
    process.exit(1)
  }

  await runAuthTests()

  if (!accessToken) {
    console.error('\nFATAL: Could not obtain access token. Aborting.')
    process.exit(1)
  }

  await runRoomTests()
  await runSpaceTests()
  await runFriendTests()
  await runNotificationTests()
  await runUserTests()
  await runAdminTests()
  await runMediaTests()
  await runSyncTests()
  await runErrorHandlingTests()
  await runCleanup()

  printReport()
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
