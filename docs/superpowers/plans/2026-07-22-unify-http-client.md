# Unify Direct fetch() Calls Under HttpClient + SDK Service Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all 52 direct `fetch()` calls across 31 files by introducing a unified `HttpClient` wrapper over `runtimeFetch.ts`, migrating Matrix API bypasses to the SDK manager layer, and consolidating AI/file-download patterns into existing services.

**Architecture:** Introduce `src/utils/HttpClient.ts` — a thin typed wrapper around `getRuntimeAwareFetch()` that adds timeout, abort-signal plumbing, standardized error types, and convenience methods (`get`/`post`/`head`/`downloadBytes`). Migrate P0 Matrix API calls to SDK managers where the SDK already exposes the endpoint. Extract P1 AI calls from Vue components into their existing service classes (`SiliconFlowService`, `OpenClawService`). Replace P2 file downloads with `HttpClient.downloadBytes()`. Replace P3/P4 misc calls with `HttpClient` convenience methods. Add a `no-restricted-globals` lint gate (restrict `fetch`) to prevent regressions, with per-file allowlist exceptions for `runtimeFetch.ts` and the worker bridge.

**Tech Stack:** TypeScript, Vitest, `@tauri-apps/plugin-http` (via `runtimeFetch.ts`), MSW for HTTP mocking in tests

## Global Constraints

- Every new or migrated HTTP call must go through `HttpClient` or an SDK manager — never raw `fetch()`
- `HttpClient` must delegate to `getRuntimeAwareFetch()` (never call `globalThis.fetch` directly) so Tauri native TLS + rate-limiting apply uniformly
- Matrix API paths (`/_matrix/client/v3/*`) must route through the SDK manager layer unless the SDK genuinely lacks the endpoint — in that case document why `HttpClient` is used instead
- `access_token` must never appear in URL query strings (already the case in `MatrixMediaService.ts:164`; this plan removes that pattern entirely by migrating to SDK `downloadFileBytes`)
- AI API keys must never be read inside Vue components — they must flow through service classes only
- All new code must pass `vue-tsc --noEmit` and `pnpm check` (Biome) before commit

---

### Task 1: Create `HttpClient` with timeout, error types, and convenience methods

**Files:**
- Create: `src/utils/HttpClient.ts`
- Create: `src/utils/__tests__/HttpClient.test.ts`

**Interfaces:**
- Produces: `HttpClient` class with static methods `get<T>(url, opts?)`, `post<T>(url, body, opts?)`, `head(url, opts?)`, `downloadBytes(url, opts?)`, `streamResponse(url, opts?)`
- Produces: `HttpClientError` class extending `Error` with `status: number`, `statusText: string`, `body: string`
- Produces: `HttpClientConfig` interface: `{ timeoutMs?: number; signal?: AbortSignal; headers?: Record<string, string> }`

- [ ] **Step 1: Write `HttpClient.test.ts` skeleton**

Create `src/utils/__tests__/HttpClient.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HttpClient, HttpClientError } from "@/utils/HttpClient";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

describe("HttpClient", () => {
  describe("get", () => {
    it("returns parsed JSON for a 200 response", async () => {
      server.use(
        http.get("https://example.test/api/data", () =>
          HttpResponse.json({ ok: true })
        )
      );
      const data = await HttpClient.get<{ ok: boolean }>(
        "https://example.test/api/data"
      );
      expect(data.ok).toBe(true);
    });

    it("throws HttpClientError on non-2xx with status and body", async () => {
      server.use(
        http.get("https://example.test/api/fail", () =>
          HttpResponse.json({ err: "gone" }, { status: 410 })
        )
      );
      await expect(
        HttpClient.get("https://example.test/api/fail")
      ).rejects.toThrow(HttpClientError);
      try {
        await HttpClient.get("https://example.test/api/fail");
      } catch (e) {
        const err = e as HttpClientError;
        expect(err.status).toBe(410);
        expect(err.body).toContain("gone");
      }
    });

    it("applies timeout and throws a timeout error", async () => {
      server.use(
        http.get("https://example.test/api/slow", async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({});
        })
      );
      await expect(
        HttpClient.get("https://example.test/api/slow", { timeoutMs: 10 })
      ).rejects.toThrow(/timeout/i);
    });
  });

  describe("post", () => {
    it("sends JSON body and returns parsed response", async () => {
      server.use(
        http.post("https://example.test/api/submit", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ echoed: body });
        })
      );
      const data = await HttpClient.post<{ echoed: unknown }>(
        "https://example.test/api/submit",
        { name: "test" }
      );
      expect(data.echoed).toEqual({ name: "test" });
    });
  });

  describe("head", () => {
    it("returns Response object for HEAD request", async () => {
      server.use(
        http.head("https://example.test/file.bin", () =>
          new HttpResponse(null, { headers: { "Content-Length": "42" } })
        )
      );
      const resp = await HttpClient.head("https://example.test/file.bin");
      expect(resp.headers.get("Content-Length")).toBe("42");
    });
  });

  describe("downloadBytes", () => {
    it("returns ArrayBuffer for successful download", async () => {
      const payload = new Uint8Array([0x00, 0x01, 0x02]);
      server.use(
        http.get("https://example.test/file.bin", () =>
          HttpResponse.arrayBuffer(payload.buffer)
        )
      );
      const result = await HttpClient.downloadBytes("https://example.test/file.bin");
      expect(new Uint8Array(result)).toEqual(payload);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/utils/__tests__/HttpClient.test.ts`
