import quizBank from '../data/quizBank.json'

export type AnswerResult = { choice: number; text?: string; correct: boolean; timedOut: boolean; explanation: string }
export type Member = { id: string; name: string; avatar: number; host: boolean; joinedAt: number }
export type Player = { id: string; name: string; avatar: number; questionDeadline: number; status: 'waiting' | 'playing' | 'lost' | 'finished'; score: number; answers: AnswerResult[]; listened: number; reason?: string; position: { x: number; z: number; yaw: number } }
export type Room = { code: 'HCM202'; hostId: string; phase: 'waiting' | 'playing'; serverTime: number; version: number; players: Player[] }
export const stageSeconds = [20, 15, 10, 5, 5]

// The /start browser coordinates the game; Supabase delivers its events to peers.
export class GameRoom {
  room: Room
  constructor(hostId: string, private now = () => Date.now()) {
    this.room = { code: 'HCM202', hostId, phase: 'waiting', serverTime: now(), version: 0, players: [] }
  }
  sync(members: Member[]) {
    let changed = false
    const connected = new Set(members.filter(member => !member.host).map(member => member.id))
    if (this.room.phase === 'waiting') {
      for (const member of members) {
        if (member.host || this.room.players.some(player => player.id === member.id)) continue
        this.room.players.push({ id: member.id, name: member.name, avatar: member.avatar, questionDeadline: 0, status: 'waiting', score: 0, answers: [], listened: -1, position: { x: 0, z: 8, yaw: 0 } }); changed = true
      }
      const count = this.room.players.length
      this.room.players = this.room.players.filter(player => connected.has(player.id)); changed ||= count !== this.room.players.length
    } else {
      for (const player of this.room.players) if (!connected.has(player.id) && player.status === 'playing') { this.lose(player, 'Mất kết nối với phòng chơi.'); changed = true }
    }
    if (changed) this.revise()
    return changed
  }
  private revise() { this.room.version++; this.room.serverTime = this.now() }
  private lose(player: Player, reason: string) { player.status = 'lost'; player.questionDeadline = 0; player.reason = reason }
  private arm(player: Player, at = this.now()) {
    const stage = Math.floor(player.answers.length / 6)
    player.questionDeadline = stage < 5 && player.listened === stage + 1 ? at + stageSeconds[stage] * 1000 : 0
  }
  private answer(player: Player, choice: number, text: string, at = this.now(), timeout = false) {
    if (!player.questionDeadline || player.status !== 'playing') return false
    const question = quizBank[Math.floor(player.answers.length / 6)][player.answers.length % 6]
    timeout ||= at >= player.questionDeadline
    if (!timeout && (!Number.isInteger(choice) || choice < 0 || choice > 3)) return false
    const normalized = text.trim()
    if (!timeout && choice === 3 && !/^\d{1,4}$/.test(normalized)) return false
    const correct = !timeout && (choice === 3 ? 'manualAnswer' in question && Number(normalized) === Number(question.manualAnswer) : choice === question.answer)
    player.answers.push({ choice: timeout ? -1 : choice, text: choice === 3 ? normalized : undefined, correct, timedOut: timeout, explanation: question.explanation })
    if (correct) player.score += 100
    this.arm(player, at); return true
  }
  command(id: string, message: Record<string, unknown>) {
    if (message.type === 'start') {
      if (id !== this.room.hostId || this.room.phase !== 'waiting' || !this.room.players.length) return false
      this.room.phase = 'playing'
      this.room.players.forEach((player, index) => { player.status = 'playing'; player.position.x = ((index % 3) - 1) * .75 })
      this.revise(); return true
    }
    const player = this.room.players.find(player => player.id === id)
    if (!player || player.status !== 'playing') return false
    if (message.type === 'lose') this.lose(player, 'Đã rời màn hình trò chơi.')
    else if (message.type === 'listen') {
      const index = Number(message.index)
      if (!Number.isInteger(index) || index !== player.listened + 1 || index > 6 || player.answers.length !== Math.max(0, index - 1) * 6) return false
      player.listened = index; this.arm(player)
    } else if (message.type === 'answer') {
      if (Number(message.index) !== player.answers.length || player.answers.length >= 30 || !this.answer(player, Number(message.choice), String(message.text ?? ''))) return false
    } else if (message.type === 'finish') {
      if (player.listened !== 6 || player.answers.length !== 30) return false
      player.status = 'finished'; player.questionDeadline = 0
    } else return false
    this.revise(); return true
  }
  tick() {
    const changed: string[] = [], now = this.now()
    for (const player of this.room.players) {
      while (player.status === 'playing' && player.questionDeadline && now >= player.questionDeadline) {
        this.answer(player, -1, '', player.questionDeadline, true)
        if (!changed.includes(player.id)) changed.push(player.id)
      }
    }
    if (changed.length) this.revise()
    return changed
  }
  snapshot(): Room {
    return { ...this.room, serverTime: this.now(), players: this.room.players.map(player => ({ ...player, answers: [], position: { ...player.position } })) }
  }
}
