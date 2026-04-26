import { computed, ref, watch } from 'vue'

export type FavoriteMessageItem = {
  id: string
  conversationName: string
  senderName: string
  timestamp: number
  content: string
}

export type FavoriteImageItem = {
  id: string
  imageUrl: string
  fileName: string
  senderName: string
  timestamp: number
}

export type FavoriteLinkItem = {
  id: string
  title: string
  url: string
  summary: string
}

export interface FavoritesState {
  messages: FavoriteMessageItem[]
  images: FavoriteImageItem[]
  links: FavoriteLinkItem[]
}

export type FavoriteTabKey = 'messages' | 'images' | 'links'

const STORAGE_KEY = 'hula-favorites-state'
export const FAVORITES_ENDPOINT = '/favorites'

type StrictMockKeys<TBase extends object, TMock extends TBase> = Exclude<keyof TMock, keyof TBase>

export type StrictMock<TBase extends object, TMock extends TBase = TBase> = TMock & {
  [K in StrictMockKeys<TBase, TMock>]: never
}

function defineStrictMock<TBase extends object>() {
  return <TMock extends TBase>(mock: StrictMock<TBase, TMock>) => mock
}

const createStrictFavoriteMessageItem = defineStrictMock<FavoriteMessageItem>()
const createStrictFavoriteImageItem = defineStrictMock<FavoriteImageItem>()
const createStrictFavoriteLinkItem = defineStrictMock<FavoriteLinkItem>()

const favoriteMessageItemKeys = ['id', 'conversationName', 'senderName', 'timestamp', 'content'] as const
const favoriteImageItemKeys = ['id', 'imageUrl', 'fileName', 'senderName', 'timestamp'] as const
const favoriteLinkItemKeys = ['id', 'title', 'url', 'summary'] as const
const favoritesStateKeys = ['messages', 'images', 'links'] as const

const defaultFavoritesState: FavoritesState = {
  messages: [
    createStrictFavoriteMessageItem({
      id: '1',
      conversationName: '产品群',
      senderName: '张三',
      timestamp: 1714550400000,
      content: '这是一条收藏的消息示例'
    })
  ],
  images: [
    createStrictFavoriteImageItem({
      id: '1',
      imageUrl: 'https://picsum.photos/200/200?random=1',
      fileName: '示例图片-1.png',
      senderName: '张三',
      timestamp: 1714546800000
    }),
    createStrictFavoriteImageItem({
      id: '2',
      imageUrl: 'https://picsum.photos/200/200?random=2',
      fileName: '示例图片-2.png',
      senderName: '李四',
      timestamp: 1714543200000
    })
  ],
  links: [
    createStrictFavoriteLinkItem({
      id: '1',
      title: 'Matrix 协议官网',
      url: 'https://matrix.org',
      summary: '开源去中心化实时通信协议官网。'
    })
  ]
}

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const favoriteMessages = ref<FavoriteMessageItem[]>([])
const favoriteImages = ref<FavoriteImageItem[]>([])
const favoriteLinks = ref<FavoriteLinkItem[]>([])

let hasHydratedFavorites = false
let hasBoundPersistence = false

export function createDefaultFavoritesState(): FavoritesState {
  return {
    messages: defaultFavoritesState.messages.map((item) => ({ ...item })),
    images: defaultFavoritesState.images.map((item) => ({ ...item })),
    links: defaultFavoritesState.links.map((item) => ({ ...item }))
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys<TKeys extends readonly string[]>(value: Record<string, unknown>, keys: TKeys): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

export function isFavoriteMessageItem(value: unknown): value is FavoriteMessageItem {
  if (!isPlainObject(value) || !hasExactKeys(value, favoriteMessageItemKeys)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.conversationName === 'string' &&
    typeof value.senderName === 'string' &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp) &&
    typeof value.content === 'string'
  )
}

export function isFavoriteImageItem(value: unknown): value is FavoriteImageItem {
  if (!isPlainObject(value) || !hasExactKeys(value, favoriteImageItemKeys)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.imageUrl === 'string' &&
    typeof value.fileName === 'string' &&
    typeof value.senderName === 'string' &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp)
  )
}

export function isFavoriteLinkItem(value: unknown): value is FavoriteLinkItem {
  if (!isPlainObject(value) || !hasExactKeys(value, favoriteLinkItemKeys)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.url === 'string' &&
    typeof value.summary === 'string'
  )
}

