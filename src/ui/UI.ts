import { exhibitionContent, type Artifact, type Chapter } from '../data/chapters'
import type { AudioSnapshot } from '../systems/AudioManager'
import { chapters } from '../data/chapters'
import { learning, artifactInsights } from '../data/learning'
import quizBank from '../data/quizBank.json'
import { visitorColors, visitorNames } from '../world/Visitors'
import type { Player, Room } from '../systems/Multiplayer'

type AppState = 'LOADING' | 'START_SCREEN' | 'EXPLORING' | 'ARTIFACT_OPEN' | 'CREDITS'
type UIHandlers = { visit: (mode: 'free' | 'guided') => void; start: () => void; host: () => Promise<void>; home: () => void; close: () => void; mute: () => boolean; narration: () => void; transcript: () => void; credits: () => void; restart: () => void; nextTourStep: () => void; exitGuided: () => void; pauseTour: () => void; join: (name: string, avatar: number) => Promise<void>; submitAnswer: (stage: number, index: number, choice: number, text: string) => void }

export class UI {
  readonly root: HTMLElement
  readonly prompt: HTMLElement
  readonly hudChapter: HTMLElement
  readonly artifactPanel: HTMLElement
  readonly finalActions: HTMLElement
  private state: AppState = 'LOADING'
  private previousFocus?: HTMLElement
  private discovered = new Set<string>()
  private quizKey = ''
  private sightseeing = false
  private inRoom = false

