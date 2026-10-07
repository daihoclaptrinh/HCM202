const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const bank = require('../src/data/quizBank.json')
const context = { exports: {}, require: () => ({ default: bank }) }
vm.createContext(context)
vm.runInContext(ts.transpileModule(fs.readFileSync('src/systems/GameRoom.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const { GameRoom } = context.exports
let now = 1000
const model = new GameRoom('HOST', () => now)
const members = Array.from({ length: 25 }, (_, index) => ({ id: `P${index}`, name: `Người ${index}`, avatar: index % 4, host: false, joinedAt: now }))
model.sync(members)
assert.equal(model.room.code, 'HCM202'); assert.equal(model.room.players.length, 25)
assert.equal(model.command('P0', { type: 'start' }), false)
assert.equal(model.command('HOST', { type: 'start' }), true)
assert.ok(model.room.players.every(player => player.status === 'playing'))
assert.equal(model.command('P0', { type: 'answer', index: 0, choice: 0 }), false)
for (let lesson = 0; lesson <= 6; lesson++) {
  assert.equal(model.command('P0', { type: 'listen', index: lesson }), true)
  if (lesson < 1 || lesson > 5) continue
  const player = model.room.players[0]
  const seconds = [20, 15, 10, 5, 5][lesson - 1]
  assert.equal(player.questionDeadline - now, seconds * 1000)
  for (let question = 0; question < 6; question++) {
    const index = (lesson - 1) * 6 + question, entry = bank[lesson - 1][question]
    if (index === 18) {
      now = player.questionDeadline; model.tick(); assert.equal(player.answers[index].timedOut, true)
    } else {
      if (entry.answer === 3) assert.equal(model.command('P0', { type: 'answer', index, choice: 3, text: '19xx' }), false)
      const text = entry.manualAnswer === '20' ? '0020' : ` ${entry.manualAnswer ?? ''} `
      assert.equal(model.command('P0', { type: 'answer', index, choice: index === 1 ? (entry.answer + 1) % 3 : entry.answer, text }), true)
    }
    assert.equal(model.command('P0', { type: 'answer', index, choice: entry.answer, text: entry.manualAnswer }), false)
  }
}
assert.equal(model.command('P0', { type: 'finish' }), true)
assert.equal(model.room.players[0].score, 2800)
assert.equal(model.room.players[0].answers.length, 30)
assert.ok(model.snapshot().players.every(player => player.answers.length === 0), 'Broadcast snapshots exclude answer records')
model.command('P1', { type: 'lose' })
assert.equal(model.command('P1', { type: 'listen', index: 0 }), false)
model.sync([...members, { id: 'LATE', name: 'Muộn', avatar: 0, host: false, joinedAt: now }])
assert.equal(model.room.players.some(player => player.id === 'LATE'), false)
model.sync(members.filter(member => member.id !== 'P2'))
assert.equal(model.room.players[2].status, 'lost')
console.log('PASS: fixed HCM202, host-only start, 25 players, 30 questions, numeric answers, per-stage timers, timeout, no duplicate scoring, disconnect and late admission')
