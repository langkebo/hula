# Backend Guide (synapse-rust)

## Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Rust | 2021 Edition | Backend language |
| Axum | ^0.8 | Web framework |
| SQLx | ^0.8 | Database ORM (PostgreSQL) |
| Tokio | ^1.49 | Async runtime |
| Redis | ^0.27 | Cache layer |
| Argon2 | ^0.5 | Password hashing |
| AES-GCM / ChaCha20Poly1305 | ^0.10 | E2EE |

## Module Architecture

```
src/
├── auth/           # Authentication module
│   ├── authorization.rs
│   └── mod.rs
├── cache/          # Cache layer
│   ├── circuit_breaker.rs
│   ├── federation_signature_cache.rs
│   ├── query_cache.rs
│   └── strategy.rs
├── common/         # Common utilities
│   ├── config.rs
│   ├── error.rs
│   ├── metrics.rs
│   ├── rate_limit.rs
│   └── security.rs
├── e2ee/           # End-to-end encryption
│   ├── crypto/     # AES, Argon2, Ed25519, X25519
│   ├── olm/        # Olm protocol
│   ├── megolm/     # Megolm protocol
│   ├── cross_signing/  # Cross-signing
│   ├── backup/     # Key backup
│   ├── device_keys/    # Device key management
│   ├── key_request/    # Key requests
│   ├── signature/      # Event signatures
│   ├── ssss/       # Secret storage
│   └── to_device/  # To-device messaging
├── federation/     # Federation protocol
│   ├── friend/     # Friend federation
│   ├── device_sync.rs
│   ├── event_auth.rs
│   └── key_rotation.rs
├── services/       # Business services
│   ├── cache/
│   ├── content_scanner/
│   ├── geo_ip/
│   ├── identity/
│   ├── message_queue/
│   ├── push/       # Push notifications (FCM, APNs, WebPush)
│   └── webhook_notification/
├── storage/        # Database layer
│   ├── media/      # Media storage (S3, filesystem)
│   ├── user.rs
│   ├── room.rs
│   ├── event.rs
│   └── ...
├── web/            # HTTP layer
│   ├── routes/     # Route handlers
│   ├── middleware.rs
│   └── filter.rs
├── worker/         # Worker management
│   ├── bus.rs
│   ├── health.rs
│   ├── load_balancer.rs
│   └── manager.rs
└── tasks/          # Background tasks
    ├── alerting.rs
    └── benchmarking.rs
```

## Service Container Pattern

All services are managed through `ServiceContainer` in `src/services/mod.rs`:

```rust
#[derive(Clone)]
pub struct ServiceContainer {
    pub user_storage: UserStorage,
    pub device_storage: DeviceStorage,
    pub token_storage: AccessTokenStorage,
    pub room_storage: RoomStorage,
    pub member_storage: RoomMemberStorage,
    pub event_storage: EventStorage,
    pub presence_storage: PresenceStorage,
    pub auth_service: AuthService,
    pub device_keys_service: DeviceKeyService,
    pub megolm_service: MegolmService,
    pub cross_signing_service: CrossSigningService,
    pub backup_service: KeyBackupService,
    pub to_device_service: ToDeviceService,
    pub voice_service: VoiceService,
    pub registration_service: Arc<RegistrationService>,
    pub room_service: Arc<RoomService>,
    pub sync_service: Arc<SyncService>,
    pub search_service: Arc<SearchService>,
    pub media_service: MediaService,
    pub cache: Arc<CacheManager>,
    pub task_queue: Option<Arc<RedisTaskQueue>>,
    pub metrics: Arc<MetricsCollector>,
    pub server_name: String,
    pub config: Config,
    // ... more services
}
```

## Adding a New Service

### 1. Create Storage Layer

```rust
// src/storage/my_feature.rs
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct MyFeatureStorage {
    pool: Arc<PgPool>,
}

impl MyFeatureStorage {
    pub fn new(pool: &Arc<PgPool>) -> Self {
        Self { pool: pool.clone() }
    }

    pub async fn get_item(&self, id: &str) -> Result<Option<Item>, sqlx::Error> {
        sqlx::query_as::<_, Item>(
            "SELECT * FROM my_feature WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&*self.pool)
        .await
    }
}
```

### 2. Create Service Layer

```rust
// src/services/my_feature_service.rs
use crate::storage::my_feature::MyFeatureStorage;
use crate::cache::CacheManager;
use std::sync::Arc;

#[derive(Clone)]
pub struct MyFeatureService {
    storage: MyFeatureStorage,
    cache: Arc<CacheManager>,
}

impl MyFeatureService {
    pub fn new(storage: MyFeatureStorage, cache: Arc<CacheManager>) -> Self {
        Self { storage, cache }
    }

    pub async fn get_item(&self, id: &str) -> Result<Option<Item>, Error> {
        // Check cache first
        if let Some(cached) = self.cache.get::<Item>(id).await? {
            return Ok(Some(cached));
        }
        
        // Fetch from storage
        let item = self.storage.get_item(id).await?;
        if let Some(ref i) = item {
            self.cache.set(id, i).await?;
        }
        Ok(item)
    }
}
```

