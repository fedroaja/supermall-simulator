// ============================================
// SUPERMALL SIMULATOR - World Manager
// Environment, Vehicles, Pedestrians
// ============================================

import * as THREE from 'three';

// Road layout constants
const CW_R   = 11.5;  // Clockwise lane radius (outer)
const CCW_R  = 8.5;   // Counter-clockwise lane radius (inner)
const PED_R  = 6.3;   // Pedestrian sidewalk radius
const ROAD_Y = -0.038;// Road marking height

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.vehicles    = [];
    this.pedestrians = [];
    this.clock       = new THREE.Clock();

    // ── Vehicle waypoints (4-corner rectangular loops) ──
    const vy = 0.32;
    // Clockwise: East → South → West → North
    this.cwWP = [
      new THREE.Vector3(-CW_R, vy, -CW_R),
      new THREE.Vector3( CW_R, vy, -CW_R),
      new THREE.Vector3( CW_R, vy,  CW_R),
      new THREE.Vector3(-CW_R, vy,  CW_R),
    ];
    // Counter-clockwise: South → East → North → West
    this.ccwWP = [
      new THREE.Vector3(-CCW_R, vy, -CCW_R),
      new THREE.Vector3(-CCW_R, vy,  CCW_R),
      new THREE.Vector3( CCW_R, vy,  CCW_R),
      new THREE.Vector3( CCW_R, vy, -CCW_R),
    ];

    // Pedestrian path (rectangular, along inner sidewalk)
    const py = 0.05;
    this.pedWP = [
      new THREE.Vector3(-PED_R, py, -PED_R),
      new THREE.Vector3( PED_R, py, -PED_R),
      new THREE.Vector3( PED_R, py,  PED_R),
      new THREE.Vector3(-PED_R, py,  PED_R),
    ];

    // Precompute segment lengths
    this._segLengths = (wps) => wps.map((wp, i) =>
      wp.distanceTo(wps[(i + 1) % wps.length])
    );
    this.cwLens   = this._segLengths(this.cwWP);
    this.ccwLens  = this._segLengths(this.ccwWP);
    this.pedLens  = this._segLengths(this.pedWP);
  }

  // ── PUBLIC ──────────────────────────────────────────
  build() {
    this._buildGround();
    this._buildRoadMarkings();
    this._buildCrosswalks();
    this._buildStreetLights();
    this._buildTrees();
    this._buildBenches();
    this._buildBackgroundBuildings();
    this._spawnVehicles();
    this._spawnPedestrians();
  }

  update(delta) {
    const t = this.clock.getElapsedTime();
    this._tickVehicles(delta, t);
    this._tickPedestrians(delta, t);
  }

  // ── THEME SYNC ───────────────────────────────────────
  setTheme(isLight) {
    // Adjust road/sidewalk colors for light mode
    if (this._groundPlanes) {
      this._groundPlanes[0].material.color.setHex(isLight ? 0x888880 : 0x2b2b2b); // road
      this._groundPlanes[1].material.color.setHex(isLight ? 0xe8e6e0 : 0xbdbcb7); // sidewalk
      this._groundPlanes[2].material.color.setHex(isLight ? 0xd0d8c0 : 0x1c1e2a); // mall base
    }
  }

  // ── GROUND LAYERS ────────────────────────────────────
  _buildGround() {
    // Big asphalt road
    const road = this._plane(55, 55, 0x2b2b2b, 0, -0.046, 0);

    // Sidewalk (concrete ring visible outside mall)
    const sidewalk = this._plane(15.5, 15.5, 0xbdbcb7, 0, -0.043, 0);

    // Mall courtyard base
    const plaza = this._plane(11.2, 11.2, 0x1c1e2a, 0, -0.040, 0);

    // Store refs for theme changes
    this._groundPlanes = [road, sidewalk, plaza];

    // Road divider strip between lanes
    const divMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    const divLen = 28;

    for (const side of [-1, 1]) {
      const ns = new THREE.Mesh(new THREE.BoxGeometry(divLen, 0.02, 0.25), divMat);
      ns.position.set(0, -0.041, side * 10);
      this.group.add(ns);

      const ew = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, divLen), divMat);
      ew.position.set(side * 10, -0.041, 0);
      this.group.add(ew);
    }
  }

  _plane(w, h, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ color })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  // ── ROAD MARKINGS ─────────────────────────────────────
  _buildRoadMarkings() {
    const wMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const yMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const RANGE = 14;

    // Helper: place dashes along axis
    const dashLine = (isX, fixedVal, from, to, step, mat, dLen, dW) => {
      for (let p = from + step * 0.5; p < to; p += step) {
        const mesh = new THREE.Mesh(
          isX
            ? new THREE.BoxGeometry(dLen, 0.01, dW)
            : new THREE.BoxGeometry(dW, 0.01, dLen),
          mat
        );
        mesh.position.set(
          isX ? p        : fixedVal,
          ROAD_Y,
          isX ? fixedVal : p
        );
        this.group.add(mesh);
      }
    };

    // ── White lane dashes ──
    // North road  (z = -8.5 inner CCW, z = -11.5 outer CW)
    dashLine(true,  -8.5,  -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);
    dashLine(true,  -11.5, -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);
    // South road
    dashLine(true,   8.5,  -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);
    dashLine(true,   11.5, -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);
    // East road  (x = 8.5 CW, x = 11.5 CCW)
    dashLine(false,  8.5,  -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);
    dashLine(false,  11.5, -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);
    // West road
    dashLine(false, -8.5,  -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);
    dashLine(false, -11.5, -RANGE, RANGE, 3.0, wMat, 1.6, 0.18);

    // ── Yellow center dividers ──
    dashLine(true,  -10, -RANGE, RANGE, 1.8, yMat, 0.9, 0.22);
    dashLine(true,   10, -RANGE, RANGE, 1.8, yMat, 0.9, 0.22);
    dashLine(false, -10, -RANGE, RANGE, 1.8, yMat, 0.9, 0.22);
    dashLine(false,  10, -RANGE, RANGE, 1.8, yMat, 0.9, 0.22);

    // ── Road edges (white solid lines near sidewalk) ──
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const sign of [-1, 1]) {
      // North/South curb edge
      const ns = new THREE.Mesh(new THREE.BoxGeometry(RANGE * 2, 0.01, 0.08), edgeMat);
      ns.position.set(0, ROAD_Y + 0.001, sign * 7.1);
      this.group.add(ns);
      // East/West curb edge
      const ew = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, RANGE * 2), edgeMat);
      ew.position.set(sign * 7.1, ROAD_Y + 0.001, 0);
      this.group.add(ew);
    }

    // Sidewalk curb (slightly raised edge)
    const curbMat = new THREE.MeshLambertMaterial({ color: 0x888880 });
    const curbH = 0.06;
    for (const sign of [-1, 1]) {
      const nc = new THREE.Mesh(new THREE.BoxGeometry(RANGE * 2, curbH, 0.22), curbMat);
      nc.position.set(0, -0.015, sign * 7);
      nc.castShadow = true;
      this.group.add(nc);

      const ec = new THREE.Mesh(new THREE.BoxGeometry(0.22, curbH, RANGE * 2), curbMat);
      ec.position.set(sign * 7, -0.015, 0);
      ec.castShadow = true;
      this.group.add(ec);
    }
  }

  // ── CROSSWALKS ────────────────────────────────────────
  _buildCrosswalks() {
    const cwMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.85 });
    const stripeW = 0.45;
    const stripeGap = 0.65;
    const numStripes = 5;
    const crossLen = 2.4; // road crossing width

    // Each corner has a crosswalk
    const corners = [
      // North entrance
      { isX: true,  fixed: -7.5, from: -1.5, axis: 'z' },
      // South entrance
      { isX: true,  fixed:  7.5, from: -1.5, axis: 'z' },
      // East entrance
      { isX: false, fixed:  7.5, from: -1.5, axis: 'x' },
      // West entrance
      { isX: false, fixed: -7.5, from: -1.5, axis: 'x' },
    ];

    corners.forEach(({ isX, fixed, from }) => {
      for (let i = 0; i < numStripes; i++) {
        const offset = from + i * (stripeW + stripeGap);
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(
            isX ? stripeW : crossLen,
            0.01,
            isX ? crossLen : stripeW
          ),
          cwMat
        );
        stripe.position.set(
          isX ? offset : fixed,
          ROAD_Y + 0.002,
          isX ? fixed  : offset
        );
        this.group.add(stripe);
      }
    });
  }

  // ── STREET LIGHTS ─────────────────────────────────────
  _buildStreetLights() {
    const positions = [];
    const R = 7.7;  // along sidewalk inner edge
    const SPACING = 5;
    for (let p = -14; p <= 14; p += SPACING) {
      positions.push({ x:  R, z:  p });
      positions.push({ x: -R, z:  p });
      positions.push({ x:  p, z:  R });
      positions.push({ x:  p, z: -R });
    }

    const poleMat  = new THREE.MeshLambertMaterial({ color: 0x444455 });
    const headMat  = new THREE.MeshLambertMaterial({ color: 0x333344 });
    const glowMat  = new THREE.MeshBasicMaterial({ color: 0xfff5cc });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xfffde7, transparent: true, opacity: 0.9 });

    positions.forEach(({ x, z }) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);

      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.6, 8), poleMat);
      pole.position.y = 1.3;
      pole.castShadow = true;
      g.add(pole);

      // Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), headMat);
      arm.position.set(0.3, 2.65, 0);
      g.add(arm);

      // Lamp head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), headMat);
      head.position.set(0.58, 2.6, 0);
      g.add(head);

      // Light glow (visible lamp)
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.22), glowMat);
      glow.position.set(0.58, 2.53, 0);
      g.add(glow);

      // PointLight (subtle)
      const pl = new THREE.PointLight(0xfff5cc, 0.6, 10);
      pl.position.set(0.58, 2.5, 0);
      g.add(pl);

      this.group.add(g);
    });
  }

  // ── TREES ──────────────────────────────────────────────
  _buildTrees() {
    const SIDE_R = 6.7;
    const positions = [];
    const SPACING = 6;
    for (let p = -12; p <= 12; p += SPACING) {
      positions.push({ x:  SIDE_R, z: p });
      positions.push({ x: -SIDE_R, z: p });
      positions.push({ x: p, z:  SIDE_R });
      positions.push({ x: p, z: -SIDE_R });
    }

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d3a1a });

    const foliageColors = [0x2e7d32, 0x388e3c, 0x43a047, 0x1b5e20, 0x33691e];

    positions.forEach(({ x, z }, i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);

      // Trunk
      const trunkH = 0.7 + Math.random() * 0.3;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.09, trunkH, 7),
        trunkMat
      );
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      g.add(trunk);

      // Foliage (layered spheres)
      const fColor = foliageColors[i % foliageColors.length];
      const fMat = new THREE.MeshLambertMaterial({ color: fColor });
      const fRadius = 0.45 + Math.random() * 0.25;

      const main = new THREE.Mesh(new THREE.SphereGeometry(fRadius, 7, 7), fMat);
      main.position.y = trunkH + fRadius * 0.75;
      main.castShadow = true;
      g.add(main);

      const top = new THREE.Mesh(new THREE.SphereGeometry(fRadius * 0.65, 6, 6), fMat);
      top.position.y = trunkH + fRadius * 1.5;
      g.add(top);

      this.group.add(g);
    });
  }

  // ── BENCHES ─────────────────────────────────────────────
  _buildBenches() {
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x8d6e3b });
    const legMat  = new THREE.MeshLambertMaterial({ color: 0x555566 });

    const spots = [
      { x:  6,   z: -3.5, ry: 0 },
      { x:  6,   z:  3.5, ry: 0 },
      { x: -6,   z: -3.5, ry: Math.PI },
      { x: -6,   z:  3.5, ry: Math.PI },
      { x: -3.5, z:  6,   ry: Math.PI / 2 },
      { x:  3.5, z:  6,   ry: Math.PI / 2 },
      { x: -3.5, z: -6,   ry: -Math.PI / 2 },
      { x:  3.5, z: -6,   ry: -Math.PI / 2 },
    ];

    spots.forEach(({ x, z, ry }) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;

      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.35), seatMat);
      seat.position.y = 0.4;
      g.add(seat);

      // Back
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.05), seatMat);
      back.position.set(0, 0.6, -0.15);
      g.add(back);

      // Legs
      for (const lx of [-0.38, 0.38]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), legMat);
        leg.position.set(lx, 0.2, 0);
        g.add(leg);
      }

      this.group.add(g);
    });
  }

  // ── BACKGROUND BUILDINGS ──────────────────────────────
  _buildBackgroundBuildings() {
    const rng = (a, b) => a + Math.random() * (b - a);
    const buildingColors = [
      0x455a64, 0x37474f, 0x4a148c, 0x1a237e,
      0x006064, 0x01579b, 0x33691e, 0x4e342e,
      0x880e4f, 0x311b92,
    ];

    const positions = [
      // North
      { x: -20, z: -20 }, { x: -12, z: -20 }, { x:  0,  z: -22 },
      { x:  12, z: -20 }, { x:  20, z: -20 }, { x: -6,  z: -19 }, { x: 6, z: -19 },
      // South
      { x: -20, z:  20 }, { x: -12, z:  20 }, { x:  0,  z:  22 },
      { x:  12, z:  20 }, { x:  20, z:  20 }, { x: -6,  z:  19 }, { x: 6, z: 19 },
      // East
      { x:  20, z: -12 }, { x:  20, z:  0  }, { x:  20, z:  12 },
      { x:  18, z: -6  }, { x:  18, z:  6  },
      // West
      { x: -20, z: -12 }, { x: -20, z:  0  }, { x: -20, z:  12 },
      { x: -18, z: -6  }, { x: -18, z:  6  },
    ];

    positions.forEach(({ x, z }, i) => {
      const bW = rng(2.5, 5);
      const bD = rng(2.5, 5);
      const bH = rng(1.5, 7);
      const color = buildingColors[i % buildingColors.length];

      const g = new THREE.Group();
      g.position.set(x + rng(-1, 1), 0, z + rng(-1, 1));
      g.rotation.y = rng(0, Math.PI / 4);

      // Body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(bW, bH, bD),
        new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.2), emissiveIntensity: 1 })
      );
      body.position.y = bH / 2;
      body.castShadow = true;
      g.add(body);

      // Roof cap
      const roofColor = new THREE.Color(color).lerp(new THREE.Color(0x000000), 0.4);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(bW * 1.05, 0.15, bD * 1.05),
        new THREE.MeshLambertMaterial({ color: roofColor })
      );
      roof.position.y = bH + 0.07;
      g.add(roof);

      // Windows: simple grid of bright dots
      const winMat = new THREE.MeshBasicMaterial({ color: 0xfff9c4, transparent: true, opacity: 0.8 });
      const cols = Math.floor(bW / 0.8);
      const rows = Math.floor(bH / 0.9);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.7) { // ~70% windows lit
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.04), winMat);
            win.position.set(
              -bW / 2 + (c + 0.5) * (bW / cols),
              0.6 + r * 0.9,
              bD / 2 + 0.01
            );
            g.add(win);
          }
        }
      }

      this.group.add(g);
    });
  }

  // ── VEHICLES ──────────────────────────────────────────
  _spawnVehicles() {
    const carColors = [
      0xe53935, 0x1e88e5, 0x43a047, 0xfb8c00, 0xfdd835,
      0x8e24aa, 0x00acc1, 0x6d4c41, 0xe0e0e0, 0xff6f00,
    ];
    const busColors = [0x00897b, 0xf4511e, 0x5c6bc0];

    // 7 CW cars (outer lane)
    for (let i = 0; i < 7; i++) {
      const mesh = this._createCarMesh(carColors[i % carColors.length]);
      const wpIdx = Math.floor(Math.random() * this.cwWP.length);
      this.group.add(mesh);
      this.vehicles.push({
        mesh, waypoints: this.cwWP, segLens: this.cwLens,
        wpIdx, t: Math.random(),
        speed: 3.5 + Math.random() * 2,
        wheelRefs: mesh.userData.wheels || [],
      });
    }

    // 5 CCW cars (inner lane)
    for (let i = 0; i < 5; i++) {
      const mesh = this._createCarMesh(carColors[(i + 3) % carColors.length]);
      const wpIdx = Math.floor(Math.random() * this.ccwWP.length);
      this.group.add(mesh);
      this.vehicles.push({
        mesh, waypoints: this.ccwWP, segLens: this.ccwLens,
        wpIdx, t: Math.random(),
        speed: 3 + Math.random() * 2,
        wheelRefs: mesh.userData.wheels || [],
      });
    }

    // 2 buses
    for (let i = 0; i < 2; i++) {
      const wps  = i === 0 ? this.cwWP   : this.ccwWP;
      const lens = i === 0 ? this.cwLens : this.ccwLens;
      const mesh = this._createBusMesh(busColors[i]);
      this.group.add(mesh);
      this.vehicles.push({
        mesh, waypoints: wps, segLens: lens,
        wpIdx: i * 2, t: 0.5,
        speed: 2.5,
        wheelRefs: mesh.userData.wheels || [],
      });
    }
  }

  _createCarMesh(color) {
    const g = new THREE.Group();
    const mat  = new THREE.MeshLambertMaterial({ color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Body (front = +Z)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.38, 1.7), mat);
    body.position.y = 0.28;
    body.castShadow = true;
    g.add(body);

    // Cabin
    const cabMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color).lerp(new THREE.Color(0x222233), 0.3)
    });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 0.85), cabMat);
    cab.position.set(0, 0.53, -0.05);
    g.add(cab);

    // Windshields
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccee, transparent: true, opacity: 0.6 });
    const wsFront = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.03), glassMat);
    wsFront.position.set(0, 0.53, 0.4);
    wsFront.rotation.x = 0.3;
    g.add(wsFront);

    const wsRear = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.03), glassMat);
    wsRear.position.set(0, 0.53, -0.5);
    wsRear.rotation.x = -0.3;
    g.add(wsRear);

    // Wheels (store refs for spin animation)
    const wGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.1, 10);
    const wheels = [];
    const wPositions = [
      [ 0.45, 0.165,  0.55],
      [-0.45, 0.165,  0.55],
      [ 0.45, 0.165, -0.55],
      [-0.45, 0.165, -0.55],
    ];
    wPositions.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wGeo, dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      g.add(w);
      wheels.push(w);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8),
        new THREE.MeshLambertMaterial({ color: 0x888899 })
      );
      hub.rotation.z = Math.PI / 2;
      hub.position.set(x > 0 ? x + 0.01 : x - 0.01, y, z);
      g.add(hub);
    });

    // Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfffde7 });
    for (const xOff of [-0.25, 0.25]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), hlMat);
      hl.position.set(xOff, 0.3, 0.87);
      g.add(hl);
    }

    // Tail lights
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    for (const xOff of [-0.25, 0.25]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), tlMat);
      tl.position.set(xOff, 0.3, -0.87);
      g.add(tl);
    }

    // Store wheel refs for animation
    g.userData.wheels = wheels;
    return g;
  }

  _createBusMesh(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });

    // Body (front = +Z)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 3.8), mat);
    body.position.y = 0.7;
    body.castShadow = true;
    g.add(body);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 3.78),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) }));
    roof.position.y = 1.28;
    g.add(roof);

    // Window strip (both sides)
    const winStripMat = new THREE.MeshBasicMaterial({ color: 0x88ccee, transparent: true, opacity: 0.7 });
    for (const xSign of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 3.0), winStripMat);
      strip.position.set(xSign * 0.62, 0.9, 0);
      g.add(strip);
    }

    // Destination sign
    const signMat = new THREE.MeshBasicMaterial({ color: 0xffee00 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.04), signMat);
    sign.position.set(0, 1.18, 1.92);
    g.add(sign);

    // Wheels (6 wheels for bus)
    const wGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10);
    const dark = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wPos = [
      [ 0.65, 0.22,  1.3], [-0.65, 0.22,  1.3],
      [ 0.65, 0.22,  0  ], [-0.65, 0.22,  0  ],
      [ 0.65, 0.22, -1.3], [-0.65, 0.22, -1.3],
    ];
    wPos.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wGeo, dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      g.add(w);
    });

    // Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfffde7 });
    for (const xOff of [-0.35, 0.35]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.05), hlMat);
      hl.position.set(xOff, 0.55, 1.93);
      g.add(hl);
    }

    return g;
  }

  // ── PEDESTRIANS ────────────────────────────────────────
  _spawnPedestrians() {
    for (let i = 0; i < 28; i++) {
      const mesh = this._createPedestrianMesh();
      const wpIdx = Math.floor(Math.random() * this.pedWP.length);
      const t     = Math.random();
      const speed = 0.9 + Math.random() * 0.8;

      // Pre-position
      const cur  = this.pedWP[wpIdx];
      const next = this.pedWP[(wpIdx + 1) % this.pedWP.length];
      mesh.position.lerpVectors(cur, next, t);
      mesh.position.y = 0;

      // Random perpendicular offset so peds don't overlap
      const perpOffset = (Math.random() - 0.5) * 0.7;
      const dir = next.clone().sub(cur).normalize();
      mesh.position.x += -dir.z * perpOffset;
      mesh.position.z +=  dir.x * perpOffset;

      this.group.add(mesh);
      this.pedestrians.push({
        mesh, wpIdx, t, speed,
        phase: Math.random() * Math.PI * 2,
        baseY: 0,
      });
    }
  }

  _createPedestrianMesh() {
    const g = new THREE.Group();

    const shirtColors = [0xe53935, 0x1e88e5, 0x43a047, 0xfb8c00, 0xce93d8, 0x80cbc4, 0xfff176, 0xff80ab];
    const pantColors  = [0x212121, 0x263238, 0x1a237e, 0x3e2723, 0x311b92];
    const skinColors  = [0xfdbcb4, 0xf4a460, 0x8d5524, 0xdeb887, 0xffe0bd];

    const shirt = new THREE.MeshLambertMaterial({ color: shirtColors[Math.floor(Math.random() * shirtColors.length)] });
    const pants = new THREE.MeshLambertMaterial({ color: pantColors[Math.floor(Math.random() * pantColors.length)] });
    const skin  = new THREE.MeshLambertMaterial({ color: skinColors[Math.floor(Math.random() * skinColors.length)] });
    const hairColors = [0x1a1a1a, 0x5d4037, 0xffd54f, 0xef5350];
    const hair  = new THREE.MeshLambertMaterial({ color: hairColors[Math.floor(Math.random() * hairColors.length)] });

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.42, 8), shirt);
    torso.position.y = 0.56;
    torso.castShadow = true;
    g.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), skin);
    head.position.y = 0.92;
    head.castShadow = true;
    g.add(head);

    // Hair
    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 5), hair);
    hairMesh.position.y = 0.97;
    hairMesh.scale.set(1, 0.5, 1);
    g.add(hairMesh);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.35, 7);
    const leftLeg = new THREE.Mesh(legGeo, pants);
    leftLeg.position.set(-0.072, 0.19, 0);
    g.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pants);
    rightLeg.position.set(0.072, 0.19, 0);
    g.add(rightLeg);

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.09, 0.05, 0.14);
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    for (const xOff of [-0.072, 0.072]) {
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(xOff, 0.02, 0.02);
      g.add(shoe);
    }

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.3, 6);
    const leftArm = new THREE.Mesh(armGeo, shirt);
    leftArm.position.set(-0.16, 0.6, 0);
    leftArm.rotation.z = 0.25;
    g.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, shirt);
    rightArm.position.set(0.16, 0.6, 0);
    rightArm.rotation.z = -0.25;
    g.add(rightArm);

    // Store refs for animation
    g.userData.leftLeg  = leftLeg;
    g.userData.rightLeg = rightLeg;
    g.userData.leftArm  = leftArm;
    g.userData.rightArm = rightArm;

    return g;
  }

  // ── UPDATE LOOPS ───────────────────────────────────────
  _tickVehicles(delta, time) {
    this.vehicles.forEach(veh => {
      const { waypoints, segLens, mesh } = veh;

      const segLen = segLens[veh.wpIdx] || 1;
      veh.t += (veh.speed / segLen) * delta;

      if (veh.t >= 1) {
        veh.t -= 1;
        veh.wpIdx = (veh.wpIdx + 1) % waypoints.length;
      }

      const cur  = waypoints[veh.wpIdx];
      const next = waypoints[(veh.wpIdx + 1) % waypoints.length];

      // Smooth position (lerp)
      mesh.position.lerpVectors(cur, next, veh.t);

      // Face direction of travel
      const dir = next.clone().sub(cur).normalize();
      if (dir.lengthSq() > 0.001) {
        mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }

      // Spin wheels based on speed
      const wheelSpin = -(veh.speed / 0.165) * delta; // angular velocity
      if (veh.wheelRefs) {
        veh.wheelRefs.forEach(w => { w.rotation.x += wheelSpin; });
      }
    });
  }

  _tickPedestrians(delta, time) {
    const wps    = this.pedWP;
    const lens   = this.pedLens;

    this.pedestrians.forEach(ped => {
      const segLen = lens[ped.wpIdx] || 1;

      ped.t += (ped.speed / segLen) * delta;
      if (ped.t >= 1) {
        ped.t -= 1;
        ped.wpIdx = (ped.wpIdx + 1) % wps.length;
      }

      const cur  = wps[ped.wpIdx];
      const next = wps[(ped.wpIdx + 1) % wps.length];

      // Lerp position (preserve perpendicular offset by only setting x/z)
      const lerpPos = cur.clone().lerp(next, ped.t);
      ped.mesh.position.x = lerpPos.x;
      ped.mesh.position.z = lerpPos.z;

      // Vertical bob
      const walkCycle = time * ped.speed * 3.5 + ped.phase;
      ped.mesh.position.y = ped.baseY + Math.abs(Math.sin(walkCycle)) * 0.04;

      // Face direction of travel
      const dir = next.clone().sub(cur).normalize();
      if (dir.lengthSq() > 0.001) {
        ped.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }

      // Limb animation
      const swing = Math.sin(walkCycle) * 0.55;
      const { leftLeg, rightLeg, leftArm, rightArm } = ped.mesh.userData;
      if (leftLeg) {
        leftLeg.rotation.x  =  swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x  = -swing * 0.7;
        rightArm.rotation.x =  swing * 0.7;
      }
    });
  }
}
