// Matrix SDK 类型扩展声明

declare module 'matrix-js-sdk' {
  interface MatrixClient {
    // Profile
    getProfile(userId: string): Promise<{ displayname?: string; avatar_url?: string }>
    
    // User Directory
    searchUserDirectory(opts: { term: string; limit?: number }): Promise<any>
    
    // Report
    reportEvent(roomId: string, eventId: string, reason: string, explanation?: string): Promise<any>
    
    // Retention
    getServerRetention(): Promise<any>
    getRoomStateEvent(roomId: string, eventType: string, stateKey: string): Promise<any>
    
    // Upload
    uploadContent(file: Blob | File, opts?: { type?: string; rawResponse?: boolean }): Promise<{ content_uri: string }>
    
    // Sync
    sync(opts?: any): Promise<any>
    
    // Client
    getRooms(): any[]
    getRoom(roomId: string): any
    stopClient(): void
    
    // Other methods
    [key: string]: any
  }

  interface Room {
    timeline: any[]
    getUnfilteredTimelineSet(): any
    getMyMembership?(): string
    getUnreadNotificationCount?(): { highlight?: number; notification?: number }
    getRoomId?(): string
  }

  interface MatrixEvent {
    getContent(): any
    getWireContent(): any
  }
}
