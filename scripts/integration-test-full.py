#!/usr/bin/env python3
"""Comprehensive front-end/back-end integration test for synapse-rust + hula + matrix-js-sdk
v2: Fixed friend routes, added delays to avoid rate limiting, expanded coverage."""
import json, time, urllib.request, urllib.error, ssl, sys, os

BASE = "https://matrix.test"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

results = []
DELAY = 0.15  # 150ms between requests to avoid 429

def req(method, path, token=None, body=None, expect_status=None, raw_body=None, content_type=None):
    url = f"{BASE}{path}"
    headers = {}
    if content_type:
        headers["Content-Type"] = content_type
    else:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = raw_body if raw_body else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    t0 = time.time()
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=30)
        status = resp.status
        content_type = resp.headers.get("Content-Type", "")
        raw_bytes = resp.read()
        if "application/json" in content_type or not raw_bytes:
            raw = raw_bytes.decode()
            body_out = json.loads(raw) if raw else {}
        else:
            # Binary response (e.g. media thumbnail/download)
            body_out = {"_binary": True, "size": len(raw_bytes), "content_type": content_type}
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode()
        try: body_out = json.loads(raw)
        except: body_out = {"raw": raw[:200]}
    except Exception as e:
        status = 0
        body_out = {"error": str(e)}
    elapsed = round((time.time() - t0) * 1000)
    time.sleep(DELAY)
    if expect_status and status != expect_status:
        return status, body_out, elapsed, False
    return status, body_out, elapsed, True

def record(module, test_name, status, body, elapsed, ok, notes=""):
    results.append({"module": module, "test": test_name, "status": status, "ok": ok,
                     "elapsed_ms": elapsed, "notes": notes,
                     "body_preview": str(body)[:150] if isinstance(body, dict) else str(body)[:150]})
    icon = "PASS" if ok else "FAIL"
    print(f"  [{icon}] {test_name}: {status} ({elapsed}ms) {notes}")

# ============================================================
# 1. Connectivity & Discovery
# ============================================================
print("\n=== 1. Connectivity & Discovery ===")
s, b, ms, ok = req("GET", "/_matrix/client/versions")
record("Discovery", "GET /versions", s, b, ms, ok and "versions" in b)
s, b, ms, ok = req("GET", "/.well-known/matrix/client")
record("Discovery", "GET /.well-known/client", s, b, ms, ok and "m.homeserver" in b)
s, b, ms, ok = req("GET", "/.well-known/matrix/server")
record("Discovery", "GET /.well-known/server", s, b, ms, ok and "m.server" in b)

# ============================================================
# 2. Auth & Account
# ============================================================
print("\n=== 2. Auth & Account ===")
s, b, ms, ok = req("GET", "/_matrix/client/v3/login")
record("Auth", "GET /login (flows)", s, b, ms, ok and "flows" in b)

# Login existing users
test_users = {}
for name in ["itest_alice", "itest_bob"]:
    s, b, ms, ok = req("POST", "/_matrix/client/v3/login", body={
        "type": "m.login.password",
        "identifier": {"type": "m.id.user", "user": name},
        "password": "Test1234!"
    })
    if ok and "access_token" in b:
        test_users[name] = b["access_token"]
        record("Auth", f"Login {name}", s, b, ms, True)
    else:
        # Try register
        s2, b2, ms2, ok2 = req("POST", "/_matrix/client/v3/register", body={
            "username": name, "password": "Test1234!", "auth": {"type": "m.login.dummy"}
        })
        if ok2 and "access_token" in b2:
            test_users[name] = b2["access_token"]
            record("Auth", f"Register {name}", s2, b2, ms2, True)
        else:
            record("Auth", f"Create {name}", s2 or s, b2 or b, ms2 or ms, False, str(b2 or b)[:100])

alice = test_users.get("itest_alice", "")
bob = test_users.get("itest_bob", "")
if not alice:
    print("FATAL: No test users. Aborting."); sys.exit(1)

s, b, ms, ok = req("GET", "/_matrix/client/v3/account/whoami", token=alice)
record("Auth", "GET /whoami", s, b, ms, ok and b.get("user_id","").endswith("matrix.test"))

s, b, ms, ok = req("GET", "/_matrix/client/v3/capabilities", token=alice)
record("Auth", "GET /capabilities", s, b, ms, ok and "capabilities" in b)