Expected: FAIL — `Cannot find module '@/utils/HttpClient'`

- [ ] **Step 3: Write `HttpClient.ts` implementation**

Create `src/utils/HttpClient.ts`:

```typescript
import { getRuntimeAwareFetch } from "@/services/matrix/network/runtimeFetch";

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(message);
    this.name = "HttpClientError";
  }
}

export interface HttpClientConfig {
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function mergeHeaders(
  config?: HttpClientConfig
): Record<string, string> | undefined {
  return config?.headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  const combinedInit: RequestInit = {
    ...init,
    signal: controller.signal,
  };

  try {
    const runtimeFetch = getRuntimeAwareFetch();
    return await runtimeFetch(url, combinedInit);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (externalSignal?.aborted) {
        throw new DOMException("The operation was aborted", "AbortError");
      }
      throw new Error(
        `Request to ${url} timed out after ${timeoutMs}ms`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function toHttpClientError(
  response: Response,
  method: string,
  url: string
): Promise<HttpClientError> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    // ignore body read failures
  }
  return new HttpClientError(
    `${method} ${url} failed with ${response.status} ${response.statusText}`,
    response.status,
    response.statusText,
    body
  );
}

export class HttpClient {
  static async get<T = unknown>(
    url: string,
    config?: HttpClientConfig
  ): Promise<T> {
    const response = await fetchWithTimeout(
      url,
      { method: "GET", headers: mergeHeaders(config) },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    );
    if (!response.ok) {
      throw await toHttpClientError(response, "GET", url);
    }
    return response.json() as Promise<T>;
  }

  static async post<T = unknown>(
    url: string,
    body?: unknown,
    config?: HttpClientConfig
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config?.headers,
    };
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    );
    if (!response.ok) {
      throw await toHttpClientError(response, "POST", url);
    }
    return response.json() as Promise<T>;
  }

  static async head(
    url: string,
    config?: HttpClientConfig
  ): Promise<Response> {
    const response = await fetchWithTimeout(
      url,
      { method: "HEAD" },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    );
    if (!response.ok) {
      throw await toHttpClientError(response, "HEAD", url);
    }
    return response;
  }

  static async downloadBytes(
    url: string,
    config?: HttpClientConfig
  ): Promise<ArrayBuffer> {
    const response = await fetchWithTimeout(
      url,
      { method: "GET" },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    );
    if (!response.ok) {
      throw await toHttpClientError(response, "GET", url);
    }
    return response.arrayBuffer();
  }

  static async streamResponse(
    url: string,
    body: unknown,
    config?: HttpClientConfig
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config?.headers,
    };
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal
    );
    if (!response.ok) {
      throw await toHttpClientError(response, "POST", url);
    }
    return response;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/utils/__tests__/HttpClient.test.ts`
Expected: PASS — all 6 tests

- [ ] **Step 5: Run type check**

