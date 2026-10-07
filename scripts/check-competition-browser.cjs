const { chromium } = require('playwright-core')
const assert = require('node:assert/strict')
const path = require('node:path')
const bank = require('../src/data/quizBank.json')
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe') })
  try {
    const base = process.env.GAME_URL || 'http://127.0.0.1:5173'
    const fixtureMembers = new Map()
    const errors = []
    async function open(route) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      if (process.env.MOCK_REALTIME === '1') await require('./realtime-fixture.cjs')(context, fixtureMembers)
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => { const Native = window.Audio; window.testAudio = []; window.Audio = class extends Native { constructor(...args) { super(...args); window.testAudio.push(this) } } })
      await page.goto(base + route)
      return page
    }
    const host = await open('/start')
    await host.locator('#start-button').waitFor({ state: 'visible', timeout: 60000 })
    await host.waitForFunction(() => document.querySelector('#host-status').textContent.includes('0 người'), undefined, { timeout: 20000 })
    assert.equal(await host.locator('#host-entry button').count(), 1)
    assert.equal(await host.locator('#join-room').isVisible(), false)
    const guest = await open('/play'), peer = await open('/play')
    for (const [page, name] of [[guest, 'Người A'], [peer, 'Người B']]) {
      await page.locator('#join-room').waitFor({ state: 'visible', timeout: 60000 })
      assert.equal(await page.locator('#room-code, #player-mode, #guided-button').count(), 0)
      assert.equal(await page.locator('#start-button').isVisible(), false)
      await page.fill('#player-name', name); await page.click('#join-room')
      try { await page.waitForFunction(() => document.querySelector('#room-message').textContent.includes('Đã vào phòng HCM202'), undefined, { timeout: 20000 }) }
      catch (error) { console.log('Lobby diagnostic:', await page.locator('#room-message').textContent(), errors); throw error }
      assert.equal(await page.locator('#hud').isVisible(), false)
    }
    await host.waitForFunction(() => document.querySelector('#host-roster').textContent.includes('Người B'))
    await host.screenshot({ path: 'review-room-lobby.png' })
    await host.click('#start-button')
    for (const page of [guest, peer]) {
      await page.locator('#hud').waitFor({ state: 'visible' })
      await page.waitForFunction(() => document.querySelector('#museum-canvas').dataset.visitors === '1')
      assert.equal(await page.locator('#guided-controls').isVisible(), false)
    }
    async function listen(suffix) {
      await guest.waitForFunction(suffix => window.testAudio.some(audio => audio.src.endsWith(suffix) && !audio.paused), suffix, { timeout: 30000 })
      await guest.evaluate(suffix => { const audio = window.testAudio.find(audio => audio.src.endsWith(suffix)); audio.playbackRate = 16; audio.currentTime = audio.duration - .5 }, suffix)
    }
    await listen('/00-introduction.mp3')
    await listen('/01-before-1911.mp3')
    await guest.locator('#stage-quiz').waitFor({ state: 'visible' })
    assert.equal(await guest.locator('.stage-question').count(), 1)
    const protection = await guest.evaluate(() => {
      const question = document.querySelector('.stage-question p'), selection = window.getSelection(), range = document.createRange()
      range.selectNodeContents(question); selection.removeAllRanges(); selection.addRange(range)
      const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })
      const keyboard = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true })
      const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      const drag = new Event('dragstart', { bubbles: true, cancelable: true })
      document.body.dispatchEvent(copy); document.body.dispatchEvent(keyboard); question.dispatchEvent(contextMenu); question.dispatchEvent(drag)
      selection.removeAllRanges()
      return { copy: copy.defaultPrevented, keyboard: keyboard.defaultPrevented, contextMenu: contextMenu.defaultPrevented, drag: drag.defaultPrevented, selection: getComputedStyle(question).userSelect }
    })
    assert.deepEqual(protection, { copy: true, keyboard: true, contextMenu: true, drag: true, selection: 'none' })
    for (let index = 0; index < 6; index++) {
      await guest.waitForFunction(index => Number(document.querySelector('#stage-quiz').dataset.index) === index, index)
      assert.match(await guest.locator('#quiz-timer').innerText(), /giây/)
      if (bank[0][index].answer === 3) {
        await guest.click('#answer-other'); await guest.fill('#manual-answer', bank[0][index].manualAnswer)
        assert.equal(await guest.locator('#manual-answer').evaluate(input => { const copy = new ClipboardEvent('copy', { bubbles: true, cancelable: true }); input.dispatchEvent(copy); return copy.defaultPrevented }), false)
      }
      else await guest.locator(`input[name="stage-answer"][value="${bank[0][index].answer}"]`).check()
      await guest.click('#submit-stage')
    }
    await guest.waitForFunction(() => document.querySelector('#my-score').textContent.includes('600'))
    await host.waitForFunction(() => document.querySelector('#score-players').textContent.includes('600'))
    await peer.waitForFunction(() => document.querySelector('#score-players').textContent.includes('600'))
    await guest.screenshot({ path: 'review-stage-quiz.png' })
    await guest.evaluate(() => { window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('fullscreenchange')) })
    assert.equal(await guest.locator('#result-screen').isVisible(), false)
    assert.deepEqual(errors, [])
    console.log(`PASS (${process.env.MOCK_REALTIME === '1' ? 'test transport' : 'real Supabase'}): host starts all, automatic audio, timed questions, blocked question copy/selection/context menu/drag, editable manual answers, named scores and no screen-exit penalty`)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
