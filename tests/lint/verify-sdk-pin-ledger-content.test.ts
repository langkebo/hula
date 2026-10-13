import { describe, expect, it } from 'vitest'
import {
  compareLedgerSnapshots,
  LEDGER_FIXTURE_DIR,
  LEDGER_PROFILE_FILES,
  LEDGER_SIDECAR_FILE,
  readLedgerSnapshot
} from '../../scripts/verify-sdk-pin.mjs'

/**
 * 门禁单测：`verify-sdk-pin` 的 **ledger 内容判据**。
 *
 * 背景（2026-10-13 实测假阳性）：旧判据是
 * `git log <pin>..HEAD -- tests/unit/fixtures/ledger_export_sdk`，**位置**判据 ——
 * 只要区间内有提交碰过那个目录就判红。后端 `ed09854e5` 只往该目录**新增 sidecar
 * `manifest.json`**、三个 profile JSON 一字未改（`synapse-web/src/routes/**` 的
 * `.route(` 增删 0 行），门禁却报「contract mirror is stale」。
 *
 * 新判据比对**内容**：优先后端 sidecar 的 `route_surface_sha256`（刻意排除
 * `generated_at` / `synapse_rust_commit` 这类易变字段），拿不到就回落到三个 profile
 * JSON 的 sha256；任一侧都读不到 ⇒ 判红（缺输入不算通过）。
 */

/** 构造一个只认给定内容的 `readFile`。 */
function reader(files: Record<string, string | null>) {
  return (relPath: string): string | null => files[relPath] ?? null
}

function profilesOf(patch: Partial<Record<string, string | null>>) {
  const files: Record<string, string | null> = {}
  for (const profile of LEDGER_PROFILE_FILES) {
    files[`${LEDGER_FIXTURE_DIR}/${profile}.json`] = `{"profile":"${profile}"}`
  }
  for (const [name, content] of Object.entries(patch)) {
    files[`${LEDGER_FIXTURE_DIR}/${name}.json`] = content
  }
  return files
}

function sidecarOf(fingerprints: Record<string, string>) {
  return JSON.stringify({
    ledger_schema_version: '4',
    profiles: Object.fromEntries(
      Object.entries(fingerprints).map(([profile, sha]) => [profile, { entry_count: 1, route_surface_sha256: sha }])
    )
  })
}

