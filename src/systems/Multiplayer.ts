import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { GameRoom, rankPlayers, playerRank, waitingPlayer, type Member, type Player, type Room } from './GameRoom'
import { getSupabase } from './Supabase'
export type { AnswerResult, Player, Room } from './GameRoom'

export class Multiplayer {
  private channel?: RealtimeChannel
  private client?: SupabaseClient
  id = ''
  room?: Room
  private timeOffset = 0
  private subscribed = false
  private members: Member[] = []
  private model?: GameRoom
  private timer?: number
  private self?: Player
  private positionSignature = ''
  private generation = 0
  constructor(private changed: (room: Room) => void, private disconnected: () => void, private error: (message: string) => void) {}
  get serverNow() { return Date.now() + this.timeOffset }
  get isHost() { return this.room?.hostId === this.id }
  get me() { return this.room?.players.find(player => player.id === this.id) }
  get connected() { return this.subscribed }
  joinHost() { return this.connect('Chủ phòng', 0, true) }
  join(name: string, avatar: number) { return this.connect(name.trim(), avatar, false) }
  private async connect(name: string, avatar: number, host: boolean) {
    if (!name) throw new Error('Nhập tên người chơi.')
    this.leave()
    const generation = this.generation
    const client = await getSupabase(); this.client = client
    if (generation !== this.generation) throw new Error('Đã hủy vào phòng.')
    this.id = crypto.randomUUID()
    const member: Member = { id: this.id, name: name.slice(0, 24), avatar, host, joinedAt: Date.now() }
    const channel = client.channel(`${import.meta.env.VITE_SUPABASE_REALTIME_TOPIC || 'hcm202'}-free-v2`, { config: { presence: { key: this.id }, broadcast: { ack: true, self: false } } })
    this.channel = channel
    channel.on('presence', { event: 'sync' }, () => this.syncPresence())
      .on('broadcast', { event: 'state' }, ({ payload }) => this.receiveState(payload))
      .on('broadcast', { event: 'player' }, ({ payload }) => {
        if (payload.sessionId !== this.room?.sessionId || payload.hostId !== this.room?.hostId || payload.player?.id !== this.id || payload.version < (this.room?.version ?? 0)) return
        this.self = payload.player
        if (this.room) { this.room.players = this.room.players.map(player => player.id === this.id ? this.self! : player); this.changed(this.room) }
      })
      .on('broadcast', { event: 'command' }, ({ payload }) => {
        if (!this.isHost || !this.model || payload.sessionId !== this.room?.sessionId || !this.members.some(member => member.id === payload.id && !member.host)) return
        if (this.model.command(payload.id, payload.message)) { this.publish(); this.publishPlayer(payload.id) }
      })
      .on('broadcast', { event: 'position' }, ({ payload }) => {
        const player = this.room?.players.find(player => player.id === payload.id)
        const { x, z, yaw } = payload
        if (payload.sessionId !== this.room?.sessionId || !player || player.status !== 'playing' || ![x, z, yaw].every(Number.isFinite) || Math.abs(x) > 8 || z < -85 || z > 13) return
        player.position = { x, z, yaw }
        const stored = this.model?.room.players.find(player => player.id === payload.id)
        if (stored) stored.position = { x, z, yaw }
        if (this.room) this.changed(this.room)
      })
    return new Promise<void>((resolve, reject) => {
      let joined = false
      const timeout = window.setTimeout(() => { this.leave(); reject(new Error('Không kết nối được Supabase Realtime. Kiểm tra URL, khóa và kết nối mạng.')) }, 15000)
      channel.subscribe(async status => {
        if (this.channel !== channel) return
        if (status === 'SUBSCRIBED') {
          this.subscribed = true
          const result = await channel.track(member)
          if (this.channel !== channel) return
          if (result !== 'ok') { window.clearTimeout(timeout); this.leave(); reject(new Error('Không đăng ký được người chơi với Supabase.')); return }
          joined = true; window.clearTimeout(timeout)
          this.syncPresence()
          if (!this.room) this.room = { code: 'HCM202', sessionId: '', hostId: '', phase: 'waiting', startedAt: 0, endedAt: 0, serverTime: Date.now(), version: 0, players: [] }
          this.changed(this.room)
          if (this.timer) window.clearInterval(this.timer)
          this.timer = window.setInterval(() => {
            if (!this.model || !this.isHost) return
            const players = this.model.tick()
            if (players.length) { this.publish(); players.forEach(id => this.publishPlayer(id)) }
          }, 100)
          resolve()
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          window.clearTimeout(timeout); this.subscribed = false
          if (joined) this.disconnected()
          else { this.leave(); reject(new Error('Supabase Realtime không kết nối được. Kiểm tra cấu hình và quyền public channel.')) }
        }
      })
    })
  }
  private syncPresence() {
    if (!this.channel) return
    this.members = Object.values(this.channel.presenceState<Member>()).flat()
    const hosts = this.members.filter(member => member.host).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    const hostId = hosts[0]?.id ?? ''
    if (this.room?.phase === 'playing' && hostId !== this.room.hostId) { this.disconnected(); return }
    if (hostId === this.id) {
      this.model ??= new GameRoom(this.id)
      this.model.sync(this.members); this.publish()
      for (const player of this.model.room.players) this.publishPlayer(player.id)
    } else {
      this.model = undefined
      if (!this.room || this.room.phase === 'waiting') {
        this.room = { code: 'HCM202', sessionId: this.room?.sessionId ?? '', hostId, phase: 'waiting', startedAt: 0, endedAt: 0, serverTime: Date.now(), version: 0, players: this.members.filter(member => !member.host).map(waitingPlayer) }
        this.changed(this.room)
      }
    }
  }
  private receiveState(room: Room) {
    if (room.code !== 'HCM202' || !this.members.some(member => member.id === room.hostId && member.host)) return
    if (this.room?.hostId === room.hostId && room.version < this.room.version) return
    this.timeOffset = room.serverTime - Date.now()
    if (room.sessionId !== this.room?.sessionId) this.self = undefined
    room.players = room.players.map(player => ({ ...player, answers: player.id === this.id ? this.self?.answers ?? [] : [] }))
    this.room = room; this.changed(room)
    if (room.phase === 'playing' && !this.isHost && !room.players.some(player => player.id === this.id)) this.error('Phòng đã bắt đầu trước khi bạn vào. Chờ chủ phòng mở lượt mới.')
  }
  private publish() {
    if (!this.model) return
    const room = this.model.snapshot(); this.receiveState(structuredClone(room))
    void this.broadcast('state', room)
  }
  private publishPlayer(id: string) {
    const player = this.model?.room.players.find(player => player.id === id)
    if (player) void this.broadcast('player', { hostId: this.id, sessionId: this.model!.room.sessionId, version: this.model!.room.version, player })
  }
  private async broadcast(event: string, payload: unknown) {
    const result = await this.channel?.send({ type: 'broadcast', event, payload })
    if (result && result !== 'ok') this.error('Không gửi được cập nhật Realtime. Kiểm tra kết nối mạng.')
  }
  leave() {
    this.generation++
    const channel = this.channel; this.channel = undefined; this.subscribed = false
    if (this.timer) window.clearInterval(this.timer)
    this.timer = undefined; this.model = undefined; this.self = undefined; this.members = []; this.room = undefined; this.id = ''; this.positionSignature = ''
    if (channel) void this.client?.removeChannel(channel)
  }
  send(message: Record<string, unknown>) {
    if (!this.connected) return
    if (message.type === 'position') {
      const signature = `${Number(message.x).toFixed(2)}:${Number(message.z).toFixed(2)}:${Number(message.yaw).toFixed(2)}`
      if (signature === this.positionSignature) return
      this.positionSignature = signature
      void this.broadcast('position', { ...message, id: this.id, sessionId: this.room?.sessionId }); return
    }
    if (this.isHost && this.model) {
      if (this.model.command(this.id, message)) {
        if (message.type === 'end') this.saveResults()
        if (message.type === 'reset') { this.model.sync(this.members); this.positionSignature = '' }
        this.publish()
        this.model.room.players.forEach(player => this.publishPlayer(player.id))
      }
    } else void this.broadcast('command', { id: this.id, sessionId: this.room?.sessionId, message })
  }
  private resultRecord() {
    if (!this.model || this.model.room.phase !== 'ended') return undefined
    const room = this.model.room
    return { ...room, rankingRule: 'score DESC, correctTimeMs ASC; equal score and time share a rank', players: rankPlayers(room.players).map(player => ({ ...player, rank: playerRank(room.players, player) })) }
  }
  private saveResults() {
    try { localStorage.setItem('hcm202-last-results-v2', JSON.stringify(this.resultRecord())) }
    catch { this.error('Không lưu được trên trình duyệt. Hãy bấm TẢI KẾT QUẢ trước khi đóng trang.') }
  }
  downloadResults() {
    let record = this.resultRecord()
    if (!record) {
      try { record = JSON.parse(localStorage.getItem('hcm202-last-results-v2') ?? 'null') }
      catch { /* The current session can still be exported after it ends. */ }
    }
    if (!record) { this.error('Chưa có kết quả. Kết thúc một phiên chơi để tải xuống.'); return }
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `HCM202-${record.endedAt}.json`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