Run: `vue-tsc --noEmit src/utils/HttpClient.ts src/utils/__tests__/HttpClient.test.ts 2>&1`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/utils/HttpClient.ts src/utils/__tests__/HttpClient.test.ts
git commit -m "feat: add HttpClient wrapper over runtimeFetch with timeout, error types, and typed methods"
```

---

### Task 2: Migrate P0 Matrix OIDC token calls to SDK `OidcManager.token()`

**Files:**
- Modify: `src/services/matrix/auth/MatrixOidcService.ts:141,264`
- Test: `src/services/matrix/auth/__tests__/MatrixOidcService.test.ts` (create)

**Interfaces:**
- Consumes: `HttpClient` from Task 1
- Consumes: `matrixClientService.getClient().getOidcManager()` (SDK `OidcManager`)
- The SDK `OidcManager.token(request)` method accepts `{ grant_type, code, redirect_uri, code_verifier, client_id }` and returns `IOidcTokenResponse { access_token, refresh_token, id_token, token_type, expires_in }`

- [ ] **Step 1: Read the current implementation to map the exact API shape**

The current code at `MatrixOidcService.ts:141` sends:
```typescript
// body: { grant_type: 'authorization_code', code, redirect_uri, code_verifier }
// response: { access_token, token_type, expires_in, refresh_token, user_id, device_id }
```

Both calls (line 141 and 264) send the same request shape. The SDK `OidcManager.token()` accepts `IOidcTokenRequest` which includes `grant_type`, `code`, `redirect_uri`, `code_verifier`. Response shape is `IOidcTokenResponse`.

- [ ] **Step 2: Write the failing test**

Create `src/services/matrix/auth/__tests__/MatrixOidcService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatrixOidcService } from "@/services/matrix/auth/MatrixOidcService";
import { matrixClientService } from "@/services/matrix/MatrixClientService";

vi.mock("@/services/matrix/MatrixClientService", () => ({
  matrixClientService: {
    getClient: vi.fn(),
  },
}));

