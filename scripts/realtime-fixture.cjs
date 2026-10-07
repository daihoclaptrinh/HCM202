// Test-only in-memory delivery implementing the Presence/Broadcast SDK contract.
// The application module is intercepted by Playwright; production never loads this.
module.exports = async function realtimeFixture(context, members = new Map()) {
  await context.addInitScript(() => {
    let current
    window.fixturePresence = state => { if (current) { current.state = state; current.listeners.filter(listener => listener.type === 'presence').forEach(listener => listener.callback()) } }
    window.fixtureBroadcast = packet => { if (current) current.listeners.filter(listener => listener.type === 'broadcast' && listener.event === packet.event).forEach(listener => listener.callback({ payload: packet.payload })) }
    window.fixtureSupabase = {
      channel() {
        current = {
          listeners: [], state: {},
          on(type, options, callback) { this.listeners.push({ type, event: options.event, callback }); return this },
          subscribe(callback) { queueMicrotask(() => callback('SUBSCRIBED')); return this },
          async track(member) { await window.realtimeFixture({ type: 'track', member }); return 'ok' },
          presenceState() { return this.state },
          async send(packet) { await window.realtimeFixture({ type: 'send', packet }); return 'ok' }
        }
        return current
      },
      async removeChannel() { await window.realtimeFixture({ type: 'leave' }); current = undefined; return 'ok' }
    }
  })
  await context.exposeBinding('realtimeFixture', async ({ page }, message) => {
    if (message.type === 'track') members.set(page, message.member)
    if (message.type === 'leave') members.delete(page)
    const alive = [...members.keys()].filter(page => !page.isClosed())
    const deliver = async (target, callback, payload) => {
      try { await target.evaluate(callback, payload) }
      catch (error) { if (!target.isClosed() && !/Execution context was destroyed|Cannot find context/.test(error.message)) throw error }
    }
    if (message.type === 'send') await Promise.all(alive.filter(target => target !== page).map(target => deliver(target, packet => window.fixtureBroadcast(packet), message.packet)))
    else {
      const state = Object.fromEntries([...members.values()].map(member => [member.connectionId ?? member.id, [member]]))
      await Promise.all(alive.map(target => deliver(target, state => window.fixturePresence(state), state)))
    }
  })
  await context.route('**/src/systems/Supabase.ts*', route => route.fulfill({ contentType: 'text/javascript', body: 'export function getSupabase() { return window.fixtureSupabase }' }))
}
