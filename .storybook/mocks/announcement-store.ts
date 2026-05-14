import { reactive } from 'vue'

export type MockAnnouncement = {
  id: string
  content: string
  top?: boolean
  author?: string
  timestamp?: number
}

type AnnouncementState = {
  announcementContent: string
  announList: MockAnnouncement[]
  announError: boolean
  isAddAnnoun: boolean
}

const defaultAnnouncementState = (): AnnouncementState => ({
  announcementContent: '',
  announList: [],
  announError: false,
  isAddAnnoun: true
})

const internalState = reactive<AnnouncementState>(defaultAnnouncementState())

const syncStoreState = () => {
  announcementStoreMock.announcementContent = internalState.announcementContent
  announcementStoreMock.announList = internalState.announList.map((announcement) => ({ ...announcement }))
  announcementStoreMock.announError = internalState.announError
  announcementStoreMock.isAddAnnoun = internalState.isAddAnnoun
}

export const resetAnnouncementStoreMock = () => {
  Object.assign(internalState, defaultAnnouncementState())
  syncStoreState()
}

export const configureAnnouncementStoreMock = (options: Partial<AnnouncementState>) => {
  if (options.announcementContent !== undefined) {
    internalState.announcementContent = options.announcementContent
  }
  if (options.announList !== undefined) {
    internalState.announList = options.announList.map((announcement) => ({ ...announcement }))
  }
  if (options.announError !== undefined) {
    internalState.announError = options.announError
  }
  if (options.isAddAnnoun !== undefined) {
    internalState.isAddAnnoun = options.isAddAnnoun
  }
  syncStoreState()
}

export const updateAnnouncementContent = (content: string) => {
  const timestamp = Date.now()
  const nextPrimary = internalState.announList[0]
  if (nextPrimary) {
    internalState.announList = [
      {
        ...nextPrimary,
        content,
        top: true,
        timestamp
      },
      ...internalState.announList.slice(1)
    ]
  } else {
    internalState.announList = [
      {
        id: 'topic',
        content,
        top: true,
        author: '@storybook:example.com',
        timestamp
      }
    ]
  }
  internalState.announcementContent = content
  syncStoreState()
}

export const announcementStoreMock = reactive({
  announcementContent: '',
  announList: [] as MockAnnouncement[],
  announError: false,
  isAddAnnoun: true,
  clearAnnouncements() {
    resetAnnouncementStoreMock()
  },
  async loadGroupAnnouncements() {
    syncStoreState()
  }
})

syncStoreState()

export const useAnnouncementStore = () => announcementStoreMock
