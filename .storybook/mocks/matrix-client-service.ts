const client = {
  getUserId: () => '@me:example.com',
  getUser: (userId: string) => ({
    presence: userId === '@alice:example.com' ? 'online' : 'offline'
  }),
  getRoom: () => ({
    getMember: (userId: string) => ({
      name: userId === '@alice:example.com' ? 'Alice' : 'Teammate'
    })
  })
}

export const matrixClientService = {
  getClient: () => client
}

export default matrixClientService
