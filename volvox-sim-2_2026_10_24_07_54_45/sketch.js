// ============================================================
// Volvox colony sim (single-species, dot-sphere version)
// ------------------------------------------------------------
// - Start with ONE Volvox-like sphere made of dots
// - It slowly grows
// - Daughter colonies form inside
// - Outer colony "ruptures" and releases daughters
// - Daughters drift, grow, and repeat → multiplication
// - Press 'f' to toggle fullscreen
// ============================================================

let colonies = [];

// Shared geometry for all spheres: unit sphere points
let unitSpherePoints = [];
const NUM_POINTS = 600;

// Soft population limit
const MAX_COLONIES = 40;

// ------------------------------------------------------------
// Setup: canvas + precompute sphere mesh + start with 1 colony
// ------------------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  background(111);

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
// Volvox colony class
// - Uses the shared unitSpherePoints to render a 3D-ish mesh
// - Slowly grows
// - Spawns daughter colonies inside
// - Eventually ruptures, releasing daughters as new colonies
// ============================================================
class Colony {
  constructor(x, y, isChild = false) {
    this.pos = createVector(x, y);

    // Slow drifting movement
    this.vel = p5.Vector.random2D().mult(random(0.05, 0.25));

    // Size: children are slightly smaller than first adult
    if (isChild) {
      this.minRadius = random(14, 22);
      this.maxRadius = random(28, 40);
    } else {
      this.minRadius = random(18, 26);
      this.maxRadius = random(36, 50);
    }
    this.radius = this.minRadius;

    // Lifecycle timing (seconds)
    this.age = 0;
    this.lifeSpan = random(25, 45); // when it will rupture

    // Growth is in the early fraction of life
    this.growthDuration = this.lifeSpan * 0.3;

    // Start forming daughters inside around 1/3 of life
    this.gestationStart = this.lifeSpan * random(0.3, 0.45);

    // Rupture near the end
    this.ruptureTime = this.lifeSpan * random(0.8, 0.95);

    // How many daughters form inside
    this.targetDaughters = floor(random(3, 7));
    this.daughters = []; // internal daughters info

    // Rotation (makes it look like a rolling 3D sphere)
    this.rotX = random(TWO_PI);
    this.rotY = random(TWO_PI);
    this.rotXSpeed = random(0.3, 0.8) * random([-1, 1]) * 0.4;
    this.rotYSpeed = random(0.3, 0.8) * random([-1, 1]) * 0.4;

    // Gentle drift limits
    this.maxSpeed = 0.5;

    this.dead = false;
  }

  update(dt) {
    if (this.dead) return;

    this.age += dt;

    // Radius growth
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
    let jitter = p5.Vector.random2D().mult(0.005);
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
      // Time-based probability (about 0.5 daughters/sec during window)
      const lambda = 0.5;
      if (random() < lambda * dt) {
        const angle = random(TWO_PI);
        const distanceFactor = random(0.2, 0.6);    // relative to parent radius
        const relRadiusMax   = random(0.3, 0.5);    // relative to parent radius

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
      d.angle += 0.2 * dt; // orbit speed

      // Their size tracks the parent's size (fraction of parent radius)
      const maxR = this.radius * d.relRadiusMax;
      const growT = this.lifeSpan * 0.3; // growth window for daughters
      const dg = constrain(d.age / growT, 0, 1);
      d.currentRadius = maxR * dg;
    }
  }

  rupture() {
    // Release internal daughters as independent colonies
    for (let d of this.daughters) {
      if (colonies.length >= MAX_COLONIES) break;

      const offsetMag = this.radius * d.distFactor;
      const dx = cos(d.angle) * offsetMag;
      const dy = sin(d.angle) * offsetMag;

      const newX = this.pos.x + dx;
      const newY = this.pos.y + dy;

      // Create a new child colony
      const child = new Colony(newX, newY, true);

      // Start it partway through its growth so it feels "already formed"
      child.age = child.lifeSpan * random(0.2, 0.4);
      // And give it a bit of the parent's drift
      child.vel = this.vel.copy().add(p5.Vector.random2D().mult(0.05));

      colonies.push(child);
    }

    // Parent is done
    this.dead = true;
  }

  draw() {
    if (this.dead) return;

    // Fade slightly near the end of life
    const lifeRatio = constrain(this.age / this.lifeSpan, 0, 1);
    const fade = map(lifeRatio, 0.8, 1.0, 1.0, 0.2, true);

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
// ============================================================
function drawSphereAt(cx, cy, radius, rotX, rotY, baseR, baseG, baseB, alpha) {
  noStroke();

  for (let p of unitSpherePoints) {
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
    const sizeBase = map(radius, 14, 60, 1.4, 3.2, true);
    const dotSize  = lerp(sizeBase * 0.7, sizeBase * 1.4, depth);
    const a        = alpha * lerp(0.3, 1.0, depth);

    // Simple shading: front side slightly brighter
    const shade = lerp(0.7, 1.2, depth);

    fill(baseR * shade, baseG * shade, baseB * shade, a);
    ellipse(sx, sy, dotSize, dotSize);
  }
}