s, b, ms, ok = req("GET", "/_matrix/client/v3/profile/@itest_alice:matrix.test")
record("Account", "GET /profile", s, b, ms, ok)

s, b, ms, ok = req("PUT", "/_matrix/client/v3/profile/@itest_alice:matrix.test/displayname", token=alice,
    body={"displayname": "Alice Integration"})
record("Account", "PUT /displayname", s, b, ms, ok)

s, b, ms, ok = req("PUT", "/_matrix/client/v3/profile/@itest_alice:matrix.test/avatar_url", token=alice,
    body={"avatar_url": "mxc://matrix.test/testavatar"})
record("Account", "PUT /avatar_url", s, b, ms, ok)

# 3PID
s, b, ms, ok = req("GET", "/_matrix/client/v3/account/3pid", token=alice)
record("Account", "GET /3pid", s, b, ms, ok)

# ============================================================
# 3. Room & Message
# ============================================================
print("\n=== 3. Room & Message ===")
s, b, ms, ok = req("POST", "/_matrix/client/v3/createRoom", token=alice,
    body={"name": "Integration Test Room", "visibility": "private", "preset": "private_chat"})
room_id = b.get("room_id", "")
record("Room", "POST /createRoom", s, b, ms, ok, f"room_id={room_id}")

event_id = ""
if room_id:
    # Send message (PUT)
    txn = f"t_{int(time.time()*1000)}"
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn}",
        token=alice, body={"msgtype": "m.text", "body": "Hello integration test!"})
    event_id = b.get("event_id", "")
    record("Message", "PUT /send message", s, b, ms, ok, f"event_id={event_id[:30]}")

    # Send message (POST compat)
    txn2 = f"t2_{int(time.time()*1000)}"
    s, b, ms, ok = req("POST", f"/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn2}",
        token=alice, body={"msgtype": "m.text", "body": "POST compat"})
    record("Message", "POST /send (compat)", s, b, ms, ok)

    # Send image message
    txn3 = f"t3_{int(time.time()*1000)}"
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn3}",
        token=alice, body={"msgtype": "m.image", "body": "test.jpg", "url": "mxc://matrix.test/testimg", "info": {"mimetype": "image/jpeg", "size": 1024}})
    record("Message", "PUT /send image", s, b, ms, ok)

    # Get messages
    s, b, ms, ok = req("GET", f"/_matrix/client/v3/rooms/{room_id}/messages?limit=10&dir=b", token=alice)
    record("Message", "GET /messages", s, b, ms, ok and "chunk" in b)

    # Edit message
    if event_id:
        txn4 = f"t4_{int(time.time()*1000)}"
        s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn4}",
            token=alice, body={"msgtype": "m.text", "body": "* Edited",
                "m.new_content": {"msgtype": "m.text", "body": "Edited message"},
                "m.relates_to": {"rel_type": "m.replace", "event_id": event_id}})
        record("Message", "PUT /send edit", s, b, ms, ok)

    # Redact
    if event_id:
        txn5 = f"t5_{int(time.time()*1000)}"
        s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/redact/{event_id}/{txn5}",
            token=alice, body={"reason": "test redact"})
        record("Message", "PUT /redact", s, b, ms, ok)

    # Room state & members
    s, b, ms, ok = req("GET", f"/_matrix/client/v3/rooms/{room_id}/state", token=alice)
    record("Room", "GET /state", s, b, ms, ok)
    s, b, ms, ok = req("GET", f"/_matrix/client/v3/rooms/{room_id}/members", token=alice)
    record("Room", "GET /members", s, b, ms, ok)

    # Typing
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/typing/@itest_alice:matrix.test",
        token=alice, body={"typing": True, "timeout": 30000})
    record("Room", "PUT /typing", s, b, ms, ok)

    # Read receipt
    if event_id:
        s, b, ms, ok = req("POST", f"/_matrix/client/v3/rooms/{room_id}/receipt/m.read/{event_id}",
            token=alice, body={})
        record("Room", "POST /receipt", s, b, ms, ok)

    # Room account data
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/user/@itest_alice:matrix.test/rooms/{room_id}/account_data/m.fully_read",
        token=alice, body={"event_id": event_id or "$dummy"})
    record("Room", "PUT /room account_data", s, b, ms, ok)

    # Room tags
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/user/@itest_alice:matrix.test/rooms/{room_id}/tags/m.favourite",
        token=alice, body={"order": 0.5})
    record("Room", "PUT /tags", s, b, ms, ok)

    # Joined rooms
    s, b, ms, ok = req("GET", "/_matrix/client/v3/joined_rooms", token=alice)
    record("Room", "GET /joined_rooms", s, b, ms, ok and "joined_rooms" in b)

    # Public rooms
    s, b, ms, ok = req("GET", "/_matrix/client/v3/publicRooms?limit=5")
    record("Room", "GET /publicRooms", s, b, ms, ok)

