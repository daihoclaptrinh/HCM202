const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename)
const { GameRoom, rankPlayers, playerRank } = require('../src/systems/GameRoom.ts')
const { quizStations } = require('../src/data/quizStations.ts')
const bank = require('../src/data/quizBank.json')
let now = 1000
const model = new GameRoom('HOST', () => now)
const members = Array.from({ length: 25 }, (_, index) => ({ id: 'P' + index, name: 'Người ' + index, avatar: index % 4, host: false, joinedAt: now }))
model.sync(members)
assert.equal(model.room.players.length, 25)
assert.equal(model.command('P0', { type: 'start' }), false)
assert.equal(model.command('HOST', { type: 'start' }), true)
const player = model.room.players[0]
const move = (player, index) => { const station = quizStations[Math.floor(index / 6)]; player.position = { x: 0, z: station.z, yaw: 0 } }
const open = (player, index) => { move(player, index); assert.equal(model.command(player.id, { type: 'openQuestion', index }), true) }
const answer = (player, index, elapsedMs) => {
  const entry = bank[Math.floor(index / 6)][index % 6]
  now += elapsedMs
  assert.equal(model.command(player.id, { type: 'answer', index, choice: entry.answer, text: entry.manualAnswer, elapsedMs: 0, score: 99999 }), true)
}
assert.equal(model.command('P0', { type: 'openQuestion', index: 24 }), false, 'Must discover the station')
open(player, 24)
assert.equal(player.listened.length, 0, 'No listening prerequisite')
assert.equal(player.questionDeadline - now, 5000)
assert.equal(model.command('P0', { type: 'openQuestion', index: 25 }), false, 'One active question')
player.position.z = 8
answer(player, 24, 1235)
assert.equal(player.answers[0].elapsedMs, 1235)
assert.equal(player.correctTimeMs, 1235, 'Ignore client duration and score')
assert.equal(model.command('P0', { type: 'answer', index: 24, choice: 0 }), false)
move(player, 24)
assert.equal(model.command('P0', { type: 'openQuestion', index: 24 }), false)
const faster = model.room.players[1]
open(faster, 24); answer(faster, 24, 1234)
assert.equal(rankPlayers(model.room.players)[0].id, faster.id, '1 ms breaks equal scores')
assert.equal(playerRank(model.room.players, player), 2)
const tied = model.room.players[2]
open(tied, 24); answer(tied, 24, 1234)
assert.equal(playerRank(model.room.players, tied), 1, 'Equal score and time share rank')
open(player, 3)
assert.equal(model.command('P0', { type: 'answer', index: 3, choice: 3, text: '19xx' }), false)
answer(player, 3, 2000)
assert.equal(player.answers[1].index, 3, 'Questions can be chosen out of order')
assert.equal(player.correctTimeMs, 3235)
open(player, 18)
now = player.questionDeadline + 5000
model.tick()
assert.equal(player.answers[2].timedOut, true)
assert.equal(player.answers[2].elapsedMs, 5000)
assert.equal(player.activeQuestion, null)
assert.equal(player.questionDeadline, 0, 'Timeout does not open more questions')
assert.equal(player.correctTimeMs, 3235, 'Tie break sums correct answers only')
const all = model.room.players[3]
for (let index = 29; index >= 0; index--) { open(all, index); answer(all, index, 17) }
assert.equal(all.score, 3000)
assert.equal(all.correctTimeMs, 510)
assert.equal(all.status, 'playing', 'All questions done still permits exploring')
assert.ok(model.snapshot().players.every(player => player.answers.length === 0))
assert.equal(model.snapshot().players[3].answeredCount, 30)
assert.equal(model.command('P0', { type: 'end' }), false)
open(faster, 0)
assert.equal(model.command('HOST', { type: 'end' }), true)
const final = JSON.stringify(model.room)
now += 50000
assert.equal(model.command('P1', { type: 'answer', index: 0, choice: 0 }), false)
assert.equal(model.command('P1', { type: 'openQuestion', index: 1 }), false)
model.tick()
assert.equal(JSON.stringify(model.room), final, 'Results freeze when host ends')
assert.equal(model.room.players[1].answeredCount, 1, 'Unsubmitted question at end scores nothing')
const sessionId = model.room.sessionId
assert.equal(model.command('P0', { type: 'reset' }), false)
assert.equal(model.command('HOST', { type: 'reset' }), true)
assert.notEqual(model.room.sessionId, sessionId)
assert.ok(model.room.players.every(player => player.score === 0 && player.correctTimeMs === 0 && player.answers.length === 0 && player.status === 'waiting'))
model.command('HOST', { type: 'start' })
model.sync(members.filter(member => member.id !== 'P2'))
assert.equal(model.room.players[2].status, 'lost')
model.sync([...members, { id: 'LATE', name: 'Muộn', avatar: 0, host: false, joinedAt: now }])
assert.equal(model.room.players.some(player => player.id === 'LATE'), false)
console.log('PASS: free order, station proximity, optional listening, exact milliseconds, ties, 30 unique answers, timeout, host-only end/reset, frozen results and disconnects')
