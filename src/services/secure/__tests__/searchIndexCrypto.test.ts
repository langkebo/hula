import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SearchEventDoc } from '@/workers/matrixWorkerTypes'
import { clearAllSearchData, loadEventsFromDB, saveEventsToDB, setSearchIndexKey } from '@/workers/searchIndexDb'
import { decryptIndexField, deriveSearchIndexKey, encryptIndexField } from '../searchIndexCrypto'

// F-4 / D3：搜索索引加密。
//
// 索引里存的是**消息正文**，明文落盘等于把私密会话搬上磁盘。
// 这套用例钉住三件事：
// 1. 密钥按用途派生（HKDF），不等于主密钥；
// 2. 只有正确密钥能解出原文，错密钥/篡改/旧明文一律返回 null；
// 3. 没有密钥时**不落盘**（而不是退回明文）。

const STORAGE_KEY = new Uint8Array(32).fill(7)

const doc: SearchEventDoc = {
  eventId: '$evt1:hs',
  roomId: '!room:hs',
  sender: '@alice:hs',
  timestamp: 1_700_000_000_000,
  msgtype: 'm.text',
  body: '机密内容：明天下午三点在老地方见'
}

describe('searchIndexCrypto', () => {
  it('HKDF 派生 32 字节，且不等于输入的主密钥', async () => {
    const key = await deriveSearchIndexKey(STORAGE_KEY)

    expect(key.length).toBe(32)
    expect(Array.from(key)).not.toEqual(Array.from(STORAGE_KEY))
  })

  it('同一主密钥派生结果稳定', async () => {
    const a = await deriveSearchIndexKey(STORAGE_KEY)
    const b = await deriveSearchIndexKey(STORAGE_KEY)
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('加解密往返一致，且密文不含明文', async () => {
    const key = await deriveSearchIndexKey(STORAGE_KEY)
    const cipher = await encryptIndexField(doc.body, key)

    expect(cipher.startsWith('v1:')).toBe(true)
    expect(cipher).not.toContain('老地方')
    await expect(decryptIndexField(cipher, key)).resolves.toBe(doc.body)
  })

  it('错密钥解不开（不抛，返回 null）', async () => {
    const key = await deriveSearchIndexKey(STORAGE_KEY)
    const wrong = await deriveSearchIndexKey(new Uint8Array(32).fill(9))
    const cipher = await encryptIndexField(doc.body, key)

    await expect(decryptIndexField(cipher, wrong)).resolves.toBeNull()
  })

  it('密文被篡改时返回 null', async () => {
    const key = await deriveSearchIndexKey(STORAGE_KEY)
    const cipher = await encryptIndexField(doc.body, key)
    const tampered = cipher.slice(0, -4) + 'AAAA'

    await expect(decryptIndexField(tampered, key)).resolves.toBeNull()
  })

  it('D3 之前的旧明文记录一律返回 null（视为不可用）', async () => {
    const key = await deriveSearchIndexKey(STORAGE_KEY)
    await expect(decryptIndexField('老格式明文', key)).resolves.toBeNull()
  })
})

describe('searchIndexDb · 加密落盘（D3）', () => {
  beforeEach(async () => {
    await clearAllSearchData()
    setSearchIndexKey(null)
  })

  it('有密钥时：写入后能读回同一条事件', async () => {
    const key = await deriveSearchIndexKey(STORAGE_KEY)
    setSearchIndexKey(key)

    await saveEventsToDB([doc])
    const loaded = await loadEventsFromDB()

    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toMatchObject({
      eventId: doc.eventId,
      roomId: doc.roomId,
      sender: doc.sender,
      body: doc.body
    })
  })

  it('无密钥时：不落盘，读回为空', async () => {
    setSearchIndexKey(null)

    await saveEventsToDB([doc])
    const loaded = await loadEventsFromDB()

    expect(loaded).toEqual([])
  })

  it('换密钥后读回为空（旧记录解不开就丢弃，等重建）', async () => {
    const key = await deriveSearchIndexKey(STORAGE_KEY)
    setSearchIndexKey(key)
    await saveEventsToDB([doc])

    const otherKey = await deriveSearchIndexKey(new Uint8Array(32).fill(3))
    setSearchIndexKey(otherKey)

    await expect(loadEventsFromDB()).resolves.toEqual([])
  })
})
