import { MatrixClient } from 'matrix-js-sdk/src/client';
import { MatrixClientExtensionMethods } from 'matrix-js-sdk/src/matrix-client-extensions.d';
import { RoomManager } from 'matrix-js-sdk/src/room/RoomManager'; // 显式导入 RoomManager

declare module 'matrix-js-sdk/src/client' {
  export interface MatrixClient extends MatrixClientExtensionMethods {
    // 显式声明 getRoomManager 方法，确保类型匹配
    getRoomManager(): RoomManager;
  }
}
