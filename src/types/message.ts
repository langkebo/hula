export interface IMessageContent {
  msgtype: string
  body: string
  format?: string
  formatted_body?: string
  url?: string
  filename?: string
  info?: IMediaInfo
  geo_uri?: string
  'm.relates_to'?: IEventRelation
  'm.new_content'?: Partial<IMessageContent>
}

export interface IMediaInfo {
  size?: number
  mimetype?: string
  w?: number
  h?: number
  duration?: number
  thumbnail_url?: string
  thumbnail_info?: IThumbnailInfo
}

export interface IThumbnailInfo {
  size: number
  w: number
  h: number
  mimetype: string
}

export interface IEventRelation {
  rel_type?: string
  event_id?: string
  key?: string
  'm.in_reply_to'?: {
    event_id: string
  }
}

export interface MessageType {
  id?: string
  eventId?: string
  msgtype?: string
  body?: string
  content?: IMessageContent
  sender?: string
  originServerTs?: number
  roomId?: string
  type?: string
  [key: string]: unknown
}
