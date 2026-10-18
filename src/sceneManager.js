// ============================================
// SUPERMALL SIMULATOR - 3D Scene Manager
// ============================================

import * as THREE from 'three';
import { GAME_CONFIG, SHOP_TYPES, LEVEL_SCALE } from './gameData.js';
import { WorldManager } from './worldManager.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.isDragging = false;
    this.isMouseDown = false;
    this.isRightDrag = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.cameraTheta = Math.PI / 4;
    this.cameraPhi = Math.PI / 3.5;
    this.cameraRadius = 18;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    this.tileMeshes = new Map();
    this.shopMeshes = new Map();
    this.highlightMesh = null;
    this.gridGroup = new THREE.Group();
    this.clock = new THREE.Clock();
    this.worldManager = null;
    this.prevTime = 0;

    this.init();
  }

  init() {
    this.setupRenderer();
    this.setupCamera();
    this.setupLighting();
    this.setupScene();
    this.setupControls();
    this.scene.add(this.gridGroup);
    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    this.updateCameraPosition();
  }

  updateCameraPosition() {
    const x = this.cameraTarget.x + this.cameraRadius * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
    const y = this.cameraTarget.y + this.cameraRadius * Math.cos(this.cameraPhi);
    const z = this.cameraTarget.z + this.cameraRadius * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0x334466, 0.8));

    const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
    sun.position.set(15, 25, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x4466ff, 0.4);
    fill.position.set(-10, 10, -10);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffaa44, 0.3);
    rim.position.set(0, 5, -15);
    this.scene.add(rim);
  }

  setupScene() {
    this.scene.background = new THREE.Color(0x0a0a1f);
    this.scene.fog = new THREE.FogExp2(0x0a0a1f, 0.016);

    // Sky sphere
    const skyGeo = new THREE.SphereGeometry(200, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor:    { value: new THREE.Color(0x0a0a2e) },
        bottomColor: { value: new THREE.Color(0x1a1a3e) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(h * 0.5 + 0.5, 0.0)), 1.0);
        }
      `,
    });
    const skySphere = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skySphere);
    this.skyMat = skyMat;

    // Stars
    const starPositions = [];
    for (let i = 0; i < 2000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 150 + Math.random() * 30;
      starPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 })));

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshLambertMaterial({ color: 0x111122 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMesh = ground;

    // Highlight indicator
    const hlMesh = new THREE.Mesh(
      new THREE.BoxGeometry(GAME_CONFIG.TILE_SIZE * 0.95, 0.05, GAME_CONFIG.TILE_SIZE * 0.95),
      new THREE.MeshBasicMaterial({ color: 0x6c63ff, transparent: true, opacity: 0.5 })
    );
    hlMesh.visible = false;
    this.scene.add(hlMesh);
    this.highlightMesh = hlMesh;

    // Build world environment (roads, vehicles, pedestrians)
    this.worldManager = new WorldManager(this.scene);
    this.worldManager.build();
  }

  // ====== THEME ======
  setTheme(isLight) {
    if (isLight) {
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.01);
      if (this.skyMat) {
        this.skyMat.uniforms.topColor.value.set(0x87ceeb);
        this.skyMat.uniforms.bottomColor.value.set(0xd0e8ff);
      }
      if (this.groundMesh) this.groundMesh.material.color.setHex(0xc8d8a8);
    } else {
      this.scene.background = new THREE.Color(0x0a0a1f);
      this.scene.fog = new THREE.FogExp2(0x0a0a1f, 0.016);
      if (this.skyMat) {
        this.skyMat.uniforms.topColor.value.set(0x0a0a2e);
        this.skyMat.uniforms.bottomColor.value.set(0x1a1a3e);
      }
      if (this.groundMesh) this.groundMesh.material.color.setHex(0x111122);
    }
    // Sync road/sidewalk colors in world
    if (this.worldManager) this.worldManager.setTheme(isLight);
  }

  // ====== CONTROLS ======
  setupControls() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.isMouseDown = true;
      }
      if (e.button === 2) {
        this.isRightDrag = true;
        this.prevMouse = { x: e.clientX, y: e.clientY };
      }
    });

    c.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (this.isMouseDown) {
        const dx = Math.abs(e.clientX - this.dragStartX);
        const dy = Math.abs(e.clientY - this.dragStartY);
        if (dx > 5 || dy > 5) this.isDragging = true;
      }

      if (this.isDragging && this.isMouseDown) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.cameraTheta -= dx * 0.005;
        this.cameraPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, this.cameraPhi + dy * 0.005));
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.updateCameraPosition();
      }

      if (this.isRightDrag) {
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        this.cameraTheta -= dx * 0.005;
        this.cameraPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, this.cameraPhi + dy * 0.005));
        this.prevMouse = { x: e.clientX, y: e.clientY };
        this.updateCameraPosition();
      }
    });

    c.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
      if (e.button === 2) this.isRightDrag = false;
    });

    c.addEventListener('contextmenu', (e) => e.preventDefault());

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraRadius = Math.max(GAME_CONFIG.ZOOM_MIN,
        Math.min(GAME_CONFIG.ZOOM_MAX, this.cameraRadius + e.deltaY * 0.05));
      this.updateCameraPosition();
    }, { passive: false });

    let lastTouchDist = 0;
    c.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = false;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        this.isMouseDown = true;
      }
    });
    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isMouseDown) {
        const dx = e.touches[0].clientX - this.dragStartX;
        const dy = e.touches[0].clientY - this.dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.isDragging = true;
        this.cameraTheta -= dx * 0.005;
        this.cameraPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, this.cameraPhi + dy * 0.005));
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        this.updateCameraPosition();
      }
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist) {
          this.cameraRadius = Math.max(GAME_CONFIG.ZOOM_MIN,
            Math.min(GAME_CONFIG.ZOOM_MAX, this.cameraRadius - (dist - lastTouchDist) * 0.05));
          this.updateCameraPosition();
        }
        lastTouchDist = dist;
      }
    }, { passive: false });
    c.addEventListener('touchend', () => { this.isMouseDown = false; lastTouchDist = 0; });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') this.resetCamera();
    });
  }

  resetCamera() {
    this.cameraTheta = Math.PI / 4;
    this.cameraPhi = Math.PI / 3.5;
    this.cameraRadius = 18;
    this.updateCameraPosition();
  }

  // ====== GRID ======
  createTileGrid(gameState) {
    while (this.gridGroup.children.length > 0) this.gridGroup.remove(this.gridGroup.children[0]);
    this.tileMeshes.clear();
    this.shopMeshes.clear();

    const { gridCols, gridRows } = gameState;
    const ts = GAME_CONFIG.TILE_SIZE;
    const gap = GAME_CONFIG.TILE_GAP;
    const offsetX = -(gridCols * (ts + gap)) / 2 + (ts + gap) / 2;
    const offsetZ = -(gridRows * (ts + gap)) / 2 + (ts + gap) / 2;

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const key = `${col}_${row}`;
        const tile = gameState.grid[key];
        const x = offsetX + col * (ts + gap);
        const z = offsetZ + row * (ts + gap);
        const tileGroup = this._createTileMesh(tile, x, z);
        tileGroup.userData = { col, row, key };
        this.gridGroup.add(tileGroup);
        this.tileMeshes.set(key, tileGroup);
      }
    }

    this.cameraTarget.set(0, 0, 0);
    this.updateCameraPosition();
  }

  _createTileMesh(tile, x, z) {
    const ts = GAME_CONFIG.TILE_SIZE;
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(ts * 0.95, 0.12, ts * 0.95),
      new THREE.MeshLambertMaterial({ color: tile?.occupied ? 0x1a1a2e : 0x1e2a1e })
    );
    floor.position.y = 0.06;
    floor.receiveShadow = true;
    group.add(floor);

    // Border
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(ts * 0.97, 0.02, ts * 0.97),
      new THREE.MeshBasicMaterial({ color: tile?.occupied ? 0x6c63ff : 0x2e4a2e, transparent: true, opacity: 0.4 })
    );
    border.position.y = 0.13;
    group.add(border);

    return group;
  }

  // ====== SHOP BUILDING ======
  addShopToScene(key, shopType, gameState) {
    try {
      // Remove existing
      const existing = this.shopMeshes.get(key);
      if (existing) this.gridGroup.remove(existing);

      const tile = gameState.grid[key];
      const level = (tile?.level) || 1;
      const pos = this._getTileWorldPos(key, gameState);

      const shopGroup = this._buildShopMesh(shopType, pos.x, pos.z, key, level);
      this.gridGroup.add(shopGroup);
      this.shopMeshes.set(key, shopGroup);

      // Spawn animation: grow from 0 to 1
      shopGroup.scale.set(0.01, 0.01, 0.01);
      this.animateScale(shopGroup, 1, 0.4);
    } catch (err) {
      console.error('[SceneManager] addShopToScene error for key=' + key, err);
    }
  }

  // ====== MAIN BUILDING MESH (level-aware) ======
  _buildShopMesh(shopType, x, z, key, level) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.userData = { key, isShop: true, level };

    const lvl   = LEVEL_SCALE[level] || LEVEL_SCALE[1];
    const TS    = GAME_CONFIG.TILE_SIZE;          // 2
    const BW    = TS * 0.86;                      // body footprint: 1.72
    const h     = Math.max(0.5, shopType.height * lvl.heightMult);

    // Colors
    const bodyColor = new THREE.Color(shopType.color)
      .lerp(new THREE.Color(0xffffff), lvl.colorBrightness * 0.6);
    const emColor = new THREE.Color(shopType.emissiveColor)
      .lerp(new THREE.Color(shopType.color), lvl.colorBrightness * 0.4);
    const emInt   = 0.12 + level * 0.07;

    // ── 1. GROUND PLATFORM ──
    const gnd = new THREE.Mesh(
      new THREE.BoxGeometry(TS * 0.97, 0.12, TS * 0.97),
      new THREE.MeshLambertMaterial({ color: level >= 4 ? 0x3a3a5e : 0x252535 })
    );
    gnd.position.y = 0.06;
    gnd.receiveShadow = true;
    group.add(gnd);

    // ── 2. NEON GROUND GLOW ──
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(TS * 0.98, 0.02, TS * 0.98),
      new THREE.MeshBasicMaterial({ color: shopType.color, transparent: true, opacity: 0.35 + level * 0.08 })
    );
    glow.position.y = 0.13;   // FIX: explicit position.y, no Object.assign
    group.add(glow);

    // ── 3. MAIN BUILDING BODY ──
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(BW, h, BW),
      new THREE.MeshLambertMaterial({ color: bodyColor, emissive: emColor, emissiveIntensity: emInt })
    );
    body.position.y = h / 2 + 0.12;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // ── 4. ROOF ──
    const roofColor = level >= 3
      ? new THREE.Color(shopType.color).multiplyScalar(0.55)
      : new THREE.Color(0x1a1a2e);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(BW * 1.04, 0.06 + level * 0.02, BW * 1.04),
      new THREE.MeshLambertMaterial({
        color: roofColor,
        emissive: level >= 4 ? new THREE.Color(shopType.color) : new THREE.Color(0x000000),
        emissiveIntensity: level >= 4 ? 0.2 : 0,
      })
    );
    roof.position.y = h + 0.14;
    roof.castShadow = true;
    group.add(roof);

    // ── 5. WINDOWS (shared geometry + material) ──
    this._addWindowsSimple(group, BW, h, shopType.color, level);

    // ── 6. ENTRANCE SIGN ──
    this._addEntranceSign(group, BW, h, shopType, level);

    // ── 7. LEVEL 2+: Awning ──
    if (level >= 2) {
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(BW * 0.6, 0.05, 0.45),
        new THREE.MeshLambertMaterial({ color: bodyColor.clone().multiplyScalar(0.65) })
      );
      awn.position.set(0, h * 0.32 + 0.12, BW / 2 + 0.22);
      group.add(awn);

      // Poles
      for (const xp of [-0.2, 0.2]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, h * 0.32, 6),
          new THREE.MeshLambertMaterial({ color: 0x888899 })
        );
        pole.position.set(xp, h * 0.16 + 0.12, BW / 2 + 0.35);
        group.add(pole);
      }
    }

    // ── 8. LEVEL 3+: Decorative mid-band + corner pillars ──
    if (level >= 3) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(BW * 1.02, 0.07, BW * 1.02),
        new THREE.MeshBasicMaterial({ color: shopType.color, transparent: true, opacity: 0.5 })
      );
      band.position.y = h * 0.52 + 0.12;
      group.add(band);

      const half = BW / 2 - 0.04;
      for (const [px, pz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, h, 0.09),
          new THREE.MeshLambertMaterial({ color: bodyColor.clone().multiplyScalar(0.75) })
        );
        pillar.position.set(px, h / 2 + 0.12, pz);
        group.add(pillar);
      }
    }

    // ── 9. LEVEL 4+: Rooftop tower + antenna ──
    if (level >= 4) {
      const towerH = h * 0.4;
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.16, towerH, 8),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color(shopType.color),
          emissive: new THREE.Color(shopType.color),
          emissiveIntensity: 0.35,
        })
      );
      tower.position.y = h + 0.14 + towerH / 2;
      group.add(tower);

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(shopType.color).lerp(new THREE.Color(0xffffff), 0.4) })
      );
      ball.position.y = h + 0.14 + towerH + 0.12;
      group.add(ball);

      // Rooftop billboard
      const bill = new THREE.Mesh(
        new THREE.BoxGeometry(BW * 0.5, 0.3, 0.06),
        new THREE.MeshBasicMaterial({ color: bodyColor, transparent: true, opacity: 0.9 })
      );
      bill.position.set(0, h + 0.25, -BW * 0.36);
      group.add(bill);

      // Small AC units
      for (const xp of [-0.28, 0.28]) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.14, 0.3),
          new THREE.MeshLambertMaterial({ color: 0x778899 })
        );
        ac.position.set(xp, h + 0.19, 0.22);
        group.add(ac);
      }
    }

    // ── 10. LEVEL 5: Penthouse floor ──
    if (level >= 5) {
      const pentH = h * 0.28;
      const pentW = BW * 0.58;

      const pent = new THREE.Mesh(
        new THREE.BoxGeometry(pentW, pentH, pentW),
        new THREE.MeshLambertMaterial({ color: bodyColor, emissive: emColor, emissiveIntensity: 0.3 })
      );
      pent.position.y = h + 0.14 + pentH / 2;
      group.add(pent);

      // Penthouse glass walls (4 sides)
      const glassMat = new THREE.MeshBasicMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.6 });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const gw = new THREE.Mesh(new THREE.BoxGeometry(pentW * 0.85, pentH * 0.6, 0.03), glassMat);
        gw.rotation.y = angle;
        gw.position.set(
          Math.sin(angle) * (pentW / 2 + 0.01),
          h + 0.14 + pentH * 0.55,
          Math.cos(angle) * (pentW / 2 + 0.01)
        );
        group.add(gw);
      }

      // Rooftop terrace
      const terrace = new THREE.Mesh(
        new THREE.BoxGeometry(BW * 0.72, 0.04, BW * 0.72),
        new THREE.MeshLambertMaterial({ color: 0x3a3a4e })
      );
      terrace.position.y = h + 0.13;
      group.add(terrace);

      // Pool
      const pool = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.09, 0.24),
        new THREE.MeshBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.88 })
      );
      pool.position.set(-0.26, h + 0.17, 0.18);
      group.add(pool);

      // Mini trees
      for (const [xp, zp] of [[-0.42, -0.38], [0.42, -0.38]]) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 6),
          new THREE.MeshLambertMaterial({ color: 0x8d6e63 }));
        trunk.position.set(xp, h + 0.17, zp);
        group.add(trunk);

        const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6),
          new THREE.MeshLambertMaterial({ color: 0x4caf50 }));
        leaves.position.set(xp, h + 0.27, zp);
        group.add(leaves);
      }
    }

    // Tag all child meshes for raycasting
    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.userData = { key, isShop: true };
      }
    });

    return group;
  }

  _addWindowsSimple(group, bw, h, colorHex, level) {
    const numRows = Math.min(level + 1, 5);
    const numCols = Math.min(level + 2, 6);

    const winW = Math.max(0.08, Math.min(0.16, (bw * 0.8) / numCols - 0.05));
    const winH = Math.max(0.08, Math.min(0.2,  (h * 0.65) / numRows - 0.04));

    // Shared geometry and material
    const winGeo = new THREE.BoxGeometry(winW, winH, 0.03);
    const winColor = new THREE.Color(colorHex).lerp(new THREE.Color(0xddeeff), 0.55);
    const winMat = new THREE.MeshBasicMaterial({ color: winColor, transparent: true, opacity: 0.8 });

    const spreadX = (numCols - 1) * (winW + 0.07);
    const spreadY = (numRows - 1) * (winH + 0.1);
    const startY  = h * 0.18 + 0.12;

    // Front and back faces
    for (const signZ of [bw / 2 + 0.016, -(bw / 2 + 0.016)]) {
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(
            -spreadX / 2 + c * (winW + 0.07),
            startY + (spreadY > 0 ? (r / Math.max(numRows - 1, 1)) * spreadY : 0),
            signZ
          );
          group.add(win);
        }
      }
    }

    // Left and right faces (rotated)
    for (const signX of [bw / 2 + 0.016, -(bw / 2 + 0.016)]) {
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          const win = new THREE.Mesh(winGeo, winMat);
          win.rotation.y = Math.PI / 2;
          win.position.set(
            signX,
            startY + (spreadY > 0 ? (r / Math.max(numRows - 1, 1)) * spreadY : 0),
            -spreadX / 2 + c * (winW + 0.07)
          );
          group.add(win);
        }
      }
    }
  }

  _addEntranceSign(group, bw, h, shopType, level) {
    const signW = bw * (0.52 + level * 0.04);
    const signH = 0.16 + level * 0.04;
    const signZ = bw / 2 + 0.04;
    const signY = h * 0.78 + 0.12;

    // Sign board
    const signColor = new THREE.Color(shopType.color).lerp(new THREE.Color(0xffffff), 0.4);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(signW, signH, 0.06),
      new THREE.MeshBasicMaterial({ color: signColor })
    );
    sign.position.set(0, signY, signZ);
    group.add(sign);

    // Glow strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(signW * 0.88, 0.04, 0.07),
      new THREE.MeshBasicMaterial({ color: shopType.color, transparent: true, opacity: 0.9 })
    );
    strip.position.set(0, signY - signH * 0.55, signZ + 0.01);
    group.add(strip);
  }

  // ====== REMOVE SHOP ======
  removeShopFromScene(key) {
    const grp = this.shopMeshes.get(key);
    if (grp) {
      this.animateScale(grp, 0, 0.25, () => this.gridGroup.remove(grp));
      this.shopMeshes.delete(key);
    }
    // Reset tile color
    const tileGrp = this.tileMeshes.get(key);
    if (tileGrp && tileGrp.children[0]?.material) {
      tileGrp.children[0].material.color.setHex(0x1e2a1e);
    }
  }

  // ====== EXPAND GRID ======
  expandGrid(gameState) {
    this.createTileGrid(gameState);
    Object.entries(gameState.grid).forEach(([key, tile]) => {
      if (!tile.occupied || !tile.shopType) return;
      const shopDef = SHOP_TYPES.find(s => s.id === tile.shopType);
      if (!shopDef) return;
      const pos = this._getTileWorldPos(key, gameState);
      try {
        const grp = this._buildShopMesh(shopDef, pos.x, pos.z, key, tile.level || 1);
        this.gridGroup.add(grp);
        this.shopMeshes.set(key, grp);
      } catch (e) {
        console.error('[expandGrid] shop error', key, e);
      }
    });
  }

  // ====== HIGHLIGHT ======
  highlightTile(col, row, gameState, color = 0x6c63ff) {
    const pos = this._getTileWorldPos(`${col}_${row}`, gameState);
    this.highlightMesh.material.color.setHex(color);
    this.highlightMesh.position.set(pos.x, 0.14, pos.z);
    this.highlightMesh.visible = true;
  }

  hideHighlight() {
    this.highlightMesh.visible = false;
  }

  // ====== RAYCASTING ======
  getHoveredTile() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshes = [];
    this.tileMeshes.forEach(g => g.children.forEach(c => { if (c.isMesh) meshes.push(c); }));
    this.shopMeshes.forEach(g => g.traverse(c => { if (c.isMesh) meshes.push(c); }));

    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;

    const obj = hits[0].object;

    // Shop child mesh has key in userData
    if (obj.userData?.key) {
      const [col, row] = obj.userData.key.split('_').map(Number);
      return { col, row, key: obj.userData.key };
    }

    // Tile child mesh — key is on parent group
    const parent = obj.parent;
    if (parent?.userData?.key) {
      return { col: parent.userData.col, row: parent.userData.row, key: parent.userData.key };
    }

    return null;
  }

  getClickedTile() {
    if (this.isDragging) return null;
    return this.getHoveredTile();
  }

  // ====== HELPERS ======
  _getTileWorldPos(key, gameState) {
    const [col, row] = key.split('_').map(Number);
    const ts  = GAME_CONFIG.TILE_SIZE;
    const gap = GAME_CONFIG.TILE_GAP;
    const { gridCols, gridRows } = gameState;
    const offsetX = -(gridCols * (ts + gap)) / 2 + (ts + gap) / 2;
    const offsetZ = -(gridRows * (ts + gap)) / 2 + (ts + gap) / 2;
    return { x: offsetX + col * (ts + gap), z: offsetZ + row * (ts + gap) };
  }

  getShopWorldPosition(key, gameState) {
    const p = this._getTileWorldPos(key, gameState);
    return new THREE.Vector3(p.x, 2, p.z);
  }

  // ====== SCALE ANIMATION ======
  animateScale(object, target, duration, onComplete) {
    const start = object.scale.x;
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - t0) / 1000 / duration, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      object.scale.setScalar(start + (target - start) * e);
      if (t < 1) requestAnimationFrame(tick);
      else if (onComplete) onComplete();
    };
    requestAnimationFrame(tick);
  }

  // ====== FLOATING TEXT ======
  spawnFloatingText(worldPos, text, color = 0xffd700) {
    const sp = worldPos.clone().project(this.camera);
    const x = (sp.x * 0.5 + 0.5) * window.innerWidth;
    const y = (1 - (sp.y * 0.5 + 0.5)) * window.innerHeight;
    const div = document.createElement('div');
    div.className = 'floating-income';
    div.textContent = text;
    div.style.color = `#${color.toString(16).padStart(6, '0')}`;
    div.style.left = `${x}px`;
    div.style.top  = `${y}px`;
    document.getElementById('floating-income-container').appendChild(div);
    setTimeout(() => div.remove(), 1600);
  }

  // ====== RENDER LOOP ======
  animate() {
    requestAnimationFrame(() => this.animate());
    const time  = this.clock.getElapsedTime();
    const delta = Math.min(time - this.prevTime, 0.1); // cap at 100ms
    this.prevTime = time;

    // World simulation
    if (this.worldManager) this.worldManager.update(delta);

    // Pulse highlight
    if (this.highlightMesh?.visible) {
      this.highlightMesh.material.opacity = 0.3 + Math.sin(time * 4) * 0.18;
    }

    // Subtle emissive pulse on shop bodies
    this.shopMeshes.forEach((grp) => {
      const lvl   = grp.userData.level || 1;
      const pulse = Math.sin(time * 1.5 + grp.position.x * 0.4) * 0.05;
      grp.traverse((obj) => {
        if (obj.isMesh && obj.material?.emissiveIntensity > 0) {
          obj.material.emissiveIntensity = Math.max(0.05, (0.12 + lvl * 0.07) + pulse);
        }
      });
    });

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
