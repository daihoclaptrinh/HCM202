import * as THREE from 'three'
import { chapters, exhibitionContent, type Artifact, type Chapter } from '../data/chapters'
import { museumConfig as config } from '../data/museumConfig'
import { CollisionSystem } from '../systems/CollisionSystem'
import { boardPlane, textPlane } from './TextFactory'
import { woodTexture } from './Materials'

export type Interactive = { mesh: THREE.Object3D; artifact: Artifact }

export class Museum {
  readonly group = new THREE.Group()
  readonly interactives: Interactive[] = []
  readonly chapterLights: THREE.Light[] = []
  readonly quadrantLights: THREE.SpotLight[] = []
  readonly transitionDoors: THREE.Group[] = []
  readonly transitionDoorZ: number
  readonly mapRoute: THREE.Line
  private materials = {
    wall: new THREE.MeshStandardMaterial({ color: config.colors.ivory, roughness: .94 }),
    floor: new THREE.MeshStandardMaterial({ color: '#b6a18a', map: woodTexture(), roughness: .72 }),
    dark: new THREE.MeshStandardMaterial({ color: config.colors.dark, roughness: .9 }),
    bronze: new THREE.MeshStandardMaterial({ color: config.colors.bronze, roughness: .52, metalness: .5 }),
    paper: new THREE.MeshStandardMaterial({ color: '#b9aa91', roughness: .95 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#8b8175', transparent: true, opacity: .18, roughness: .25 })
  }

  constructor(private scene: THREE.Scene, collisions: CollisionSystem) {
    this.scene.add(this.group)
    this.buildCorridor(collisions)
    this.buildPrologue()
    let route: THREE.Line | undefined
    chapters.forEach((stage) => {
      const stageRoute = this.buildStage(stage, collisions)
      if (stageRoute) route = stageRoute
    })
    if (!route) throw new Error('Stage 2 journey route was not created')
    this.mapRoute = route
    this.transitionDoorZ = config.hall.centerZ + config.hall.radius + 7
    this.buildTransitionDoorway()
    this.buildFinalHall(collisions)
    this.buildAmbientLighting()
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z); mesh.receiveShadow = true; this.group.add(mesh)
    return mesh
  }

  private buildCorridor(collisions: CollisionSystem) {
    const { width, height, start, end } = config.corridor
    const length = start - end
    this.mesh(new THREE.BoxGeometry(width, .16, length), this.materials.floor, 0, -.08, (start + end) / 2)
    this.mesh(new THREE.BoxGeometry(width, .12, length), this.materials.dark, 0, height, (start + end) / 2)
    // Bury the wall bottoms below the entire floor slab. Previously both the
    // wall's bottom face and the floor's top face were at y=0, so the depth
    // buffer alternated between them along a camera-dependent strip.
    const wallDepthBelowFloor = .2
    for (const side of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(.18, height + wallDepthBelowFloor, length), this.materials.wall,
        side * width / 2, (height - wallDepthBelowFloor) / 2, (start + end) / 2)
    }
    collisions.addBox(-20, -width / 2 + .08, end, start); collisions.addBox(width / 2 - .08, 20, end, start); collisions.addBox(-width / 2, width / 2, start, start + 1)
    this.mesh(new THREE.BoxGeometry(.035, .012, length), this.materials.bronze, -1.72, .01, (start + end) / 2).receiveShadow = false
    config.years.forEach(({ z }) => this.mesh(new THREE.BoxGeometry(.08, .014, .025), this.materials.bronze, -1.72, .018, z))
  }

  private wallText(text: string, side: 'left' | 'right', z: number, width: number, height: number, options = {}) {
    const plane = textPlane(text, width, height, { color: '#322419', ...options })
    plane.position.set(side === 'left' ? -2.085 : 2.085, 1.95, z)
    plane.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2
    this.group.add(plane)
    return plane
  }

  private buildPrologue() {
    this.wallText(exhibitionContent.prologue.lead, 'left', 4, 3.4, 2.5, { title: true, size: 55 })
    this.wallText(exhibitionContent.prologue.stages, 'right', 0, 3.3, 2.2, { title: true, size: 58 })
  }

