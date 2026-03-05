# SDK Guide (matrix-js-sdk)

## Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | ^5.0 | SDK language |
| Node.js | >=22.0.0 | Runtime |
| Vitest | - | Unit testing |
| Babel | - | Transpilation |

## Module Architecture

```
src/
├── common/
│   ├── BaseManager.ts      # Base class for all managers
│   └── index.ts
├── client.ts               # Main MatrixClient class
├── models/                 # Data models
│   ├── room.ts
│   ├── user.ts
│   ├── event.ts
│   └── ...
├── http-api/               # HTTP layer
│   ├── fetch.ts
│   ├── method.ts
│   ├── errors.ts
│   └── prefix.ts
├── store/                  # Storage backends
│   ├── indexeddb.ts
│   ├── memory.ts
│   └── stub.ts
└── [managers]/             # Feature managers (see below)
```

## Manager Modules

| Manager | Directory | Purpose |
|---------|-----------|---------|
| `FriendManager` | `src/friend/` | Friend relationships |
| `RoomManager` | `src/room/` | Room management |
| `AccountManager` | `src/account/` | Account operations |
| `AuthManager` | `src/auth/` | Authentication |
| `EventManager` | `src/event/` | Event handling |
| `MediaManager` | `src/media/` | Media upload/download |
| `MessagingManager` | `src/messaging/` | Messaging |
| `SearchManager` | `src/search/` | Search functionality |
| `SpaceManager` | `src/space/` | Spaces |
| `ThreadManager` | `src/thread/` | Threads |
| `UserManager` | `src/user/` | User management |
| `VoiceMessageManager` | `src/voice/` | Voice messages |
| `ModerationManager` | `src/moderation/` | Moderation |
| `NotificationManager` | `src/notification/` | Server notifications |
| `PresenceManager` | `src/presence/` | Presence |
| `ProfileManager` | `src/profile/` | Profile |
| `PushManager` | `src/push/` | Push notifications |
| `ReceiptManager` | `src/receipt/` | Read receipts |
| `RetentionManager` | `src/retention/` | Retention |
| `QuotaManager` | `src/quota/` | Quota management |
| `DirectMessageManager` | `src/dm/` | Direct messages |
| `FederationBlacklistManager` | `src/federation/` | Federation blacklist |
| `FilterManager` | `src/filter-manager/` | Filters |
| `RoomMembershipManager` | `src/room-membership/` | Room membership |
| `RoomStateEventManager` | `src/room-state/` | Room state |
| `TimelineManager` | `src/timeline/` | Timeline |
| `BackgroundUpdateManager` | `src/background-update/` | Background updates |
| `AccountDataManager` | `src/account-data/` | Account data |
| `SynapseAdminClient` | `src/admin/` | Synapse admin API |
| `ApplicationServiceManager` | `src/appservice/` | App services |

## BaseManager Pattern

All managers extend `BaseManager`:

```typescript
// src/common/BaseManager.ts
export interface IManager {
    readonly isRunning: boolean;
    start(): Promise<void>;
    stop(): void;
}

export abstract class BaseManager<Events extends string, Arguments extends ListenerMap<Events>>
    extends TypedEventEmitter<Events, Arguments>
    implements IManager
{
    private _isRunning = false;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    public async start(): Promise<void> {
        if (this._isRunning) return;
        try {
            await this.doStart();
            this._isRunning = true;
        } catch (error) {
            this.handleError(error as Error, "start");
            throw error;
        }
    }

    public stop(): void {
        if (!this._isRunning) return;
        try {
            this.doStop();
        } catch (error) {
            this.handleError(error as Error, "stop");
        }
        this.removeAllListeners();
        this._isRunning = false;
    }

    protected async doStart(): Promise<void> {}
    protected doStop(): void {}

    protected handleError(error: Error, context: string): void {
        logger.error(`${this.constructor.name} error during ${context}:`, error);
    }
}
```

## Creating a New Manager

### 1. Create Types

```typescript
// src/my_feature/types.ts
export interface MyFeature {
    id: string;
    name: string;
    data: Record<string, unknown>;
}

export enum MyFeatureEvent {
    Created = "created",
    Updated = "updated",
    Deleted = "deleted",
}

export interface MyFeatureEventHandlerMap {
    [MyFeatureEvent.Created]: (feature: MyFeature) => void;
    [MyFeatureEvent.Updated]: (feature: MyFeature) => void;
    [MyFeatureEvent.Deleted]: (id: string) => void;
}

export interface IMyFeatureResponse {
    id: string;
    name: string;
    data: Record<string, unknown>;
}
```