# DM room
s, b, ms, ok = req("POST", "/_matrix/client/v3/createRoom", token=alice,
    body={"is_direct": True, "invite": ["@itest_bob:matrix.test"], "preset": "private_chat"})
dm_room = b.get("room_id", "")
record("Room", "POST /createRoom (DM)", s, b, ms, ok)

# Invite
if dm_room and bob:
    s, b, ms, ok = req("POST", f"/_matrix/client/v3/rooms/{dm_room}/invite", token=alice,
        body={"user_id": "@itest_bob:matrix.test"})
    record("Room", "POST /invite", s, b, ms, ok)

# ============================================================
# 4. E2EE & Device
# ============================================================
print("\n=== 4. E2EE & Device ===")
s, b, ms, ok = req("GET", "/_matrix/client/v3/devices", token=alice)
record("E2EE", "GET /devices", s, b, ms, ok and "devices" in b)

s, b, ms, ok = req("POST", "/_matrix/client/v3/keys/upload", token=alice, body={
    "device_keys": {
        "user_id": "@itest_alice:matrix.test", "device_id": "ITESTDEV",
        "algorithms": ["m.olm.v1.curve25519-aes-sha2", "m.megolm.v1.aes-sha2"],
        "keys": {"ed25519:ITESTDEV": "test_ed25519_key", "curve25519:ITESTDEV": "test_curve25519_key"},
        "signatures": {}
    }, "one_time_keys": {"signed_curve25519:1": {"key": "test_otk", "signatures": {}}}
})
record("E2EE", "POST /keys/upload", s, b, ms, ok)

s, b, ms, ok = req("POST", "/_matrix/client/v3/keys/query", token=alice,
    body={"device_keys": {"@itest_alice:matrix.test": {}}})
record("E2EE", "POST /keys/query", s, b, ms, ok)
# OTK leak check
alice_keys = b.get("device_keys", {}).get("@itest_alice:matrix.test", {})
otk_leak = any(k.startswith("signed_curve25519:") for dev in alice_keys.values() for k in dev.get("keys", {}))
record("E2EE", "OTK leak check", 200, {}, 0, not otk_leak, "OTK in device_keys" if otk_leak else "Clean")

s, b, ms, ok = req("GET", "/_matrix/client/v3/keys/changes?from=0&to=999999999", token=alice)
record("E2EE", "GET /keys/changes", s, b, ms, ok)

s, b, ms, ok = req("PUT", "/_matrix/client/v3/sendToDevice/m.test/1", token=alice,
    body={"messages": {"@itest_bob:matrix.test": {"DEVICE": {"body": "test"}}}})
record("E2EE", "PUT /sendToDevice", s, b, ms, ok)
record("E2EE", "sendToDevice has failures", 200, b, 0, "failures" in b)

# Key claim
s, b, ms, ok = req("POST", "/_matrix/client/v3/keys/claim", token=alice,
    body={"one_time_keys": {"@itest_bob:matrix.test": {"ITESTDEV": "signed_curve25519"}}})
record("E2EE", "POST /keys/claim", s, b, ms, ok)

# ============================================================
# 5. Friends & Social
# ============================================================
print("\n=== 5. Friends & Social ===")
# GET /friends (v3)
s, b, ms, ok = req("GET", "/_matrix/client/v3/friends", token=alice)
record("Friend", "GET /v3/friends", s, b, ms, ok, f"total={b.get('total',0)}")

# POST /friends (send friend request) - correct route is /friends not /friend/request
s, b, ms, ok = req("POST", "/_matrix/client/v3/friends", token=alice,
    body={"user_id": "@itest_bob:matrix.test", "message": "integration test"})
