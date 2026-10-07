import quizBank from '../data/quizBank.json'
import { quizStations, stationRadius } from '../data/quizStations'

export type AnswerResult = { index: number; choice: number; text?: string; correct: boolean; timedOut: boolean; abandoned: boolean; explanation: string; openedAt: number; answeredAt: number; elapsedMs: number }
export type Member = { id: string; name: string; avatar: number; host: boolean; joinedAt: number; connectionId?: string; sessionId?: string }
export type Player = { id: string; name: string; avatar: number; activeQuestion: number | null; questionOpenedAt: number; questionDeadline: number; status: 'waiting' | 'playing' | 'reconnecting' | 'lost' | 'finished'; connected: boolean; reconnectUntil: number; score: number; correctTimeMs: number; answeredCount: number; answers: AnswerResult[]; listened: number[]; reason?: string; position: { x: number; z: number; yaw: number } }
export type Room = { code: 'HCM202'; sessionId: string; hostId: string; phase: 'waiting' | 'playing' | 'ended'; startedAt: number; endedAt: number; serverTime: number; version: number; players: Player[] }
export const stageSeconds = [20, 15, 10, 5, 5]
export const reconnectGraceMs = 5 * 60 * 1000
export function rankPlayers(players: Player[]) {
  return [...players].sort((a, b) => b.score - a.score || a.correctTimeMs - b.correctTimeMs || a.id.localeCompare(b.id))
}
export function playerRank(players: Player[], player: Player) {
  return 1 + players.filter(other => other.score > player.score || other.score === player.score && other.correctTimeMs < player.correctTimeMs).length
}
export function waitingPlayer(member: Member): Player {
  return { id: member.id, name: member.name, avatar: member.avatar, activeQuestion: null, questionOpenedAt: 0, questionDeadline: 0, status: 'waiting', connected: true, reconnectUntil: 0, score: 0, correctTimeMs: 0, answeredCount: 0, answers: [], listened: [], position: { x: 0, z: 8, yaw: 0 } }
}

