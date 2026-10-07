const { chromium } = require('playwright-core')
const assert = require('node:assert/strict')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs/promises')
const bank = require('../src/data/quizBank.json')
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  try {
    const base = process.env.GAME_URL || 'http://127.0.0.1:5173'
    const members = new Map(), errors = []
    const realTransport = process.env.MOCK_REALTIME === '0'
    const testTopic = 'hcm202-check-' + Date.now() + '-'
    async function open(route) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      if (!realTransport) await require('./realtime-fixture.cjs')(context, members)
      else await context.route('**/src/systems/Multiplayer.ts*', async route => {
        const response = await route.fetch(), source = await response.text()
        await route.fulfill({ response, body: source.replace('client.channel(', 'client.channel(' + JSON.stringify(testTopic) + ' + ') })
      })
      await context.route('**/src/main.ts*', async route => {
        const response = await route.fetch(), source = await response.text()
        assert(source.includes('new Experience()'))
        await route.fulfill({ response, body: source.replace('new Experience()', '(window.testExperience = new Experience())') })
      })
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(base + route)
      return page
    }
    const host = await open('/start')
    await host.waitForFunction(() => document.querySelector('#host-status').textContent.includes('0 người'))
    const guest = await open('/play'), peer = await open('/play')
    for (const [page, name] of [[guest, 'Người A'], [peer, 'Người B']]) {
      await page.locator('#join-room').waitFor({ state: 'visible' })
      await page.fill('#player-name', name); await page.click('#join-room')
      await page.waitForFunction(() => document.querySelector('#room-message').textContent.includes('Đã vào phòng HCM202'))
    }
    await host.waitForFunction(() => document.querySelector('#host-roster').textContent.includes('Người B'))
    await host.click('#start-button')
    for (const page of [guest, peer]) {
      await page.locator('#hud').waitFor({ state: 'visible' })
      await page.waitForFunction(() => document.querySelector('#museum-canvas').dataset.visitors === '1')
      assert.equal(await page.locator('#guided-controls').isVisible(), false)
      assert.equal(await page.evaluate(() => window.testExperience.controls.movementLocked), false)
      assert.equal(await page.evaluate(() => window.testExperience.multiplayer.me.activeQuestion), null)
    }
    await guest.keyboard.down('KeyW'); await guest.waitForTimeout(1800); await guest.keyboard.up('KeyW')
    assert(await guest.evaluate(() => window.testExperience.camera.position.z < 6), 'Can walk before listening')
    async function move(page, z) {
      await page.evaluate(z => { const e = window.testExperience; e.camera.position.set(0, 1.68, z); e.controls.setOrientation(0, 0) }, z)
      await page.waitForTimeout(350)
    }
    await move(guest, -47.3); await move(peer, -49)
    await guest.locator('[data-question="24"]').waitFor({ state: 'visible' })
    // Billboard names and avatars remain present while both players explore.
    assert.equal(await guest.evaluate(() => [...window.testExperience.visitors.models.values()][0].children.some(child => child.isSprite)), true)
    await guest.screenshot({ path: path.join(os.tmpdir(), 'hcm202-free-players.png') })
    await guest.click('#lesson-listen')
    await guest.waitForFunction(() => window.testExperience.audio.snapshot.state === 'playing')
    await move(guest, -46)
    assert.equal(await guest.evaluate(() => window.testExperience.audio.snapshot.state), 'playing', 'Story continues across zones')
    await move(guest, -47.3)
    await guest.click('[data-question="24"]')
    await guest.locator('#question-panel').waitFor({ state: 'visible' })
    const entry = bank[4][0]
    await guest.locator('input[name="stage-answer"][value="' + entry.answer + '"]').check()
    await guest.click('#submit-stage')
    await guest.waitForFunction(() => window.testExperience.multiplayer.me.score === 100)
    assert.equal(await guest.evaluate(() => window.testExperience.multiplayer.me.listened.length), 0)
    await guest.click('#close-question')
    // Return to an earlier area and choose a non-first question.
    await move(guest, -5.2)
    await guest.click('[data-question="3"]')
    await guest.locator('#question-panel').waitFor({ state: 'visible' })
    const deadline = await guest.evaluate(() => window.testExperience.multiplayer.me.questionDeadline)
    await guest.click('#close-question'); await move(guest, 0)
    assert.equal(await guest.evaluate(() => window.testExperience.multiplayer.me.questionDeadline), deadline)
    await guest.click('#resume-question')
    await guest.click('#answer-other'); await guest.fill('#manual-answer', '1911'); await guest.click('#submit-stage')
    await guest.waitForFunction(() => window.testExperience.multiplayer.me.score === 200)
    await peer.click('[data-question="25"]')
    await peer.waitForFunction(() => window.testExperience.multiplayer.me.answers.some(answer => answer.index === 25 && answer.timedOut), undefined, { timeout: 10000 })
    assert.equal(await peer.evaluate(() => window.testExperience.multiplayer.me.activeQuestion), null)
    await host.screenshot({ path: path.join(os.tmpdir(), 'hcm202-host-live.png') })
    await host.click('#end-session')
    await guest.locator('#result-screen').waitFor({ state: 'visible' })
    await peer.locator('#result-screen').waitFor({ state: 'visible' })
    const archive = await host.evaluate(() => JSON.parse(localStorage.getItem('hcm202-last-results-v2')))
    assert.equal(archive.phase, 'ended')
    assert.equal(archive.players[0].name, 'Người A')
    assert.equal(archive.players[0].score, 200)
    assert.equal(archive.players[0].answers.length, 2)
    assert(archive.players[0].answers.every(answer => Number.isInteger(answer.elapsedMs) && answer.elapsedMs > 0))
    assert.equal(archive.players[0].correctTimeMs, archive.players[0].answers.reduce((sum, answer) => sum + answer.elapsedMs, 0))
    assert.equal(await host.locator('#host-ranking tbody tr').count(), 2)
    await guest.screenshot({ path: path.join(os.tmpdir(), 'hcm202-session-results.png') })
    const downloadEvent = host.waitForEvent('download')
    await host.click('#download-results')
    const download = await downloadEvent
    const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'))
    assert.equal(exported.sessionId, archive.sessionId)
    await host.click('#new-session')
    for (const page of [guest, peer]) {
      await page.locator('#start').waitFor({ state: 'visible' })
      await page.waitForFunction(() => window.testExperience.multiplayer.me?.answers.length === 0)
      assert.equal(await page.evaluate(() => window.testExperience.multiplayer.me.score), 0)
    }
    await host.click('#start-button')
    await guest.locator('#hud').waitFor({ state: 'visible' })
    await guest.waitForFunction(() => document.querySelector('#museum-canvas').dataset.visitors === '1')
    assert.deepEqual(errors, [])
    console.log('PASS: free movement, optional story across zones, out-of-order questions, avatars, timers, host end, ms archive/export, rankings and next session')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
