# Migration Documentation: ImRequestUtils to matrix-js-sdk

## Overview

This document tracks the migration from legacy `ImRequestUtils` to matrix-js-sdk for the hula frontend project, ensuring feature parity between desktop and mobile platforms.

## Migration Date

**Started:** 2026-04-13
**Completed:** 2026-04-13
**Last Updated:** 2026-04-13

## API Contract Compliance (2026-04-13)

Based on `/Users/ljf/Desktop/hu/matrix-js-sdk/docs/api-contract/CHANGELOG.md` dated 2026-04-13:

### Thread SDK Convergence
- ✅ `MatrixThreadService.createRoomThread()` now properly sends required `content` field via SDK default
- ✅ `MatrixThreadService.createRoomThread()` options type aligned with `ThreadingManager.createRoomThread()`
- ✅ `MatrixThreadService.getRoomThreads()` now correctly passes `include_all` query parameter
- ✅ `MatrixThreadService.getRoomThreadById()` return type matches `/threads/{thread_id}` response
- ✅ `MatrixThreadService` fields: `replyCount`, `isFrozen`, `lastReplyTs` properly mapped from SDK response

### Sliding Sync Convergence
- ✅ `MatrixSlidingSyncService` does not modify caller request objects (verified no `pos`/`timeout`/`clientTimeout` manipulation)
- ✅ `MatrixSlidingSyncService` correctly handles `timeout=0` as valid value

### Type Safety Improvements
- ✅ `BaseManager.setRetryOptions()` available as public method for retry configuration
- ✅ All services use `Record<string, unknown>` for generic object returns (where applicable)
- ✅ Push-related services properly typed with `IPushRule`, `IPusher`, `IPushRules`

## Summary of Changes

### 1. Services Migrated from ImRequestUtils to matrix-js-sdk

#### MatrixApiKeyService (`src/services/matrix/MatrixApiKeyService.ts`)
- **Status:** ✅ Completed
- **Changes:**
  - Removed imports from `@/utils/ImRequestUtils` and `@/enums`
  - Added imports from `matrix-js-sdk` (Method)
  - Added `matrixClientService` and `BaseManager` for error handling
  - Created private `httpRequest` helper method using `authedRequest`
  - All API calls now use `/_matrix/client/v1/ai/apikey/*` endpoints
  - Methods: `page()`, `simpleList()`, `create()`, `update()`, `delete()`, `balance()`, `platformList()`, `addPlatformModel()`

#### MatrixChatRoleService (`src/services/matrix/MatrixChatRoleService.ts`)
- **Status:** ✅ Completed
- **Changes:**
  - Migrated from ImRequestUtils to matrix-js-sdk
  - All API calls now use `/_matrix/client/v1/ai/chatrole/*` endpoints
  - Methods: `page()`, `categoryList()`, `create()`, `update()`, `delete()`

#### MatrixConversationService (`src/services/matrix/MatrixConversationService.ts`)
- **Status:** ✅ Completed
- **Changes:**
  - Migrated from ImRequestUtils to matrix-js-sdk
  - All API calls now use `/_matrix/client/v1/ai/conversation/*` and `/_matrix/client/v1/ai/message/*` endpoints
  - Methods: `page()`, `create()`, `update()`, `delete()`, `messageListByConversationId()`, `messageDelete()`, `messageDeleteByConversationId()`

#### MatrixModelService (`src/services/matrix/MatrixModelService.ts`)
- **Status:** ✅ Completed
- **Changes:**
  - Migrated from ImRequestUtils to matrix-js-sdk
  - All API calls now use `/_matrix/client/v1/ai/model/*` endpoints
  - Methods: `page()`, `update()`, `delete()`

#### MatrixAIService (`src/services/matrix/MatrixAIService.ts`)
- **Status:** ✅ Completed
- **Changes:**
  - Migrated from ImRequestUtils to matrix-js-sdk
  - All API calls now use `/_matrix/client/v1/ai/*` endpoints
  - Maintains streaming functionality via Tauri invoke
  - Methods: `conversationGetMy()`, `conversationCreate()`, `conversationUpdate()`, `conversationDelete()`, `messageSaveGeneratedContent()`, `messageCancelStream()`, `messageSendStream()`, `generateImage()`, `messageListByConversationId()`, `modelPage()`, `getModelRemainingUsage()`, `imageMyPage()`, `imageMyListByIds()`, `videoMyPage()`, `videoMyListByIds()`, `videoGenerate()`, `audioMyPage()`, `audioMyListByIds()`, `audioGenerate()`, `audioGetVoices()`, `messageDelete()`, `messageDeleteByConversationId()`, `chatRolePage()`

### 2. New Services Created

#### MatrixMapService (`src/services/matrix/MatrixMapService.ts`)
- **Status:** ✅ Completed
- **Purpose:** Replaces deprecated mapApi.ts for location-related functionality
- **Endpoints:** `/_matrix/client/v1/location/*`
- **Methods:**
  - `transformCoordinates(lat, lng)` - Coordinate transformation
  - `reverseGeocode(lat, lng)` - Get address from coordinates
  - `getStaticMap(lat, lng, width, height, zoom)` - Get static map image

### 3. Hooks Migrated

#### useUpload (`src/hooks/useUpload.ts`)
- **Status:** ✅ Completed
- **Changes:**
  - Removed all qiniu/minio upload logic
  - Now uses matrix-js-sdk's `uploadContent` method directly
  - Simplified `UploadProviderEnum` to only support `DEFAULT`
  - Removed `QiniuCredential` and `MinioCredential` types
  - Removed `getQiniuToken` and `getUploadProvider` imports