// The host clock records every attempt; clients cannot submit scores or durations.
export class GameRoom {
  room: Room
  private connections = new Map<string, string>()
  constructor(hostId: string, private now = () => Math.round(performance.timeOrigin + performance.now())) {
    this.room = { code: 'HCM202', sessionId: hostId + '-' + now(), hostId, phase: 'waiting', startedAt: 0, endedAt: 0, serverTime: now(), version: 0, players: [] }
  }
  sync(members: Member[]) {
    let changed = false
    const latest = new Map<string, Member>()
    for (const member of members.filter(member => !member.host).sort((a, b) => a.joinedAt - b.joinedAt)) latest.set(member.id, member)
    if (this.room.phase === 'waiting') {
      for (const member of latest.values()) {
        if (!this.room.players.some(player => player.id === member.id)) { this.room.players.push(waitingPlayer(member)); changed = true }
      }
    }
    if (this.room.phase !== 'ended') for (const player of this.room.players) {
      const member = latest.get(player.id)
      const connection = member?.connectionId ?? member?.id
      const eligible = !!member && (this.room.phase === 'waiting' || member.sessionId === this.room.sessionId || this.connections.get(player.id) === connection || !member.connectionId)
      if (eligible) {
        if (player.status === 'reconnecting' && this.now() >= player.reconnectUntil) { this.lose(player, 'Đã quá 5 phút nối lại. Chờ quản trò mở phiên mới.'); changed = true }
        if (player.status === 'lost') continue
        if (this.connections.get(player.id) !== connection && player.activeQuestion !== null) { this.answer(player, -1, '', this.now(), false, true); changed = true }
        this.connections.set(player.id, connection!)
        if (!player.connected || player.status === 'reconnecting') { player.connected = true; player.reconnectUntil = 0; if (this.room.phase === 'playing') player.status = 'playing'; changed = true }
      } else if (player.connected) {
        if (player.activeQuestion !== null) this.answer(player, -1, '', this.now(), false, true)
        player.connected = false; player.reconnectUntil = this.now() + reconnectGraceMs
        if (player.status === 'playing') player.status = 'reconnecting'
        changed = true
      }
    }
    if (changed) this.revise()
    return changed
  }
  private revise() { this.room.version++; this.room.serverTime = this.now() }
  isCurrentConnection(id: string, connectionId: string) { return this.connections.get(id) === connectionId && this.room.players.some(player => player.id === id && player.connected) }
  private lose(player: Player, reason: string) {
    if (player.activeQuestion !== null) this.answer(player, -1, '', this.now(), false, true)
    player.status = 'lost'; player.activeQuestion = null; player.questionDeadline = 0; player.reason = reason
  }
  private answer(player: Player, choice: number, text: string, at = this.now(), timeout = false, abandoned = false) {
    if (player.activeQuestion === null || player.status !== 'playing') return false
    const index = player.activeQuestion, question = quizBank[Math.floor(index / 6)][index % 6]
    timeout ||= at >= player.questionDeadline
    if (!timeout && !abandoned && (!Number.isInteger(choice) || choice < 0 || choice > 3)) return false
    const normalized = text.trim()
    if (!timeout && !abandoned && choice === 3 && !/^\d{1,4}$/.test(normalized)) return false
    const correct = !timeout && !abandoned && (choice === 3 ? 'manualAnswer' in question && Number(normalized) === Number(question.manualAnswer) : choice === question.answer)
    const answeredAt = timeout ? player.questionDeadline : at
    const elapsedMs = Math.max(0, Math.round(answeredAt - player.questionOpenedAt))
    player.answers.push({ index, choice: timeout || abandoned ? -1 : choice, text: choice === 3 ? normalized : undefined, correct, timedOut: timeout, abandoned, explanation: question.explanation, openedAt: player.questionOpenedAt, answeredAt, elapsedMs })
    player.answeredCount = player.answers.length
    if (correct) { player.score += 100; player.correctTimeMs += elapsedMs }
    player.activeQuestion = null; player.questionDeadline = 0; player.questionOpenedAt = 0
    return true
  }
  command(id: string, message: Record<string, unknown>) {
    if (message.type === 'start') {
      if (id !== this.room.hostId || this.room.phase !== 'waiting' || !this.room.players.some(player => player.connected)) return false
      this.room.phase = 'playing'; this.room.startedAt = this.now()
      this.room.players.forEach((player, index) => { player.status = player.connected ? 'playing' : 'reconnecting'; player.position = { x: ((index % 3) - 1) * .9, z: 8 - Math.floor(index / 3) * .65, yaw: 0 } })
      this.revise(); return true
    }
    if (message.type === 'end') {
      if (id !== this.room.hostId || this.room.phase !== 'playing') return false
      this.tick()
      this.room.phase = 'ended'; this.room.endedAt = this.now()
      for (const player of this.room.players) {
        if (player.status === 'playing' || player.status === 'reconnecting') player.status = 'finished'
        player.activeQuestion = null; player.questionDeadline = 0; player.questionOpenedAt = 0
      }
      this.revise(); return true
    }
    if (message.type === 'reset') {
      if (id !== this.room.hostId || this.room.phase !== 'ended') return false
      this.room.phase = 'waiting'; this.room.startedAt = 0; this.room.endedAt = 0
      this.room.sessionId = this.room.hostId + '-' + this.now() + '-' + (this.room.version + 1)
      this.room.players = this.room.players.map(player => waitingPlayer({ ...player, host: false, joinedAt: this.now() }))
      this.connections.clear()
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
      const firstUnanswered = quizBank[station.stage].findIndex((_question, question) => !player.answers.some(answer => answer.index === station.stage * 6 + question))
      if (!player.listened.includes(station.stage + 1) || index !== station.stage * 6 + firstUnanswered) return false
      if (Math.hypot(player.position.x - station.x, player.position.z - station.z) > stationRadius) return false
      player.activeQuestion = index; player.questionOpenedAt = this.now()
      player.questionDeadline = player.questionOpenedAt + stageSeconds[Math.floor(index / 6)] * 1000
    } else if (message.type === 'answer') {
      if (Number(message.index) !== player.activeQuestion || !this.answer(player, Number(message.choice), String(message.text ?? ''))) return false
    } else if (message.type === 'forfeitQuestion') {
      if (Number(message.index) !== player.activeQuestion || !this.answer(player, -1, '', this.now(), false, true)) return false
    } else return false
    this.revise(); return true
  }
  tick() {
    const changed: string[] = [], now = this.now()
    if (this.room.phase !== 'playing') return changed
    for (const player of this.room.players) {
      if (player.status === 'reconnecting' && now >= player.reconnectUntil) {
        this.lose(player, 'Đã quá 5 phút nối lại. Chờ quản trò mở phiên mới.'); changed.push(player.id)
      }
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
