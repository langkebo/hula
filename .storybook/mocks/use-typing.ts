export const useTyping = () => ({
  startTyping: () => undefined,
  stopTyping: () => undefined,
  getTypingUsers: () => [{ userId: '@alice:example.com', lastTyped: Date.now() }]
})
