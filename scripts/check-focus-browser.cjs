const { chromium } = require('playwright-core')
const assert = require('node:assert/strict')
const path = require('node:path')
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe') })
  try {
    const base = process.env.GAME_URL || 'http://127.0.0.1:5173', members = new Map()
    async function open(route) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      if (process.env.MOCK_REALTIME === '1') await require('./realtime-fixture.cjs')(context, members)
      const page = await context.newPage(); await page.goto(base + route); return page
    }
    const host = await open('/start')
    await host.locator('#start-button').waitFor({ state: 'visible', timeout: 60000 })
    await host.waitForFunction(() => document.querySelector('#host-status').textContent.includes('0 người'))
    const page = await open('/play')
    await page.locator('#join-room').waitFor({ state: 'visible', timeout: 60000 })
    await page.fill('#player-name', 'Thử chuyển tab'); await page.click('#join-room')
    await page.waitForFunction(() => document.querySelector('#room-message').textContent.includes('Đã vào phòng HCM202'))
    await host.click('#start-button'); await page.locator('#hud').waitFor({ state: 'visible' })
    await page.click('#transcript-button'); assert.equal(await page.locator('#result-screen').isVisible(), false)
    await page.locator('#transcript .close').click()
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false)
    // Headless Chrome emulates focused pages. Exercise the desktop events.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('fullscreenchange')) })
    await page.waitForTimeout(400)
    assert.equal(await page.locator('#result-screen').isVisible(), false)
    await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }))
    await page.waitForTimeout(400)
    assert.equal(await page.locator('#result-screen').isVisible(), false)
    assert.equal(await page.locator('#hud').isVisible(), true)
    console.log('PASS: no fullscreen required, switching tabs/window focus and leaving fullscreen do not lose or end the game')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
