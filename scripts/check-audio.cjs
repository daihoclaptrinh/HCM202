const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const frames = new Map(); let nextFrame = 0
class FakeAudio {
  volume = 1; currentTime = 0; muted = false; ended = false
  pause() { this.paused = true }
  async play() { this.paused = false }
}
const context = { exports: {}, HTMLAudioElement: FakeAudio, document: { addEventListener() {} }, performance, requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame }, cancelAnimationFrame(id) { frames.delete(id) } }
vm.createContext(context)
const source = fs.readFileSync('src/systems/AudioManager.ts', 'utf8').replaceAll('import.meta.env.BASE_URL', "'/'")
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
;(async () => {
  const manager = new context.exports.AudioManager()
  manager.narration.element = new FakeAudio()
  const pending = manager.fade(manager.narration, 0, 1000)
  manager.cancelFade(manager.narration)
  await Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('Cancelled fade did not settle')), 200))])
  assert.equal(frames.size, 0)
  manager.narration.element = new FakeAudio(); manager.state = 'playing'
  const fadeOut = manager.fadeOutNarration(1000)
  manager.reset(); await fadeOut
  assert.equal(manager.snapshot.state, 'idle')
  assert.equal(manager.snapshot.path, undefined)
  const track = new FakeAudio(); track.volume = 0
  manager.availability.set('/test.wav', track); manager.narration = { element: track, path: '/test.wav' }; manager.state = 'loading'
  manager.pauseNarration(); assert.equal(manager.snapshot.state, 'paused'); assert.equal(track.paused, true)
  await manager.toggleNarration(); assert.equal(manager.snapshot.state, 'playing'); assert.equal(track.volume, 1)
  manager.bindNarrationEvents(track)
  assert.equal(manager.hasCompleted('/test.wav'), false)
  manager.pauseNarration(); assert.equal(manager.hasCompleted('/test.wav'), false)
  track.ended = true; track.onended()
  assert.equal(manager.hasCompleted('/test.wav'), true)
  manager.reset(); assert.equal(manager.hasCompleted('/test.wav'), false)
  console.log('PASS: cancelled fade settles; reset blocks stale completion; pause during loading resumes with audible volume')
})().catch(error => { console.error(error); process.exitCode = 1 })