### 3. Create Route Handler

```rust
// src/web/routes/my_feature.rs
use axum::{
    extract::{Path, State},
    Json,
};
use crate::services::ServiceContainer;

pub async fn get_item(
    Path(id): Path<String>,
    State(services): State<ServiceContainer>,
) -> Result<Json<Item>, ApiError> {
    let item = services.my_feature_service.get_item(&id).await?;
    match item {
        Some(i) => Ok(Json(i)),
        None => Err(ApiError::NotFound),
    }
}
```

### 4. Register in ServiceContainer

```rust
// src/services/mod.rs
pub struct ServiceContainer {
    // ... existing fields
    pub my_feature_storage: MyFeatureStorage,
    pub my_feature_service: Arc<MyFeatureService>,
}

impl ServiceContainer {
    pub fn new(...) -> Self {
        // ... existing initialization
        let my_feature_storage = MyFeatureStorage::new(pool);
        let my_feature_service = Arc::new(MyFeatureService::new(
            my_feature_storage.clone(),
            cache.clone(),
        ));
        
        Self {
            // ... existing fields
            my_feature_storage,
            my_feature_service,
        }
    }
}

pub mod my_feature_service;
pub use my_feature_service::*;
```

### 5. Register Routes

```rust
// src/web/routes/mod.rs
pub mod my_feature;

use axum::Router;

pub fn create_router(services: ServiceContainer) -> Router {
    Router::new()
        // ... existing routes
        .route("/my_feature/:id", get(my_feature::get_item))
        .with_state(services)
}
```

## E2EE Module Structure

```
e2ee/
├── crypto/         # Cryptographic primitives
│   ├── aes.rs      # AES-GCM encryption
│   ├── argon2.rs   # Key derivation
│   ├── ed25519.rs  # Signing keys
│   └── x25519.rs   # Diffie-Hellman keys
├── olm/            # Olm protocol (1-to-1)
│   ├── session.rs  # Olm sessions
│   └── storage.rs
├── megolm/         # Megolm protocol (group)
│   ├── session.rs  # Megolm sessions
│   └── storage.rs
├── cross_signing/  # Cross-signing
│   ├── models.rs
│   ├── service.rs
│   └── storage.rs
├── backup/         # Key backup
│   ├── models.rs
│   ├── service.rs
│   └── storage.rs
├── device_keys/    # Device key management
├── key_request/    # Key requests (Gossip)
├── signature/      # Event signatures
├── ssss/           # Secret storage (SSSS)
└── to_device/      # To-device messaging
```

## Federation Module

```
federation/
├── friend/         # Friend system federation
│   ├── client.rs
│   └── friend_federation.rs
├── device_sync.rs  # Device synchronization
├── event_auth.rs   # Event authorization chains
├── key_rotation.rs # Signing key rotation
└── memory_tracker.rs
```

## Push Notification System

```
services/push/
├── providers/
│   ├── apns.rs     # Apple Push Notification
│   ├── fcm.rs      # Firebase Cloud Messaging
│   └── webpush.rs  # Web Push
├── gateway.rs      # Push gateway
└── queue.rs        # Push queue
```

## Error Handling

```rust
// src/common/error.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match &self {
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}
```

## Configuration

```rust
// src/common/config.rs
#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub federation: FederationConfig,
    pub security: SecurityConfig,
    pub search: SearchConfig,
    pub rate_limit: RateLimitConfig,
    // ... more configs
}
```

## Database Migrations

Use SQLx migrations in `migrations/` directory:

```sql
-- migrations/20240101000000_create_my_feature.sql
CREATE TABLE my_feature (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_get_item() {
        let container = ServiceContainer::new_test();
        let result = container.my_feature_service.get_item("test").await;
        assert!(result.is_ok());
    }
}
```

## Common Patterns

### Async Handler

```rust
pub async fn my_handler(
    State(services): State<ServiceContainer>,
    Json(payload): Json<MyRequest>,
) -> Result<Json<MyResponse>, ApiError> {
    let result = services.my_service.do_something(payload).await?;
    Ok(Json(result))
}
```

### Authentication Middleware

```rust
pub async fn auth_middleware(
    State(services): State<ServiceContainer>,
    mut req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let token = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(ApiError::Unauthorized("Missing token"))?;
    
    let user = services.auth_service.validate_token(token).await?;
    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}
```

### Caching

```rust
pub async fn get_with_cache<T>(
    cache: &CacheManager,
    key: &str,
    fetch: impl Future<Output = Result<T, Error>>,
) -> Result<T, Error> {
    if let Some(cached) = cache.get::<T>(key).await? {
        return Ok(cached);
    }
    
    let value = fetch.await?;
    cache.set(key, &value).await?;
    Ok(value)
}
```
