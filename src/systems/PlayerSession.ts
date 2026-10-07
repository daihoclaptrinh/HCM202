export const playerSessionKey = 'hcm202-player-session-v4'
export type PlayerSession = { token: string; name: string; avatar: number; sessionId: string; audio?: { path: string; seconds: number } }

export function readPlayerSession(): PlayerSession | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(playerSessionKey) ?? 'null')
    if (saved && typeof saved.token === 'string' && /^[0-9a-f-]{36}$/i.test(saved.token) && typeof saved.name === 'string' && typeof saved.sessionId === 'string' && Number.isInteger(saved.avatar)) return saved
  } catch { /* A new connection remains available if browser storage is unavailable. */ }
}
export function savePlayerSession(session: PlayerSession) {
  try { localStorage.setItem(playerSessionKey, JSON.stringify(session)) } catch { /* Keep the live session usable. */ }
}
export function clearPlayerSession(token: string) {
  if (readPlayerSession()?.token !== token) return
  try { localStorage.removeItem(playerSessionKey) } catch { /* The host still refuses ended-session commands. */ }
}
