import * as THREE from 'three'
import { textPlane } from './TextFactory'
import type { Player } from '../systems/Multiplayer'
export const visitorColors = ['#b98b4f', '#518d82', '#617fb0', '#a76379']
export const visitorNames = ['Nhà khám phá', 'Nhà nghiên cứu', 'Người kể chuyện', 'Người lưu giữ']
export class Visitors {
  private models = new Map<string, THREE.Group>()
  constructor(private scene: THREE.Scene) {}
  get count() { return this.models.size }
  update(players: Player[], myId: string) {
    const active = new Set<string>()
    for (const player of players) {
      if (player.id === myId || player.status !== 'playing') continue
      active.add(player.id)
      let group = this.models.get(player.id)
      if (!group) {
        group = new THREE.Group()
        const outfit = new THREE.MeshStandardMaterial({ color: visitorColors[player.avatar] ?? visitorColors[0], roughness: .85 })
        const skin = new THREE.MeshStandardMaterial({ color: '#dfba94', roughness: .9 })
        const body = new THREE.Mesh(new THREE.CylinderGeometry(.17, .24, .65, 10), outfit); body.position.y = .95
        const head = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), skin); head.position.y = 1.48
        group.add(body, head)
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .55, 8), outfit); leg.position.set(side * .1, .3, 0)
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .55, 8), outfit); arm.position.set(side * .26, .95, 0); arm.rotation.z = side * .15
          group.add(leg, arm)
        }
        const label = textPlane(player.name, 1.2, .3, { size: 50, align: 'center', background: '#211b17' }); label.position.y = 1.9; group.add(label)
        this.models.set(player.id, group); this.scene.add(group)
      }
      group.position.set(player.position.x, 0, player.position.z)
      group.rotation.y = player.position.yaw
    }
    for (const [id, group] of this.models) if (!active.has(id)) {
      this.scene.remove(group); this.models.delete(id)
      group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; for (const material of new Set(materials)) material.dispose() } })
    }
  }
}
