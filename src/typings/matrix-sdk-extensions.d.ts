// Deep-path imports removed (清单 B):
// The SDK's public MatrixClient (matrix-js-sdk/client) already extends
// MatrixClientExtensionMethods, which declares getRoomManager(): RoomManager
// (see matrix-js-sdk/src/matrix-client-extensions.ts:185).
// The previous augmentation targeting 'matrix-js-sdk/src/client' was redundant
// and violated the sdk-boundary check. No replacement augmentation is needed.
