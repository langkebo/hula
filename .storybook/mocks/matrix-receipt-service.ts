export const matrixReceiptService = {
  getReadReceipts: () => [
    {
      userId: '@alice:example.com',
      displayName: 'Alice',
      avatarUrl: '',
      eventId: '$event-1',
      timestamp: Date.now()
    },
    {
      userId: '@bob:example.com',
      displayName: 'Bob',
      avatarUrl: '',
      eventId: '$event-1',
      timestamp: Date.now()
    }
  ]
}