describe('verify-sdk-pin: ledger 内容判据', () => {
  it('两侧内容一致（无 sidecar）⇒ 不改判红，basis=files', () => {
    const snapshot = () => readLedgerSnapshot(reader(profilesOf({})))
    const verdict = compareLedgerSnapshots(snapshot(), snapshot())

    expect(verdict.same).toBe(true)
    expect(verdict.basis).toBe('files')
    expect(verdict.changedProfiles).toEqual([])
  })

  it('某个 profile 内容变了 ⇒ 判红，并点名是哪一个', () => {
    const before = readLedgerSnapshot(reader(profilesOf({})))
    const after = readLedgerSnapshot(reader(profilesOf({ all: '{"profile":"all","changed":true}' })))
    const verdict = compareLedgerSnapshots(before, after)

    expect(verdict.same).toBe(false)
    expect(verdict.changedProfiles).toEqual(['all'])
    expect(verdict.detail).toContain('all:')
  })

  it('**回归**：只新增 sidecar（+ 三个 profile JSON 未动）⇒ 不算落后', () => {
    // pin 那侧没有 sidecar（它是 2026-10-13 才引入的），HEAD 那侧有
    const before = readLedgerSnapshot(reader(profilesOf({})))
    const after = readLedgerSnapshot(
      reader({
        ...profilesOf({}),
        [LEDGER_SIDECAR_FILE]: sidecarOf({ all: 'aaa', default: 'bbb', worker: 'ccc' })
      })
    )
    const verdict = compareLedgerSnapshots(before, after)

    expect(verdict.same).toBe(true)
    // 一侧没有 sidecar ⇒ 回落到文件哈希，而不是假装比过 sidecar
    expect(verdict.basis).toBe('files')
  })

  it('两侧都有 sidecar ⇒ basis 标注 sidecar，但判定仍以 profile JSON 内容为准', () => {
    const fingerprints = { all: 'aaa', default: 'bbb', worker: 'ccc' }
    const before = readLedgerSnapshot(
      reader({
        ...profilesOf({}),
        [LEDGER_SIDECAR_FILE]: sidecarOf(fingerprints)
      })
    )
    const after = readLedgerSnapshot(
      reader({
        ...profilesOf({}),
        [LEDGER_SIDECAR_FILE]: sidecarOf(fingerprints)
      })
    )
    const verdict = compareLedgerSnapshots(before, after)

    expect(verdict.same).toBe(true)
    expect(verdict.basis).toBe('files+sidecar')
  })

  it('**严格性**：只有易变字段变化（重新生成）也算落后 ⇒ 判红，并在详情里带上 route_surface 诊断', () => {
    const fingerprints = { all: 'aaa', default: 'bbb', worker: 'ccc' }
    const before = readLedgerSnapshot(reader({ ...profilesOf({}), [LEDGER_SIDECAR_FILE]: sidecarOf(fingerprints) }))
    // 只有 generated_at 之类的易变字段变了：文件哈希不同、路由面指纹相同
    const after = readLedgerSnapshot(
      reader({
        ...profilesOf({ all: '{"profile":"all","regenerated":true}' }),
        [LEDGER_SIDECAR_FILE]: sidecarOf(fingerprints)
      })
    )
    const verdict = compareLedgerSnapshots(before, after)

    expect(verdict.same).toBe(false)
    expect(verdict.changedProfiles).toEqual(['all'])
    // 诊断里能看出「内容摘要本身其实没变」——这是给人判断的信号，不参与判定
    expect(verdict.detail).toContain('route_surface: aaa → aaa')
  })

  it('路由面真的变了 ⇒ 判红，并点名是哪一个', () => {
    const before = readLedgerSnapshot(
      reader({ ...profilesOf({}), [LEDGER_SIDECAR_FILE]: sidecarOf({ all: 'aaa', default: 'bbb', worker: 'ccc' }) })
    )
    const after = readLedgerSnapshot(
      reader({
        ...profilesOf({ worker: '{"profile":"worker","routes":["+1"]}' }),
        [LEDGER_SIDECAR_FILE]: sidecarOf({ all: 'aaa', default: 'bbb', worker: 'ZZZ' })
      })
    )
    const verdict = compareLedgerSnapshots(before, after)

    expect(verdict.same).toBe(false)
    expect(verdict.changedProfiles).toEqual(['worker'])
    expect(verdict.detail).toContain('route_surface: ccc → ZZZ')
  })

  it('sidecar 是坏 JSON ⇒ 回落文件哈希，不崩、也不假装比过', () => {
    const before = readLedgerSnapshot(reader(profilesOf({})))
    const after = readLedgerSnapshot(reader({ ...profilesOf({}), [LEDGER_SIDECAR_FILE]: '{ not json' }))
    const verdict = compareLedgerSnapshots(before, after)

    expect(verdict.basis).toBe('files')
    expect(verdict.same).toBe(true)
  })

  it('sidecar 存在但没有任何指纹 ⇒ 等同读不到，回落文件哈希', () => {
    const snapshot = readLedgerSnapshot(
      reader({ ...profilesOf({}), [LEDGER_SIDECAR_FILE]: JSON.stringify({ profiles: {} }) })
    )

    expect(snapshot.sidecarFingerprints).toBeNull()
  })

  it('任一侧一个 profile JSON 都读不到 ⇒ 判红（缺输入不算通过）', () => {
    const empty = readLedgerSnapshot(reader({}))
    const full = readLedgerSnapshot(reader(profilesOf({})))

    expect(compareLedgerSnapshots(empty, full)).toMatchObject({ same: false, basis: 'unresolvable' })
    expect(compareLedgerSnapshots(full, empty)).toMatchObject({ same: false, basis: 'unresolvable' })
    expect(compareLedgerSnapshots(empty, empty)).toMatchObject({ same: false, basis: 'unresolvable' })
  })
})