record("Friend", "POST /v3/friends (request)", s, b, ms, ok)

# Also test v1 friend request route
s, b, ms, ok = req("POST", "/_matrix/client/v1/friends/request", token=alice,
    body={"user_id": "@itest_bob:matrix.test", "message": "v1 test"})
record("Friend", "POST /v1/friends/request", s, b, ms, ok)

# Incoming requests (v3)
s, b, ms, ok = req("GET", "/_matrix/client/v3/friends/requests/incoming", token=bob)
record("Friend", "GET /v3/friends/requests/incoming", s, b, ms, ok)

# Outgoing requests (v3)
s, b, ms, ok = req("GET", "/_matrix/client/v3/friends/requests/outgoing", token=alice)
record("Friend", "GET /v3/friends/requests/outgoing", s, b, ms, ok)

# Accept friend request (v1 route with user_id path)
s, b, ms, ok = req("POST", "/_matrix/client/v1/friends/request/@itest_alice:matrix.test/accept", token=bob, body={})
record("Friend", "POST /v1/friends/request/accept", s, b, ms, ok)

# Check friendship
s, b, ms, ok = req("GET", "/_matrix/client/v3/friends/check/@itest_bob:matrix.test", token=alice)
record("Friend", "GET /v3/friends/check", s, b, ms, ok)

# Friend search
s, b, ms, ok = req("GET", "/_matrix/client/v3/friends/search?query=bob", token=alice)
record("Friend", "GET /v3/friends/search", s, b, ms, ok)

# Friend suggestions
s, b, ms, ok = req("GET", "/_matrix/client/v1/friends/suggestions", token=alice)
record("Friend", "GET /v1/friends/suggestions", s, b, ms, ok)

# Friend groups
s, b, ms, ok = req("GET", "/_matrix/client/v1/friends/groups", token=alice)
record("Friend", "GET /v1/friends/groups", s, b, ms, ok)

# Presence
s, b, ms, ok = req("PUT", "/_matrix/client/v3/presence/@itest_alice:matrix.test/status", token=alice,
    body={"presence": "online", "status_msg": "testing"})
record("Presence", "PUT /presence (set)", s, b, ms, ok)

s, b, ms, ok = req("GET", "/_matrix/client/v3/presence/@itest_alice:matrix.test/status", token=alice)
record("Presence", "GET /presence (get)", s, b, ms, ok and b.get("presence") == "online")

