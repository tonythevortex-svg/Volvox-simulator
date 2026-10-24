// ============================================================
// Volvox colony sim (optimized, smoother growth & better dispersal)
// ------------------------------------------------------------
// - Start with ONE Volvox-like sphere made of dots
// - Slowly grows, forms daughters inside, then ruptures
// - Daughters are released, drift, grow, and repeat
// - Smoother growth, slower gestation, better spreading
// - Performance tweaks (LOD for spheres)
// - Press 'f' to toggle fullscreen
// ============================================================

let colonies = [];

// Shared geometry for all spheres: unit sphere points
let unitSpherePoints = [];
const NUM_POINTS = 420;   // fewer than 600 → faster

// Soft population limit
const MAX_COLONIES = 30;

// ------------------------------------------------------------
// Setup: canvas + precompute sphere mesh + start with 1 colony
// ------------------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);

  // Precompute points on a unit sphere (radius 1)
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NUM_POINTS; i++) {
    const t = i / (NUM_POINTS - 1); // 0..1
    const y = 1 - 2 * t;            // 1..-1 (vertical)
    const radius = Math.sqrt(1 - y * y);
    const phi = goldenAngle * i;

    const x = Math.cos(phi) * radius;
    const z = Math.sin(phi) * radius;

    unitSpherePoints.push(createVector(x, y, z));
  }

  // Start with a single adult in the middle
  colonies.push(new Colony(width / 2, height / 2, false));
}

// ------------------------------------------------------------
// Draw loop
// ------------------------------------------------------------
function draw() {
  background(255);

  const dt = deltaTime / 1000.0; // seconds per frame

  // Update & draw all colonies
  for (let c of colonies) {
    c.update(dt);
    c.draw();
  }

  // Remove dead colonies
  colonies = colonies.filter(c => !c.dead);

  // Very simple repulsion to reduce heavy overlaps
  applySeparation();

  // HUD
  noStroke();
  fill(20);
  textSize(12);
  text(
    "Colonies: " + colonies.length +
    "  (press 'f' for fullscreen)",
    10, 20
  );
}

// ------------------------------------------------------------
// Full-window canvas
// ------------------------------------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ------------------------------------------------------------
// Fullscreen toggle with key 'f'
// ------------------------------------------------------------
function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}

// ============================================================
// Simple colony–colony separation
// Pushes overlapping colonies slightly apart
// ============================================================
function applySeparation() {
  const pushStrength = 0.02; // small = gentle

  for (let i = 0; i < colonies.length; i++) {
    for (let j = i + 1; j < colonies.length; j++) {
      const a = colonies[i];
      const b = colonies[j];
      if (a.dead || b.dead) continue;

      const diff = p5.Vector.sub(b.pos, a.pos);
      const dist = diff.mag() || 0.0001;
      const minDist = (a.radius + b.radius) * 0.9; // when we start pushing

      if (dist < minDist) {
        const overlap = minDist - dist;
        const dir = diff.copy().div(dist);

        // Push each colony away a bit
        const move = dir.mult(overlap * pushStrength);
        b.pos.add(move);
        a.pos.sub(move);
      }
    }
  }
}

// ============================================================
// Volvox colony class
// ============================================================
class Colony {
  constructor(x, y, isChild = false) {
    this.pos = createVector(x, y);

    // Slow drifting movement
    this.vel = p5.Vector.random2D().mult(random(0.03, 0.18));

    // Size: children slightly smaller than initial adult
    if (isChild) {
      this.minRadius = random(10, 16);   // start smaller
      this.maxRadius = random(26, 38);
    } else {
      this.minRadius = random(14, 22);
      this.maxRadius = random(32, 48);
    }
    this.radius = this.minRadius;

    // Lifecycle timing (slower, smoother) in seconds
    this.age = 0;
    this.lifeSpan = random(40, 70); // longer life overall

    // Growth over a bigger fraction of life
    this.growthDuration = this.lifeSpan * 0.6;

    // Start forming daughters later & slower
    this.gestationStart = this.lifeSpan * random(0.45, 0.6);
    // Rupture near the end
    this.ruptureTime = this.lifeSpan * random(0.85, 0.95);

    // How many daughters form inside
    this.targetDaughters = floor(random(3, 7));
    this.daughters = []; // internal daughters info

    // Rotation (makes it look like a rolling 3D sphere)
    this.rotX = random(TWO_PI);
    this.rotY = random(TWO_PI);
    this.rotXSpeed = random(0.2, 0.5) * random([-1, 1]) * 0.4;
    this.rotYSpeed = random(0.2, 0.5) * random([-1, 1]) * 0.4;

    // Gentle drift limits
    this.maxSpeed = 0.4;

    this.dead = false;
  }

  update(dt) {
    if (this.dead) return;

    this.age += dt;

    // Radius growth (smooth from baby → adult)
    const g = constrain(this.age / this.growthDuration, 0, 1);
    this.radius = lerp(this.minRadius, this.maxRadius, g);

    // Simple drift movement
    this.pos.add(this.vel);

    // Wrap around edges (torus space)
    if (this.pos.x < -this.radius) this.pos.x = width + this.radius;
    if (this.pos.x > width + this.radius) this.pos.x = -this.radius;
    if (this.pos.y < -this.radius) this.pos.y = height + this.radius;
    if (this.pos.y > height + this.radius) this.pos.y = -this.radius;

    // Very subtle random wobble so they don't all move straight
    let jitter = p5.Vector.random2D().mult(0.003);
    this.vel.add(jitter).limit(this.maxSpeed);

    // Rotation over time
    this.rotX += this.rotXSpeed * dt;
    this.rotY += this.rotYSpeed * dt;

    // Handle daughters
    this.updateDaughters(dt);

    // Rupture and release daughters
    if (this.age >= this.ruptureTime) {
      this.rupture();
    }
  }

