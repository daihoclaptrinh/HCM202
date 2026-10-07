import * as THREE from 'three'
import { audioAssets, chapters, exhibitionContent } from '../data/chapters'
import { museumConfig as config } from '../data/museumConfig'
import type { NarrationState } from '../systems/AudioManager'
import { AudioManager } from '../systems/AudioManager'
import { CollisionSystem } from '../systems/CollisionSystem'
import { UI } from '../ui/UI'
import { Museum } from '../world/Museum'
import { Controls } from './Controls'
import { Multiplayer, type Room } from '../systems/Multiplayer'
import { Visitors } from '../world/Visitors'
import { quizStations, stationRadius } from '../data/quizStations'

type GuidedStep = { label: string; position: THREE.Vector3; target: THREE.Vector3; narration?: string; waitForNarration?: boolean; duration?: number; finalRotation?: boolean }

export class Experience {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(63, innerWidth / innerHeight, .08, 180)
  private clock = new THREE.Clock()
  private collisions = new CollisionSystem(config.player.radius)
  private controls: Controls
  private museum: Museum
  private audio = new AudioManager()
  private ui: UI
  private started = false
  private sightseeing = false
  private currentChapter = -1
  private nearbyIndex = -1
  private finalStarted = false
  private boardCandidate = -1
  private ambientZone: 'corridor' | 'final' = 'corridor'
  private mapMilestonePlayed = false
  private guided = false
  private tourPaused = false
  private lessonIndex = -1
  private multiplayer = new Multiplayer(room => this.updateRoom(room), () => {
    if (this.gameActive) this.loseGame('Mất kết nối với phòng chơi.')
    else { this.ui.setStartAllowed(false); this.ui.setLobbyMessage('Đã mất kết nối. Vào lại phòng trước khi bắt đầu.') }
  }, message => this.ui.setLobbyMessage(message))
  private visitors: Visitors
  private gameActive = false
  private eliminated = false
  private positionTimer = 0
  private reportedLessons = new Set<number>()
  private roomSignature = ''
  private sessionId = ''
  private forfeitedQuestion = ''
  private visitMode: 'free' | 'guided' = 'free'
  private guidedSteps: GuidedStep[] = []
  private guidedIndex = -1
  private guidedPhase: 'moving' | 'waiting' | 'rotating' = 'waiting'
  private guidedVelocity = new THREE.Vector3()
  private guidedWait = 0
  private guidedNarrationState: NarrationState = 'idle'
  private guidedRotation = 0
  private guidedWalkTime = 0
  private guidedCurve: THREE.CatmullRomCurve3 | null = null
  private guidedDuration = 3
  private guidedElapsed = 0
  private guidedSpeedMultiplier = 1
  private finalTimers: number[] = []
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor() {
    this.ui = new UI({
      visit: mode => this.startVisitor(mode),
      start: () => this.startHost(),
      end: () => this.multiplayer.send({ type: 'end' }),
      newSession: () => this.multiplayer.send({ type: 'reset' }),
      downloadResults: () => this.multiplayer.downloadResults(),
      openQuestion: index => {
        if (!this.gameActive || !this.audio.hasCompleted(audioAssets.narration[Math.floor(index / 6) + 1]) || document.hidden) return
        this.multiplayer.send({ type: 'position', x: this.camera.position.x, z: this.camera.position.z, yaw: this.camera.rotation.y })
        this.multiplayer.send({ type: 'openQuestion', index })
      },
      host: () => this.multiplayer.joinHost(),
      home: () => this.home(),
      close: () => this.closePanels(),
      mute: () => this.audio.toggleMute(),
      narration: () => { if (this.gameActive) void this.audio.toggleNarration(); else this.toggleNarration() },
      listenHere: () => this.toggleNarration(),
      transcript: () => this.openTranscript(),
      credits: () => this.openCredits(),
      restart: () => this.restart(),
      nextTourStep: () => this.nextGuidedStep(),
      exitGuided: () => this.exitGuided(),
      pauseTour: () => {
        this.tourPaused = !this.tourPaused
        this.ui.setTourPaused(this.tourPaused)
        if (this.tourPaused) this.audio.pauseNarration()
        else if (this.guidedNarrationState === 'paused') void this.audio.toggleNarration()
      },
      join: async (name, avatar) => {
        if (!name.trim()) throw new Error('Nhập tên người chơi trước khi vào phòng.')
        this.sightseeing = false; this.eliminated = false; this.ui.setVisitMode(false)
        await this.multiplayer.join(name, avatar)
      },
      submitAnswer: (stage, index, choice, text) => {
        if (!this.gameActive || this.multiplayer.me?.activeQuestion !== stage * 6 + index) return
        const me = this.multiplayer.me
        if (document.hidden || !document.hasFocus() || this.forfeitedQuestion === `${this.sessionId}:${me.activeQuestion}:${me.questionOpenedAt}`) { this.forfeitCurrentQuestion(); return }
        this.multiplayer.send({ type: 'answer', index: stage * 6 + index, choice, text })
      }
    })
    this.audio.subscribe((snapshot) => {
      this.guidedNarrationState = snapshot.state; this.ui.updateAudio(snapshot)
      if (snapshot.completed && snapshot.path && this.gameActive) {
        const index = audioAssets.narration.indexOf(snapshot.path)
        if (index >= 0 && !this.reportedLessons.has(index)) { this.reportedLessons.add(index); this.multiplayer.send({ type: 'listen', index }) }
      }
      this.refreshLesson()
    })
    this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.q<HTMLCanvasElement>('#museum-canvas'), antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.scene.background = new THREE.Color('#252019'); this.scene.fog = new THREE.FogExp2('#252019', .009)
    this.camera.position.set(0, config.player.eyeHeight, 8)
    this.controls = new Controls(this.camera, this.collisions, config.player.speed, this.reducedMotion)
    this.museum = new Museum(this.scene, this.collisions)
    this.visitors = new Visitors(this.scene)
    window.addEventListener('resize', () => this.resize()); window.addEventListener('keydown', (event) => this.keydown(event))
    window.addEventListener('blur', () => this.forfeitCurrentQuestion())
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.forfeitCurrentQuestion() })
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) this.forfeitCurrentQuestion() })
    window.addEventListener('beforeunload', () => this.forfeitCurrentQuestion())
    window.addEventListener('popstate', () => this.forfeitCurrentQuestion())
    void this.load(); this.renderer.setAnimationLoop(() => this.update())
  }

  private async load() {
    this.ui.progress(.35)
    await this.audio.prepare([...audioAssets.narration, ...Object.values(audioAssets.ambient), ...Object.values(audioAssets.sfx)])
    this.audio.selectNarration(exhibitionContent.prologue.audio)
    this.ui.progress(1); window.setTimeout(() => this.ui.ready(), 450)
  }

  private startHost() {
    if (!this.multiplayer.isHost || this.multiplayer.room?.phase !== 'waiting') return
    this.multiplayer.send({ type: 'start' })
  }

  private beginGame(mode: 'free' | 'guided') {
    if (this.gameActive || this.started || this.eliminated) return
    this.sightseeing = false; this.ui.setVisitMode(false)
    this.gameActive = true; this.museum.quizMarkers.visible = true; this.audio.setMuted(false)
    const spawn = this.multiplayer.me?.position
    if (spawn) this.camera.position.set(spawn.x, config.player.eyeHeight, spawn.z)
    this.visitMode = mode
    this.started = true; this.guided = mode === 'guided'; this.controls.enabled = !this.guided; this.ui.explore(); this.ui.setHomeControl(!this.guided)
    void this.audio.playAmbient(audioAssets.ambient.corridor)
    if (this.guided) { this.guidedSteps = this.createGuidedSteps(); this.ui.setGuidedTour(true); this.advanceGuidedStep() }
    else this.updateNarrationZone()
  }

  private startVisitor(mode: 'free' | 'guided') {
    if (this.gameActive) return
    this.multiplayer.leave(); this.visitors.update([], ''); this.museum.quizMarkers.visible = false
    this.sightseeing = true; this.ui.setVisitMode(true); this.restart(false)
    this.visitMode = mode; this.started = true; this.guided = mode === 'guided'
    this.controls.enabled = !this.guided; this.ui.explore(); this.ui.setHomeControl(true)
    void this.audio.playAmbient(audioAssets.ambient.corridor)
    if (this.guided) { this.guidedSteps = this.createGuidedSteps(); this.ui.setGuidedTour(true); this.advanceGuidedStep() }
    else this.updateNarrationZone()
  }

  private update() {
    const delta = Math.min(this.clock.getDelta(), .05)
    this.ui.updateQuizTimer(this.multiplayer.me?.questionDeadline ?? 0, this.multiplayer.serverNow)
    if (this.started && !this.guided) this.updateNarrationZone()
    this.controls.enabled = this.started && !this.ui.panelOpen && !this.guided && !this.ui.questionOpen
    if (this.guided) {
      if (!this.tourPaused && !this.ui.panelOpen && !document.hidden) this.updateGuidedTour(delta)
    } else this.controls.update(delta)
    if (this.started) {
      this.updateChapter(); if (!this.guided) this.updateNarrationZone(); this.updateAmbient(); this.updateInteraction()
      if (this.gameActive) this.ui.showCompetitionQuestions(this.multiplayer.me, this.nearbyQuestionStage())
      this.museum.updateTransitionDoor(this.camera.position.z, delta, this.reducedMotion); if (this.guided) this.updateFinal()
    }
    this.visitors.animate(delta, this.camera.position)
    this.renderer.render(this.scene, this.camera)
    if (this.gameActive) {
      this.positionTimer += delta
      if (this.positionTimer >= .2) { this.positionTimer = 0; this.multiplayer.send({ type: 'position', x: this.camera.position.x, z: this.camera.position.z, yaw: this.camera.rotation.y }) }
    }
  }

  private getSafeCorridorX(z: number): number {
    if (z > -4) return 0
    if (z >= -12) return -0.45
    if (z >= -15.5) {
      const t = (z - -12) / (-15.5 - -12)
      return THREE.MathUtils.lerp(-0.45, 0.35, t)
    }
    if (z >= -22.5) return 0.35
    if (z >= -25) {
      const t = (z - -22.5) / (-25 - -22.5)
      return THREE.MathUtils.lerp(0.35, -0.35, t)
    }
    if (z >= -33) return -0.35
    if (z >= -35.8) {
      const t = (z - -33) / (-35.8 - -33)
      return THREE.MathUtils.lerp(-0.35, 0.35, t)
    }
    if (z >= -43.8) return 0.35
    if (z >= -47.3) {
      const t = (z - -43.8) / (-47.3 - -43.8)
      return THREE.MathUtils.lerp(0.35, -0.35, t)
    }
    if (z >= -58.5) return -0.35
    if (z >= -61.5) {
      const t = (z - -58.5) / (-61.5 - -58.5)
      return THREE.MathUtils.lerp(-0.35, 0, t)
    }
    return 0
  }

  private createPath(start: THREE.Vector3, end: THREE.Vector3): THREE.CatmullRomCurve3 {
    const distZ = end.z - start.z
    const absDistZ = Math.abs(distZ)

    if (absDistZ < 1.0) {
      return new THREE.CatmullRomCurve3([start.clone(), end.clone()], false, 'centripetal')
    }

    const sign = Math.sign(distZ)
    const points: THREE.Vector3[] = [start.clone()]

    const stepOutZ = start.z + sign * Math.min(1.0, absDistZ * 0.25)
    points.push(new THREE.Vector3(this.getSafeCorridorX(stepOutZ), config.player.eyeHeight, stepOutZ))

    const numSteps = Math.max(1, Math.floor(absDistZ / 3.0))
    for (let i = 1; i <= numSteps; i++) {
      const midZ = start.z + sign * (i * (absDistZ / (numSteps + 1)))
      points.push(new THREE.Vector3(this.getSafeCorridorX(midZ), config.player.eyeHeight, midZ))
    }

    if ((start.z > -61.5 && end.z < -61.5) || (start.z < -61.5 && end.z > -61.5)) {
      points.push(new THREE.Vector3(0, config.player.eyeHeight, -61.5))
    }

    const stepInZ = end.z - sign * Math.min(1.0, absDistZ * 0.25)
    points.push(new THREE.Vector3(this.getSafeCorridorX(stepInZ), config.player.eyeHeight, stepInZ))

    points.push(end.clone())
    points.sort((a, b) => sign > 0 ? a.z - b.z : b.z - a.z)

    const cleanPoints: THREE.Vector3[] = [points[0]]
    for (let i = 1; i < points.length; i++) {
      if (points[i].distanceTo(cleanPoints[cleanPoints.length - 1]) > 0.25) {
        cleanPoints.push(points[i])
      }
    }
    if (cleanPoints[cleanPoints.length - 1].distanceTo(end) > 0.05) {
      cleanPoints.push(end.clone())
    }
    if (cleanPoints.length < 2) {
      cleanPoints.push(end.clone())
    }

    return new THREE.CatmullRomCurve3(cleanPoints, false, 'centripetal')
  }

  private createGuidedSteps() {
    const steps: GuidedStep[] = [
      {
        label: 'MỞ ĐẦU',
        position: new THREE.Vector3(0, config.player.eyeHeight, 3.5),
        target: new THREE.Vector3(-2.08, 1.95, 4.0),
        narration: exhibitionContent.prologue.audio,
        waitForNarration: true
      }
    ]

    chapters.forEach((chapter) => {
      const z = (chapter.start + chapter.end) / 2
      const isBoardLeft = chapter.board.side === 'left'
      const boardTarget = new THREE.Vector3(isBoardLeft ? -2.04 : 2.04, 1.9, z)
      const boardPos = new THREE.Vector3(isBoardLeft ? -0.45 : 0.45, config.player.eyeHeight, z)

      let exhibitPos: THREE.Vector3
      let exhibitTarget: THREE.Vector3

      switch (chapter.index) {
        case 1:
          exhibitPos = new THREE.Vector3(-0.35, config.player.eyeHeight, z)
          exhibitTarget = new THREE.Vector3(1.2, 0.95, z)
          break
        case 2:
          exhibitPos = new THREE.Vector3(0.15, config.player.eyeHeight, z)
          exhibitTarget = new THREE.Vector3(-2.03, 2.05, z)
          break
        case 3:
          exhibitPos = new THREE.Vector3(0.15, config.player.eyeHeight, z)
          exhibitTarget = new THREE.Vector3(1.55, 0.98, z)
          break
        case 4:
          exhibitPos = new THREE.Vector3(-0.15, config.player.eyeHeight, z)
          exhibitTarget = new THREE.Vector3(-1.52, 0.95, z)
          break
        case 5:
        default:
          exhibitPos = new THREE.Vector3(0.0, config.player.eyeHeight, z)
          exhibitTarget = new THREE.Vector3(2.03, 1.9, z)
          break
      }

      steps.push({
        label: `0${chapter.index} · BẢNG THÔNG TIN`,
        position: boardPos,
        target: boardTarget,
        narration: chapter.audio,
        waitForNarration: true
      })

      steps.push({
        label: `0${chapter.index} · HIỆN VẬT & TƯ LIỆU`,
        position: exhibitPos,
        target: exhibitTarget,
        duration: 4.5
      })
    })

    steps.push({
      label: 'SẢNH TƯ TƯỞNG HỒ CHÍ MINH',
      position: new THREE.Vector3(0, config.player.eyeHeight, config.hall.centerZ + 2.45),
      target: new THREE.Vector3(0, 1.35, config.hall.centerZ),
      narration: exhibitionContent.finalHall.audio,
      waitForNarration: true
    })

    steps.push({
      label: 'TOÀN CẢNH SẢNH DANH DỰ',
      position: new THREE.Vector3(0, config.player.eyeHeight, config.hall.centerZ + 2.45),
      target: new THREE.Vector3(0, 1.7, config.hall.centerZ - 4),
      duration: 1,
      finalRotation: true
    })

    return steps
  }

  private advanceGuidedStep() {
    this.guidedIndex++
    if (this.guidedIndex >= this.guidedSteps.length) { this.finishGuidedTour(); return }
    const step = this.guidedSteps[this.guidedIndex]
    this.guidedVelocity.set(0, 0, 0)
    this.guidedWait = 0
    this.guidedPhase = 'moving'
    this.guidedRotation = 0
    this.guidedSpeedMultiplier = 1

    const startPos = this.camera.position.clone()
    const endPos = step.position.clone()
    this.guidedCurve = this.createPath(startPos, endPos)
    const curveLen = this.guidedCurve.getLength()
    this.guidedDuration = THREE.MathUtils.clamp(curveLen / 2.1 + 0.6, 1.0, 7.0)
    if (curveLen < 0.35) this.guidedDuration = 0.9
    this.guidedElapsed = 0

    this.ui.setGuidedTour(true, `${this.guidedIndex + 1} / ${this.guidedSteps.length} · ${step.label}`)
  }

  private nextGuidedStep() {
    if (!this.guided || this.tourPaused || this.ui.panelOpen) return
    const step = this.guidedSteps[this.guidedIndex]
    if (!step) return

    if (this.guidedPhase === 'moving') {
      if (this.guidedSpeedMultiplier === 1) {
        this.guidedSpeedMultiplier = 3.5
        void this.audio.fadeOutNarration(250)
        return
      }
      this.arriveGuidedStep(step)
      return
    }

    void this.audio.fadeOutNarration(350)
    this.advanceGuidedStep()
  }

  private exitGuided() {
    if (!this.guided) return
    this.visitMode = 'free'
    this.tourPaused = false
    this.ui.setTourPaused(false)
    this.ui.setHomeControl(true)
    this.finishGuidedTour()
  }

  private finishGuidedTour() {
    this.guided = false
    this.guidedPhase = 'waiting'
    this.guidedCurve = null
    this.guidedSpeedMultiplier = 1
    this.ui.setGuidedTour(false)
    this.ui.setHomeControl(true)
    this.controls.setOrientation(this.camera.rotation.y, this.camera.rotation.x)
    this.controls.enabled = true
    this.updateChapter()
    this.updateNarrationZone()
  }

  private updateGuidedTour(delta: number) {
    const step = this.guidedSteps[this.guidedIndex]
    if (!step) return

    if (this.guidedPhase === 'moving') {
      this.guidedElapsed += delta * this.guidedSpeedMultiplier
      const rawT = Math.min(1, this.guidedElapsed / this.guidedDuration)
      const smoothT = rawT * rawT * rawT * (rawT * (rawT * 6 - 15) + 10)

      if (this.guidedCurve) {
        const currentPos = this.guidedCurve.getPointAt(smoothT)
        this.guidedWalkTime += delta * 2.5
        const bob = (this.reducedMotion || this.guidedSpeedMultiplier > 1)
          ? 0
          : Math.sin(this.guidedWalkTime * 5.2) * 0.007 * Math.sin(smoothT * Math.PI)
        currentPos.y = config.player.eyeHeight + bob
        this.camera.position.copy(currentPos)

        const tangent = this.guidedCurve.getTangentAt(smoothT).normalize()
        const walkYaw = Math.atan2(-tangent.x, -tangent.z)

        const toTarget = step.target.clone().sub(currentPos)
        const destYaw = Math.atan2(-toTarget.x, -toTarget.z)
        const destPitch = Math.atan2(toTarget.y, Math.hypot(toTarget.x, toTarget.z))

        let targetYaw: number
        let targetPitch: number

        if (this.guidedCurve.getLength() < 0.4) {
          targetYaw = destYaw
          targetPitch = destPitch
        } else if (smoothT < 0.65) {
          targetYaw = walkYaw
          targetPitch = 0
        } else {
          const blend = (smoothT - 0.65) / 0.35
          const smoothBlend = blend * blend * (3 - 2 * blend)
          const diff = Math.atan2(Math.sin(destYaw - walkYaw), Math.cos(destYaw - walkYaw))
          targetYaw = walkYaw + diff * smoothBlend
          targetPitch = THREE.MathUtils.lerp(0, destPitch, smoothBlend)
        }

        const rotEase = this.reducedMotion ? 1 : Math.min(1, delta * (this.guidedSpeedMultiplier > 1 ? 8 : 4.5))
        const curYaw = this.camera.rotation.y
        const yawDiff = Math.atan2(Math.sin(targetYaw - curYaw), Math.cos(targetYaw - curYaw))
        const newYaw = curYaw + yawDiff * rotEase
        const newPitch = THREE.MathUtils.lerp(this.camera.rotation.x, targetPitch, rotEase)
        this.controls.setOrientation(newYaw, newPitch)
      }

      if (rawT >= 1) {
        this.arriveGuidedStep(step)
      }
      return
    }

    if (this.guidedPhase === 'rotating') {
      const rotSpeed = this.reducedMotion ? 0.42 : 0.25
      this.guidedRotation += delta * rotSpeed
      const targetPitch = 0.08
      const currentPitch = THREE.MathUtils.lerp(this.camera.rotation.x, targetPitch, Math.min(1, delta * 3))
      this.controls.setOrientation(this.camera.rotation.y + delta * rotSpeed, currentPitch)
      if (this.guidedRotation >= Math.PI * 2) this.finishGuidedTour()
      return
    }

    this.guidedWait += delta

    const toTarget = step.target.clone().sub(this.camera.position)
    const targetYaw = Math.atan2(-toTarget.x, -toTarget.z)
    const targetPitch = Math.atan2(toTarget.y, Math.hypot(toTarget.x, toTarget.z))

    const curYaw = this.camera.rotation.y
    const yawDiff = Math.atan2(Math.sin(targetYaw - curYaw), Math.cos(targetYaw - curYaw))
    const pitchDiff = targetPitch - this.camera.rotation.x

    const rotEase = this.reducedMotion ? 1 : Math.min(1, delta * 4.2)
    if (Math.abs(yawDiff) > 0.0005 || Math.abs(pitchDiff) > 0.0005) {
      const newYaw = curYaw + yawDiff * rotEase
      const newPitch = this.camera.rotation.x + pitchDiff * rotEase
      this.controls.setOrientation(newYaw, newPitch)
    }

    if (step.waitForNarration) {
      // The visitor explicitly starts the track, then chooses Next after its ended event.
    } else if (this.guidedWait >= (step.duration ?? 4.5)) {
      this.advanceGuidedStep()
    }
  }

  private arriveGuidedStep(step: GuidedStep) {
    this.camera.position.copy(step.position)
    this.camera.position.y = config.player.eyeHeight
    this.guidedVelocity.set(0, 0, 0)
    if (step.finalRotation) {
      this.guidedPhase = 'rotating'
      this.guidedRotation = 0
      return
    }
    this.guidedPhase = 'waiting'
    this.guidedWait = 0
    if (step.narration) {
      this.audio.stopNarration()
      this.audio.selectNarration(step.narration)
      this.lessonIndex = audioAssets.narration.indexOf(step.narration)
      this.refreshLesson()
      if (this.gameActive && !this.audio.hasCompleted(step.narration)) void this.audio.toggleNarration()
    } else {
      this.lessonIndex = -1; this.ui.hideLesson()
    }
  }


  private updateChapter() {
    const z = this.camera.position.z
    const index = chapters.findIndex((chapter) => z <= chapter.start && z >= chapter.end)
    if (index !== this.currentChapter) { this.currentChapter = index; this.ui.setChapter(index >= 0 ? chapters[index] : undefined) }
    const stageTwo = chapters[1]
    const mapProgress = THREE.MathUtils.clamp((stageTwo.start - z) / Math.max(1, stageTwo.start - stageTwo.end - 4), 0, 1)
    this.museum.updateMap(this.reducedMotion ? (mapProgress > 0 ? 1 : 0) : mapProgress)
    if (mapProgress >= .75 && !this.mapMilestonePlayed) { this.mapMilestonePlayed = true; void this.audio.playSfx(audioAssets.sfx.mapPoint) }
  }

  private updateNarrationZone() {
    this.controls.movementLocked = false
    const z = this.camera.position.z
    const chapter = chapters.findIndex(chapter => z <= chapter.start && z >= chapter.end)
    const index = z > chapters[0].start ? 0 : chapter >= 0 ? chapter + 1 : z < config.corridor.end ? 6 : -1
    if (index === this.lessonIndex) return
    this.lessonIndex = index; this.boardCandidate = chapter
    if (this.gameActive) {
      // A selected story keeps playing while the player explores another area.
      if (index < 0) { this.ui.hideLesson(); return }
      this.refreshLesson()
    } else {
      this.audio.stopNarration()
      if (index < 0) { this.ui.hideLesson(); this.ui.setNarrationControl(false); return }
      this.audio.selectNarration(audioAssets.narration[index]); this.ui.setNarrationControl(true); this.refreshLesson()
    }
    if (index === 6) this.revealFinalHall()
  }

  private nearbyQuestionStage() {
    if (!this.gameActive) return -1
    return quizStations.findIndex(station => Math.hypot(this.camera.position.x - station.x, this.camera.position.z - station.z) <= stationRadius - .15)
  }

  private refreshLesson() {
    if (this.lessonIndex < 0) return
    const path = audioAssets.narration[this.lessonIndex], listened = this.audio.hasCompleted(path)
    if (this.controls) this.controls.movementLocked = false
    const chapter = chapters[this.lessonIndex - 1]
    const title = this.lessonIndex === 0 ? 'Mở đầu hành trình' : chapter ? chapter.period : 'Kết luận'
    this.ui.showLesson(title, true, this.gameActive ? [] : (chapter ?? chapters[0]).artifacts, this.guided)
    this.ui.markListened(listened)
    this.ui.setLessonInstruction(listened ? 'Đã nghe xong. Đến biển ? của khu này để trả lời lần lượt câu 1 đến 6.' : 'Phải nghe hết nội dung khu này mới được trả lời câu hỏi. Bạn vẫn có thể đi lại khi nghe.')
    if (this.sightseeing) this.ui.setLessonInstruction(listened ? 'Đã nghe xong. Tiếp tục khám phá theo nhịp của bạn.' : 'Bấm nghe để tìm hiểu thêm, hoặc tiếp tục tham quan khi bạn muốn.')
    if (this.gameActive) {
      this.ui.setNarrationControl(!!this.audio.snapshot.path)
      const button = this.ui.q<HTMLButtonElement>('#lesson-listen')
      button.hidden = listened
      if (this.audio.snapshot.path !== path || this.audio.snapshot.state === 'idle') { button.disabled = false; button.textContent = '▶ NGHE CHUYỆN KHU NÀY' }
    }
    this.ui.setTourNextEnabled(true)
  }

  private updateRoom(room: Room) {
    if (this.sightseeing) return
    if (this.sessionId && this.sessionId !== room.sessionId && room.phase === 'waiting') {
      this.gameActive = false; this.started = false; this.eliminated = false
      this.reportedLessons.clear(); this.roomSignature = ''; this.forfeitedQuestion = ''; this.restart(false); this.audio.setMuted(false); this.ui.resetSession()
    }
    this.sessionId = room.sessionId
    this.ui.showRoom(room, this.multiplayer.id)
    this.visitors?.update(room.players, this.multiplayer.id)
    this.ui.q('#museum-canvas').dataset.visitors = String(this.visitors?.count ?? 0)
    this.ui.updateLobby(room, this.multiplayer.id)
    const me = this.multiplayer.me
    if (room.phase === 'ended') {
      const key = `${room.sessionId}:ended`
      if (this.roomSignature !== key) {
        this.roomSignature = key; this.gameActive = false; this.started = false; this.guided = false
        this.controls.enabled = false; this.audio.stopNarration(); this.audio.setMuted(true)
        if (me) this.ui.showSessionResult(room, this.multiplayer.id)
      }
      return
    }
    if (!me) return
    if (room.phase === 'playing' && me.status === 'playing' && !this.gameActive && !this.started) this.beginGame('free')
    if (me.status === 'lost') { this.loseGame(me.reason ?? 'Lượt chơi đã kết thúc.'); return }
    const signature = `${me.activeQuestion}:${me.answers.length}:${me.listened.join(',')}`
    if (signature !== this.roomSignature) { this.roomSignature = signature; this.refreshLesson(); this.ui.showCompetitionQuestions(me, this.nearbyQuestionStage()) }
    if (me.activeQuestion !== null && (document.hidden || !document.hasFocus())) this.forfeitCurrentQuestion()
  }

  private loseGame(reason: string) {
    if (!this.gameActive) return
    this.eliminated = true
    this.gameActive = false; this.started = false; this.guided = false
    this.controls.enabled = false; this.controls.movementLocked = true
    this.multiplayer.send({ type: 'lose' }); this.audio.stopNarration(); this.audio.setMuted(true)
    this.ui.showResult(false, this.multiplayer.me?.score ?? 0, reason)
  }

  private forfeitCurrentQuestion() {
    const me = this.multiplayer.me
    if (!this.gameActive || !me || me.activeQuestion === null) return
    const key = `${this.sessionId}:${me.activeQuestion}:${me.questionOpenedAt}`
    this.ui.q<HTMLButtonElement>('#submit-stage').disabled = true
    if (key === this.forfeitedQuestion) return
    this.forfeitedQuestion = key
    this.multiplayer.send({ type: 'forfeitQuestion', index: me.activeQuestion })
  }

  private updateAmbient() {
    const inFinal = Math.hypot(this.camera.position.x, this.camera.position.z - config.hall.centerZ) < config.hall.radius - .5
    const zone = inFinal ? 'final' : 'corridor'
    if (zone === this.ambientZone) return
    this.ambientZone = zone; void this.audio.playAmbient(zone === 'final' ? audioAssets.ambient.finalHall : audioAssets.ambient.corridor)
  }

  private updateInteraction() {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    let best = -1; let score = Infinity
    this.museum.interactives.forEach((item, index) => {
      const direction = item.mesh.position.clone().sub(this.camera.position); const distance = direction.length(); const angle = forward.angleTo(direction.normalize())
      if (distance < 2.4 && angle < .58 && distance < score) { score = distance; best = index }
    })
    this.nearbyIndex = best; this.ui.setPrompt(best >= 0 && !this.ui.panelOpen)
  }

  private updateFinal() {
    const distance = Math.hypot(this.camera.position.x, this.camera.position.z - config.hall.centerZ)
    if (distance < 2.65 && !this.finalStarted) {
      this.revealFinalHall()
    }
  }

  private revealFinalHall() {
    if (this.finalStarted) return
    this.finalStarted = true
    const interval = this.reducedMotion ? 0 : 650
    this.museum.quadrantLights.forEach((light, index) => this.finalTimers.push(window.setTimeout(() => { light.intensity = 9 }, index * interval + (this.reducedMotion ? 0 : 300))))
    this.finalTimers.push(window.setTimeout(() => { this.renderer.toneMappingExposure = .93; this.ui.showFinalActions() }, this.reducedMotion ? 0 : 3000))
    void this.audio.playSfx(audioAssets.sfx.finalReveal)
  }

  private keydown(event: KeyboardEvent) {
    if (this.ui.questionOpen) {
      if (event.code === 'Escape') event.preventDefault()
      return
    }
    if (!this.started || event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable)) return
    if (event.code === 'Escape') {
      if (this.ui.panelOpen) this.closePanels()
      else if (this.guided) this.exitGuided()
    }
    if (event.code === 'KeyQ' && this.gameActive) {
      this.ui.root.querySelector<HTMLButtonElement>('#hunt-grid button:not(:disabled)')?.focus()
    }
    if (event.code === 'KeyM') this.audio.toggleMute()
    if (event.code === 'KeyE' && this.nearbyIndex >= 0 && !this.ui.panelOpen) {
      const artifact = this.museum.interactives[this.nearbyIndex].artifact; const chapter = chapters.find((item) => item.id === artifact.chapterId)
      if (chapter) this.ui.openArtifact(artifact, chapter)
    }
  }

  private transcriptContext(): { title: string; transcript: string } {
    const distance = Math.hypot(this.camera.position.x, this.camera.position.z - config.hall.centerZ)
    if (distance < config.hall.radius) return { title: 'KẾT LUẬN', transcript: exhibitionContent.finalHall.transcript }
    if (this.boardCandidate >= 0) { const chapter = chapters[this.boardCandidate]; return { title: `0${chapter.index} · ${chapter.period}`, transcript: chapter.transcript } }
    if (this.currentChapter >= 0) { const chapter = chapters[this.currentChapter]; return { title: `0${chapter.index} · ${chapter.period}`, transcript: chapter.transcript } }
    return { title: 'MỞ ĐẦU', transcript: exhibitionContent.prologue.transcript }
  }

  private openTranscript() { const context = this.transcriptContext(); this.ui.showTranscript(context.title, context.transcript) }
  private toggleNarration() {
    if ((!this.gameActive && !this.sightseeing) || this.lessonIndex < 0 || this.audio.hasCompleted(audioAssets.narration[this.lessonIndex])) return
    const path = audioAssets.narration[this.lessonIndex]
    if (this.audio.snapshot.path !== path) { this.audio.stopNarration(); this.audio.selectNarration(path) }
    void this.audio.toggleNarration()
  }
  private closePanels() { this.ui.closePanels() }
  private openCredits() { this.ui.showCredits() }
  private home() {
    if (this.gameActive) { this.loseGame('Bạn đã rời lượt chơi.'); return }
    this.restart(false); this.started = false; this.controls.enabled = false; this.audio.reset(); this.audio.selectNarration(exhibitionContent.prologue.audio); this.ui.setHomeControl(false); this.ui.showHome()
  }
  private restart(playAudio = true) {
    if (this.gameActive) { this.loseGame('Bạn đã rời lượt chơi.'); return }
    this.lessonIndex = -1; this.controls.movementLocked = false; this.ui.hideLesson()
    this.tourPaused = false; this.ui.setTourPaused(false)
    this.finalTimers.forEach((timer) => window.clearTimeout(timer)); this.finalTimers = []
    this.camera.position.set(0, config.player.eyeHeight, 8); this.controls.reset(); this.audio.reset()
    this.currentChapter = -1; this.nearbyIndex = -1; this.boardCandidate = -1; this.finalStarted = false; this.mapMilestonePlayed = false; this.ambientZone = 'corridor'
    this.guided = false; this.guidedSteps = []; this.guidedIndex = -1; this.guidedPhase = 'waiting'; this.guidedVelocity.set(0, 0, 0); this.guidedWait = 0; this.guidedRotation = 0
    this.guidedCurve = null; this.guidedElapsed = 0; this.guidedSpeedMultiplier = 1
    this.renderer.toneMappingExposure = 1.08; this.museum.updateMap(0); this.museum.updateTransitionDoor(8, 1, true); this.museum.quadrantLights.forEach((light) => light.intensity = 0); this.ui.reset()
    this.audio.selectNarration(exhibitionContent.prologue.audio)
    if (playAudio && this.visitMode === 'guided') {
      this.guided = true; this.controls.enabled = false; this.guidedSteps = this.createGuidedSteps(); this.ui.setHomeControl(this.sightseeing); this.ui.setGuidedTour(true); this.advanceGuidedStep(); void this.audio.playAmbient(audioAssets.ambient.corridor)
    } else if (playAudio) {
      this.ui.setHomeControl(true); this.updateNarrationZone(); void this.audio.playAmbient(audioAssets.ambient.corridor)
    }
  }
  private resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.setSize(innerWidth, innerHeight) }
}
