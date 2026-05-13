import { afterEach, describe, expect, it } from 'vitest'
import { __resetSemaphoresForTest, getSemaphore, Semaphore, SemaphoreLimits } from '../Semaphore'

afterEach(() => {
  __resetSemaphoresForTest()
})

describe('Semaphore', () => {
  it('caps concurrent holders at capacity', async () => {
    const sem = new Semaphore('t', 2)
    await sem.acquire()
    await sem.acquire()
    expect(sem.inUse).toBe(2)

    let third: 'acquired' | 'pending' = 'pending'
    const p = sem.acquire().then(() => {
      third = 'acquired'
    })
    await Promise.resolve()
    expect(third).toBe('pending')

    sem.release()
    await p
    expect(third).toBe('acquired')
  })

  it('releases in FIFO order', async () => {
    const sem = new Semaphore('fifo', 1)
    await sem.acquire()

    const order: string[] = []
    const a = sem.acquire().then(() => order.push('a'))
    const b = sem.acquire().then(() => order.push('b'))

    sem.release()
    await a
    sem.release()
    await b

    expect(order).toEqual(['a', 'b'])
  })

  it('run() releases permit even if task throws', async () => {
    const sem = new Semaphore('r', 1)
    await expect(sem.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(sem.inUse).toBe(0)
  })

  it('rejects invalid capacity', () => {
    expect(() => new Semaphore('x', 0)).toThrow()
    expect(() => new Semaphore('x', -1)).toThrow()
  })

  it('getSemaphore returns a singleton per name with plan defaults', () => {
    const a = getSemaphore('mediaUpload')
    const b = getSemaphore('mediaUpload')
    expect(a).toBe(b)
    expect(a.inUse).toBe(0)
    // Capacity is opaque but we can derive it by filling up.
    const { mediaUpload } = SemaphoreLimits
    for (let i = 0; i < mediaUpload; i++) a.acquire()
    expect(a.inUse).toBe(mediaUpload)
  })
})