#### useAssistantModelPresets (`src/hooks/useAssistantModelPresets.ts`)
- **Status:** ✅ Completed
- **Changes:**
  - Removed imports from `@/utils/ImRequestUtils` and `@/enums`
  - Now uses `matrixModelService.page()` instead of `imRequestResult`
  - Normalizes AIModel data to AssistantModelPreset format

### 4. Components Migrated

#### LocationModal.vue (`src/components/rightBox/location/LocationModal.vue`)
- **Status:** ✅ Completed
- **Change:** Updated import from `reverseGeocode` in `@/services/mapApi` to `matrixMapService` in `@/services/matrix/MatrixMapService`

#### StaticProxyMap.vue (`src/components/rightBox/location/StaticProxyMap.vue`)
- **Status:** ✅ Completed
- **Change:** Updated import from `getStaticMap` in `@/services/mapApi` to `matrixMapService` in `@/services/matrix/MatrixMapService`

### 5. Services Index Updated

#### matrix/index.ts (`src/services/matrix/index.ts`)
- **Status:** ✅ Completed
- **Added exports:**
  - `matrixMapService`
  - Type exports: `TransformedCoordinate`, `AddressComponent`, `ReverseGeocodeResult`

## Technical Implementation Details

### HTTP Request Pattern

All migrated services use a consistent pattern:

```typescript
private httpRequest<T>(method: Method, path: string, queryParams?: Record<string, unknown>, body?: Record<string, unknown>): Promise<T> {
  return (this.client.http as any).authedRequest(
    method,
    path,
    queryParams ?? {},
    body ?? {}
  )
}
```

### Error Handling

All services extend `BaseManager` which provides:
- `handleError<T>()` method for consistent error handling
- `normalizeError()` for error normalization
- Logging via `@tauri-apps/plugin-log`

### API Endpoints Mapping

| Legacy Endpoint | New Endpoint |
|-----------------|--------------|
| `ImUrlEnum.CONVERSATION_PAGE` | `/_matrix/client/v1/ai/conversation/page` |
| `ImUrlEnum.CONVERSATION_CREATE_MY` | `/_matrix/client/v1/ai/conversation/create` |
| `ImUrlEnum.MODEL_PAGE` | `/_matrix/client/v1/ai/model/page` |
| `ImUrlEnum.API_KEY_PAGE` | `/_matrix/client/v1/ai/apikey/page` |
| `ImUrlEnum.CHAT_ROLE_PAGE` | `/_matrix/client/v1/ai/chatrole/page` |

## Test Results

- **Total Tests:** 547 passed
- **Test Files:** 42 passed
- **Duration:** 28.75s

## Remaining Work

### ImRequestUtils Dependencies Still Present

The following files still import from `ImRequestUtils` but may require further analysis before migration:

1. **ReadCountQueue.ts** - Uses `getMsgReadCount()` for batch message read count fetching. This is a legacy function that queries read counts for messages. The synapse-rust backend has `get_unread_counts` and `get_unread_counts_batch` methods, but these work at the room level rather than message level. This may need a new endpoint implementation or alternative approach.

## Completed Cleanups

- `src/services/mapApi.ts` - ✅ Deleted (replaced by MatrixMapService)
- `src/utils/ImRequestUtils.ts` - ✅ Deleted (all functions migrated to matrix-js-sdk)
- `src/enums/index.ts` - ✅ Removed ImUrlEnum (was deprecated, replaced by matrix-js-sdk endpoints)

## Recommendations

1. **Verify Backend Endpoints:** Ensure the synapse-rust backend implements all `/_matrix/client/v1/ai/*` endpoints before full deployment.

2. **Remove Legacy Code:** After verifying all new endpoints work correctly:
   - Review ReadCountQueue.ts functionality and potentially implement a matrix-js-sdk compatible endpoint
   - Consider if message-level read counts are still needed or if room-level counts are sufficient

3. **Monitor for Issues:** Watch for any runtime errors related to the API migrations during testing.

## Backend Requirements

The synapse-rust backend should implement these endpoints:

### AI Service Endpoints
- `GET /_matrix/client/v1/ai/apikey/page`
- `GET /_matrix/client/v1/ai/apikey/simple_list`
- `POST /_matrix/client/v1/ai/apikey/create`
- `POST /_matrix/client/v1/ai/apikey/update`
- `POST /_matrix/client/v1/ai/apikey/delete`
- `GET /_matrix/client/v1/ai/apikey/balance`
- `GET /_matrix/client/v1/ai/platform/list`
- `POST /_matrix/client/v1/ai/platform/add_model`
- `GET /_matrix/client/v1/ai/chatrole/page`
- `GET /_matrix/client/v1/ai/chatrole/category_list`
- `POST /_matrix/client/v1/ai/chatrole/create`
- `POST /_matrix/client/v1/ai/chatrole/update`
- `POST /_matrix/client/v1/ai/chatrole/delete`
- `GET /_matrix/client/v1/ai/conversation/page`
- `POST /_matrix/client/v1/ai/conversation/create`
- `POST /_matrix/client/v1/ai/conversation/update`
- `POST /_matrix/client/v1/ai/conversation/delete`
- `GET /_matrix/client/v1/ai/message/list`
- `POST /_matrix/client/v1/ai/message/delete`
- `GET /_matrix/client/v1/ai/model/page`
- `POST /_matrix/client/v1/ai/model/update`
- `POST /_matrix/client/v1/ai/model/delete`

### Location Service Endpoints
- `GET /_matrix/client/v1/location/coord_transform`
- `GET /_matrix/client/v1/location/reverse_geocode`
- `GET /_matrix/client/v1/location/static_map`