  constructor(private readonly handlers: UIHandlers) {
    const root = document.querySelector<HTMLElement>('#app')
    if (!root) throw new Error('Required application root #app was not found')
    this.root = root
    const credits = exhibitionContent.credits
    this.root.innerHTML = `
      <canvas id="museum-canvas" aria-label="Không gian bảo tàng ảo"></canvas>
      <div id="loading" class="screen" role="status"><div><p class="eyebrow">BẢO TÀNG ẢO</p><h1>BẢO TÀNG TƯ TƯỞNG HỒ CHÍ MINH</h1><div class="load-track"><i></i></div><p class="muted">Đang chuẩn bị không gian triển lãm...</p></div></div>
      <div id="start" class="screen hidden"><div><p class="eyebrow">BẢO TÀNG ẢO</p><h1>BẢO TÀNG<br>TƯ TƯỞNG<br>HỒ CHÍ MINH</h1><p>Quá trình hình thành và phát triển<br>Tư tưởng Hồ Chí Minh</p><p class="instructions">WASD để di chuyển · Kéo chuột để quan sát<br>Khuyến nghị sử dụng tai nghe</p></div></div>
      <div id="hud" class="hidden"><button id="home-button" class="hidden" aria-label="Về trang chủ">← TRANG CHỦ</button><div id="chapter" aria-live="polite">MỞ ĐẦU</div><div class="audio-controls"><button id="audio" aria-label="Tắt âm thanh" aria-pressed="false">ÂM THANH</button><button id="narration" aria-label="Nghe thuyết minh" disabled>▶ NGHE THUYẾT MINH</button><button id="transcript-button" aria-label="Xem nội dung thuyết minh">NỘI DUNG THUYẾT MINH</button><span id="audio-status" class="sr-only" aria-live="polite"></span></div><div id="help">W A S D&nbsp;&nbsp; Di chuyển<br>DRAG&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Quan sát<br>E&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Khám phá</div><div id="focus"></div><div id="prompt" aria-live="polite"></div></div>
      <aside id="artifact" class="panel" role="dialog" aria-modal="true" aria-labelledby="artifact-title" hidden><button class="close" aria-label="Đóng">×</button><p class="eyebrow artifact-code"></p><h2 id="artifact-title" class="artifact-title"></h2><p class="artifact-year"></p><img class="artifact-image" alt="" hidden><p class="artifact-description"></p><hr><p class="artifact-stage muted"></p></aside>
      <aside id="credits" class="panel" role="dialog" aria-modal="true" aria-labelledby="credits-title" hidden><button class="close" aria-label="Đóng">×</button><p class="eyebrow">GIỚI THIỆU DỰ ÁN</p><h2 id="credits-title">${credits.project}</h2><p>${credits.subtitle}</p><p>Dự án học phần: ${credits.course}<br>Nhóm thực hiện: ${credits.team}<br>Giảng viên: ${credits.lecturer}</p><hr><p>Nguồn nội dung chính:<br>${credits.source.replace('\n', '<br>')}</p></aside>
      <aside id="transcript" class="panel" role="dialog" aria-modal="true" aria-labelledby="transcript-title" hidden><button class="close" aria-label="Đóng">×</button><p class="eyebrow">NỘI DUNG THUYẾT MINH</p><h2 id="transcript-title"></h2><div class="transcript-content"></div></aside>
      <div id="guided-controls"><span id="guided-progress"></span><div class="guided-actions"><button id="guided-exit" title="Thoát chế độ hướng dẫn viên để tự do tham quan">THOÁT HƯỚNG DẪN</button><button id="guided-next" title="Đến điểm tham quan tiếp theo">TIẾP THEO →</button></div></div>
      <div id="final-actions"><button id="restart">↻ THAM QUAN LẠI</button><button id="credits-button">GIỚI THIỆU DỰ ÁN</button></div>
      <div id="mobile" class="screen hidden"><div><h2>TRẢI NGHIỆM MÁY TÍNH</h2><p>Trải nghiệm này được thiết kế tối ưu cho màn hình máy tính.</p><button id="continue">TIẾP TỤC</button></div></div>`
    this.prompt = this.q('#prompt'); this.hudChapter = this.q('#chapter'); this.artifactPanel = this.q('#artifact'); this.finalActions = this.q('#final-actions')
    this.q('#hud').insertAdjacentHTML('beforeend', `<button id="journal-button">SỔ KHÁM PHÁ · <span id="discovery-count">0 / 7</span></button><button id="help-button" aria-expanded="true">ĐIỀU KHIỂN</button>`)
    this.q('#guided-next').insertAdjacentHTML('beforebegin', '<button id="tour-pause" aria-pressed="false">TẠM DỪNG</button>')
    this.root.insertAdjacentHTML('beforeend', '<aside id="journal" class="panel" role="dialog" aria-modal="true" aria-labelledby="journal-title" hidden><button class="close" aria-label="Đóng">×</button><p class="eyebrow">HÀNH TRÌNH CỦA BẠN</p><h2 id="journal-title">Sổ khám phá</h2><p>Khám phá tư liệu và trả lời câu hỏi để kết nối năm giai đoạn.</p><div id="journal-content"></div></aside>')
    this.q('#artifact').insertAdjacentHTML('beforeend', '<h3>Gợi ý quan sát</h3><p class="artifact-insight"></p><p class="muted">Nội dung tham khảo: Giáo trình Tư tưởng Hồ Chí Minh, Bộ Giáo dục và Đào tạo, 2019. Chú thích nguồn ảnh chi tiết đang được bổ sung.</p><button id="zoom-image" aria-pressed="false">PHÓNG TO ẢNH</button>')
    try {
      const saved = JSON.parse(localStorage.getItem('museum-progress-v1') ?? '{}')
      this.discovered = new Set((saved.discovered ?? []).filter((id: string) => chapters.some(c => c.artifacts.some(a => a.id === id))))
    } catch { /* Storage can be unavailable; the visit remains usable. */ }
    this.updateDiscovery()
    this.q('#tour-pause').onclick = handlers.pauseTour
    this.root.insertAdjacentHTML('beforeend', '<section id="lesson-gate" hidden aria-label="Điểm nghe nội dung"><p class="eyebrow" id="lesson-title"></p><p id="lesson-instruction"></p><button id="lesson-listen">▶ NGHE NỘI DUNG</button><div id="upcoming-artifacts" hidden><p class="eyebrow">HIỆN VẬT SẮP TỚI</p><div id="upcoming-list"></div></div></section>')
    this.q('#lesson-listen').onclick = handlers.narration
    this.q('#lesson-gate').insertAdjacentHTML('beforeend', '<form id="stage-quiz" hidden><p id="quiz-timer" role="timer"></p><button id="review-answers" type="button" hidden>XEM KẾT QUẢ 6 CÂU</button><div id="stage-questions"></div><p id="quiz-message" aria-live="polite"></p><button id="submit-stage" type="submit">GỬI ĐÁP ÁN</button></form>')
    this.q('#review-answers').onclick = () => {
      const container = this.q('#stage-questions'); container.hidden = !container.hidden
      this.q('#review-answers').textContent = container.hidden ? 'XEM KẾT QUẢ 6 CÂU' : 'THU GỌN KẾT QUẢ'
    }
    const questions = this.q('#stage-questions')
    const answerEditor = (target: EventTarget | null) => target instanceof Element && !!target.closest('input[type="text"], textarea, [contenteditable="true"]')
    const questionSelected = () => {
      const selection = window.getSelection()
      if (!selection) return false
      for (let index = 0; index < selection.rangeCount; index++) if (selection.getRangeAt(index).intersectsNode(questions)) return true
      return false
    }
    for (const type of ['copy', 'cut']) document.addEventListener(type, event => {
      if (answerEditor(event.target)) return
      if (questions.contains(event.target as Node) || questionSelected()) {
        event.preventDefault(); (event as ClipboardEvent).clipboardData?.clearData()
      }
    })
    for (const type of ['contextmenu', 'dragstart']) questions.addEventListener(type, event => { if (!answerEditor(event.target)) event.preventDefault() })
    document.addEventListener('keydown', event => {
      if (answerEditor(event.target)) return
      if ((event.ctrlKey || event.metaKey) && ['c', 'x'].includes(event.key.toLowerCase()) && (questions.contains(event.target as Node) || questionSelected())) event.preventDefault()
    })
    this.q('#start .instructions').insertAdjacentHTML('beforebegin', `<div class="experience-tabs" role="group" aria-label="Chọn trải nghiệm"><button id="visit-tab" aria-pressed="true">THAM QUAN TÌM HIỂU</button><button id="competitive-tab" aria-pressed="false">CHƠI TÍNH ĐIỂM</button></div><div id="visitor-entry"><div class="visit-modes"><button id="visit-free-button">TỰ THAM QUAN</button><button id="visit-guided-button">ĐI CÙNG HƯỚNG DẪN VIÊN</button></div></div><div id="competition-entry" hidden><div class="lobby"><p class="eyebrow">PHÒNG HCM202</p><label>Tên người chơi<input id="player-name" maxlength="24" autocomplete="off" placeholder="Tên của bạn"></label><div class="avatar-options">${visitorNames.map((name, index) => `<button class="avatar-choice" data-avatar="${index}" aria-pressed="${index === 0}"><span class="avatar-figure" style="--outfit:${visitorColors[index]}"></span>${name}</button>`).join('')}</div><button id="join-room">VÀO PHÒNG CHƠI</button><p id="room-message" aria-live="polite"></p><div id="lobby-roster"></div><p class="lobby-rules">Nghe nội dung → trả lời 6 câu mỗi chặng. Mỗi câu đúng +100 điểm.<br>Thời gian theo chặng: 20 → 15 → 10 → 5 → 5 giây/câu.<br>Đồng hồ câu hỏi vẫn chạy khi chuyển tab.</p></div></div><div id="host-entry" hidden><p class="eyebrow">CHỦ PHÒNG · HCM202</p><p id="host-status" aria-live="polite">Đang kết nối phòng...</p><div id="host-roster"></div><button id="start-button" disabled>BẮT ĐẦU</button></div>`)
    const applyRoute = () => {
      const host = location.pathname === '/start', competitive = location.pathname === '/play'
      this.root.classList.toggle('host-screen', host)
      this.q('#host-entry').hidden = !host; this.q('#competition-entry').hidden = !competitive; this.q('#visitor-entry').hidden = host || competitive
      this.q('#start .experience-tabs').classList.toggle('hidden', host)
      this.q('#visit-tab').setAttribute('aria-pressed', String(!competitive))
      this.q('#competitive-tab').setAttribute('aria-pressed', String(competitive))
    }
    this.q('#visit-tab').onclick = () => { history.pushState(null, '', '/'); applyRoute() }
    this.q('#competitive-tab').onclick = () => { history.pushState(null, '', '/play'); applyRoute() }
    window.addEventListener('popstate', applyRoute); applyRoute()
    this.q('#visit-free-button').onclick = () => handlers.visit('free')
    this.q('#visit-guided-button').onclick = () => handlers.visit('guided')
    this.root.insertAdjacentHTML('beforeend', '<aside id="scoreboard" hidden aria-label="Bảng điểm phòng chơi"><h3 id="score-room"></h3><p id="my-score" aria-live="polite"></p><div id="score-players"></div></aside><div id="result-screen" class="screen hidden"><div><p class="eyebrow">KẾT QUẢ LƯỢT CHƠI</p><h2 id="result-title"></h2><p id="result-copy"></p><button id="new-game">CHƠI LƯỢT MỚI</button></div></div>')
    let selectedAvatar = 0
    this.root.querySelectorAll<HTMLButtonElement>('.avatar-choice').forEach(button => button.onclick = () => {
      selectedAvatar = Number(button.dataset.avatar)
      this.root.querySelectorAll('.avatar-choice').forEach(option => option.setAttribute('aria-pressed', String(option === button)))
    })
    this.q('#join-room').onclick = async () => {
      const button = this.q<HTMLButtonElement>('#join-room'); button.disabled = true
      this.setLobbyMessage('Đang vào phòng HCM202...')
      try { await handlers.join(this.q<HTMLInputElement>('#player-name').value, selectedAvatar) }
      catch (error) { this.setLobbyMessage(error instanceof Error ? error.message : 'Không kết nối được phòng.'); this.setStartAllowed(false) }
      finally { button.disabled = this.inRoom }
    }
    this.setStartAllowed(false)
    this.q('#stage-quiz').onsubmit = event => {
      event.preventDefault()
      const stage = Number(this.q('#stage-quiz').dataset.stage)
      const index = Number(this.q('#stage-quiz').dataset.index)
      const choice = this.root.querySelector<HTMLInputElement>('input[name="stage-answer"]:checked')?.value
      const text = this.root.querySelector<HTMLInputElement>('#manual-answer')?.value.trim() ?? ''
      if (choice === undefined || choice === '3' && !/^\d{1,4}$/.test(text)) { this.q('#quiz-message').textContent = 'Chọn đáp án; nếu chọn đáp án khác, nhập số cần trả lời.'; return }
      this.q<HTMLButtonElement>('#submit-stage').disabled = true
      this.q('#quiz-message').textContent = 'Đang chấm điểm…'
      handlers.submitAnswer(stage, index, Number(choice), text)
    }
    this.q('#new-game').onclick = () => location.reload()
    this.q('#journal-button').onclick = () => { this.renderJournal(); this.openPanel(this.q('#journal'), 'CREDITS') }
    this.q('#zoom-image').onclick = () => {
      const zoomed = this.artifactPanel.classList.toggle('zoomed')
      this.q('#zoom-image').setAttribute('aria-pressed', String(zoomed))
      this.q('#zoom-image').textContent = zoomed ? 'THU NHỎ ẢNH' : 'PHÓNG TO ẢNH'
    }
    this.q('#help-button').onclick = () => {
      const hidden = this.q('#help').classList.toggle('hidden')
      this.q('#help').classList.remove('faded')
      this.q('#help-button').setAttribute('aria-expanded', String(!hidden))
    }
    this.root.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || !this.panelOpen) return
      const panel = this.root.querySelector<HTMLElement>('.panel.open')
      const elements = panel?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex="0"]')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    })
    this.q('#start-button').onclick = handlers.start; this.q('#home-button').onclick = handlers.home; this.q('#audio').onclick = () => handlers.mute(); this.q('#narration').onclick = handlers.narration
    this.q('#restart').onclick = handlers.restart; this.q('#credits-button').onclick = handlers.credits; this.q('#transcript-button').onclick = handlers.transcript; this.q('#guided-next').onclick = handlers.nextTourStep; this.q('#guided-exit').onclick = handlers.exitGuided
    this.root.querySelectorAll('.close').forEach((button) => button.addEventListener('click', handlers.close))
    this.q('#continue').onclick = () => this.q('#mobile').classList.add('hidden')
    if (innerWidth < 768) this.q('#mobile').classList.remove('hidden')
  }

  q<T extends HTMLElement = HTMLElement>(selector: string) { const element = this.root.querySelector<T>(selector); if (!element) throw new Error(`Required UI element ${selector} was not found`); return element }
  progress(value: number) { this.q('.load-track i').style.width = `${value * 100}%` }
  ready() { this.state = 'START_SCREEN'; this.q('#loading').classList.add('hidden'); this.q('#start').classList.remove('hidden'); this.q('#visit-tab').focus(); if (location.pathname === '/start') void this.handlers.host().catch(error => this.setLobbyMessage(error instanceof Error ? error.message : 'Không kết nối được Supabase.')) }
  explore() { this.state = 'EXPLORING'; this.q('#start').classList.add('hidden'); this.q('#hud').classList.remove('hidden'); this.root.classList.toggle('competition-active', !this.sightseeing); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); this.q('#help').classList.remove('faded') }
  setHomeControl(show: boolean) { this.q('#home-button').classList.toggle('hidden', !show) }
  showHome() { this.state = 'START_SCREEN'; this.q('#hud').classList.add('hidden'); this.q('#start').classList.remove('hidden'); this.q('#visit-tab').focus() }
  setChapter(chapter?: Chapter) { this.hudChapter.innerHTML = chapter ? `0${chapter.index} / 05<br><span>${chapter.period}</span>` : '' }
  setPrompt(show: boolean) { this.prompt.textContent = show ? 'E - KHÁM PHÁ' : ''; this.q('#focus').classList.toggle('active', show) }
  setNarrationControl(show: boolean) { this.q('#narration').classList.toggle('hidden', !show) }
  updateAudio(snapshot: AudioSnapshot) {
    const sound = this.q<HTMLButtonElement>('#audio'); sound.textContent = snapshot.muted ? 'ÂM THANH: TẮT' : 'ÂM THANH'; sound.setAttribute('aria-pressed', String(snapshot.muted)); sound.setAttribute('aria-label', snapshot.muted ? 'Bật âm thanh' : 'Tắt âm thanh')
    const narration = this.q<HTMLButtonElement>('#narration'); narration.disabled = !snapshot.path || snapshot.state === 'loading' || snapshot.completed
    const labels = { idle: '▶ NGHE THUYẾT MINH', loading: 'ĐANG TẢI...', playing: '❚❚ TẠM DỪNG', paused: '▶ TIẾP TỤC', finished: 'ĐÃ NGHE', unavailable: '↻ THỬ TẢI LẠI' }
    narration.textContent = labels[snapshot.state]; narration.setAttribute('aria-label', labels[snapshot.state].replaceAll(/[▶❚↻]/g, '').trim())
    this.q('#audio-status').textContent = snapshot.state === 'playing' ? 'Đang phát thuyết minh' : snapshot.state === 'paused' ? 'Đã tạm dừng thuyết minh' : ''
    const listen = this.q<HTMLButtonElement>('#lesson-listen')
    listen.disabled = snapshot.state === 'loading' || snapshot.completed
    listen.textContent = snapshot.state === 'playing' ? '❚❚ TẠM DỪNG' : snapshot.state === 'paused' ? '▶ TIẾP TỤC NGHE' : snapshot.state === 'loading' ? 'ĐANG TẢI NỘI DUNG…' : snapshot.state === 'unavailable' ? '↻ THỬ TẢI LẠI' : '▶ NGHE NỘI DUNG'
  }
  openArtifact(artifact: Artifact, chapter: Chapter) {
    this.discovered.add(artifact.id); this.updateDiscovery(); this.saveProgress()
    this.artifactPanel.classList.remove('zoomed'); this.q('#zoom-image').textContent = 'PHÓNG TO ẢNH'; this.q('#zoom-image').setAttribute('aria-pressed', 'false')
    this.q('.artifact-insight').textContent = artifactInsights[artifact.id] ?? chapter.museumCopy
    this.q('.artifact-code').textContent = artifact.code; this.q('.artifact-title').textContent = artifact.title; this.q('.artifact-year').textContent = artifact.year
    const image = this.q<HTMLImageElement>('.artifact-image'); image.src = artifact.image; image.alt = artifact.title; image.hidden = false
    this.q('.artifact-description').textContent = artifact.description; this.q('.artifact-stage').textContent = `Giai đoạn · ${chapter.period}`; this.openPanel(this.artifactPanel, 'ARTIFACT_OPEN')
  }
  showCredits() { this.openPanel(this.q('#credits'), 'CREDITS') }
  showTranscript(title: string, transcript: string) { this.q('#transcript-title').textContent = title; this.q('.transcript-content').innerHTML = transcript.split('\n\n').map((paragraph) => `<p>${paragraph}</p>`).join(''); this.openPanel(this.q('#transcript'), 'CREDITS') }
  closePanels() { if (!this.panelOpen) return; this.root.querySelectorAll<HTMLElement>('.panel').forEach((panel) => { panel.classList.remove('open'); panel.hidden = true }); this.state = 'EXPLORING'; this.previousFocus?.focus() }
  showFinalActions() { this.finalActions.classList.add('visible') }
  showLesson(title: string, complete: boolean, artifacts: Artifact[], guided: boolean) {
    this.q('#lesson-gate').hidden = false
    this.q('#lesson-gate').classList.toggle('guided-lesson', guided)
    this.q('#lesson-title').textContent = title
    this.q('#lesson-instruction').textContent = complete ? (guided ? 'Đã nghe xong. Bấm TIẾP THEO để khám phá hiện vật.' : 'Đã nghe xong. Bạn có thể di chuyển tiếp để khám phá hiện vật.') : 'Dừng chân tại đây. Bấm nghe và nghe hết nội dung để tiếp tục hành trình.'
    this.q('#upcoming-artifacts').hidden = !complete || artifacts.length === 0
    const list = this.q('#upcoming-list'); list.replaceChildren()
    if (complete) artifacts.forEach(artifact => {
      const card = document.createElement('div'); card.className = 'upcoming-item'
      const image = document.createElement('img'); image.src = `${import.meta.env.BASE_URL}${artifact.image.replace(/^\//, '')}`; image.alt = artifact.title
      const title = document.createElement('span'); title.textContent = `${artifact.title} · ${artifact.year}`
      card.append(image, title); list.append(card)
    })
  }
  setVisitMode(sightseeing: boolean) {
    this.sightseeing = sightseeing; this.root.classList.toggle('sightseeing', sightseeing)
    this.root.classList.toggle('competition-active', !sightseeing && this.state === 'EXPLORING')
    if (sightseeing) {
      this.q('#scoreboard').hidden = true; this.inRoom = false; this.q('#lobby-roster').replaceChildren()
      this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.lobby input, .avatar-choice, #join-room').forEach(element => element.disabled = false)
    }
    this.q('#journal-title + p').textContent = sightseeing ? 'Khám phá tư liệu và kết nối năm giai đoạn hình thành tư tưởng Hồ Chí Minh.' : 'Khám phá tư liệu và trả lời câu hỏi để kết nối năm giai đoạn.'
  }
  setStartAllowed(allowed: boolean) { this.q<HTMLButtonElement>('#start-button').disabled = !allowed }
  setLobbyMessage(message: string) { this.q(location.pathname === '/start' ? '#host-status' : '#room-message').textContent = message }
  updateLobby(room: Room, myId: string) {
    const host = room.hostId === myId, me = room.players.find(player => player.id === myId)
    this.setStartAllowed(host && room.phase === 'waiting' && room.players.length > 0)
    if (location.pathname === '/start') {
      this.q('#host-status').textContent = host ? (room.phase === 'waiting' ? `${room.players.length} người đã vào phòng HCM202.` : 'Trò chơi đã bắt đầu. Theo dõi bảng điểm trực tiếp.') : 'Một chủ phòng khác đang điều khiển HCM202.'
    } else if (me) {
      this.inRoom = true
      this.q<HTMLButtonElement>('#join-room').disabled = true; this.q('#join-room').textContent = 'ĐÃ VÀO PHÒNG'
      this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.lobby input, .avatar-choice').forEach(element => element.disabled = true)
      if (room.phase === 'waiting') this.setLobbyMessage('Đã vào phòng HCM202 — chờ chủ phòng bắt đầu.')
    }
    const roster = this.q(host ? '#host-roster' : '#lobby-roster'); roster.replaceChildren()
    for (const player of room.players) { const row = document.createElement('p'); row.textContent = player.name; roster.append(row) }
  }
  showRoom(room: Room, myId: string) {
    this.q('#scoreboard').hidden = this.sightseeing; this.q('#score-room').textContent = `PHÒNG ${room.code} · ${room.players.length} NGƯỜI`
    const me = room.players.find(player => player.id === myId)
    this.q('#my-score').textContent = me ? `${me.name}: ${me.score} / 3.000 điểm` : ''
    const list = this.q('#score-players'); list.replaceChildren()
    const status = { waiting: 'Chờ', playing: 'Đang chơi', lost: 'Thua', finished: 'Hoàn thành' }
      ;[...room.players].sort((a, b) => b.score - a.score).forEach(player => {
        const row = document.createElement('div'); row.className = `score-row${player.id === myId ? ' me' : ''}`
        const dot = document.createElement('span'); dot.style.background = visitorColors[player.avatar]
        const name = document.createElement('strong'); name.textContent = player.name
        const points = document.createElement('small'); points.textContent = `${player.score} · ${status[player.status]}`
        row.append(dot, name, points); list.append(row)
      })
  }
  showStageQuiz(stage: number, me: Player | undefined, listened: boolean) {
    const form = this.q('#stage-quiz'); form.hidden = !listened || stage < 0 || stage >= 5 || !me || me.listened < stage + 1
    if (form.hidden) { this.quizKey = ''; return }
    const results = me!.answers.slice(stage * 6, stage * 6 + 6)
    const key = `${stage}:${results.length}`
    if (this.quizKey === key) return
    this.quizKey = key; form.dataset.stage = String(stage); form.dataset.index = String(results.length)
    const container = this.q('#stage-questions'); container.replaceChildren()
    container.hidden = results.length === 6
    this.q('#review-answers').hidden = results.length !== 6
    this.q('#review-answers').textContent = 'XEM KẾT QUẢ 6 CÂU'
    quizBank[stage].forEach((question, index) => {
      if (results.length < 6 && index !== results.length) return
      const section = document.createElement('div'); section.className = 'stage-question'
      const title = document.createElement('p'); title.textContent = `Câu ${index + 1} / 6. ${question.question}`; section.append(title)
      question.choices.forEach((choice, value) => {
        const label = document.createElement('label'), input = document.createElement('input')
        input.type = 'radio'; input.name = results.length === 6 ? `review-answer-${index}` : 'stage-answer'; input.value = String(value); input.required = true
        input.disabled = results.length === 6; input.checked = results[index]?.choice === value
        label.append(input, document.createTextNode(choice)); section.append(label)
      })
      if ('manualAnswer' in question) {
        const other = document.createElement('button'); other.type = 'button'; other.id = results.length === 6 ? `review-other-${index}` : 'answer-other'; other.textContent = 'ĐÁP ÁN KHÁC'; other.setAttribute('aria-pressed', String(results[index]?.choice === 3)); other.disabled = results.length === 6
        const radio = document.createElement('input'); radio.type = 'radio'; radio.name = results.length === 6 ? `review-answer-${index}` : 'stage-answer'; radio.value = '3'; radio.hidden = true; radio.disabled = results.length === 6; radio.checked = results[index]?.choice === 3
        const field = document.createElement('label'); field.textContent = 'Nhập năm / số cần trả lời'; field.hidden = true
        const manual = document.createElement('input'); manual.id = results.length === 6 ? `review-manual-${index}` : 'manual-answer'; manual.type = 'text'; manual.inputMode = 'numeric'; manual.maxLength = 4; manual.pattern = '[0-9]{1,4}'; manual.autocomplete = 'off'; manual.disabled = results.length === 6; manual.value = results[index]?.text ?? ''; field.hidden = results[index]?.choice !== 3; field.append(manual)
        other.onclick = () => { radio.checked = true; field.hidden = false; manual.required = true; other.setAttribute('aria-pressed', 'true'); manual.focus() }
        section.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(input => input.onchange = () => { field.hidden = true; manual.required = false; other.setAttribute('aria-pressed', 'false') })
        section.append(other, radio, field)
      }
      if (results[index]) { const feedback = document.createElement('p'); feedback.className = 'quiz-result'; feedback.textContent = `${results[index].timedOut ? 'Hết giờ · +0 điểm' : results[index].correct ? '✓ Đúng · +100 điểm' : 'Chưa đúng · +0 điểm'}. ${results[index].explanation}`; section.append(feedback) }
      container.append(section)
    })
    this.q('#submit-stage').hidden = results.length === 6
    this.q<HTMLButtonElement>('#submit-stage').disabled = results.length === 6
    const previous = results.at(-1)
    this.q('#quiz-message').textContent = results.length === 6 ? `Đã hoàn thành chặng. ${me!.name}: ${me!.score} điểm.` : previous ? `${previous.timedOut ? 'Câu trước hết giờ' : previous.correct ? 'Câu trước đúng · +100 điểm' : 'Câu trước chưa đúng'}. ${previous.explanation}` : 'Chọn một đáp án và gửi trước khi hết giờ.'
  }
  updateQuizTimer(deadline: number, now: number) {
    const timer = this.q('#quiz-timer')
    timer.hidden = !deadline || this.q('#stage-quiz').hidden
    if (timer.hidden) return
    const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
    timer.textContent = `Còn ${seconds} giây`; timer.classList.toggle('urgent', seconds <= 5)
    if (!seconds) this.q<HTMLButtonElement>('#submit-stage').disabled = true
  }
  markListened(listened: boolean) {
    this.q('#lesson-listen').hidden = listened
    this.q('#narration').classList.toggle('hidden', listened)
  }
  setLessonInstruction(text: string) { this.q('#lesson-instruction').textContent = text }
  showResult(won: boolean, score: number, reason: string) {
    this.closePanels(); this.hideLesson(); this.setGuidedTour(false)
    this.q('#result-title').textContent = won ? 'Hoàn thành hành trình' : 'Lượt chơi kết thúc'
    this.q('#result-copy').textContent = `${reason} Điểm của bạn: ${score} / 3.000.`
    this.q('#result-screen').classList.remove('hidden')
  }
  hideLesson() { this.q('#lesson-gate').hidden = true; this.setTourNextEnabled(true) }
  setTourNextEnabled(enabled: boolean) { this.q<HTMLButtonElement>('#guided-next').disabled = !enabled }
  setTourPaused(paused: boolean) { this.q('#tour-pause').textContent = paused ? 'TIẾP TỤC' : 'TẠM DỪNG'; this.q('#tour-pause').setAttribute('aria-pressed', String(paused)) }
  private updateDiscovery() { this.q('#discovery-count').textContent = `${this.discovered.size} / ${chapters.reduce((sum, c) => sum + c.artifacts.length, 0)}` }
  private saveProgress() { try { localStorage.setItem('museum-progress-v1', JSON.stringify({ discovered: [...this.discovered] })) } catch { /* Optional persistence. */ } }
  private renderJournal() {
    const container = this.q('#journal-content'); container.replaceChildren()
    learning.forEach((item, index) => {
      const section = document.createElement('section'); section.className = 'learning-card'
      const title = document.createElement('h3'); title.textContent = `0${index + 1} · ${item.title}`; section.append(title)
      const progress = document.createElement('p'); progress.className = 'muted'; progress.textContent = chapters[index].artifacts.map(a => `${this.discovered.has(a.id) ? '✓' : '○'} ${a.title}`).join(' · '); section.append(progress)
      const detail = document.createElement('p'); detail.textContent = this.sightseeing ? item.explanation : 'Nghe nội dung tại điểm dừng của chặng để mở sáu câu trắc nghiệm tính điểm.'; section.append(detail); container.append(section)
    })
  }
  setGuidedTour(active: boolean, label = '') { const controls = this.q('#guided-controls'); controls.classList.toggle('visible', active); this.q('#guided-progress').textContent = label }
  reset() { this.closePanels(); this.finalActions.classList.remove('visible'); this.setGuidedTour(false); this.setNarrationControl(true); this.setPrompt(false); this.setChapter() }
  get panelOpen() { return this.state === 'ARTIFACT_OPEN' || this.state === 'CREDITS' }
  private openPanel(panel: HTMLElement, state: AppState) { this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; this.root.querySelectorAll<HTMLElement>('.panel').forEach((item) => { item.classList.remove('open'); item.hidden = true }); panel.hidden = false; requestAnimationFrame(() => panel.classList.add('open')); this.state = state; panel.querySelector<HTMLElement>('.close')?.focus() }
}
