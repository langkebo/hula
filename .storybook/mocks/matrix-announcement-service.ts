import { updateAnnouncementContent } from './announcement-store'

export const matrixAnnouncementService = {
  async editAnnouncement(_roomId: string, payload: { id: string; content: string; isPinned: boolean }) {
    updateAnnouncementContent(payload.content)
  },
  async pushAnnouncement(_roomId: string, payload: { content: string; isPinned: boolean }) {
    updateAnnouncementContent(payload.content)
  }
}