  updateDaughters(dt) {
    // Don't form daughters before gestationStart or if already rupturing
    if (this.age < this.gestationStart || this.age > this.ruptureTime) return;

    // Spawn new daughters gradually while under target count
    if (this.daughters.length < this.targetDaughters &&
        colonies.length + this.daughters.length < MAX_COLONIES) {

      // Lower rate → slower gestation
      const lambda = 0.25; // daughters / sec
      if (random() < lambda * dt) {
        const angle = random(TWO_PI);
        const distanceFactor = random(0.25, 0.55);   // relative to parent radius
        const relRadiusMax   = random(0.25, 0.45);   // relative to parent radius

        this.daughters.push({
          angle: angle,             // angular position inside
          distFactor: distanceFactor,
          relRadiusMax: relRadiusMax,
          age: 0,                   // internal age
        });
      }
    }

    // Grow and revolve daughters inside parent
    for (let d of this.daughters) {
      d.age += dt;

      // Let daughters slowly revolve inside
      d.angle += 0.15 * dt; // slower orbit

      // Their size tracks the parent's size (fraction of parent radius)
      const maxR = this.radius * d.relRadiusMax;
      const growT = this.lifeSpan * 0.6; // slower growth window for daughters
      const dg = constrain(d.age / growT, 0, 1);
      d.currentRadius = maxR * dg;
    }
  }

  rupture() {
    // Release internal daughters as independent colonies,
    // with stronger outward push and starting slightly outside parent
    for (let d of this.daughters) {
      if (colonies.length >= MAX_COLONIES) break;

      const dir = p5.Vector.fromAngle(d.angle);

      // Start beyond parent's surface to reduce overlap
      const offsetMag = this.radius * (d.distFactor + 0.7); // extra 0.7
      const dx = dir.x * offsetMag;
      const dy = dir.y * offsetMag;

      const newX = this.pos.x + dx;
      const newY = this.pos.y + dy;

      // Create a new child colony
      const child = new Colony(newX, newY, true);

      // Start as a genuine "baby" (age 0 → smooth growth)
      child.age = 0;

      // Outward velocity so they spread out more
      const outwardVel = dir.copy().mult(random(0.25, 0.6));
      // Some inherited drift
      child.vel = outwardVel.add(this.vel.copy().mult(0.3));

      colonies.push(child);
    }

    // Parent is done
    this.dead = true;
  }

  draw() {
    if (this.dead) return;

    // Fade slightly near the end of life
    const lifeRatio = constrain(this.age / this.lifeSpan, 0, 1);
    const fade = map(lifeRatio, 0.85, 1.0, 1.0, 0.2, true);

    // Draw main Volvox sphere (mesh of dots)
    const baseR = 60;
    const baseG = 190;
    const baseB = 120;
    const alpha = 200 * fade;

    drawSphereAt(
      this.pos.x,
      this.pos.y,
      this.radius,
      this.rotX,
      this.rotY,
      baseR,
      baseG,
      baseB,
      alpha
    );

    // Draw daughter colonies inside as smaller spheres
    for (let d of this.daughters) {
      if (!d.currentRadius || d.currentRadius <= 0) continue;

      const offsetMag = this.radius * d.distFactor;
      const cx = this.pos.x + cos(d.angle) * offsetMag;
      const cy = this.pos.y + sin(d.angle) * offsetMag;

      // Slightly brighter green for daughters
      const childR = 70;
      const childG = 210;
      const childB = 140;
      const childAlpha = 220 * fade;

      drawSphereAt(
        cx,
        cy,
        d.currentRadius,
        this.rotX * 1.1, // small variation in rotation
        this.rotY * 1.1,
        childR,
        childG,
        childB,
        childAlpha
      );
    }
  }
}

// ============================================================
// Render helper: draw a 3D-ish dot sphere at (cx,cy)
// ------------------------------------------------------------
// Uses unitSpherePoints (x,y,z in [-1,1]) and:
//  - rotates by (rotX, rotY)
//  - scales by radius
//  - colors & sizes dots based on depth (z)
// - LOD: fewer points for smaller spheres → faster
// ============================================================
function drawSphereAt(cx, cy, radius, rotX, rotY, baseR, baseG, baseB, alpha) {
  noStroke();

  // Level of detail: smaller radius → skip more points
  // radius ~ 10 → step≈4, radius ~ 60 → step≈1
  const step = floor(map(radius, 10, 60, 1, 1, true));

  for (let i = 0; i < unitSpherePoints.length; i += step) {
    const p = unitSpherePoints[i];

    // Rotate around Y axis
    let x1 =  p.x * cos(rotY) + p.z * sin(rotY);
    let z1 = -p.x * sin(rotY) + p.z * cos(rotY);
    let y1 =  p.y;

    // Rotate around X axis
    let y2 =  y1 * cos(rotX) - z1 * sin(rotX);
    let z2 =  y1 * sin(rotX) + z1 * cos(rotX);
    let x2 =  x1;

    // Project to 2D
    const sx = cx + x2 * radius;
    const sy = cy + y2 * radius;

    // Depth in [0,1]
    const depth = (z2 + 1) / 2;

    // Dot size & alpha based on depth
    const sizeBase = map(radius, 10, 60, 1.3, 3.0, true);
    const dotSize  = lerp(sizeBase * 0.7, sizeBase * 1.4, depth);
    const a        = alpha * lerp(0.35, 1.0, depth);

    // Simple shading: front side slightly brighter
    const shade = lerp(0.75, 1.2, depth);

    fill(baseR * shade, baseG * shade, baseB * shade, a);
    ellipse(sx, sy, dotSize, dotSize);
  }
}
