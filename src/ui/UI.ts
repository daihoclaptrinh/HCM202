import { exhibitionContent, type Artifact, type Chapter } from '../data/chapters'
import type { AudioSnapshot } from '../systems/AudioManager'
import { chapters } from '../data/chapters'
import { learning, artifactInsights } from '../data/learning'
import quizBank from '../data/quizBank.json'
import { visitorColors, visitorNames } from '../world/Visitors'
import type { Player, Room } from '../systems/Multiplayer'
import { rankPlayers, playerRank, stageSeconds } from '../systems/GameRoom'
import { quizStations } from '../data/quizStations'

type AppState = 'LOADING' | 'START_SCREEN' | 'EXPLORING' | 'ARTIFACT_OPEN' | 'CREDITS'
type UIHandlers = { visit: (mode: 'free' | 'guided') => void; start: () => void; end: () => void; newSession: () => void; downloadResults: () => void; openQuestion: (index: number) => void; host: () => Promise<void>; resume: () => Promise<void>; home: () => void; close: () => void; mute: () => boolean; narration: () => void; listenHere: () => void; transcript: () => void; credits: () => void; restart: () => void; nextTourStep: () => void; exitGuided: () => void; pauseTour: () => void; join: (name: string, avatar: number) => Promise<void>; submitAnswer: (stage: number, index: number, choice: number, text: string) => void }

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
  private huntKey = ''
  private roomKey = ''
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
    this.q('#lesson-listen').onclick = handlers.listenHere
    this.q('#lesson-gate').insertAdjacentHTML('beforeend', '<form id="stage-quiz" hidden><p id="quiz-timer" role="timer"></p><button id="review-answers" type="button" hidden>XEM KẾT QUẢ 6 CÂU</button><div id="stage-questions"></div><p id="quiz-message" aria-live="polite"></p><button id="submit-stage" type="submit">GỬI ĐÁP ÁN</button></form>')
    this.q('#review-answers').onclick = () => {
      const container = this.q('#stage-questions'); container.hidden = !container.hidden
      this.q('#review-answers').textContent = container.hidden ? 'XEM KẾT QUẢ 6 CÂU' : 'THU GỌN KẾT QUẢ'
    }
    const questions = this.q('#stage-questions')
    const questionSelected = () => {
      const selection = window.getSelection()
      if (!selection) return false
      for (let index = 0; index < selection.rangeCount; index++) if ([questions, this.q('#hunt-feedback')].some(element => selection.getRangeAt(index).intersectsNode(element))) return true
      return false
    }
    for (const type of ['copy', 'cut']) document.addEventListener(type, event => {
      if (this.questionOpen || questions.contains(event.target as Node) || this.q('#hunt-feedback').contains(event.target as Node) || questionSelected()) {
        event.preventDefault(); (event as ClipboardEvent).clipboardData?.clearData()
      }
    })
    for (const type of ['contextmenu', 'dragstart', 'selectstart']) questions.addEventListener(type, event => event.preventDefault())
    questions.addEventListener('select', event => {
      const input = event.target
      if (input instanceof HTMLInputElement && input.type === 'text' && input.selectionStart !== input.selectionEnd) input.setSelectionRange(input.selectionEnd, input.selectionEnd)
    }, true)
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'a'].includes(event.key.toLowerCase()) && (this.questionOpen || questions.contains(event.target as Node) || questionSelected())) event.preventDefault()
      if (this.questionOpen && event.key === 'Escape') event.preventDefault()
      if (this.questionOpen && event.key === 'Tab') {
        const fields = [...this.q('#question-panel').querySelectorAll<HTMLElement>('button:not(:disabled), input:not([hidden]):not(:disabled)')].filter(element => element.getClientRects().length > 0)
        const first = fields[0], last = fields.at(-1)
        if (event.shiftKey && (document.activeElement === first || !this.q('#question-panel').contains(document.activeElement))) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || !this.q('#question-panel').contains(document.activeElement))) { event.preventDefault(); first?.focus() }
      }
    })
    this.q('#start .instructions').insertAdjacentHTML('beforebegin', `<div class="experience-tabs" role="group" aria-label="Chọn trải nghiệm"><button id="visit-tab" aria-pressed="true">THAM QUAN TÌM HIỂU</button><button id="competitive-tab" aria-pressed="false">CHƠI TÍNH ĐIỂM</button></div><div id="visitor-entry"><div class="visit-modes"><button id="visit-free-button">TỰ THAM QUAN</button><button id="visit-guided-button">ĐI CÙNG HƯỚNG DẪN VIÊN</button></div></div><div id="competition-entry" hidden><div class="lobby"><p class="eyebrow">PHÒNG HCM202</p><label>Tên người chơi<input id="player-name" maxlength="24" autocomplete="off" placeholder="Tên của bạn"></label><div class="avatar-options">${visitorNames.map((name, index) => `<button class="avatar-choice" data-avatar="${index}" aria-pressed="${index === 0}"><span class="avatar-figure" style="--outfit:${visitorColors[index]}"></span>${name}</button>`).join('')}</div><button id="join-room">VÀO PHÒNG CHƠI</button><p id="room-message" aria-live="polite"></p><div id="lobby-roster"></div><p class="lobby-rules">Tự do chọn khu khám phá. Phải nghe hết nội dung khu đó mới được trả lời câu hỏi tại biển vàng ?.<br>Trả lời lần lượt câu 1 đến 6 trong từng khu; mỗi câu chỉ một lượt, đúng +100 điểm. Giới hạn: 20 / 15 / 10 / 5 / 5 giây.<br>Khi mở câu, phải trả lời hoặc chờ hết giờ; không thể đóng. Chuyển tab / rời cửa sổ / thoát toàn màn hình tính câu đang mở là sai. Không sao chép hay bôi đen câu hỏi / đáp án.<br>F5 tự nối lại bằng token trên trình duyệt; mất kết nối được giữ chỗ 5 phút. F5 khi mở câu vẫn tính câu đó sai. Token chỉ xoá khi quản trò kết thúc phiên.<br>Quản trò kết thúc phiên. Bằng điểm: tổng thời gian trả lời đúng (ms) thấp hơn xếp trên; bằng cả hai thì đồng hạng.</p></div></div><div id="host-entry" hidden><p class="eyebrow">CHỦ PHÒNG · HCM202</p><p id="host-status" aria-live="polite">Đang kết nối phòng...</p><div id="host-roster"></div><p class="host-guide">Chờ người chơi vào /play rồi bấm BẮT ĐẦU. Giữ tab này mở trong suốt phiên. Bấm KẾT THÚC PHIÊN để chốt điểm và top 5; câu đang mở chưa gửi sẽ không được tính.</p><div class="host-actions"><button id="start-button" disabled>BẮT ĐẦU</button><button id="end-session" hidden>KẾT THÚC PHIÊN</button><button id="new-session" hidden>MỞ PHIÊN MỚI</button><button id="download-results">TẢI KẾT QUẢ GẦN NHẤT</button></div><div id="host-ranking"></div></div>`)
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
    this.root.insertAdjacentHTML('beforeend', '<aside id="question-hunt" hidden aria-label="Tìm câu hỏi"><p class="eyebrow">TỰ DO KHÁM PHÁ</p><p>WASD / phím mũi tên: đi lại · Kéo chuột: nhìn quanh.<br>Nghe hết nội dung khu, rồi tìm biển vàng ? để trả lời lần lượt câu 1–6.</p><p id="hunt-location"></p><div id="hunt-grid"></div><p id="hunt-feedback" aria-live="polite"></p></aside><div id="question-blocker" hidden></div><section id="question-panel" hidden role="dialog" aria-modal="true" aria-label="Câu hỏi tính điểm"><p id="question-location" class="eyebrow"></p><p class="question-note">Phải trả lời câu này hoặc chờ hết giờ. Chuyển tab / rời cửa sổ / thoát toàn màn hình sẽ tính câu này sai. Không sao chép / bôi đen câu hỏi và đáp án.</p></section>')
    this.q('#question-panel').append(this.q('#stage-quiz'))
    this.q('#end-session').onclick = handlers.end
    this.q('#new-session').onclick = handlers.newSession
    this.q('#download-results').onclick = handlers.downloadResults
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
    this.root.querySelectorAll('.panel .close').forEach((button) => button.addEventListener('click', handlers.close))
    this.q('#continue').onclick = () => this.q('#mobile').classList.add('hidden')
    if (innerWidth < 768) this.q('#mobile').classList.remove('hidden')
  }

  q<T extends HTMLElement = HTMLElement>(selector: string) { const element = this.root.querySelector<T>(selector); if (!element) throw new Error(`Required UI element ${selector} was not found`); return element }
  progress(value: number) { this.q('.load-track i').style.width = `${value * 100}%` }
  ready() { this.state = 'START_SCREEN'; this.q('#loading').classList.add('hidden'); this.q('#start').classList.remove('hidden'); this.q('#visit-tab').focus(); if (location.pathname === '/start') void this.handlers.host().catch(error => this.setLobbyMessage(error instanceof Error ? error.message : 'Không kết nối được Supabase.')); else if (location.pathname === '/play') void this.handlers.resume().catch(error => this.setLobbyMessage(error instanceof Error ? error.message : 'Không khôi phục được phiên.')) }
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
      this.q('#scoreboard').hidden = true; this.q('#question-hunt').hidden = true; this.q('#question-panel').hidden = true; this.q('#question-blocker').hidden = true; this.inRoom = false; this.q('#lobby-roster').replaceChildren()
      this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.lobby input, .avatar-choice, #join-room').forEach(element => element.disabled = false)
    }
    this.q('#journal-title + p').textContent = sightseeing ? 'Khám phá tư liệu và kết nối năm giai đoạn hình thành tư tưởng Hồ Chí Minh.' : 'Khám phá tư liệu và trả lời câu hỏi để kết nối năm giai đoạn.'
  }
  setStartAllowed(allowed: boolean) { this.q<HTMLButtonElement>('#start-button').disabled = !allowed }
  setLobbyMessage(message: string) { this.q(location.pathname === '/start' ? '#host-status' : '#room-message').textContent = message }
  updateLobby(room: Room, myId: string) {
    const host = room.hostId === myId, me = room.players.find(player => player.id === myId)
    this.setStartAllowed(host && room.phase === 'waiting' && room.players.some(player => player.connected))
    this.q('#start-button').hidden = room.phase !== 'waiting'
    this.q('#end-session').hidden = !host || room.phase !== 'playing'
    this.q('#new-session').hidden = !host || room.phase !== 'ended'
    if (location.pathname === '/start') {
      this.q('#host-status').textContent = host ? (room.phase === 'waiting' ? `${room.players.length} người đã vào phòng HCM202.` : room.phase === 'playing' ? 'Phiên đang diễn ra. Người chơi tự do khám phá; bạn có thể kết thúc bất cứ lúc nào.' : 'Đã kết thúc phiên. Kết quả đã được chốt; tải xuống để lưu lâu dài.') : 'Một quản trò khác đang điều khiển HCM202.'
      this.q('#host-roster').hidden = room.phase !== 'waiting'
    } else if (me) {
      this.inRoom = true
      this.q<HTMLButtonElement>('#join-room').disabled = true; this.q('#join-room').textContent = 'ĐÃ VÀO PHÒNG'
      this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.lobby input, .avatar-choice').forEach(element => element.disabled = true)
      if (room.phase === 'waiting') this.setLobbyMessage('Đã vào phòng HCM202 — chờ quản trò bắt đầu.')
    }
    const roster = this.q(host ? '#host-roster' : '#lobby-roster'); roster.replaceChildren()
    for (const player of room.players) { const row = document.createElement('p'); row.textContent = `${player.name}${player.connected ? '' : ' · Đang chờ nối lại (5 phút)'}`; roster.append(row) }
  }
  private renderRanking(container: HTMLElement, room: Room, myId: string) {
    container.replaceChildren()
    const title = document.createElement('h3'); title.textContent = room.phase === 'ended' ? 'TOP 5 · KẾT QUẢ PHIÊN' : 'TOP 5 · TRỰC TIẾP'
    const rule = document.createElement('p'); rule.className = 'ranking-rule'; rule.textContent = 'Điểm cao hơn xếp trên. Bằng điểm: tổng thời gian trả lời đúng thấp hơn thắng. Không tính thời gian đi lại / nghe chuyện. Bằng cả điểm và ms: đồng hạng.'
    const table = document.createElement('table'); table.className = 'ranking-table'
    table.innerHTML = '<thead><tr><th>Hạng</th><th>Người chơi</th><th>Điểm</th><th>Thời gian đúng (ms)</th></tr></thead>'
    const body = document.createElement('tbody')
    for (const player of rankPlayers(room.players).slice(0, 5)) {
      const row = document.createElement('tr'); row.classList.toggle('me', player.id === myId)
      for (const value of [playerRank(room.players, player), player.name, player.score, player.correctTimeMs]) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell) }
      body.append(row)
    }
    table.append(body); container.append(title, rule, table)
  }
  showRoom(room: Room, myId: string) {
    const key = `${room.sessionId}:${room.version}:${myId}`
    if (this.roomKey === key) return
    this.roomKey = key
    this.q('#scoreboard').hidden = this.sightseeing || location.pathname === '/start' || room.phase !== 'playing'
    this.q('#score-room').textContent = `HCM202 · ${room.players.filter(player => player.status === 'playing').length} NGƯỜI ĐANG CHƠI`
    const me = room.players.find(player => player.id === myId)
    this.q('#my-score').textContent = me ? `${me.name}: ${me.score} điểm · ${me.answeredCount}/30 câu · ${me.correctTimeMs} ms` : ''
    const list = this.q('#score-players'); list.replaceChildren()
    const status = { waiting: 'Chờ', playing: 'Đang chơi', reconnecting: 'Chờ nối lại (5 phút)', lost: 'Hết hạn / rời phiên', finished: 'Đã kết thúc' }
    for (const player of rankPlayers(room.players).slice(0, 5)) {
      const row = document.createElement('div'); row.className = `score-row${player.id === myId ? ' me' : ''}`
      const dot = document.createElement('span'); dot.style.background = visitorColors[player.avatar]
      const name = document.createElement('strong'); name.textContent = `${playerRank(room.players, player)}. ${player.name}`
      const points = document.createElement('small'); points.textContent = `${player.score}đ · ${player.correctTimeMs} ms · ${status[player.status]}`
      row.append(dot, name, points); list.append(row)
    }
    if (location.pathname === '/start') {
      this.q('#host-ranking').hidden = room.phase === 'waiting'
      this.renderRanking(this.q('#host-ranking'), room, myId)
    }
  }
  showCompetitionQuestions(me: Player | undefined, stage: number) {
    const hunt = this.q('#question-hunt')
    hunt.hidden = !me || me.status !== 'playing' || this.sightseeing
    if (hunt.hidden) { this.q('#question-panel').hidden = true; this.q('#question-blocker').hidden = true; return }
    const key = `${stage}:${me!.activeQuestion}:${me!.listened.join(',')}:${me!.answers.map(answer => answer.index).join(',')}`
    if (this.huntKey !== key) {
      this.huntKey = key
      this.q('#hunt-location').textContent = stage < 0 ? 'Đi tới biển vàng ? để tìm câu hỏi. Bạn được chọn khu bất kỳ.' : `KHU 0${stage + 1} · ${quizStations[stage].label} · ${stageSeconds[stage]} giây/câu. ${me!.listened.includes(stage + 1) ? 'Trả lời lần lượt câu 1 đến 6:' : 'Phải nghe hết nội dung khu này để mở câu hỏi.'}`
      const grid = this.q('#hunt-grid'); grid.replaceChildren()
      const nextQuestion = stage < 0 ? -1 : quizBank[stage].findIndex((_question, index) => !me!.answers.some(answer => answer.index === stage * 6 + index))
      if (stage >= 0) quizBank[stage].forEach((_question, index) => {
        const id = stage * 6 + index, answer = me!.answers.find(answer => answer.index === id)
        const button = document.createElement('button'); button.dataset.question = String(id)
        button.textContent = `Câu ${index + 1}${answer ? answer.correct ? ' ✓' : ' ×' : ''}`
        button.disabled = !!answer || me!.activeQuestion !== null || !me!.listened.includes(stage + 1) || index !== nextQuestion
        button.onclick = () => this.handlers.openQuestion(id)
        grid.append(button)
      })
    }
    const questionKey = `${me!.activeQuestion}:${me!.answers.length}`
    if (this.quizKey === questionKey) return
    this.quizKey = questionKey
    const form = this.q('#stage-quiz'), container = this.q('#stage-questions')
    form.hidden = false; container.replaceChildren(); container.hidden = false; this.q('#review-answers').hidden = true
    const active = me!.activeQuestion
    this.q('#submit-stage').hidden = active === null
    this.q<HTMLButtonElement>('#submit-stage').disabled = active === null
    if (active === null) {
      this.q('#question-panel').hidden = true; this.q('#question-blocker').hidden = true
      const answer = me!.answers.at(-1)
      this.q('#hunt-feedback').textContent = answer ? `${answer.abandoned ? 'Rời màn hình · câu này tính sai · +0 điểm' : answer.timedOut ? 'Hết giờ · +0 điểm' : answer.correct ? 'Đúng · +100 điểm' : 'Chưa đúng · +0 điểm'} · ${answer.elapsedMs} ms. ${answer.explanation} Tiếp tục với câu kế tiếp trong khu này, hoặc khám phá khu khác.` : ''
      return
    }
    const questionStage = Math.floor(active / 6), index = active % 6, question = quizBank[questionStage][index]
    form.dataset.stage = String(questionStage); form.dataset.index = String(index)
    this.q('#question-location').textContent = `KHU 0${questionStage + 1} · CÂU ${index + 1}/6`
    const section = document.createElement('div'); section.className = 'stage-question'
    const title = document.createElement('p'); title.textContent = question.question; section.append(title)
    question.choices.forEach((choice, value) => {
      const label = document.createElement('label'), input = document.createElement('input')
      input.type = 'radio'; input.name = 'stage-answer'; input.value = String(value); input.required = true
      label.append(input, document.createTextNode(choice)); section.append(label)
    })
    if ('manualAnswer' in question) {
      const other = document.createElement('button'); other.type = 'button'; other.id = 'answer-other'; other.textContent = 'ĐÁP ÁN KHÁC'; other.setAttribute('aria-pressed', 'false')
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'stage-answer'; radio.value = '3'; radio.hidden = true
      const field = document.createElement('label'); field.textContent = 'Nhập năm / số cần trả lời'; field.hidden = true
      const manual = document.createElement('input'); manual.id = 'manual-answer'; manual.type = 'text'; manual.inputMode = 'numeric'; manual.maxLength = 4; manual.pattern = '[0-9]{1,4}'; manual.autocomplete = 'off'; field.append(manual)
      other.onclick = () => { radio.checked = true; field.hidden = false; manual.required = true; other.setAttribute('aria-pressed', 'true'); manual.focus() }
      section.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(input => input.onchange = () => { field.hidden = true; manual.required = false; other.setAttribute('aria-pressed', 'false') })
      section.append(other, radio, field)
    }
    container.append(section); this.q('#quiz-message').textContent = 'Chọn đáp án và gửi trước khi hết giờ.'
    this.closePanels(); this.q('#question-panel').hidden = false; this.q('#question-blocker').hidden = false
    this.q<HTMLInputElement>('#stage-questions input[type=radio]').focus()
  }
  updateQuizTimer(deadline: number, now: number) {
    const timer = this.q('#quiz-timer')
    timer.hidden = !deadline || this.q('#stage-quiz').hidden
    if (timer.hidden) return
    const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
    timer.textContent = `Còn ${seconds} giây`; timer.classList.toggle('urgent', seconds <= 5)
    if (!seconds) this.q<HTMLButtonElement>('#submit-stage').disabled = true
  }
  showSessionResult(room: Room, myId: string) {
    const me = room.players.find(player => player.id === myId)
    this.closePanels(); this.hideLesson(); this.setGuidedTour(false)
    this.q('#question-hunt').hidden = true; this.q('#question-panel').hidden = true; this.q('#question-blocker').hidden = true; this.q('#hud').classList.add('hidden')
    this.q('#result-title').textContent = 'Phiên chơi đã kết thúc'
    this.q('#result-copy').textContent = me ? `${me.name}: ${me.score} điểm · ${me.correctTimeMs} ms · Hạng ${playerRank(room.players, me)}. Chờ quản trò mở phiên mới.` : 'Quản trò đã chốt kết quả.'
    let ranking = this.root.querySelector<HTMLElement>('#final-ranking')
    if (!ranking) { ranking = document.createElement('div'); ranking.id = 'final-ranking'; this.q('#result-copy').after(ranking) }
    this.renderRanking(ranking, room, myId)
    this.q('#new-game').hidden = true; this.q('#result-screen').classList.remove('hidden')
  }
  resetSession() {
    this.quizKey = ''; this.huntKey = ''; this.roomKey = ''
    this.q('#result-screen').classList.add('hidden'); this.q('#question-panel').hidden = true; this.q('#question-blocker').hidden = true; this.q('#question-hunt').hidden = true
    this.showHome()
  }
  suspendSession(message: string) {
    this.quizKey = ''; this.huntKey = ''; this.roomKey = ''
    this.closePanels(); this.hideLesson(); this.setGuidedTour(false)
    this.q('#question-panel').hidden = true; this.q('#question-blocker').hidden = true; this.q('#question-hunt').hidden = true
    this.showHome(); this.setLobbyMessage(message)
  }
  markListened(listened: boolean) {
    this.q('#lesson-listen').hidden = listened
    this.q('#narration').classList.toggle('hidden', listened)
  }
  setLessonInstruction(text: string) { this.q('#lesson-instruction').textContent = text }
  showResult(won: boolean, score: number, reason: string) {
    this.closePanels(); this.hideLesson(); this.setGuidedTour(false)
    this.q('#question-hunt').hidden = true; this.q('#question-panel').hidden = true; this.q('#question-blocker').hidden = true
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
      const detail = document.createElement('p'); detail.textContent = this.sightseeing ? item.explanation : 'Nghe hết nội dung khu này để mở câu hỏi tại biển vàng ?. Trả lời lần lượt câu 1 đến 6; bạn vẫn được chọn khu khám phá theo ý muốn.'; section.append(detail); container.append(section)
    })
  }
  setGuidedTour(active: boolean, label = '') { const controls = this.q('#guided-controls'); controls.classList.toggle('visible', active); this.q('#guided-progress').textContent = label }
  reset() { this.closePanels(); this.finalActions.classList.remove('visible'); this.setGuidedTour(false); this.setNarrationControl(true); this.setPrompt(false); this.setChapter() }
  get questionOpen() { return !this.q('#question-panel').hidden && !this.q('#question-blocker').hidden }
  get panelOpen() { return this.state === 'ARTIFACT_OPEN' || this.state === 'CREDITS' }
  private openPanel(panel: HTMLElement, state: AppState) { this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; this.root.querySelectorAll<HTMLElement>('.panel').forEach((item) => { item.classList.remove('open'); item.hidden = true }); panel.hidden = false; requestAnimationFrame(() => panel.classList.add('open')); this.state = state; panel.querySelector<HTMLElement>('.close')?.focus() }
}