  private buildStage(stage: Chapter, collisions: CollisionSystem) {
    const centerZ = (stage.start + stage.end) / 2
    this.buildInformationBoard(stage, centerZ)
    const route = this.buildExhibition(stage, centerZ, collisions)
    this.buildTransition(stage)
    this.buildStageLighting(stage, centerZ)
    return route
  }

  private buildInformationBoard(stage: Chapter, z: number) {
    const side = stage.board.side
    const x = side === 'left' ? -2.04 : 2.04
    const frame = this.mesh(new THREE.BoxGeometry(.07, 2.5, 3.4), this.materials.bronze, x, 2, z)
    const surface = boardPlane({ number: `0${stage.index}`, period: stage.board.period, title: stage.board.title.replaceAll('\n', ' '), body: stage.board.content }, 3.25, 2.35)
    surface.position.set(side === 'left' ? x + .041 : x - .041, 2, z)
    surface.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2
    this.group.add(surface)
    frame.castShadow = true
  }

  private buildExhibition(stage: Chapter, z: number, collisions: CollisionSystem) {
    switch (stage.exhibition.type) {
      case 'desk': this.buildDeskExhibition(stage, z, collisions); return undefined
      case 'journey-map': return this.buildJourneyExhibition(stage, z, collisions)
      case 'document-case': this.buildDocumentCase(stage, z, collisions); return undefined
      case 'return-archive': this.buildReturnArchive(stage, z, collisions); return undefined
      case 'wall-timeline': this.buildWallTimeline(stage, z, collisions); return undefined
    }
  }

  private sideX(side: 'left' | 'right', offset = 1.45) { return side === 'left' ? -offset : offset }

