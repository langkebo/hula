import { ref } from 'vue'

export type AriaLivePoliteness = 'polite' | 'assertive' | 'off'

interface LiveMessage {
  id: number
  text: string
  politeness: AriaLivePoliteness
}

const messages = ref<LiveMessage[]>([])
let nextId = 0

/**
 * Hook for managing ARIA live region announcements.
 * Useful for providing async feedback to screen reader users.
 */
export function useAriaLive() {
  const clearAnnouncements = () => {
    messages.value = []
  }

  /**
   * Announce a message to screen readers.
   * @param text The message to announce.
   * @param politeness How urgently to announce the message. Defaults to 'polite'.
   */
  const announce = (text: string, politeness: AriaLivePoliteness = 'polite') => {
    const id = ++nextId
    messages.value.push({ id, text, politeness })

    // Clear the message after a delay to allow for the same message to be announced again later
    setTimeout(() => {
      messages.value = messages.value.filter((m) => m.id !== id)
    }, 1000)
  }

  return {
    messages,
    announce,
    clearAnnouncements
  }
}
