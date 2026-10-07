import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = fileURLToPath(new URL('../public/audio/', import.meta.url)), rate = 22050
function write(relative, duration, sample) {
  const count = Math.floor(duration * rate), buffer = Buffer.alloc(44 + count * 2)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36); buffer.writeUInt32LE(count * 2, 40)
  for (let i = 0; i < count; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample(i / rate))) * 32767), 44 + i * 2)
  const path = join(root, relative); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buffer)
}
// Original tones, with integral cycles for a continuous twenty-second loop.
for (const [name, frequencies] of [['corridor', [110, 165, 220]], ['final-hall', [130, 195, 260]]]) {
  write(`ambient/${name}.wav`, 20, t => frequencies.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) / 3 * .12 * (.85 + .15 * Math.cos(2 * Math.PI * t / 20)))
}
for (const [name, frequency] of [['map-point', 523.25], ['final-reveal', 392], ['transition', 440]]) {
  write(`sfx/${name}.wav`, 1.4, t => (Math.sin(2 * Math.PI * frequency * t) + .35 * Math.sin(2 * Math.PI * frequency * 1.5 * t)) * .22 * Math.min(1, t / .02) * Math.exp(-4 * t))
}
