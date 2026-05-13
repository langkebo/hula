import { createTask, registerTask } from './workerRegistry'

interface HashInput {
  buffer: ArrayBuffer
}

interface HashOutput {
  hash: string
}

const hashTask = createTask<HashInput, HashOutput>('calculate-hash', async (input) => {
  const { buffer } = input
  const uint8Array = new Uint8Array(buffer)

  const { Md5 } = await import('digest-wasm')
  const md5 = Md5
  const hash = await md5.digest_u8(uint8Array)
  return { hash: hash.toLowerCase() }
})

registerTask(hashTask)
