import { expect, test } from '@playwright/test'
import {
  bootstrapMatrixLivePage,
  createLiveProbeMessage,
  getMatrixLivePeerSkipReason,
  getMatrixLiveSkipReason,
  loginToMatrixLive,
  openConfiguredRoom,
  openMessageWorkspace,
  readMatrixLiveEnv,
  roomContainsMessage,
  sendTextMessageToRoom,
  waitForLiveSessions
} from './support/matrixLive'

const matrixLiveEnv = readMatrixLiveEnv()

test.describe('Matrix Live Desktop Flows', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(180_000)

  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'matrix-live 仅在桌面 Chromium 项目下运行')

    const skipReason = getMatrixLiveSkipReason(matrixLiveEnv)
    test.skip(Boolean(skipReason), skipReason ?? '')

    await bootstrapMatrixLivePage(page, matrixLiveEnv)
  })

  test('logs in against a live homeserver and opens the message workspace', async ({ page }) => {
    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)

    await expect(page.locator('.message-list-page')).toBeVisible()
    await expect(page.locator('.message-session-toolbar')).toBeVisible()
  })

  test('sends a probe message into the configured encrypted room', async ({ page }) => {
    test.skip(!matrixLiveEnv.roomId, '发送探针消息需要配置 MATRIX_LIVE_ROOM_ID')

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)
    await openConfiguredRoom(page, matrixLiveEnv)

    const probeText = createLiveProbeMessage(matrixLiveEnv)
    const eventId = await sendTextMessageToRoom(page, matrixLiveEnv.roomId, probeText)

    expect(eventId).toBeTruthy()
    await expect
      .poll(() => roomContainsMessage(page, matrixLiveEnv.roomId, probeText), {
        timeout: 120_000,
        message: '等待探针消息回写到已登录用户的加密时间线'
      })
      .toBe(true)
  })

  test('loads the configured decrypted timeline sample from the encrypted room', async ({ page }) => {
    test.skip(!matrixLiveEnv.roomId, '校验解密时间线需要配置 MATRIX_LIVE_ROOM_ID')
    test.skip(!matrixLiveEnv.expectedTimelineText, '校验解密时间线需要配置 MATRIX_LIVE_EXPECTED_TIMELINE_TEXT')

    await loginToMatrixLive(page, matrixLiveEnv)
    await openMessageWorkspace(page)
    await waitForLiveSessions(page)
    await openConfiguredRoom(page, matrixLiveEnv)

    await expect
      .poll(() => roomContainsMessage(page, matrixLiveEnv.roomId, matrixLiveEnv.expectedTimelineText), {
        timeout: 120_000,
        message: '等待已配置的加密消息完成同步与解密'
      })
      .toBe(true)
  })

  test('delivers a probe message across two live Matrix accounts', async ({ browser, page }) => {
    test.skip(!matrixLiveEnv.roomId, '双账号收发需要配置 MATRIX_LIVE_ROOM_ID')

    const peerSkipReason = getMatrixLivePeerSkipReason(matrixLiveEnv)
    test.skip(Boolean(peerSkipReason), peerSkipReason ?? '')

    const receiverContext = await browser.newContext()
    const receiverPage = await receiverContext.newPage()

    try {
      await bootstrapMatrixLivePage(receiverPage, matrixLiveEnv)

      await Promise.all([
        loginToMatrixLive(page, matrixLiveEnv, 'primary'),
        loginToMatrixLive(receiverPage, matrixLiveEnv, 'peer')
      ])

      await Promise.all([openMessageWorkspace(page), openMessageWorkspace(receiverPage)])
      await Promise.all([waitForLiveSessions(page), waitForLiveSessions(receiverPage)])
      await Promise.all([openConfiguredRoom(page, matrixLiveEnv), openConfiguredRoom(receiverPage, matrixLiveEnv)])

      const probeText = createLiveProbeMessage(matrixLiveEnv)
      const eventId = await sendTextMessageToRoom(page, matrixLiveEnv.roomId, probeText)

      expect(eventId).toBeTruthy()
      await expect
        .poll(() => roomContainsMessage(receiverPage, matrixLiveEnv.roomId, probeText), {
          timeout: 120_000,
          message: '等待第二个账号同步并解密发送端发出的消息'
        })
        .toBe(true)
    } finally {
      await receiverContext.close()
    }
  })
})
