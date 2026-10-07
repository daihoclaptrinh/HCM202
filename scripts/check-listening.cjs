const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
function evaluate(file, imports = {}) {
  const context = { exports: {}, require: name => imports[name] ?? {} }
  vm.createContext(context)
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const data = evaluate('src/data/chapters.ts')
const config = evaluate('src/data/museumConfig.ts')
const { Experience } = evaluate('src/core/Experience.ts', { '../data/chapters': data, '../data/museumConfig': config })
const finished = new Set()
let preview, selected, advanced = 0
const experience = Object.create(Experience.prototype)
Object.assign(experience, {
  camera: { position: { x: 0, y: 1.68, z: 8 } }, controls: { movementLocked: false }, lessonIndex: -1, guided: false,
  multiplayer: { me: { listened: -1, answers: [] }, send() {} },
  audio: { hasCompleted: path => finished.has(path), selectNarration: path => selected = path, stopNarration() {}, fadeOutNarration: () => Promise.resolve() },
  ui: { setNarrationControl() {}, showLesson: (...args) => preview = args, setTourNextEnabled() {}, markListened() {}, showStageQuiz() {}, setLessonInstruction() {} }
})
experience.updateNarrationZone()
assert.equal(experience.controls.movementLocked, true)
assert.equal(selected, data.audioAssets.narration[0])
assert.equal(preview[1], false)
// Stopping, pausing or failing to load cannot add a completion record.
experience.audio.stopNarration(); experience.refreshLesson()
assert.equal(experience.controls.movementLocked, true)
finished.add(selected); experience.refreshLesson()
assert.equal(experience.controls.movementLocked, true, 'Must wait for server acknowledgement')
experience.multiplayer.me.listened = 0; experience.refreshLesson()
assert.equal(experience.controls.movementLocked, false)
assert.equal(preview[1], true)
assert.equal(preview[2][0].id, 'que-huong')
// Even an overshoot is clamped back to the next mandatory listening point.
experience.camera.position.z = -12
experience.updateNarrationZone()
assert.equal(experience.camera.position.z, -6)
assert.equal(experience.controls.movementLocked, true)
assert.equal(selected, data.audioAssets.narration[1])
Object.assign(experience, { guided: true, tourPaused: false, guidedPhase: 'waiting', guidedIndex: 0, guidedSteps: [{ narration: selected }], advanceGuidedStep: () => advanced++ })
experience.ui.panelOpen = false
experience.nextGuidedStep(); assert.equal(advanced, 0)
finished.add(selected); experience.multiplayer.me.listened = 1
experience.nextGuidedStep(); assert.equal(advanced, 0, 'Quiz must also be completed')
experience.multiplayer.me.answers = [{}, {}, {}, {}, {}, {}]
experience.nextGuidedStep(); assert.equal(advanced, 1)
console.log('PASS: listening gate, server acknowledgement, six answers required, overshoot clamp, guided Next requires completion')
