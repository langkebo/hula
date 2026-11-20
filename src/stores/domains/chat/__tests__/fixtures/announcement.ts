/**
 * 公告列表夹具。
 *
 * 契约来源：`useAnnouncementStore().getGroupAnnouncementList()` 的返回值
 * （在 `Announcement` 之上补齐 `uid` / `userName`，并把 `id` 归一为字符串）。
 */
import type { Announcement } from '@/stores/domains/chat/announcement'

export interface AnnouncementListRecord extends Announcement {
  uid: string
  userName: string
}

export interface AnnouncementListPage {
  records: AnnouncementListRecord[]
  total: number
}

export function makeAnnouncementListRecord(overrides: Partial<AnnouncementListRecord> = {}): AnnouncementListRecord {
  return {
    id: 'ann-1',
    content: '公告内容',
    top: false,
    author: '@admin:example.org',
    timestamp: 1700000000000,
    uid: '@admin:example.org',
    userName: '@admin:example.org',
    ...overrides
  }
}

export function makeAnnouncementListPage(records: AnnouncementListRecord[] = []): AnnouncementListPage {
  return { records, total: records.length }
}
