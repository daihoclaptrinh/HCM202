export type NarrationState = 'idle' | 'loading' | 'playing' | 'paused' | 'finished' | 'unavailable'
export type AudioSnapshot = { path?: string; state: NarrationState; muted: boolean; available: boolean; completed: boolean }
type AudioListener = (snapshot: AudioSnapshot) => void

type Channel = {
  element?: HTMLAudioElement
  path?: string
  fadeFrame?: number
  finishFade?: () => void
}

const VOLUMES = { narration: 1, ambient: .16, ambientDucked: .09, sfx: .2 } as const

export class AudioManager {
  private availability = new Map<string, HTMLAudioElement | null>()
  private visited = new Set<string>()
  private completed = new Set<string>()
  private automaticAttempts = new Set<string>()
  private narration: Channel = {}
  private ambient: Channel = {}
  private sfx: Channel = {}
  private listeners = new Set<AudioListener>()
  private state: NarrationState = 'idle'
  private muted = false
  private resumeAfterVisibility = false
  private requestVersion = 0
  private ambientVersion = 0

  constructor() {
    document.addEventListener('visibilitychange', () => this.handleVisibility())
  }

  async prepare(paths: string[]) {
    await Promise.all([...new Set(paths)].map((path) => this.prepareTrack(path)))
    this.emit()
  }

  subscribe(listener: AudioListener) {
    this.listeners.add(listener); listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }

  has(path: string) { return this.availability.get(path) instanceof HTMLAudioElement }
  get snapshot(): AudioSnapshot { return { path: this.narration.path, state: this.state, muted: this.muted, available: this.narration.path ? this.has(this.narration.path) : false, completed: this.narration.path ? this.hasCompleted(this.narration.path) : false } }
  get isMuted() { return this.muted }
  isVisited(path: string) { return this.visited.has(path) }
  hasCompleted(path: string) { return this.completed.has(path) }

  selectNarration(path: string) {
    if (this.narration.path === path && this.narration.element) return
    this.narration.path = path
    this.state = this.has(path) ? 'idle' : 'unavailable'
    this.emit()
  }

  async playNarration(path: string, automatic = true) {
    if (this.hasCompleted(path)) return false
    if (automatic && (this.visited.has(path) || this.automaticAttempts.has(path))) return false
    if (automatic) this.automaticAttempts.add(path)
    if (this.narration.path === path && (this.state === 'loading' || this.state === 'playing')) return false
    const request = ++this.requestVersion
    if (!this.has(path)) await this.prepareTrack(path)
    if (request !== this.requestVersion) return false
    const next = this.availability.get(path)
    this.narration.path = path
    if (!next) { this.state = 'unavailable'; this.emit(); return false }
    if (this.narration.element && this.narration.element !== next) await this.fade(this.narration, 0, 750, true)
    if (request !== this.requestVersion) return false
    this.cancelFade(this.narration)
    this.narration.element = next; next.currentTime = 0; next.volume = 0; next.muted = this.muted
    this.state = 'loading'; this.emit()
    try { await next.play() } catch { if (request === this.requestVersion) { this.state = 'paused'; this.emit() }; return false }
    if (request !== this.requestVersion) { next.pause(); return false }
    this.visited.add(path); this.state = 'playing'; this.bindNarrationEvents(next); this.duckAmbient(true); this.emit()
    await this.fade(this.narration, VOLUMES.narration, 500)
    return true
  }

  async toggleNarration() {
    const audio = this.narration.element
    const path = this.narration.path
    if (!path) return false
    if (this.hasCompleted(path)) return false
    if (!this.has(path)) return this.playNarration(path, false)
    if (this.state === 'playing') { audio?.pause(); this.state = 'paused'; this.duckAmbient(false); this.emit(); return true }
    if (this.state === 'finished' || !audio) return this.playNarration(path, false)
    audio.volume = VOLUMES.narration
    try { await audio.play(); this.state = 'playing'; this.duckAmbient(true); this.emit(); return true } catch { return false }
  }

  pauseNarration() {
    if (this.state !== 'playing' && this.state !== 'loading') return
    this.requestVersion++; this.cancelFade(this.narration)
    this.narration.element?.pause(); this.resumeAfterVisibility = false
    this.state = 'paused'; this.duckAmbient(false); this.emit()
  }

  async replayNarration() {
    const path = this.narration.path
    if (!path || !this.has(path) || this.hasCompleted(path)) return false
    return this.playNarration(path, false)
  }

  async fadeOutNarration(duration = 800) {
    const request = this.requestVersion
    if (!this.narration.element || this.state === 'unavailable' || this.state === 'idle') return
    await this.fade(this.narration, 0, duration, true)
    if (request !== this.requestVersion) return
    this.state = 'finished'; this.duckAmbient(false); this.emit()
  }

