import * as THREE from 'three'
import { CollisionSystem } from '../systems/CollisionSystem'

export class Controls {
  private keys = new Set<string>()
  private dragging = false
  private yaw = 0
  private pitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private velocity = new THREE.Vector3()
  private movement = new THREE.Vector3()
  private forward = new THREE.Vector3()
  private right = new THREE.Vector3()
  enabled = false
  movementLocked = false

  constructor(private camera: THREE.PerspectiveCamera, private collisions: CollisionSystem, private speed: number, private reducedMotion: boolean) {
    window.addEventListener('keydown', (event) => {
      if (!this.enabled || event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable)) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
      this.keys.add(event.code)
    })
    window.addEventListener('keyup', (event) => this.keys.delete(event.code))
    window.addEventListener('pointerdown', (event) => { if (this.enabled && event.target instanceof HTMLCanvasElement) this.dragging = true })
    window.addEventListener('pointerup', () => this.dragging = false)
    window.addEventListener('pointercancel', () => this.dragging = false)
    window.addEventListener('pointermove', (event) => {
      if (!this.dragging || !this.enabled) return
      this.targetYaw -= event.movementX * .003
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - event.movementY * .003, -Math.PI * .36, Math.PI * .36)
    })
    window.addEventListener('blur', () => this.clearInput())
  }

  reset() {
    this.clearInput()
    this.setOrientation(0, 0)
  }

  setOrientation(yaw: number, pitch: number) {
    this.yaw = yaw
    this.pitch = pitch
    this.targetYaw = yaw
    this.targetPitch = pitch
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }

  private clearInput() {
    this.keys.clear()
    this.dragging = false
    this.velocity.set(0, 0, 0)
    this.movement.set(0, 0, 0)
  }

  update(delta: number) {
    const rotationEase = this.reducedMotion ? 1 : Math.min(1, delta * 12)
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, rotationEase)
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, rotationEase)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    if (this.movementLocked) { this.velocity.set(0, 0, 0); return }
    if (!this.enabled) { this.velocity.multiplyScalar(.75); return }
    const z = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'))
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'))
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    this.movement.set(0, 0, 0).addScaledVector(this.forward, z).addScaledVector(this.right, x)
    if (this.movement.lengthSq() > 0) this.movement.normalize().multiplyScalar(this.speed)
    const acceleration = Math.min(1, delta * (this.reducedMotion ? 18 : 7))
    this.velocity.lerp(this.movement, acceleration)
    this.collisions.move(this.camera.position, this.velocity.clone().multiplyScalar(delta))
  }
}