export function isFavoritesState(value: unknown): value is FavoritesState {
  if (!isPlainObject(value) || !hasExactKeys(value, favoritesStateKeys)) return false
  return (
    Array.isArray(value.messages) &&
    value.messages.every(isFavoriteMessageItem) &&
    Array.isArray(value.images) &&
    value.images.every(isFavoriteImageItem) &&
    Array.isArray(value.links) &&
    value.links.every(isFavoriteLinkItem)
  )
}

function cloneFavoritesState(state: FavoritesState): FavoritesState {
  return {
    messages: state.messages.map((item) => ({ ...item })),
    images: state.images.map((item) => ({ ...item })),
    links: state.links.map((item) => ({ ...item }))
  }
}

function parseFavoritesState(input: unknown): FavoritesState | null {
  if (!isFavoritesState(input)) return null
  return cloneFavoritesState(input)
}

function applyFavoritesState(nextState: FavoritesState): FavoritesState {
  const snapshot = cloneFavoritesState(nextState)
  favoriteMessages.value = snapshot.messages
  favoriteImages.value = snapshot.images
  favoriteLinks.value = snapshot.links
  return snapshot
}

function createFavoritesSnapshot(): FavoritesState {
  return {
    messages: favoriteMessages.value.map((item) => ({ ...item })),
    images: favoriteImages.value.map((item) => ({ ...item })),
    links: favoriteLinks.value.map((item) => ({ ...item }))
  }
}

function persistFavoritesState() {
  if (!isBrowser()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createFavoritesSnapshot()))
}

function loadFavoritesStateFromStorage(): FavoritesState {
  if (!isBrowser()) return createDefaultFavoritesState()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createDefaultFavoritesState()
  try {
    const parsed = parseFavoritesState(JSON.parse(raw))
    if (parsed) return parsed
  } catch {
    // Fall through to reset invalid persisted state.
  }
  localStorage.removeItem(STORAGE_KEY)
  return createDefaultFavoritesState()
}

function ensureFavoritesState() {
  if (!hasHydratedFavorites) {
    hydrateFavoritesState()
  }
  if (!hasBoundPersistence) {
    watch([favoriteMessages, favoriteImages, favoriteLinks], persistFavoritesState, { deep: true })
    hasBoundPersistence = true
  }
}

export function removeFavoriteById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id)
}

export function formatFavoriteTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString().slice(0, 5)}`
}

export function hydrateFavoritesState() {
  hasHydratedFavorites = true
  return applyFavoritesState(loadFavoritesStateFromStorage())
}

export async function fetchFavoritesState(
  endpoint: string = FAVORITES_ENDPOINT,
  fetchImpl: typeof fetch = fetch
): Promise<FavoritesState> {
  const response = await fetchImpl(endpoint)
  const payload = (await response.json()) as unknown
  if (!response.ok || !isFavoritesState(payload)) {
    throw new Error('Invalid favorites payload')
  }
  return cloneFavoritesState(payload)
}

export function replaceFavoritesState(input: FavoritesState) {
  const nextState = applyFavoritesState(input)
  persistFavoritesState()
  hasHydratedFavorites = true
  return nextState
}

export function resetFavoritesState() {
  return replaceFavoritesState(createDefaultFavoritesState())
}

export function useFavorites(initialTab: FavoriteTabKey = 'messages') {
  ensureFavoritesState()

  const activeTab = ref<FavoriteTabKey>(initialTab)
  const favoriteStats = computed(() => ({
    messages: favoriteMessages.value.length,
    images: favoriteImages.value.length,
    links: favoriteLinks.value.length
  }))
  const totalCount = computed(
    () => favoriteStats.value.messages + favoriteStats.value.images + favoriteStats.value.links
  )
  const hasFavorites = computed(() => totalCount.value > 0)

  const removeMessageFavorite = (id: string) => {
    favoriteMessages.value = removeFavoriteById(favoriteMessages.value, id)
  }

  const removeImageFavorite = (id: string) => {
    favoriteImages.value = removeFavoriteById(favoriteImages.value, id)
  }

  const removeLinkFavorite = (id: string) => {
    favoriteLinks.value = removeFavoriteById(favoriteLinks.value, id)
  }

  const removeFavorite = (tab: FavoriteTabKey, id: string) => {
    if (tab === 'messages') {
      removeMessageFavorite(id)
      return
    }
    if (tab === 'images') {
      removeImageFavorite(id)
      return
    }
    removeLinkFavorite(id)
  }

  return {
    activeTab,
    favoriteMessages,
    favoriteImages,
    favoriteLinks,
    favoriteStats,
    totalCount,
    hasFavorites,
    removeMessageFavorite,
    removeImageFavorite,
    removeLinkFavorite,
    removeFavorite,
    formatTime: formatFavoriteTime
  }
}
