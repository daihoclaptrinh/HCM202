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
let selected, stopped = 0, advanced = 0
const button = {}
const snapshot = { path: data.audioAssets.narration[0], state: 'playing' }
const experience = Object.create(Experience.prototype)
Object.assign(experience, {
  camera: { position: { x: 0, y: 1.68, z: 8 } }, controls: { movementLocked: true }, lessonIndex: -1, guided: false, gameActive: true,
  audio: { snapshot, hasCompleted: path => finished.has(path), selectNarration: path => selected = path, stopNarration() { stopped++ }, fadeOutNarration: () => Promise.resolve() },
  ui: { q: () => button, setNarrationControl() {}, showLesson() {}, hideLesson() {}, setTourNextEnabled() {}, markListened() {}, setLessonInstruction() {} }
})
experience.updateNarrationZone()
assert.equal(experience.controls.movementLocked, false)
assert.equal(stopped, 0)
// Skip four areas without finishing audio or answering any questions.
experience.camera.position.z = -50
experience.updateNarrationZone()
assert.equal(experience.camera.position.z, -50)
assert.equal(experience.lessonIndex, 5)
assert.equal(experience.controls.movementLocked, false)
assert.equal(stopped, 0, 'Playing story continues when moving to another area')
assert.equal(selected, undefined, 'Zone change must not replace the selected story')
experience.camera.position.z = -8
experience.updateNarrationZone()
assert.equal(experience.lessonIndex, 1)
assert.equal(experience.controls.movementLocked, false)
Object.assign(experience, { sightseeing: true, gameActive: false, guided: true, tourPaused: false, guidedPhase: 'waiting', guidedIndex: 0, guidedSteps: [{ narration: data.audioAssets.narration[1] }], advanceGuidedStep: () => advanced++ })
experience.ui.panelOpen = false
experience.nextGuidedStep()
assert.equal(advanced, 1, 'Guided visitors can still skip optional narration')
console.log('PASS: free movement without listening gates, arbitrary areas, uninterrupted story and optional guided narration')