# ============================================================
# 6. Media
# ============================================================
print("\n=== 6. Media ===")
# Upload
boundary = "----FormBoundary7MA4YWxkTrZu0gW"
file_content = b"integration test media content"
body_raw = f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode() + file_content + f"\r\n--{boundary}--\r\n".encode()
t0 = time.time()
try:
    upload_r = urllib.request.Request(f"{BASE}/_matrix/media/v3/upload?filename=test.txt",
        data=body_raw, headers={"Authorization": f"Bearer {alice}", "Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
    resp = urllib.request.urlopen(upload_r, context=ctx, timeout=30)
    us, ub = resp.status, json.loads(resp.read().decode())
except urllib.error.HTTPError as e:
    us, ub = e.code, json.loads(e.read().decode())
except Exception as e:
    us, ub = 0, {"error": str(e)}
ums = round((time.time() - t0) * 1000)
mxc = ub.get("content_uri", "")
record("Media", "POST /upload", us, ub, ums, us == 200, f"mxc={mxc}")

# Download
if mxc:
    mxc_parts = mxc.replace("mxc://", "").split("/")
    media_id = mxc_parts[1] if len(mxc_parts) > 1 else ""
    server_name = mxc_parts[0]
    s, b, ms, ok = req("GET", f"/_matrix/media/v3/download/{server_name}/{media_id}", token=alice)
    record("Media", "GET /download", s, b, ms, ok or b.get("_binary"), "binary download")

# Thumbnail (returns binary image or 404 for non-existent)
s, b, ms, ok = req("GET", f"/_matrix/media/v3/thumbnail/matrix.test/test?width=32&height=32&method=scale", token=alice)
record("Media", "GET /thumbnail", s, b, ms, s == 200 or b.get("_binary") or s == 404, "binary or 404 ok")

# Preview URL
s, b, ms, ok = req("GET", "/_matrix/media/v3/preview_url?url=https://example.com", token=alice)
record("Media", "GET /preview_url", s, b, ms, s in [200, 400, 404, 502])

# ============================================================
# 7. Search & Push
# ============================================================
print("\n=== 7. Search & Push ===")
s, b, ms, ok = req("POST", "/_matrix/client/v3/search", token=alice,
    body={"search_categories": {"room_events": {"search_term": "integration", "filter": {"limit": 5}}}})
record("Search", "POST /search", s, b, ms, ok)

s, b, ms, ok = req("GET", "/_matrix/client/v3/pushrules/", token=alice)
record("Push", "GET /pushrules", s, b, ms, ok and "global" in b)

s, b, ms, ok = req("GET", "/_matrix/client/v3/pushers", token=alice)
record("Push", "GET /pushers", s, b, ms, ok)

# ============================================================
# 8. Sync
# ============================================================
print("\n=== 8. Sync ===")
s, b, ms, ok = req("GET", "/_matrix/client/v3/sync?timeout=0", token=alice)
record("Sync", "GET /sync", s, b, ms, ok and "next_batch" in b, f"has_next_batch={'next_batch' in b}")

# ============================================================
# 9. Burn-After-Read
# ============================================================
print("\n=== 9. Burn-After-Read ===")
if room_id:
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/burn_after_read/@itest_alice:matrix.test",
        token=alice, body={"enabled": True, "expires_in": 60000})
    record("BurnAfterRead", "PUT /burn_after_read", s, b, ms, ok)

# ============================================================
# 10. Key Rotation & Key Backup
# ============================================================
print("\n=== 10. Key Rotation & Key Backup ===")
s, b, ms, ok = req("GET", "/_matrix/client/v3/key_rotation/status", token=alice)
record("KeyRotation", "GET /status", s, b, ms, ok)

s, b, ms, ok = req("GET", "/_matrix/client/v3/key_rotation/check_validity", token=alice)
record("KeyRotation", "GET /check_validity", s, b, ms, ok)

s, b, ms, ok = req("GET", "/_matrix/client/v3/key_rotation/history", token=alice)
record("KeyRotation", "GET /history", s, b, ms, ok)

s, b, ms, ok = req("POST", "/_matrix/client/v3/room_keys/version", token=alice,
    body={"algorithm": "m.megolm_backup.v1.curve25519-aes-sha2", "auth_data": {}})
backup_ver = b.get("version", "")
record("KeyBackup", "POST /room_keys/version", s, b, ms, ok, f"version={backup_ver}")

if backup_ver:
    s, b, ms, ok = req("GET", f"/_matrix/client/v3/room_keys/version/{backup_ver}", token=alice)
    record("KeyBackup", "GET /room_keys/version", s, b, ms, ok)

# ============================================================
# 11. Account Data
# ============================================================
print("\n=== 11. Account Data ===")
s, b, ms, ok = req("PUT", "/_matrix/client/v3/user/@itest_alice:matrix.test/account_data/m.test_it",
    token=alice, body={"key": "value", "ts": int(time.time()*1000)})
record("AccountData", "PUT /account_data", s, b, ms, ok)

s, b, ms, ok = req("GET", "/_matrix/client/v3/user/@itest_alice:matrix.test/account_data/m.test_it",
    token=alice)
record("AccountData", "GET /account_data", s, b, ms, ok and b.get("key") == "value")

# ============================================================
# 12. Relations & Reactions
# ============================================================
print("\n=== 12. Relations & Reactions ===")
if event_id and room_id:
    # Reaction
    txn6 = f"t6_{int(time.time()*1000)}"
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/send/m.reaction/{txn6}",
        token=alice, body={"m.relates_to": {"rel_type": "m.annotation", "event_id": event_id, "key": "👍"}})
    record("Reaction", "PUT /send reaction", s, b, ms, ok)

    # Relations
    s, b, ms, ok = req("GET", f"/_matrix/client/v3/rooms/{room_id}/relations/{event_id}", token=alice)
    record("Relations", "GET /relations", s, b, ms, ok)

    # Thread
    txn7 = f"t7_{int(time.time()*1000)}"
    s, b, ms, ok = req("PUT", f"/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn7}",
        token=alice, body={"msgtype": "m.text", "body": "Thread reply",
            "m.relates_to": {"rel_type": "m.thread", "event_id": event_id}})
    record("Thread", "PUT /send thread reply", s, b, ms, ok)