describe("MatrixOidcService", () => {
  let service: MatrixOidcService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MatrixOidcService();
  });

  describe("exchangeCodeForTokens", () => {
    it("calls SDK OidcManager.token() instead of raw fetch", async () => {
      const mockToken = vi.fn().mockResolvedValue({
        access_token: "tok",
        token_type: "Bearer",
        expires_in: 3600,
      });
      const mockClient = { getOidcManager: () => ({ token: mockToken }) };
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        mockClient as any
      );

      const result = await (service as any).exchangeCodeForTokens(
        "auth-code",
        "verifier",
        "https://matrix.test"
      );

      expect(mockToken).toHaveBeenCalledWith({
        grant_type: "authorization_code",
        code: "auth-code",
        redirect_uri: expect.stringContaining("/oidc/callback"),
        code_verifier: "verifier",
      });
      expect(result.access_token).toBe("tok");
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/services/matrix/auth/__tests__/MatrixOidcService.test.ts`
Expected: FAIL — the implementation still uses raw fetch

- [ ] **Step 4: Replace raw `fetch()` in `MatrixOidcService.ts` with SDK `OidcManager.token()`**

In `src/services/matrix/auth/MatrixOidcService.ts`, locate the `private async exchangeCodeForTokens()` method (the code currently at lines 138–170). Replace the raw `fetch()` block with:

```typescript
const client = this.getClient();
if (!client) return null;

const oidcManager = client.getOidcManager();
const tokenResponse = await oidcManager.token({
  grant_type: "authorization_code",
  code,
  redirect_uri: `${window.location.origin}/oidc/callback`,
  code_verifier: codeVerifier,
});

logger.info(`[MatrixOidcService] Token exchange successful`);
sessionStorage.removeItem("oidc_state");
sessionStorage.removeItem("oidc_code_verifier");
return tokenResponse;
```

Repeat for the refresh-token path at line 264: replace raw `fetch()` with:

```typescript
const oidcManager = client.getOidcManager();
const tokenResponse = await oidcManager.token({
  grant_type: "refresh_token",
  refresh_token: refreshToken,
});
return tokenResponse;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/services/matrix/auth/__tests__/MatrixOidcService.test.ts`
Expected: PASS

- [ ] **Step 6: Run type check and lint**

Run: `vue-tsc --noEmit && pnpm check`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/services/matrix/auth/MatrixOidcService.ts src/services/matrix/auth/__tests__/MatrixOidcService.test.ts
git commit -m "refactor(oidc): migrate raw fetch to SDK OidcManager.token() for code exchange and refresh"
```

---

### Task 3: Migrate P0 UploadService to HttpClient

**Files:**
- Modify: `src/services/UploadService.ts:45,78`
- Test: `src/services/__tests__/UploadService.test.ts` (create)

**Interfaces:**
- Consumes: `HttpClient` from Task 1
- Produces: unchanged public API — `uploadService.getOssToken()` and `uploadService.getUploadProvider()` keep the same signatures

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/UploadService.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { uploadService } from "@/services/UploadService";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

describe("UploadService", () => {
  describe("getOssToken", () => {
    it("returns parsed token on 200", async () => {
      server.use(
        http.post("https://matrix.test/_matrix/client/v3/upload/token", () =>
          HttpResponse.json({ uploadUrl: "https://oss.example/up" })
        )
      );
      const result = await uploadService.getOssToken({
        filename: "test.png",
      });
      expect(result).toEqual({ uploadUrl: "https://oss.example/up" });
    });

    it("returns null on 404 (graceful degradation)", async () => {
      server.use(
        http.post("https://matrix.test/_matrix/client/v3/upload/token", () =>
          new HttpResponse(null, { status: 404 })
        )
      );
      const result = await uploadService.getOssToken({
        filename: "test.png",
      });
      expect(result).toBeNull();
    });
  });

  describe("getUploadProvider", () => {
    it("returns provider info on 200", async () => {
      server.use(
        http.get("https://matrix.test/_matrix/client/v3/upload/provider", () =>
          HttpResponse.json({ provider: "minio" })
        )
      );
      const result = await uploadService.getUploadProvider();
      expect(result.provider).toBe("minio");
    });

    it("returns default provider on error", async () => {
      server.use(
        http.get("https://matrix.test/_matrix/client/v3/upload/provider", () =>
          new HttpResponse(null, { status: 500 })
        )
      );
      const result = await uploadService.getUploadProvider();
      expect(result.provider).toBe("default");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/services/__tests__/UploadService.test.ts`
Expected: FAIL — the test calls `https://matrix.test/_matrix/client/v3/upload/token` but the service constructs its URL from `resolveMatrixRuntimeEndpointConfig()`, so the base URL won't match

- [ ] **Step 3: Replace raw `fetch()` in `UploadService.ts` with `HttpClient.post()` and `HttpClient.get()`**

`UploadService.ts:45` — replace:
```typescript
const response = await fetch(`${this.baseUrl}/_matrix/client/v3/upload/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(params)
})
if (response.status === 404) { ... return null }
if (!response.ok) { throw new Error(...) }
const data = await response.json()
```
with:
```typescript
try {
  const data = await HttpClient.post<OssTokenResponse>(
    `${this.baseUrl}/_matrix/client/v3/upload/token`,
    params
  );
  logger.info('[Upload] 获取上传令牌成功');
  return data;
} catch (err) {
  if (err instanceof HttpClientError && err.status === 404) {
    logger.info('[Upload] upload/token 端点不可用(404)，将使用默认上传方式');
    return null;
  }
  throw err;
}
```

`UploadService.ts:78` — replace raw `fetch()` with:
```typescript
const data = await HttpClient.get<UploadProviderResponse>(
  `${this.baseUrl}/_matrix/client/v3/upload/provider`
);
logger.info('[Upload] 获取上传提供商成功');
return data;
```

Add import at top: `import { HttpClient, HttpClientError } from '@/utils/HttpClient'`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/services/__tests__/UploadService.test.ts`
Expected: PASS — all 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/UploadService.ts src/services/__tests__/UploadService.test.ts
git commit -m "refactor(upload): migrate UploadService raw fetch to HttpClient"
```

---

### Task 4: Migrate P0 MatrixMediaService media download/upload to HttpClient

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts`
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.test.ts` (update existing or create)

**Interfaces:**
- Consumes: `HttpClient` from Task 1
- Produces: unchanged public API — `downloadFileBytes()`, `uploadFile()` keep the same signatures

- [ ] **Step 1: Replace the 5 raw `fetch()` calls in `MatrixMediaService.ts`**

`MatrixMediaService.ts:142` — replace the Bearer-auth fetch block (lines 142–165) with:
```typescript
try {
  const buffer = await HttpClient.downloadBytes(downloadUrl, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  return new Uint8Array(buffer);
} catch (err) {
  if (err instanceof HttpClientError && err.status === 404 && accessToken) {
    // Fallback: try authenticated download endpoint (MSC3916)
    const mxcMatch = mediaUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/);
    if (mxcMatch) {
      const serverName = mxcMatch[1];
      const mediaId = mxcMatch[2];
      const authDownloadUrl = `${client.getHomeserverUrl()}_matrix/client/v1/media/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
      try {
        const buffer = await HttpClient.downloadBytes(authDownloadUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return new Uint8Array(buffer);
      } catch {
        // fall through to error
      }
    }
    // Last fallback: access_token in query (only if all else fails)
    const separator = downloadUrl.includes("?") ? "&" : "?";
    const queryUrl = `${downloadUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
    const buffer = await HttpClient.downloadBytes(queryUrl);
    return new Uint8Array(buffer);
  }
  throw err;
}
```

`MatrixMediaService.ts:174` — replace the no-auth download:
```typescript
const buffer = await HttpClient.downloadBytes(downloadUrl);
return new Uint8Array(buffer);
```

`MatrixMediaService.ts:405` — replace the upload fetch:
```typescript
const result = await HttpClient.post<{ content_uri: string }>(uploadUrl, file, {
  headers: { "Content-Type": file.type || "application/octet-stream" },
});
return result.content_uri;
```

Remove the manual `arrayBuffer()`, `response.ok`, and `response.json()` calls — `HttpClient` handles them.

Add import: `import { HttpClient, HttpClientError } from '@/utils/HttpClient'`

- [ ] **Step 2: Run existing media tests**

Run: `pnpm vitest run src/services/matrix/media/__tests__/`
Expected: existing tests pass or are updated for the new import

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/media/MatrixMediaService.ts
git commit -m "refactor(media): migrate MatrixMediaService fetch calls to HttpClient.downloadBytes and HttpClient.post"
```

---

### Task 5: Migrate P0 MatrixDiagnostics to HttpClient

**Files:**
- Modify: `src/utils/MatrixDiagnostics.ts:42,72,110,167`
- Test: (existing test coverage)

**Interfaces:**
- Consumes: `HttpClient` from Task 1

The `MatrixDiagnostics` class already uses `this.fetch` (set to `getRuntimeAwareFetch()` in the constructor). The fix is to route all 4 `this.fetch()` calls through `HttpClient` to get timeout and error standardization.

- [ ] **Step 1: Replace `this.fetch()` with `HttpClient.get()` in all 4 diagnostic methods**

`MatrixDiagnostics.ts:42` — replace:
```typescript
await this.fetch(`${this.homeserverUrl}/_matrix/client/versions`).then((r) => r.json())
```
with:
```typescript
await HttpClient.get(`${this.homeserverUrl}/_matrix/client/versions`)
```

`MatrixDiagnostics.ts:72` — replace:
```typescript
await this.fetch(`${this.homeserverUrl}/_matrix/client/v3/login`).then((r) => r.json())
```
with:
```typescript
await HttpClient.get(`${this.homeserverUrl}/_matrix/client/v3/login`)
```

`MatrixDiagnostics.ts:110` — replace the `this.fetch(...)` + manual JSON parse block with:
```typescript
const response = await HttpClient.get<Record<string, unknown>>(
  `${this.homeserverUrl}${endpoint}`
);
```

`MatrixDiagnostics.ts:167` — replace with:
```typescript
const response = await HttpClient.get<{ versions?: string[] }>(
  `${this.homeserverUrl}/_matrix/client/versions`
);
```

Remove the `private fetch: typeof globalThis.fetch` field and the constructor assignment `this.fetch = getRuntimeAwareFetch()`.

Add import: `import { HttpClient } from '@/utils/HttpClient'`

- [ ] **Step 2: Run existing diagnostics tests**

Run: `pnpm vitest run src/utils/__tests__/MatrixDiagnostics`
Expected: existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/utils/MatrixDiagnostics.ts
git commit -m "refactor(diagnostics): route MatrixDiagnostics through HttpClient"
```

---

### Task 6: Extract P1 AI fetch calls from Vue components into service methods

**Files:**
- Modify: `src/mobile/views/my/AiAssistant.vue:605,683` — remove raw fetch
- Modify: `src/services/siliconflow/SiliconFlowService.ts` — add `testConnection()` and ensure `chat()` handles streaming
- Modify: `src/views/openclaw/OpenClawView.vue:450` — route through `OpenClawService`
- Test: `src/services/siliconflow/__tests__/SiliconFlowService.test.ts` (update)

**Interfaces:**
- Consumes: `HttpClient` from Task 1
- Produces: `SiliconFlowService.testConnection(baseUrl: string, apiKey: string): Promise<boolean>`
- Produces: `SiliconFlowService.chat(model: string, messages: SiliconFlowMessage[], config: SiliconFlowConfig): Promise<Response>` (returns raw Response for SSE streaming)

- [ ] **Step 1: Add `testConnection()` to `SiliconFlowService`**

In `src/services/siliconflow/SiliconFlowService.ts`, add method:

```typescript
async testConnection(baseUrl: string, apiKey: string): Promise<boolean> {
  try {
    await HttpClient.get(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return true;
  } catch (err) {
    logger.error("Connection test failed", err);
    return false;
  }
}
```

Add `chatStream()` method that returns raw Response for SSE consumption:

```typescript
async chatStream(
  model: string,
  messages: SiliconFlowMessage[],
  config: { baseUrl: string; apiKey: string; temperature?: number; maxTokens?: number }
): Promise<Response> {
  return HttpClient.streamResponse(`${config.baseUrl}/v1/chat/completions`, {
    model,
    messages,
    stream: true,
    ...(config.temperature !== undefined && { temperature: config.temperature }),
    ...(config.maxTokens !== undefined && { max_tokens: config.maxTokens }),
  }, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });
}
```

- [ ] **Step 2: Replace `fetch()` calls in `AiAssistant.vue` with service calls**

`AiAssistant.vue:605` — replace:
```typescript
const response = await fetch(`${apiKeySettings.value.baseUrl}/v1/models`, { ... })
```
with:
```typescript
const ok = await siliconFlowService.testConnection(
  apiKeySettings.value.baseUrl,
  apiKeySettings.value.apiKey
);
if (ok) { showToast(t('ai_assistant.connection_success')); ... }
```

`AiAssistant.vue:683` — replace the `fetch()` + SSE-parsing block with:
```typescript
const response = await siliconFlowService.chatStream(
  selectedModel.value?.id ?? DEFAULT_MODEL,
  messagesForApi,
  {
    baseUrl: apiKeySettings.value.baseUrl,
    apiKey: apiKeySettings.value.apiKey,
  }
);
```

Add import: `import { siliconFlowService } from '@/services/siliconflow/SiliconFlowService'`

- [ ] **Step 3: Route `OpenClawView.vue:450` through `OpenClawService`**

Check if `OpenClawService` has a `chatStream()` method. If not, add one analogous to `SiliconFlowService.chatStream()`. Replace the raw `fetch()` in `OpenClawView.vue` with the service call.

- [ ] **Step 4: Run type check and lint**

Run: `vue-tsc --noEmit && pnpm check`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/services/siliconflow/SiliconFlowService.ts src/mobile/views/my/AiAssistant.vue src/views/openclaw/OpenClawView.vue
git commit -m "refactor(ai): extract AI fetch calls from Vue components into SiliconFlowService and OpenClawService"
```

---

### Task 7: Migrate P2 file download pattern to `HttpClient.downloadBytes()`

**Files:**
- Modify: `src/composables/common/useDownload.ts:35`
- Modify: `src/composables/common/useAudioFileManager.ts:138`
- Modify: `src/stores/domains/chat/emoji.ts:66,131`
- Modify: `src/stores/domains/widget/fileDownload.ts:241`
- Modify: `src/components/rightBox/emoticon/useEmojiLocalCache.ts:162`
- Modify: `src/components/voice/VoiceMessageEnhanced.vue:243`
- Modify: `src/workers/imageDownloader.ts:20`
- Modify: `src/strategy/strategies/video.ts:143`

**Interfaces:**
- Consumes: `HttpClient` from Task 1

- [ ] **Step 1: Replace all simple `await fetch(url)` download patterns**

For each file, the pattern is:
```typescript
// Before
const response = await fetch(url);
// ... various .ok check, .blob(), .arrayBuffer(), error handling
```

Replace with:
```typescript
// After
import { HttpClient } from '@/utils/HttpClient';

const buffer = await HttpClient.downloadBytes(url);
// ... use buffer as needed
```

File-by-file specifics:

`useDownload.ts:35`:
```typescript
// Before
const response = await fetch(url)
// After
const buffer = await HttpClient.downloadBytes(url);
// Convert buffer to Blob if needed: new Blob([buffer])
```

`emoji.ts:66,131`:
```typescript
// Before
const response = await fetch(url)
// After
const buffer = await HttpClient.downloadBytes(url)
```

`useEmojiLocalCache.ts:162`:
```typescript
// Before
const response = await fetch(url)
// After
const buffer = await HttpClient.downloadBytes(url)
```

`VoiceMessageEnhanced.vue:243`:
```typescript
// Before
const response = await fetch(downloadableUrl)
// After
const buffer = await HttpClient.downloadBytes(downloadableUrl)
```

`imageDownloader.ts:20`:
```typescript
// Before
const response = await fetch(url)
// After
const buffer = await HttpClient.downloadBytes(url)
```

`video.ts:143` — this fetches a blob URL (`blob:...`), which is a local in-memory URL. `runtimeFetch.ts` may not handle `blob:` URLs, so keep this as raw `fetch()` but add a comment:
```typescript
// blob: URL — only works with browser native fetch, not Tauri native fetch
const response = await fetch(blobUrl);
```

- [ ] **Step 2: Run type check and lint for all modified files**

Run: `vue-tsc --noEmit && pnpm check`
Expected: no errors

- [ ] **Step 3: Run affected tests**

Run: `pnpm vitest run src/stores/domains/chat/__tests__/emoji.test.ts src/stores/domains/widget/__tests__/`
Expected: tests pass (update MSW handlers if they mock `fetch` directly)

- [ ] **Step 4: Commit**

```bash
git add src/composables/common/useDownload.ts src/composables/common/useAudioFileManager.ts src/stores/domains/chat/emoji.ts src/stores/domains/widget/fileDownload.ts src/components/rightBox/emoticon/useEmojiLocalCache.ts src/components/voice/VoiceMessageEnhanced.vue src/workers/imageDownloader.ts src/strategy/strategies/video.ts
git commit -m "refactor(download): migrate file download fetch calls to HttpClient.downloadBytes()"
```

---

### Task 8: Migrate P3/P4 misc fetch calls to HttpClient

**Files:**
- Modify: `src/utils/PathUtil.ts:294,337,372,415`
- Modify: `src/utils/ImageUtils.ts:286`
- Modify: `src/utils/PerformanceReporter.ts:430`
- Modify: `src/services/discovery/adapters/consul.ts:35`
- Modify: `src/layout/left/model.tsx:180`
- Modify: `src/views/CheckUpdate.vue:170`
- Modify: `src/views/Update.vue:77`
- Modify: `src/views/settingsWindow/tabs/HelpSettings.vue:176`
- Modify: `src/App.vue:263`
- Modify: `src/services/performance/ChunkUploadService.ts:134,273,299,322`
- Modify: `src/services/matrix/media/MatrixMultimediaService.ts:283`
- Modify: `src/services/matrix/room/RoomOperations.ts:305`

**Interfaces:**
- Consumes: `HttpClient` from Task 1

- [ ] **Step 1: Replace `fetch()` calls in each file**

`PathUtil.ts:294` (GET with full response):
```typescript
// Before: const response = await fetch(remoteUrl)
// After: use HttpClient.get or HttpClient.downloadBytes depending on the caller
const response = await HttpClient.head(remoteUrl);
```

`PathUtil.ts:337,415` (HEAD requests):
```typescript
// Before: const headResponse = await fetch(url, { method: 'HEAD' })
// After:
const headResponse = await HttpClient.head(url);
```

`PathUtil.ts:372` (Range request):
```typescript
// Before: const response = await fetch(url, shouldUseRange ? { headers: { Range: `bytes=0-${rangeEnd}` } } : void 0)
// After:
const response = await HttpClient.downloadBytes(url, {
  headers: shouldUseRange ? { Range: `bytes=0-${rangeEnd}` } : undefined,
});
```

`ImageUtils.ts:286` (HEAD):
```typescript
// Before: const response = await fetch(input, { method: 'HEAD' })
// After:
const response = await HttpClient.head(input);
```

`PerformanceReporter.ts:430` (POST beacon):
```typescript
// Before: const response = await fetch(this.config.endpoint, { ... })
// After:
await HttpClient.post(this.config.endpoint, payload);
```

`ChunkUploadService.ts:134,273,299,322` (already in service, just swap to HttpClient):
```typescript
// Before: const resp = await fetch(chunkEndpoint('/start'), { ... })
// After:
const resp = await HttpClient.post<T>(chunkEndpoint('/start'), body);
```

`consul.ts:35` (service discovery GET):
```typescript
// Before: const response = await fetch(url)
// After:
const data = await HttpClient.get(url);
```

`App.vue:263` (favicon — keep as raw fetch with comment, it's a browser-only check):
```typescript
// Browser favicon reachability check — this intentionally uses native fetch
await fetch('https://www.apple.com/favicon.ico', { mode: 'no-cors' });
```

`HelpSettings.vue:176` (local `/package.json`):
```typescript
// Before: const response = await fetch('/package.json')
// After:
const data = await HttpClient.get<{ version: string }>('/package.json');
```

`CheckUpdate.vue:170` and `Update.vue:77` and `model.tsx:180` and `MatrixMultimediaService.ts:283` and `RoomOperations.ts:305`:
Follow the same pattern — `HttpClient.get()` or `HttpClient.downloadBytes()` depending on whether the caller needs JSON or binary.

- [ ] **Step 2: Run type check, lint, and affected tests**

Run: `vue-tsc --noEmit && pnpm check`
Expected: no errors

Run: `pnpm vitest run src/utils/__tests__/PathUtil.test.ts src/utils/__tests__/ImageUtils.test.ts src/services/performance/__tests__/ src/services/discovery/__tests__/`
Expected: tests pass

- [ ] **Step 3: Commit**

```bash
git add src/utils/PathUtil.ts src/utils/ImageUtils.ts src/utils/PerformanceReporter.ts src/services/discovery/adapters/consul.ts src/layout/left/model.tsx src/views/CheckUpdate.vue src/views/Update.vue src/views/settingsWindow/tabs/HelpSettings.vue src/App.vue src/services/performance/ChunkUploadService.ts src/services/matrix/media/MatrixMultimediaService.ts src/services/matrix/room/RoomOperations.ts
git commit -m "refactor(http): migrate misc fetch calls across utils/services/views to HttpClient"
```

---

### Task 9: Add lint gate to prevent new raw `fetch()` calls

**Files:**
- Modify: `biome.json` (or `.lintstagedrc.mjs`)

Biome does not have a `no-restricted-globals` rule built-in. Use an ESLint override or a custom script.

- [ ] **Step 1: Create a custom lint script**

Create `scripts/check-no-raw-fetch.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ALLOWLIST = new Set([
  'src/services/matrix/network/runtimeFetch.ts',   // the fetch wrapper itself
  'src/workers/matrixSdk.worker.ts',                // worker bridge needs raw fetch for proxying
  'src/App.vue',                                     // apple.com favicon reachability check (no-cors)
  'src/strategy/strategies/video.ts',                // blob: URL requires browser-native fetch
]);

const output = execSync(
  `grep -rln '\\bfetch(' src/ --include='*.ts' --include='*.tsx' --include='*.vue'`,
  { encoding: 'utf-8' }
);

const files = output.trim().split('\n').filter(Boolean);
const violations = files.filter((f) => !ALLOWLIST.has(f));

if (violations.length > 0) {
  console.error(`ERROR: ${violations.length} file(s) use raw fetch() outside the allowlist:`);
  violations.forEach((f) => console.error(`  ${f}`));
  console.error('Use HttpClient from @/utils/HttpClient, an SDK manager method, or add to the allowlist with justification.');
  process.exit(1);
}

console.log(`OK: ${files.length} file(s) with fetch() — all in allowlist`);
```

- [ ] **Step 2: Add to CI quality gate**

Update `package.json` scripts:

```json
"quality:no-raw-fetch": "node scripts/check-no-raw-fetch.mjs",
"quality:contracts": "... && pnpm quality:no-raw-fetch"
```

- [ ] **Step 3: Verify the gate catches violations**

Run: `pnpm quality:no-raw-fetch`
Expected: PASS (all remaining fetch files are in the allowlist)

- [ ] **Step 4: Commit**

```bash
git add scripts/check-no-raw-fetch.mjs package.json
git commit -m "feat(quality): add no-raw-fetch gate to prevent new fetch() regressions"
```

---

### Task 10: Final verification — full type check, lint, test suite

- [ ] **Step 1: Run full test suite**

Run: `pnpm test:run`
Expected: all tests pass

- [ ] **Step 2: Run type check**

Run: `vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `pnpm check`
Expected: no errors

- [ ] **Step 4: Run the new quality gate**

Run: `pnpm quality:no-raw-fetch`
Expected: PASS

- [ ] **Step 5: Count remaining raw fetch calls**

Run: `grep -rn '\bfetch(' src/ --include='*.ts' --include='*.vue' | grep -v node_modules | grep -v __tests__ | wc -l`
Expected: ≤5 (only allowlist entries)

- [ ] **Step 6: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final verification pass for fetch unification"
```
