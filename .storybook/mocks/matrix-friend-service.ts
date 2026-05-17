export const matrixFriendService = {
  async getFriendSuggestions() {
    return []
  },
  async searchFriendsViaApi(query: string) {
    if (!query.trim()) {
      return []
    }
    return [
      {
        user_id: query.startsWith('@') ? query : `@${query}:example.com`,
        display_name: query,
        avatar_url: ''
      }
    ]
  }
}
