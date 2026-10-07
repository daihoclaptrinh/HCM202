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
const listen = (player, stage) => assert.equal(model.command(player.id, { type: 'listen', index: stage + 1 }), true)
const open = (player, index) => { move(player, index); assert.equal(model.command(player.id, { type: 'openQuestion', index }), true) }
const answer = (player, index, elapsedMs) => {
  const entry = bank[Math.floor(index / 6)][index % 6]
  now += elapsedMs
  assert.equal(model.command(player.id, { type: 'answer', index, choice: entry.answer, text: entry.manualAnswer, elapsedMs: 0, score: 99999 }), true)
}
move(player, 24)
assert.equal(model.command('P0', { type: 'openQuestion', index: 24 }), false, 'Listening is required')
listen(player, 4)
assert.equal(model.command('P0', { type: 'openQuestion', index: 25 }), false, 'Cannot skip first question')
player.position.z = 8
assert.equal(model.command('P0', { type: 'openQuestion', index: 24 }), false, 'Must discover the station')
open(player, 24)
assert.equal(player.questionDeadline - now, 5000)
assert.equal(model.command('P0', { type: 'openQuestion', index: 25 }), false, 'One active question')
answer(player, 24, 1235)
assert.equal(player.answers[0].elapsedMs, 1235)
assert.equal(player.correctTimeMs, 1235, 'Ignore client duration and score')
assert.equal(model.command('P0', { type: 'answer', index: 24, choice: 0 }), false)
assert.equal(model.command('P0', { type: 'openQuestion', index: 24 }), false)
const faster = model.room.players[1]
listen(faster, 4); open(faster, 24); answer(faster, 24, 1234)
assert.equal(rankPlayers(model.room.players)[0].id, faster.id, '1 ms breaks equal scores')
assert.equal(playerRank(model.room.players, player), 2)
const tied = model.room.players[2]
listen(tied, 4); open(tied, 24); answer(tied, 24, 1234)
assert.equal(playerRank(model.room.players, tied), 1)
listen(player, 0)
move(player, 3)
assert.equal(model.command('P0', { type: 'openQuestion', index: 3 }), false, 'Manual question also requires predecessors')
open(player, 0); now += 234
assert.equal(model.command('P0', { type: 'forfeitQuestion', index: 0 }), true)
assert.equal(player.answers[1].correct, false)
assert.equal(player.answers[1].abandoned, true)
assert.equal(player.answers[1].timedOut, false)
assert.equal(player.answers[1].elapsedMs, 234)
assert.equal(player.status, 'playing', 'Losing focus forfeits just this question')
assert.equal(model.command('P0', { type: 'forfeitQuestion', index: 0 }), false, 'Duplicate focus events do not score twice')
open(player, 1)
assert.equal(model.command('P0', { type: 'forfeitQuestion', index: 0 }), false, 'Delayed event cannot forfeit the next question')
answer(player, 1, 2000)
assert.equal(player.correctTimeMs, 3235)
open(player, 2); now = player.questionDeadline + 5000; model.tick()
assert.equal(player.answers[3].timedOut, true)
assert.equal(player.answers[3].elapsedMs, 20000)
assert.equal(player.activeQuestion, null)
assert.equal(player.correctTimeMs, 3235)
open(player, 3)
assert.equal(model.command('P0', { type: 'answer', index: 3, choice: 3, text: '19xx' }), false)
answer(player, 3, 17)
assert.equal(player.score, 300)
const all = model.room.players[3]
for (const stage of [4, 0, 3, 1, 2]) {
  listen(all, stage)
  for (let question = 0; question < 6; question++) { const index = stage * 6 + question; open(all, index); answer(all, index, 17) }
}
assert.equal(all.score, 3000)
assert.equal(all.correctTimeMs, 510)
assert.equal(all.status, 'playing')
assert.ok(model.snapshot().players.every(player => player.answers.length === 0))
assert.equal(model.snapshot().players[3].answeredCount, 30)
assert.equal(model.command('P0', { type: 'end' }), false)
open(faster, 25)
assert.equal(model.command('HOST', { type: 'end' }), true)
const final = JSON.stringify(model.room); now += 50000
assert.equal(model.command('P1', { type: 'answer', index: 25, choice: 0 }), false)
model.tick(); assert.equal(JSON.stringify(model.room), final)
assert.equal(model.room.players[1].answeredCount, 1)
const sessionId = model.room.sessionId
assert.equal(model.command('P0', { type: 'reset' }), false)
assert.equal(model.command('HOST', { type: 'reset' }), true)
assert.notEqual(model.room.sessionId, sessionId)
assert.ok(model.room.players.every(player => player.score === 0 && player.correctTimeMs === 0 && player.answers.length === 0 && player.listened.length === 0 && player.status === 'waiting'))
model.command('HOST', { type: 'start' })
const disconnected = model.room.players[2]
listen(disconnected, 0); open(disconnected, 0)
model.sync(members.filter(member => member.id !== 'P2'))
assert.equal(disconnected.status, 'lost')
assert.equal(disconnected.answers[0].abandoned, true, 'Disconnect records the open question as wrong')
console.log('PASS: listening prerequisites, sequential questions, ms rankings, one-question focus penalties, duplicates, timeout, host end/reset and disconnect')
