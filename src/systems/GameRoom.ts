import quizBank from '../data/quizBank.json'
import { quizStations, stationRadius } from '../data/quizStations'

export type AnswerResult = { index: number; choice: number; text?: string; correct: boolean; timedOut: boolean; explanation: string; openedAt: number; answeredAt: number; elapsedMs: number }
export type Member = { id: string; name: string; avatar: number; host: boolean; joinedAt: number }
export type Player = { id: string; name: string; avatar: number; activeQuestion: number | null; questionOpenedAt: number; questionDeadline: number; status: 'waiting' | 'playing' | 'lost' | 'finished'; score: number; correctTimeMs: number; answeredCount: number; answers: AnswerResult[]; listened: number[]; reason?: string; position: { x: number; z: number; yaw: number } }
export type Room = { code: 'HCM202'; sessionId: string; hostId: string; phase: 'waiting' | 'playing' | 'ended'; startedAt: number; endedAt: number; serverTime: number; version: number; players: Player[] }
export const stageSeconds = [20, 15, 10, 5, 5]
export function rankPlayers(players: Player[]) {
  return [...players].sort((a, b) => b.score - a.score || a.correctTimeMs - b.correctTimeMs || a.id.localeCompare(b.id))
}
export function playerRank(players: Player[], player: Player) {
  return 1 + players.filter(other => other.score > player.score || other.score === player.score && other.correctTimeMs < player.correctTimeMs).length
}
export function waitingPlayer(member: Member): Player {
  return { id: member.id, name: member.name, avatar: member.avatar, activeQuestion: null, questionOpenedAt: 0, questionDeadline: 0, status: 'waiting', score: 0, correctTimeMs: 0, answeredCount: 0, answers: [], listened: [], position: { x: 0, z: 8, yaw: 0 } }
}

// The host clock records every attempt; clients cannot submit scores or durations.
export class GameRoom {
  room: Room
  constructor(hostId: string, private now = () => Math.round(performance.timeOrigin + performance.now())) {
    this.room = { code: 'HCM202', sessionId: hostId + '-' + now(), hostId, phase: 'waiting', startedAt: 0, endedAt: 0, serverTime: now(), version: 0, players: [] }
  }
  sync(members: Member[]) {
    let changed = false
    const connected = new Set(members.filter(member => !member.host).map(member => member.id))
    if (this.room.phase === 'waiting') {
      for (const member of members) {
        if (member.host || this.room.players.some(player => player.id === member.id)) continue
        this.room.players.push(waitingPlayer(member)); changed = true
      }
      const count = this.room.players.length
      this.room.players = this.room.players.filter(player => connected.has(player.id)); changed ||= count !== this.room.players.length
    } else if (this.room.phase === 'playing') {
      for (const player of this.room.players) if (!connected.has(player.id) && player.status === 'playing') { this.lose(player, 'Mất kết nối với phòng chơi.'); changed = true }
    }
    if (changed) this.revise()
    return changed
  }
  private revise() { this.room.version++; this.room.serverTime = this.now() }
  private lose(player: Player, reason: string) { player.status = 'lost'; player.activeQuestion = null; player.questionDeadline = 0; player.reason = reason }
  private answer(player: Player, choice: number, text: string, at = this.now(), timeout = false) {
    if (player.activeQuestion === null || player.status !== 'playing') return false
    const index = player.activeQuestion, question = quizBank[Math.floor(index / 6)][index % 6]
    timeout ||= at >= player.questionDeadline
    if (!timeout && (!Number.isInteger(choice) || choice < 0 || choice > 3)) return false
    const normalized = text.trim()
    if (!timeout && choice === 3 && !/^\d{1,4}$/.test(normalized)) return false
    const correct = !timeout && (choice === 3 ? 'manualAnswer' in question && Number(normalized) === Number(question.manualAnswer) : choice === question.answer)
    const answeredAt = timeout ? player.questionDeadline : at
    const elapsedMs = Math.max(0, Math.round(answeredAt - player.questionOpenedAt))
    player.answers.push({ index, choice: timeout ? -1 : choice, text: choice === 3 ? normalized : undefined, correct, timedOut: timeout, explanation: question.explanation, openedAt: player.questionOpenedAt, answeredAt, elapsedMs })
    player.answeredCount = player.answers.length
    if (correct) { player.score += 100; player.correctTimeMs += elapsedMs }
    player.activeQuestion = null; player.questionDeadline = 0; player.questionOpenedAt = 0
    return true
  }
  command(id: string, message: Record<string, unknown>) {
    if (message.type === 'start') {
      if (id !== this.room.hostId || this.room.phase !== 'waiting' || !this.room.players.length) return false
      this.room.phase = 'playing'; this.room.startedAt = this.now()
      this.room.players.forEach((player, index) => { player.status = 'playing'; player.position = { x: ((index % 3) - 1) * .9, z: 8 - Math.floor(index / 3) * .65, yaw: 0 } })
      this.revise(); return true
    }
    if (message.type === 'end') {
      if (id !== this.room.hostId || this.room.phase !== 'playing') return false
      this.tick()
      this.room.phase = 'ended'; this.room.endedAt = this.now()
      for (const player of this.room.players) {
        if (player.status === 'playing') player.status = 'finished'
        player.activeQuestion = null; player.questionDeadline = 0; player.questionOpenedAt = 0
      }
      this.revise(); return true
    }
    if (message.type === 'reset') {
      if (id !== this.room.hostId || this.room.phase !== 'ended') return false
      this.room.phase = 'waiting'; this.room.startedAt = 0; this.room.endedAt = 0
      this.room.sessionId = this.room.hostId + '-' + this.now() + '-' + (this.room.version + 1)
      this.room.players = this.room.players.map(player => waitingPlayer({ ...player, host: false, joinedAt: this.now() }))
      this.revise(); return true
    }
    if (this.room.phase !== 'playing') return false
    const player = this.room.players.find(player => player.id === id)
    if (!player || player.status !== 'playing') return false
    if (message.type === 'lose') this.lose(player, 'Đã rời phiên chơi.')
    else if (message.type === 'listen') {
      const index = Number(message.index)
      if (!Number.isInteger(index) || index < 0 || index > 6 || player.listened.includes(index)) return false
      player.listened.push(index)
    } else if (message.type === 'openQuestion') {
      const index = Number(message.index)
      if (!Number.isInteger(index) || index < 0 || index >= 30 || player.activeQuestion !== null || player.answers.some(answer => answer.index === index)) return false
      const station = quizStations[Math.floor(index / 6)]
      if (Math.hypot(player.position.x - station.x, player.position.z - station.z) > stationRadius) return false
      player.activeQuestion = index; player.questionOpenedAt = this.now()
      player.questionDeadline = player.questionOpenedAt + stageSeconds[Math.floor(index / 6)] * 1000
    } else if (message.type === 'answer') {
      if (Number(message.index) !== player.activeQuestion || !this.answer(player, Number(message.choice), String(message.text ?? ''))) return false
    } else return false
    this.revise(); return true
  }
  tick() {
    const changed: string[] = [], now = this.now()
    if (this.room.phase !== 'playing') return changed
    for (const player of this.room.players) {
      if (player.status === 'playing' && player.questionDeadline && now >= player.questionDeadline) {
        this.answer(player, -1, '', player.questionDeadline, true); changed.push(player.id)
      }
    }
    if (changed.length) this.revise()
    return changed
  }
  snapshot(): Room {
    return { ...this.room, serverTime: this.now(), players: this.room.players.map(player => ({ ...player, answers: [], listened: [...player.listened], position: { ...player.position } })) }
  }
}
