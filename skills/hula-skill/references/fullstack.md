# Fullstack Flow Guide

## Three-Project Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         hula (Frontend)                          │
│                    Vue 3 + Tauri + Pinia                         │
│              Desktop (Naive UI) / Mobile (Vant)                  │
│                                                                  │
│  src/services/matrix/*  →  Matrix SDK Wrappers                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Matrix Client-Server API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    matrix-js-sdk (SDK)                           │
│                  TypeScript + Node.js                            │
│         Matrix Protocol Implementation + Managers                │
│                                                                  │
│  src/*/  →  Feature Managers (Friend, Room, Crypto, etc.)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Matrix Client-Server API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   synapse-rust (Backend)                         │
│                 Rust + Axum + SQLx + Redis                       │
│                    Matrix Homeserver                             │
│                                                                  │
│  src/web/routes/*  →  src/services/*  →  src/storage/*          │
└─────────────────────────────────────────────────────────────────┘
```

## Adding a New Feature End-to-End

### Step 1: Backend (synapse-rust)

1. **Create Storage Layer**
   ```rust
   // src/storage/my_feature.rs
   pub struct MyFeatureStorage {
       pool: Arc<PgPool>,
   }
   ```

2. **Create Service Layer**
   ```rust
   // src/services/my_feature_service.rs
   pub struct MyFeatureService {
       storage: MyFeatureStorage,
       cache: Arc<CacheManager>,
   }
   ```

3. **Create Route Handler**
   ```rust
   // src/web/routes/my_feature.rs
   pub async fn get_item(
       Path(id): Path<String>,
       State(services): State<ServiceContainer>,
   ) -> Result<Json<Item>, ApiError>
   ```

4. **Register in ServiceContainer**
   ```rust
   // src/services/mod.rs
   pub my_feature_storage: MyFeatureStorage,
   pub my_feature_service: Arc<MyFeatureService>,
   ```

5. **Register Routes**
   ```rust
   // src/web/routes/mod.rs
   .route("/my_feature/:id", get(my_feature::get_item))
   ```

### Step 2: SDK (matrix-js-sdk)

1. **Create Types**
   ```typescript
   // src/my_feature/types.ts
   export interface MyFeature { ... }
   export enum MyFeatureEvent { ... }
   ```

2. **Create Manager**
   ```typescript
   // src/my_feature/MyFeatureManager.ts
   export class MyFeatureManager extends BaseManager<...> {
       public async getFeature(id: string): Promise<MyFeature>
   }
   ```

3. **Register in MatrixClient**
   ```typescript
   // src/client.ts
   public readonly myFeatureManager: MyFeatureManager;
   ```

4. **Export from Index**
   ```typescript
   // src/my_feature/index.ts
   export { MyFeatureManager } from "./MyFeatureManager.ts";
   ```

### Step 3: Frontend (hula)

1. **Create Service Wrapper**
   ```typescript
   // src/services/matrix/MatrixMyFeatureService.ts
   class MatrixMyFeatureService {
       private client: MatrixClient | null = null
       
       async getFeature(id: string): Promise<MyFeature> {
           const client = this.getClient()
           return client.myFeatureManager.getFeature(id)
       }
   }
   export const matrixMyFeatureService = new MatrixMyFeatureService()
   ```

2. **Export from Index**
   ```typescript
   // src/services/matrix/index.ts
   export { matrixMyFeatureService } from './MatrixMyFeatureService'
   ```

3. **Create Pinia Store (if needed)**
   ```typescript
   // src/stores/myFeature.ts
   export const useMyFeatureStore = defineStore('myFeature', () => {
       const items = ref<MyFeature[]>([])
       async function fetchItems() { ... }
       return { items, fetchItems }
   })
   ```

4. **Create UI Components**
   ```vue
   <!-- src/views/MyFeatureView.vue -->
   <script setup lang="ts">
   import { useMyFeatureStore } from '@/stores/myFeature'
   const store = useMyFeatureStore()
   </script>
   ```

5. **Add Route**
   ```typescript
   // src/router/index.ts
   {
       path: '/my-feature',
       component: () => import('@/views/MyFeatureView.vue')
   }
   ```

## Data Flow Examples

### Sending a Message

```
hula (Frontend)
    │
    ├─→ MatrixEventService.sendMessage(roomId, content)
    │       └─→ client.sendEvent(roomId, 'm.room.message', content)
    │
matrix-js-sdk (SDK)
    │
    ├─→ HTTP POST /_matrix/client/v3/rooms/{roomId}/send/{eventType}
    │
synapse-rust (Backend)
    │
    ├─→ web/routes/room.rs: send_event()
    │       └─→ RoomService.send_event()
    │               └─→ EventStorage.insert_event()
    │                       └─→ PostgreSQL INSERT
```

### Adding a Friend

```
hula (Frontend)
    │
    ├─→ MatrixFriendService.sendFriendRequest(userId, message)
    │       └─→ client.friendManager.sendFriendRequest(userId, message)
    │
matrix-js-sdk (SDK)
    │
    ├─→ FriendManager.sendFriendRequest()
    │       └─→ HTTP POST /_matrix/client/v1/friend/request
    │
synapse-rust (Backend)
    │
    ├─→ web/routes/friend_room.rs: send_friend_request()
    │       └─→ FriendRoomService.send_request()
    │               ├─→ FriendRoomStorage.insert_request()
    │               └─→ Federation: notify remote server (if needed)
```

### End-to-End Encryption

```
hula (Frontend)
    │
    ├─→ MatrixEncryptionService.enableEncryption(roomId)
    │       └─→ client.crypto.enableEncryption(roomId)
    │
matrix-js-sdk (SDK)
    │
    ├─→ RustCrypto.enableEncryption()
    │       ├─→ Generate Megolm session
    │       ├─→ Share keys with room members
    │       └─→ HTTP PUT /_matrix/client/v3/rooms/{roomId}/state/m.room.encryption
    │
synapse-rust (Backend)
    │
    ├─→ web/routes/room.rs: send_state_event()
    │       └─→ RoomService.send_state_event()
    │               └─→ EventStorage.insert_event()
    │
    └─→ e2ee/megolm/
            └─→ MegolmService manages session distribution
```

## Cross-Project Type Alignment

### Ensure Type Consistency

| Backend (Rust) | SDK (TypeScript) | Frontend (TypeScript) |
|----------------|------------------|----------------------|
| `struct User` | `interface User` | `interface UserInfo` |
| `struct Room` | `class Room` | `interface RoomInfo` |
| `struct Event` | `class MatrixEvent` | `interface Message` |

### API Response Mapping

```typescript
// Backend returns:
{ "user_id": "@user:example.com", "display_name": "User" }

// SDK maps to:
interface User {
    userId: string;
    displayName: string;
}

// Frontend uses:
interface UserInfo {
    uid: string;
    name: string;
}
```

## Testing Across Projects

### Backend Tests

```rust
#[tokio::test]
async fn test_create_room() {
    let container = ServiceContainer::new_test();
    let result = container.room_service.create_room(...).await;
    assert!(result.is_ok());
}
```

### SDK Tests

```typescript
it("should create room", async () => {
    mockClient.http.authedRequest.mockResolvedValue({ room_id: "!room:example.com" });
    const room = await client.roomManager.createRoom({ name: "Test" });
    expect(room.roomId).toBe("!room:example.com");
});
```

### Frontend Tests

```typescript
it("should create room via service", async () => {
    const store = useRoomStore();
    await store.createRoom({ name: "Test" });
    expect(store.rooms).toHaveLength(1);
});
```

## Common Integration Points

### Authentication Flow

1. **Frontend**: `MatrixClientService.login(username, password)`
2. **SDK**: `client.login(username, password)` → HTTP POST
3. **Backend**: `AuthService.login()` → validate credentials → return token
4. **Frontend**: Store token in Pinia + secure storage

### Sync Flow

1. **Frontend**: `MatrixClientService.startClient()`
2. **SDK**: `client.startClient()` → `/sync` long-polling
3. **Backend**: `SyncService.sync()` → return rooms, events, presence
4. **Frontend**: Update Pinia stores with sync data

### Media Upload

1. **Frontend**: `MatrixMediaService.upload(file)`
2. **SDK**: `client.uploadContent(file)` → HTTP POST multipart
3. **Backend**: `MediaService.upload()` → store in S3/filesystem
4. **Frontend**: Get `mxc://` URI for message

## Error Handling Chain

```
Frontend Error
    │
    ├─→ Service layer: catch → log → rethrow
    │
    ├─→ UI layer: catch → show toast → log
    │
SDK Error (MatrixError)
    │
    ├─→ HTTP error response
    │
Backend Error (ApiError)
    │
    ├─→ Service layer: map to ApiError
    ├─→ Route handler: return JSON error
```

## Configuration Flow

```
hula (Frontend)
    │
    ├─→ Environment variables (.env.local)
    ├─→ Runtime config from Tauri
    └─→ MatrixClientConfig
            │
            ▼
matrix-js-sdk (SDK)
    │
    └─→ ICreateClientOpts
            │
            ▼
synapse-rust (Backend)
    │
    ├─→ Config struct (config.toml)
    ├─→ Environment variables
    └─→ Command-line arguments
```

## Checklist for New Features

- [ ] Backend: Storage layer created
- [ ] Backend: Service layer created
- [ ] Backend: Routes registered
- [ ] Backend: Types exported
- [ ] SDK: Types defined
- [ ] SDK: Manager created
- [ ] SDK: Manager registered in client
- [ ] SDK: Tests written
- [ ] Frontend: Service wrapper created
- [ ] Frontend: Types aligned
- [ ] Frontend: Pinia store (if needed)
- [ ] Frontend: UI components
- [ ] Frontend: Routes added
- [ ] Frontend: i18n strings added
- [ ] Frontend: Tests written