  stopNarration() {
    this.requestVersion++
    this.cancelFade(this.narration)
    if (this.narration.element) { this.narration.element.pause(); this.narration.element.currentTime = 0 }
    this.narration.element = undefined; this.state = 'finished'; this.duckAmbient(false); this.emit()
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted }
  setMuted(muted: boolean) {
    this.muted = muted
    ;[this.narration, this.ambient, this.sfx].forEach((channel) => { if (channel.element) channel.element.muted = muted })
    this.emit()
  }

  async playAmbient(path: string) {
    const next = this.availability.get(path)
    if (!next || this.ambient.path === path) return false
    const request = ++this.ambientVersion
    if (this.ambient.element) await this.fade(this.ambient, 0, 2500, true)
    if (request !== this.ambientVersion) return false
    this.ambient.path = path; this.ambient.element = next; next.loop = true; next.currentTime = 0; next.volume = 0; next.muted = this.muted
    try { await next.play() } catch { return false }
    void this.fade(this.ambient, this.state === 'playing' ? VOLUMES.ambientDucked : VOLUMES.ambient, 2500)
    return true
  }

  async playSfx(path: string) {
    const next = this.availability.get(path)
    if (!next) return false
    if (this.sfx.element) { this.sfx.element.pause(); this.sfx.element.currentTime = 0 }
    this.sfx = { element: next, path }; next.volume = VOLUMES.sfx; next.muted = this.muted; next.currentTime = 0
    try { await next.play(); return true } catch { return false }
  }

  reset() {
    this.requestVersion++
    this.ambientVersion++
    ;[this.narration, this.ambient, this.sfx].forEach((channel) => { this.cancelFade(channel); channel.element?.pause(); if (channel.element) channel.element.currentTime = 0 })
    this.visited.clear(); this.completed.clear(); this.automaticAttempts.clear(); this.narration = {}; this.ambient = {}; this.sfx = {}; this.state = 'idle'; this.resumeAfterVisibility = false; this.emit()
  }

  private prepareTrack(path: string) {
    if (this.has(path)) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const audio = new Audio(this.resolve(path)); audio.preload = 'metadata'
      let settled = false
      const finish = (available: boolean) => {
        if (settled) return
        settled = true; window.clearTimeout(timeout); audio.removeEventListener('loadedmetadata', ready); audio.removeEventListener('canplaythrough', ready); audio.removeEventListener('error', failed)
        this.availability.set(path, available ? audio : null); resolve()
      }
      const ready = () => finish(true); const failed = () => finish(false); const timeout = window.setTimeout(() => finish(false), 10000)
      audio.addEventListener('loadedmetadata', ready, { once: true }); audio.addEventListener('canplaythrough', ready, { once: true }); audio.addEventListener('error', failed, { once: true }); audio.load()
    })
  }

  private bindNarrationEvents(audio: HTMLAudioElement) {
    audio.onended = () => { if (this.narration.element !== audio) return; if (this.narration.path) this.completed.add(this.narration.path); this.state = 'finished'; this.duckAmbient(false); this.emit() }
    audio.onpause = () => { if (this.narration.element === audio && !audio.ended && this.state === 'playing') { this.state = 'paused'; this.emit() } }
  }

  private duckAmbient(ducked: boolean) {
    if (this.ambient.element) void this.fade(this.ambient, ducked ? VOLUMES.ambientDucked : VOLUMES.ambient, 700)
  }

  private handleVisibility() {
    const audio = this.narration.element
    if (document.hidden) {
      this.resumeAfterVisibility = this.state === 'playing'
      if (this.resumeAfterVisibility) { audio?.pause(); this.state = 'paused'; this.emit() }
    } else if (this.resumeAfterVisibility && audio) {
      this.resumeAfterVisibility = false
      void audio.play().then(() => { this.state = 'playing'; this.emit() }).catch(() => undefined)
    }
  }

  private resolve(path: string) { return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}` }
  private emit() { const snapshot = this.snapshot; this.listeners.forEach((listener) => listener(snapshot)) }
  private cancelFade(channel: Channel) { if (channel.fadeFrame !== undefined) cancelAnimationFrame(channel.fadeFrame); channel.fadeFrame = undefined; channel.finishFade?.(); channel.finishFade = undefined }

  private fade(channel: Channel, target: number, duration: number, pauseAtEnd = false) {
    this.cancelFade(channel)
    const audio = channel.element
    if (!audio) return Promise.resolve()
    return new Promise<void>((resolve) => {
      channel.finishFade = resolve
      const start = audio.volume; const began = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - began) / duration); audio.volume = Math.max(0, Math.min(1, start + (target - start) * progress))
        if (progress < 1) channel.fadeFrame = requestAnimationFrame(tick)
        else { channel.fadeFrame = undefined; channel.finishFade = undefined; if (pauseAtEnd) audio.pause(); resolve() }
      }
      channel.fadeFrame = requestAnimationFrame(tick)
    })
  }
}
