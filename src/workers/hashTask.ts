import { createTask, registerTask } from './workerRegistry'

interface HashInput {
  buffer: ArrayBuffer
  platform: 'android' | 'other'
}

interface HashOutput {
  hash: string
}

const hashTask = createTask<HashInput, HashOutput>('calculate-hash', async (input) => {
  const { buffer, platform } = input
  const uint8Array = new Uint8Array(buffer)

  if (platform === 'android') {
    const CryptoJS = (await import('crypto-js')).default
    const wordArray = CryptoJS.lib.WordArray.create(buffer as ArrayBuffer)
    const hash = CryptoJS.MD5(wordArray).toString()
    return { hash: hash.toLowerCase() }
  }

  const { Md5 } = await import('digest-wasm')
  const md5 = Md5
  const hash = await md5.digest_u8(uint8Array)
  return { hash: hash.toLowerCase() }
})

registerTask(hashTask)
