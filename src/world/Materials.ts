import * as THREE from 'three'

export function woodTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#806044'; ctx.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x++) {
    const grain = Math.sin(x * .12) * .025 + Math.sin(x * .31) * .015
    ctx.strokeStyle = `rgba(35,18,8,${.07 + grain})`; ctx.beginPath()
    for (let y = 0; y < 256; y += 8) {
      const offset = Math.sin(y * .025 + x * .09) * 1.4
      if (y === 0) ctx.moveTo(x + offset, y); else ctx.lineTo(x + offset, y)
    }; ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 12); texture.anisotropy = 4
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}
