# Favorites Protocol Alignment Report

## Scope

- Frontend target: `src/composables/useFavorites.ts`
- Backend search target: `/Users/ljf/Desktop/hu/synapse-rust/src`
- Search terms: `favorites`, `/favorites`, `FavoriteMessageItem`, `FavoriteImageItem`, `FavoriteLinkItem`
- Result: no dedicated favorites REST route, GraphQL schema, protobuf message, or DTO was found in `synapse-rust`

## Mapping Table

| Frontend type | Frontend field | Type | Required | Nested | Enum | Date format | `synapse-rust` contract field | Diff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FavoriteMessageItem` | `id` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteMessageItem` | `conversationName` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteMessageItem` | `senderName` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteMessageItem` | `timestamp` | `number` | yes | no | no | unix epoch ms | not found | backend contract missing |
| `FavoriteMessageItem` | `content` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteImageItem` | `id` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteImageItem` | `imageUrl` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteImageItem` | `fileName` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteImageItem` | `senderName` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteImageItem` | `timestamp` | `number` | yes | no | no | unix epoch ms | not found | backend contract missing |
| `FavoriteLinkItem` | `id` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteLinkItem` | `title` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteLinkItem` | `url` | `string` | yes | no | no | n/a | not found | backend contract missing |
| `FavoriteLinkItem` | `summary` | `string` | yes | no | no | n/a | not found | backend contract missing |

## Removed Legacy Compatibility

- Removed fallback fields: `username`, `time`, `url` aliasing
- Removed runtime normalization that silently rewrote legacy payloads
- Removed partial-state acceptance in `replaceFavoritesState`
- Replaced permissive parsing with exact-key runtime guards

## Current Contract Decision

- Until a backend favorites contract exists in `synapse-rust`, the frontend treats the current three item types as the only valid protocol shape
- Any missing field, extra field, wrong type, or wrong top-level collection key is considered invalid payload
- Invalid persisted payloads are discarded instead of normalized