  private artifactMaterial(artifact: Artifact) {
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${artifact.image.replace(/^\//, '')}`, loaded => {
      const image = loaded.image as HTMLImageElement
      const ratio = image.naturalWidth / image.naturalHeight
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1024
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#cbbca2'; ctx.fillRect(0, 0, 768, 1024)
      const width = Math.min(768, 1024 * ratio), height = width / ratio
      ctx.drawImage(image, (768 - width) / 2, (1024 - height) / 2, width, height)
      loaded.image = canvas; loaded.needsUpdate = true
    })
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
    return new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: new THREE.Color('#3a3028'), emissiveIntensity: .28, roughness: .82, side: THREE.DoubleSide })
  }

  private buildDeskExhibition(stage: Chapter, z: number, collisions: CollisionSystem) {
    const x = this.sideX(stage.exhibition.side, 1.2)
    const desk = this.mesh(new THREE.BoxGeometry(1.75, .12, 1.25), this.materials.floor, x, .82, z)
    for (const dx of [-.7, .7]) for (const dz of [-.48, .48]) this.mesh(new THREE.BoxGeometry(.1, .8, .1), this.materials.floor, x + dx, .4, z + dz)
    const cover = new THREE.MeshStandardMaterial({ color: '#44251c', roughness: .82 })
    const pages = new THREE.MeshStandardMaterial({ color: '#c8b996', roughness: .96 })
    const book = new THREE.Group(); book.position.set(x - .22, .93, z + .03); book.rotation.y = -.18
    const leftCover = new THREE.Mesh(new THREE.BoxGeometry(.42, .025, .56), cover); leftCover.position.x = -.215
    const rightCover = leftCover.clone(); rightCover.position.x = .215
    const leftPages = new THREE.Mesh(new THREE.BoxGeometry(.39, .035, .52), pages); leftPages.position.set(-.205, .026, 0); leftPages.rotation.z = -.035
    const rightPages = leftPages.clone(); rightPages.position.x = .205; rightPages.rotation.z = .035
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .55, 12), cover); spine.rotation.x = Math.PI / 2
    book.add(leftCover, rightCover, leftPages, rightPages, spine); this.group.add(book)
    const inkstone = this.mesh(new THREE.CylinderGeometry(.14, .16, .055, 24), this.materials.dark, x + .48, .91, z - .2)
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .012, 24), new THREE.MeshStandardMaterial({ color: '#080706', roughness: .35 })); ink.position.set(x + .48, .944, z - .2); this.group.add(ink)
    const brush = new THREE.Group(); brush.position.set(x + .12, 1.12, z - .4); brush.rotation.x = -Math.PI * 2 / 3
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, .62, 12), this.materials.bronze)
    const bristles = [new THREE.Vector2(0, -.075), new THREE.Vector2(.012, -.062), new THREE.Vector2(.032, -.018), new THREE.Vector2(.036, .025), new THREE.Vector2(.026, .055), new THREE.Vector2(.016, .065)]
    const tip = new THREE.Mesh(new THREE.LatheGeometry(bristles, 20), new THREE.MeshStandardMaterial({ color: '#211a16', roughness: 1 })); tip.position.y = -.375
    brush.add(handle, tip); this.group.add(brush)
    stage.artifacts.forEach((artifact, index) => this.buildArchiveMount(artifact, x > 0 ? 'right' : 'left', z + (index - 1) * .75, 1.85))
    collisions.addBox(x - 1, x + 1, z - .78, z + .78); desk.castShadow = true; inkstone.castShadow = true
  }

  private buildJourneyExhibition(stage: Chapter, z: number, collisions: CollisionSystem) {
    const side = stage.exhibition.side
    const x = side === 'left' ? -2.03 : 2.03
    const map = new THREE.Group(); map.position.set(x, 2.15, z); map.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2
    map.add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.15, .06), this.materials.dark))
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.5, -.38, .04),
      new THREE.Vector3(0, .58, .04),
      new THREE.Vector3(1.5, .38, .04)
    )
    const routePoints = curve.getPoints(48)
    const geometry = new THREE.BufferGeometry().setFromPoints(routePoints); geometry.setDrawRange(0, 0)
    const route = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: config.colors.warm, transparent: true, opacity: .82 })); map.add(route)
    const endpoints = [routePoints[0], routePoints[routePoints.length - 1]]
    endpoints.forEach((point, index) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.055, .085, 32), new THREE.MeshBasicMaterial({ color: index === 1 ? config.colors.warm : config.colors.bronze, transparent: true, opacity: .9 }))
      ring.position.copy(point).add(new THREE.Vector3(0, 0, .01)); map.add(ring)
    })
    const labels = textPlane(exhibitionContent.map.labels, 3.95, 1.9, { size: 28, align: 'center' }); labels.position.z = .05; map.add(labels); this.group.add(map)
    stage.artifacts.forEach((artifact, index) => this.buildArchiveMount(artifact, side, z + 1.6 + index * .7, 1.1))
    collisions.addBox(this.sideX(side, 1.72) - .45, this.sideX(side, 1.72) + .45, z - 2.25, z + 2.25)
    return route
  }

  private buildDocumentCase(stage: Chapter, z: number, collisions: CollisionSystem) {
    const side = stage.exhibition.side; const x = this.sideX(side, 1.55)
    const base = this.mesh(new THREE.BoxGeometry(.75, .72, 4.5), this.materials.dark, x, .36, z)
    const glass = this.mesh(new THREE.BoxGeometry(.78, .48, 4.5), this.materials.glass, x, .86, z)
    stage.artifacts.forEach((artifact, index) => {
      const documentZ = z + (index - 1) * 1.35
      const document = this.mesh(new THREE.BoxGeometry(.5, .04, .85), this.materials.paper, x, 1.03, documentZ)
      const image = this.mesh(new THREE.PlaneGeometry(.48, .81), this.artifactMaterial(artifact), x, 1.055, documentZ); image.rotation.x = -Math.PI / 2
      this.interactives.push({ mesh: document, artifact })
      const label = textPlane(`${artifact.code}\n${artifact.title}\n${artifact.year}`, .82, .58, { size: 46, lineHeight: 54, background: '#211b17', align: 'center' })
      label.position.set(side === 'left' ? x + .4 : x - .4, .72, documentZ); label.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2; this.group.add(label)
    })
    collisions.addBox(x - .55, x + .55, z - 2.4, z + 2.4); base.castShadow = true; glass.renderOrder = 2
  }

  private buildReturnArchive(stage: Chapter, z: number, collisions: CollisionSystem) {
    const side = stage.exhibition.side; const x = this.sideX(side, 1.42)
    const stone = new THREE.MeshStandardMaterial({ color: '#716b60', roughness: 1 })
    const slab = this.mesh(new THREE.BoxGeometry(1.35, .18, 1.9, 3, 1, 3), stone, x, .82, z)
    slab.rotation.y = -.06; slab.rotation.z = .025
    const leftSupport = this.mesh(new THREE.CylinderGeometry(.25, .34, .72, 7), stone, x - .43, .39, z - .5)
    const rightSupport = this.mesh(new THREE.CylinderGeometry(.24, .32, .67, 7), stone, x + .4, .36, z + .48)
    leftSupport.rotation.z = -.08; rightSupport.rotation.z = .06
    const paper = this.mesh(new THREE.PlaneGeometry(.72, .95), this.materials.paper, x, .922, z + .08); paper.rotation.x = -Math.PI / 2; paper.rotation.z = -.12
    const pencil = this.mesh(new THREE.CylinderGeometry(.01, .012, .55, 10), this.materials.bronze, x + .28, .94, z - .12); pencil.rotation.z = Math.PI / 2; pencil.rotation.y = -.35
    stage.artifacts.forEach((artifact) => this.buildArchiveMount(artifact, side, z + 1.15, 1.9))
    collisions.addBox(x - .78, x + .78, z - 1.12, z + 1.12); slab.castShadow = true; leftSupport.castShadow = true; rightSupport.castShadow = true
  }

  private buildWallTimeline(stage: Chapter, z: number, collisions: CollisionSystem) {
    const side = stage.exhibition.side; const x = side === 'left' ? -2.03 : 2.03
    const board = this.mesh(new THREE.BoxGeometry(.07, 2.25, 4.8), this.materials.dark, x, 2, z)
    const timeline = textPlane('1941                 1945                 1954                 1969\n\nGIẢI PHÓNG      ĐỘC LẬP       BẢO VỆ        XÂY DỰNG · THỐNG NHẤT', 4.6, 2.05, { size: 30, background: '#211d19', align: 'center' })
    timeline.position.set(side === 'left' ? x + .041 : x - .041, 2, z); timeline.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2; this.group.add(timeline)
    stage.artifacts.forEach((artifact) => this.buildArtifactStand(artifact, side, z + 2.1, collisions))
    board.castShadow = true
  }

  private buildArchiveMount(artifact: Artifact, side: 'left' | 'right', z: number, y: number) {
    const x = side === 'left' ? -2.02 : 2.02
    const document = this.mesh(new THREE.BoxGeometry(.05, .7, .52), this.materials.paper, x, y, z)
    const image = new THREE.Mesh(new THREE.PlaneGeometry(.48, .66), this.artifactMaterial(artifact))
    image.position.set(side === 'left' ? x + .028 : x - .028, y, z); image.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2; this.group.add(image)
    const label = textPlane(`${artifact.code}\n${artifact.title}`, .82, .52, { size: 44, lineHeight: 52, background: '#211b17', align: 'center' })
    label.position.set(side === 'left' ? x + .03 : x - .03, y - .62, z); label.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2; this.group.add(label)
    this.interactives.push({ mesh: document, artifact })
  }

  private buildArtifactStand(artifact: Artifact, side: 'left' | 'right', z: number, collisions: CollisionSystem) {
    const x = this.sideX(side, 1.55)
    const base = this.mesh(new THREE.BoxGeometry(.8, .72, .75), this.materials.dark, x, .36, z)
    const document = this.mesh(new THREE.BoxGeometry(.04, .7, .5), this.materials.paper, x, 1.1, z)
    const image = this.mesh(new THREE.PlaneGeometry(.46, .66), this.artifactMaterial(artifact), side === 'left' ? x + .021 : x - .021, 1.1, z)
    image.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2
    this.interactives.push({ mesh: document, artifact }); collisions.addBox(x - .5, x + .5, z - .5, z + .5); base.castShadow = true
  }

  private buildTransition(stage: Chapter) {
    stage.transitionAfter.entries.forEach((entry) => this.wallText(entry.text, entry.side, entry.z, 2.8, entry.text.includes('1941') ? 1.3 : .9, { title: true, size: entry.text.length > 45 ? 42 : 54, align: 'center' }))
  }

  private buildStageLighting(stage: Chapter, z: number) {
    const boardX = this.sideX(stage.board.side, 1.2); const exhibitX = this.sideX(stage.exhibition.side, 1.25)
    const boardLight = new THREE.SpotLight(config.colors.warm, stage.index === 4 ? 4 : 6, 7, .98, .82, 1.5)
    boardLight.position.set(-boardX * .2, 3.45, z); boardLight.target.position.set(boardX, 2.15, z)
    const exhibitLight = new THREE.SpotLight(config.colors.warm, stage.index === 4 ? 5 : stage.index === 5 ? 13 : 9, 7, .7, .7, 1.4)
    const exhibitZ = stage.exhibition.type === 'wall-timeline' ? z + 2.1 : z
    exhibitLight.position.set(-exhibitX * .15, 3.45, exhibitZ); exhibitLight.target.position.set(exhibitX, stage.index === 5 ? 1.1 : .95, exhibitZ)
    exhibitLight.castShadow = stage.index === 1 || stage.index === 3
    exhibitLight.shadow.mapSize.set(1024, 1024)
    exhibitLight.shadow.camera.near = .1; exhibitLight.shadow.camera.far = 10
    exhibitLight.shadow.bias = -.0002; exhibitLight.shadow.normalBias = .035
    this.group.add(boardLight, boardLight.target, exhibitLight, exhibitLight.target); this.chapterLights.push(boardLight, exhibitLight)
  }

  private buildTransitionDoorway() {
    const z = this.transitionDoorZ
    const wood = new THREE.MeshStandardMaterial({ color: '#2d1e16', roughness: .7, metalness: .03 })
    const recessedWood = new THREE.MeshStandardMaterial({ color: '#1d1511', roughness: .88 })
    const lintel = this.mesh(new THREE.BoxGeometry(4.4, .32, .5), this.materials.bronze, 0, 3.3, z)
    const leftPost = this.mesh(new THREE.BoxGeometry(.34, 3.45, .52), this.materials.bronze, -2.03, 1.72, z)
    const rightPost = this.mesh(new THREE.BoxGeometry(.34, 3.45, .52), this.materials.bronze, 2.03, 1.72, z)
    const threshold = this.mesh(new THREE.BoxGeometry(4.2, .055, .58), this.materials.bronze, 0, .028, z)
    const makeDoor = (direction: -1 | 1) => {
      const door = new THREE.Group(); door.position.set(direction * .92, 0, z)
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.84, 3.08, .24), wood); slab.position.y = 1.56; slab.castShadow = true; door.add(slab)
      for (const y of [.82, 2.2]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.48, .92, .035), recessedWood); panel.position.set(0, y, .138); door.add(panel)
        const border = new THREE.Mesh(new THREE.BoxGeometry(1.58, 1.02, .025), this.materials.bronze); border.position.set(0, y, .125); door.add(border)
        panel.position.z = .145
      }
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .28, 20), this.materials.bronze); handle.rotation.x = Math.PI / 2; handle.position.set(-direction * .62, 1.55, .22); door.add(handle)
      this.group.add(door); return door
    }
    this.transitionDoors.push(makeDoor(-1), makeDoor(1))
    lintel.castShadow = true; leftPost.castShadow = true; rightPost.castShadow = true; threshold.receiveShadow = false
    const glow = new THREE.PointLight(config.colors.warm, 4.2, 8, 2)
    glow.position.set(0, 2.15, z - 1.2); this.group.add(glow)
  }

  private buildFinalHall(collisions: CollisionSystem) {
    const { centerZ, radius, height } = config.hall
    // The hall overlaps the corridor at its entrance; separate their top faces
    // slightly so the depth buffer never has to choose between coplanar floors.
    this.mesh(new THREE.CylinderGeometry(radius, radius, .18, 64), this.materials.floor, 0, -.095, centerZ)
    this.mesh(new THREE.CylinderGeometry(radius, radius, .15, 64), this.materials.dark, 0, height, centerZ)
    const wall = this.mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, Math.PI * .18, Math.PI * 1.64), this.materials.wall, 0, height / 2, centerZ); wall.material.side = THREE.BackSide
    const pedestal = this.mesh(new THREE.CylinderGeometry(1.2, 1.28, .55, 48), this.materials.floor, 0, .275, centerZ)
    this.mesh(new THREE.TorusGeometry(2.05, .025, 8, 64), this.materials.bronze, 0, .025, centerZ).rotation.x = Math.PI / 2
    const bookA = this.mesh(new THREE.BoxGeometry(.8, .06, 1), this.materials.paper, -.42, .7, centerZ); const bookB = this.mesh(new THREE.BoxGeometry(.8, .06, 1), this.materials.paper, .42, .7, centerZ); bookA.rotation.z = -.13; bookB.rotation.z = .13
    collisions.addBox(-1.65, 1.65, centerZ - 1.65, centerZ + 1.65); collisions.addCircularBoundary(0, centerZ, radius - .12, centerZ + radius - .8)
    const themeAngles = [-.815, .865, 2.35, 3.9]
    exhibitionContent.finalHall.themes.forEach((theme, index) => {
      const angle = themeAngles[index]
      const panel = textPlane(`${theme.title}\n${theme.subtitle}\n\n${theme.copy}`, 4.3, 2.25, { title: true, size: 38, align: 'center' })
      panel.position.set(Math.sin(angle) * 7.7, 2.65, centerZ + Math.cos(angle) * 7.7); panel.lookAt(0, 2.65, centerZ); this.group.add(panel)
      const light = new THREE.SpotLight(config.colors.warm, 0, 10, .65, .8, 1.5); light.position.set(Math.sin(angle) * 5.5, 4.8, centerZ + Math.cos(angle) * 5.5); light.target = panel; this.group.add(light, light.target); this.quadrantLights.push(light)
    })
    const title = textPlane(`${exhibitionContent.finalHall.title}\n\n${exhibitionContent.finalHall.definition}`, 5.5, 2.8, { title: true, size: 48, align: 'center' }); title.position.set(0, 3, centerZ - 7.1); this.group.add(title)
    const final = textPlane(`${exhibitionContent.finalHall.closing}\n\n${exhibitionContent.finalHall.question}`, 5.1, 3, { title: true, size: 44, align: 'center' }); final.position.set(0, 3, centerZ + 7.75); final.rotation.y = Math.PI; (final.material as THREE.MeshBasicMaterial).side = THREE.FrontSide; this.group.add(final); pedestal.castShadow = true
    const center = new THREE.SpotLight(config.colors.warm, 14, 12, .5, .65, 1.4); center.position.set(0, 5.6, centerZ); center.target.position.set(0, 0, centerZ); center.castShadow = true; center.shadow.mapSize.set(1024, 1024)
    center.shadow.camera.near = .1; center.shadow.camera.far = 14
    center.shadow.bias = -.0002; center.shadow.normalBias = .035
    this.group.add(center, center.target)
  }

  private buildAmbientLighting() {
    this.scene.add(new THREE.HemisphereLight('#fff0d8', '#80674f', 1.7))
    const stripMaterial = new THREE.MeshBasicMaterial({ color: '#c29a61' })
    for (const x of [-1.9, 1.9]) this.mesh(new THREE.BoxGeometry(.025, .025, 80), stripMaterial, x, .06, -28)
    for (let z = 6; z > -68; z -= 10) {
      const fixture = this.mesh(new THREE.BoxGeometry(1.2, .025, .18), new THREE.MeshBasicMaterial({ color: '#fff1d2' }), 0, 3.72, z)
      fixture.receiveShadow = false
      const fill = new THREE.PointLight('#ffe6be', 7, 12, 1.5); fill.position.set(0, 3.2, z); this.group.add(fill)
    }
  }

  updateMap(progress: number) {
    const count = this.mapRoute.geometry.getAttribute('position').count
    this.mapRoute.geometry.setDrawRange(0, Math.max(0, Math.ceil(progress * count)))
  }

  updateTransitionDoor(playerZ: number, delta: number, reducedMotion: boolean) {
    const approachDistance = playerZ - this.transitionDoorZ
    const openAmount = 1 - THREE.MathUtils.smoothstep(approachDistance, 1.15, 3.8)
    const targetOffset = openAmount * 1.72
    const easing = reducedMotion ? 1 : Math.min(1, delta * 3.2)
    this.transitionDoors[0].position.x = THREE.MathUtils.lerp(this.transitionDoors[0].position.x, -.92 - targetOffset, easing)
    this.transitionDoors[1].position.x = THREE.MathUtils.lerp(this.transitionDoors[1].position.x, .92 + targetOffset, easing)
  }
}