### 2. Create Manager

```typescript
// src/my_feature/MyFeatureManager.ts
import { BaseManager } from "../common/BaseManager.ts";
import { ClientPrefix, Method } from "../http-api/index.ts";
import { logger } from "../logger.ts";
import type { QueryDict } from "../utils.ts";
import {
    type MyFeature,
    MyFeatureEvent,
    type MyFeatureEventHandlerMap,
    type IMyFeatureResponse,
} from "./types.ts";

const API_PREFIX = ClientPrefix.V1;

interface MyFeatureManagerClient {
    http: {
        authedRequest<T>(
            method: Method,
            path: string,
            queryParams?: QueryDict,
            body?: Record<string, unknown>,
            opts?: { prefix?: string },
        ): Promise<T>;
    };
}

export class MyFeatureManager extends BaseManager<MyFeatureEvent, MyFeatureEventHandlerMap> {
    private client: MyFeatureManagerClient;

    public constructor(client: MyFeatureManagerClient) {
        super();
        this.client = client;
    }

    protected async doStart(): Promise<void> {
        logger.info("MyFeatureManager starting");
        // Initialize state, fetch initial data, etc.
    }

    protected doStop(): void {
        logger.info("MyFeatureManager stopping");
        // Cleanup resources
    }

    public async getFeature(id: string): Promise<MyFeature | null> {
        const response = await this.client.http.authedRequest<IMyFeatureResponse>(
            Method.Get,
            `/my_feature/${id}`,
            undefined,
            undefined,
            { prefix: API_PREFIX },
        );
        return this.mapResponse(response);
    }

    public async createFeature(name: string, data: Record<string, unknown>): Promise<MyFeature> {
        const response = await this.client.http.authedRequest<IMyFeatureResponse>(
            Method.Post,
            "/my_feature",
            undefined,
            { name, data },
            { prefix: API_PREFIX },
        );
        const feature = this.mapResponse(response);
        this.emit(MyFeatureEvent.Created, feature);
        return feature;
    }

    private mapResponse(response: IMyFeatureResponse): MyFeature {
        return {
            id: response.id,
            name: response.name,
            data: response.data,
        };
    }
}
```

### 3. Create Index

```typescript
// src/my_feature/index.ts
export { MyFeatureManager } from "./MyFeatureManager.ts";
export * from "./types.ts";
```

### 4. Register in MatrixClient

```typescript
// src/client.ts
import { MyFeatureManager } from "./my_feature/index.ts";

export class MatrixClient extends TypedEventEmitter<...> {
    public readonly myFeatureManager: MyFeatureManager;

    constructor(...) {
        super();
        this.myFeatureManager = new MyFeatureManager(this);
    }

    public async start(): Promise<void> {
        // Start all managers
        await this.myFeatureManager.start();
    }

    public stop(): void {
        // Stop all managers
        this.myFeatureManager.stop();
    }
}
```

## FriendManager Example

```typescript
// src/friend/FriendManager.ts
export class FriendManager extends BaseManager<FriendEvent, FriendEventHandlerMap> {
    private client: FriendManagerClient;
    private friends: Map<string, Friend> = new Map();
    private incomingRequests: Map<string, FriendRequest> = new Map();
    private outgoingRequests: Map<string, FriendRequest> = new Map();

    protected async doStart(): Promise<void> {
        await this.syncFriends();
    }

    public async sendFriendRequest(userId: string, message?: string): Promise<void> {
        await this.client.http.authedRequest(
            Method.Post,
            "/friend/request",
            undefined,
            { user_id: userId, message },
            { prefix: FRIEND_API_PREFIX },
        );
    }

    public async acceptFriendRequest(userId: string): Promise<void> {
        await this.client.http.authedRequest(
            Method.Post,
            `/friend/request/${userId}/accept`,
            undefined,
            undefined,
            { prefix: FRIEND_API_PREFIX },
        );
        this.emit(FriendEvent.RequestAccepted, userId);
    }

    public getFriends(): Friend[] {
        return Array.from(this.friends.values());
    }

    public getIncomingRequests(): FriendRequest[] {
        return Array.from(this.incomingRequests.values());
    }
}
```