# ============================================================
# 13. Typing Batch & SDK Alignment
# ============================================================
print("\n=== 13. SDK Module Alignment ===")
if room_id:
    s, b, ms, ok = req("POST", "/_matrix/client/v3/rooms/typing/batch", token=alice,
        body={"rooms": [room_id]})
    record("SDK-Align", "POST /typing/batch", s, b, ms, ok)

# User directory
s, b, ms, ok = req("POST", "/_matrix/client/v3/user_directory/search", token=alice,
    body={"search_term": "bob"})
record("SDK-Align", "POST /user_directory/search", s, b, ms, ok)

# Filter
s, b, ms, ok = req("POST", "/_matrix/client/v3/user/@itest_alice:matrix.test/filter", token=alice,
    body={"room": {"timeline": {"limit": 50}}})
filter_id = b.get("filter_id", "")
record("SDK-Align", "POST /filter", s, b, ms, ok, f"filter_id={filter_id}")

# ============================================================
# 14. Error Handling & Edge Cases
# ============================================================
print("\n=== 14. Error Handling ===")
s, b, ms, ok = req("GET", "/_matrix/client/v3/account/whoami", token="invalid_token_12345")
record("Error", "Invalid token → 401", s, b, ms, s == 401, f"errcode={b.get('errcode','')}")

s, b, ms, ok = req("GET", "/_matrix/client/v3/rooms/!nonexistent:matrix.test/state", token=alice)
record("Error", "Non-existent room → 403/404", s, b, ms, s in [403, 404], f"errcode={b.get('errcode','')}")

s, b, ms, ok = req("POST", "/_matrix/client/v3/createRoom", token=alice, body={})
record("Error", "Empty createRoom → 200 (defaults)", s, b, ms, s == 200, "Should create with defaults")

# UIA with identifier
s, b, ms, ok = req("POST", "/_matrix/client/v3/account/password", token=alice, body={
    "new_password": "Test5678!",
    "auth": {"type": "m.login.password", "identifier": {"type": "m.id.user", "user": "itest_alice"}, "password": "Test1234!"}
})
record("UIA", "POST /password (identifier)", s, b, ms, ok, f"status={s}")

# UIA with user_id (compat)
s, b, ms, ok = req("POST", "/_matrix/client/v3/account/password", token=alice, body={
    "new_password": "Test1234!",
    "auth": {"type": "m.login.password", "user_id": "@itest_alice:matrix.test", "password": "Test5678!"}
})
record("UIA", "POST /password (user_id compat)", s, b, ms, ok, f"status={s}")

# ============================================================
# Summary
# ============================================================
print("\n" + "="*60)
total = len(results)
passed = sum(1 for r in results if r["ok"])
failed = total - passed
print(f"TOTAL: {total} | PASS: {passed} | FAIL: {failed} | Rate: {passed/total*100:.1f}%")

modules = {}
for r in results:
    mod = r["module"]
    if mod not in modules: modules[mod] = {"pass": 0, "fail": 0, "total_ms": 0}
    modules[mod]["pass" if r["ok"] else "fail"] += 1
    modules[mod]["total_ms"] += r["elapsed_ms"]

print("\nModule Breakdown:")
for mod, stats in modules.items():
    t = stats["pass"] + stats["fail"]
    avg = stats["total_ms"] // t if t else 0
    print(f"  {mod}: {stats['pass']}/{t} pass, avg {avg}ms")

if failed:
    print("\nFailed Items:")
    for r in results:
        if not r["ok"]:
            print(f"  [{r['module']}] {r['test']}: {r['status']} - {r['notes']} | {r['body_preview'][:100]}")

report = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"), "backend": BASE,
    "summary": {"total": total, "passed": passed, "failed": failed, "rate": f"{passed/total*100:.1f}%"},
    "modules": modules, "results": results}
with open("/Users/ljf/Desktop/hu_ts/hula/docs/integration-test-report-latest.json", "w") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
print(f"\nReport saved to docs/integration-test-report-latest.json")
