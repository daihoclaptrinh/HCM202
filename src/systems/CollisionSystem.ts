import * as THREE from 'three'

export class CollisionSystem {
  private obstacles: THREE.Box2[] = []
  private boundaries: Array<{ center: THREE.Vector2; radius: number; openingMinZ: number }> = []
  readonly radius: number

  constructor(radius: number) { this.radius = radius }

  addBox(minX: number, maxX: number, minZ: number, maxZ: number) {
    this.obstacles.push(new THREE.Box2(new THREE.Vector2(minX, minZ), new THREE.Vector2(maxX, maxZ)))
  }

  addCircularBoundary(centerX: number, centerZ: number, radius: number, openingMinZ: number) {
    this.boundaries.push({ center: new THREE.Vector2(centerX, centerZ), radius, openingMinZ })
  }

  private blocked(x: number, z: number) {
    const boxBlocked = this.obstacles.some((box) => x + this.radius > box.min.x && x - this.radius < box.max.x && z + this.radius > box.min.y && z - this.radius < box.max.y)
    if (boxBlocked) return true
    return this.boundaries.some((boundary) => {
      if (z > boundary.openingMinZ && Math.abs(x - boundary.center.x) < 2.15) return false
      return Math.hypot(x - boundary.center.x, z - boundary.center.y) + this.radius > boundary.radius
    })
  }

  move(position: THREE.Vector3, delta: THREE.Vector3) {
    const nextX = position.x + delta.x
    if (!this.blocked(nextX, position.z)) position.x = nextX
    const nextZ = position.z + delta.z
    if (!this.blocked(position.x, nextZ)) position.z = nextZ
  }
}