## Crypto Module

```
src/crypto/
├── store/              # Crypto storage backends
│   ├── indexeddb-crypto-store.ts
│   └── memory-crypto-store.ts
└── ...

src/crypto-api/
├── CryptoEvent.ts      # Crypto events
├── CryptoEventHandlerMap.ts
├── keybackup.ts        # Key backup
├── recovery-key.ts     # Recovery key
├── verification.ts     # Verification
└── index.ts

src/rust-crypto/
├── CrossSigningIdentity.ts
├── DehydratedDeviceManager.ts
├── RoomEncryptor.ts
├── backup.ts
├── verification.ts
└── rust-crypto.ts
```

## WebRTC Module

```
src/webrtc/
├── call.ts             # 1-to-1 calls
├── callFeed.ts         # Call feeds
├── groupCall.ts        # Group calls
├── callEventHandler.ts
├── mediaHandler.ts
├── audioContext.ts
└── stats/              # Call statistics
    ├── callStatsReportGatherer.ts
    ├── connectionStats.ts
    └── ...
```

## MatrixRTC Module

```
src/matrixrtc/
├── MatrixRTCSession.ts
├── MatrixRTCSessionManager.ts
├── CallMembership.ts
├── EncryptionManager.ts
├── LivekitTransport.ts
├── RoomKeyTransport.ts
└── types.ts
```

## HTTP API

```typescript
// src/http-api/index.ts
export enum Method {
    Get = "GET",
    Post = "POST",
    Put = "PUT",
    Delete = "DELETE",
}

export enum ClientPrefix {
    V1 = "/_matrix/client/v1",
    V3 = "/_matrix/client/v3",
    R0 = "/_matrix/client/r0",
    Unstable = "/_matrix/client/unstable",
}

// Usage
await client.http.authedRequest(
    Method.Get,
    "/sync",
    { since: token, timeout: 30000 },
    undefined,
    { prefix: ClientPrefix.V3 },
);
```

## Event Emitter Pattern

```typescript
// Listen to events
client.friendManager.on(FriendEvent.RequestReceived, (request) => {
    console.log("New friend request from", request.userId);
});

// Emit events
this.emit(FriendEvent.Created, feature);
```

## Testing

```typescript
// __tests__/friend/FriendManager.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FriendManager, FriendEvent } from "../../src/friend/index.ts";

describe("FriendManager", () => {
    let manager: FriendManager;
    let mockClient: any;

    beforeEach(() => {
        mockClient = {
            http: {
                authedRequest: vi.fn(),
            },
        };
        manager = new FriendManager(mockClient);
    });

    it("should start and sync friends", async () => {
        mockClient.http.authedRequest.mockResolvedValue({
            friends: [{ user_id: "@user:example.com" }],
        });
        await manager.start();
        expect(manager.isRunning).toBe(true);
        expect(manager.getFriends()).toHaveLength(1);
    });
});
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `FriendManager` |
| Interfaces | PascalCase with `I` prefix | `IFriendResponse` |
| Enums | PascalCase | `FriendEvent` |
| Methods | camelCase | `sendFriendRequest` |
| Private fields | Underscore prefix | `_friends` |
| Constants | UPPER_SNAKE_CASE | `API_PREFIX` |

## Common Patterns

### Singleton Access

Managers are accessed through the client instance:

```typescript
const client = createClient({ ... });
await client.start();

// Access managers
const friends = client.friendManager.getFriends();
const rooms = client.roomManager.getRooms();
```

### Error Handling

```typescript
try {
    await client.friendManager.sendFriendRequest(userId);
} catch (error) {
    if (error instanceof MatrixError) {
        console.error("Matrix error:", error.errcode, error.message);
    }
}
```

### Typed Events

```typescript
// Define event types
export enum MyEvent {
    Changed = "changed",
}

export interface MyEventHandlerMap {
    [MyEvent.Changed]: (data: MyData) => void;
}

// Use in manager
export class MyManager extends BaseManager<MyEvent, MyEventHandlerMap> {
    private notifyChange(data: MyData): void {
        this.emit(MyEvent.Changed, data);
    }
}
```
