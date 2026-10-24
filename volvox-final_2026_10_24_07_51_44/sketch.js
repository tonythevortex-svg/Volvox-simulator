// ============================================================
// Volvox colony sim + meditative soundscape
// ------------------------------------------------------------
// - Each colony has a quiet sine tone
// - Pitch depends on position/size → interference as they move
// - Amplitude follows life/fade
// - Tiny pop sound when a colony starts to die
// - Press 'f' for fullscreen, 's' to toggle sound
// ============================================================

let colonies = [];

// Shared geometry for all spheres: unit sphere points
let unitSpherePoints = [];
const NUM_POINTS = 320;   // fixed, performance-friendly

// Soft population limit
const MAX_COLONIES = 900;

// Audio
let soundEnabled = false;   // toggled with 's'

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
  background(0);

  const dt = deltaTime / 1000.0; // seconds per frame

  // Update & draw all colonies
  for (let c of colonies) {
    c.update(dt);
    c.draw();
  }

  // Remove fully dead colonies
  colonies = colonies.filter(c => !c.dead);

  // Gentle separation so they don't stack too much
  applySeparation();

  // HUD
  noStroke();
  fill(20);
  textSize(12);
  text(
    "Colonies: " + colonies.length +
    "  (press 'f' for fullscreen, 's' for sound)",
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
// Key handling
// ------------------------------------------------------------
function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }

  // Toggle sound
  if (key === 's' || key === 'S') {
    // Needed to unlock audio context in browsers
    userStartAudio();

    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      // Turn on sound for existing colonies
      for (let c of colonies) {
        c.enableSound();
      }
    } else {
      // Turn off sound for all colonies
      for (let c of colonies) {
        c.disableSound();
      }
    }
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
// Pop sound when a colony starts dying
// ============================================================
function playPop() {
  if (!soundEnabled || typeof p5.Envelope === "undefined") return;

  let osc = new p5.Oscillator('sine');
  let env = new p5.Envelope();

  // Slightly clicky / percussive but very soft
  env.setADSR(0.001, 0.05, 0.0, 0.05);
  env.setRange(0.15, 0.0);

  osc.freq(random(500, 900));
  osc.start();
  env.play(osc);

  // Stop the osc a bit after the envelope finishes
  setTimeout(() => {
    osc.stop();
  }, 150);
}

// ============================================================
// Volvox colony class
// ============================================================
class Colony {
  constructor(x, y, isChild = false) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.03, 0.18));

    // Lifecycle timing (seconds)
    this.age = 0;
    this.lifeSpan = random(40, 70); // until rupture
    this.growthDuration = this.lifeSpan * 0.6;

    // Gestation & rupture timing
    this.gestationStart = this.lifeSpan * random(0.45, 0.6);
    this.ruptureTime    = this.lifeSpan * random(0.85, 0.95);

    // Size setup (smooth growth)
    if (isChild) {
      this.minRadius = random(10, 16);
      this.maxRadius = random(26, 38);
    } else {
      this.minRadius = random(14, 22);
      this.maxRadius = random(32, 48);
    }
    this.radius = this.minRadius;

    // Internal mini-Volvox (babies)
    this.targetDaughters = floor(random(3, 7));
    this.daughters = []; // {angle, distFactor, relRadiusMax, age, radius, rotX, rotY,...}

    // Rotation (3D-looking sphere)
    this.rotX = random(TWO_PI);
    this.rotY = random(TWO_PI);
    this.rotXSpeed = random(0.2, 5) * random([-1, 1]) * 0.4;
    this.rotYSpeed = random(0.2, 1) * random([-1, 1]) * 0.4;

    // Gentle drift
    this.maxSpeed = 0.4;

    // Death / fade and release timing
    this.state = "alive";      // "alive" → "dying" → dead=true
    this.deathTimer = 0;
    this.deathDuration = 3.0;  // seconds for full fade
    this.releaseDelayFraction = 0.6; // when in dying phase to release babies
    this.releaseDone = false;

    this.dead = false;

    // Audio
    this.osc = null;
    if (soundEnabled) {
      this.enableSound();
    }
  }

  // ----- Audio helpers -----
  enableSound() {
    if (this.osc || typeof p5.Oscillator === "undefined") return;
    this.osc = new p5.Oscillator('sine');
    this.osc.amp(0, 0);  // start silent
    this.osc.start();
  }

  disableSound() {
    if (this.osc) {
      this.osc.amp(0, 0.05);
      this.osc.stop(0.1);
      this.osc = null;
    }
  }

  updateSound() {
    if (!soundEnabled || !this.osc) return;

    // Base life fade (similar to draw())
    const lifeRatio = constrain(this.age / this.lifeSpan, 0, 1);
    let lifeFade = map(lifeRatio, 0.85, 1.0, 1.0, 0.4, true);

    if (this.state === "dying") {
      const deathFade = map(this.deathTimer, 0, this.deathDuration, 1.0, 0.0, true);
      lifeFade *= deathFade;
    }

    // Map position + size to frequency for gentle drift
    const baseMin = 110;  // low-ish, meditative
    const baseMax = 260;  // keep it narrow so tones blend
    let posFreq = map(this.pos.x, 0, width, baseMin, baseMax, true);
    let sizeOffset = map(this.radius, 10, 60, -20, 20, true);

    const freq = posFreq + sizeOffset;

    // Soft overall amplitude, scaled by fade
    const baseAmp = 0.03;
    const amp = baseAmp * lifeFade;

    // Smooth transitions
    this.osc.freq(freq, 0.2);
    this.osc.amp(amp, 0.3);
  }

  update(dt) {
    if (this.dead) return;

    if (this.state === "alive") {
      this.updateAlive(dt);
    } else if (this.state === "dying") {
      this.updateDying(dt);
    }

    // Update the audio each frame
    this.updateSound();
  }

  updateAlive(dt) {
    this.age += dt;

    // --- Smooth radius growth (linear in time) ---
    const g = constrain(this.age / this.growthDuration, 0, 1);
    this.radius = lerp(this.minRadius, this.maxRadius, g);

    // Drift movement
    this.pos.add(this.vel);

    // Wrap around edges
    if (this.pos.x < -this.radius) this.pos.x = width + this.radius;
    if (this.pos.x > width + this.radius) this.pos.x = -this.radius;
    if (this.pos.y < -this.radius) this.pos.y = height + this.radius;
    if (this.pos.y > height + this.radius) this.pos.y = -this.radius;

    // Subtle random wobble
    let jitter = p5.Vector.random2D().mult(0.003);
    this.vel.add(jitter).limit(this.maxSpeed);

    // Rotation over time
    this.rotX += this.rotXSpeed * dt;
    this.rotY += this.rotYSpeed * dt;

    // Handle gestating babies
    this.updateDaughters(dt);

    // When time is up, parent starts dying (rupture event)
    if (this.age >= this.ruptureTime) {
      this.startDying();
    }
  }

  updateDying(dt) {
    this.deathTimer += dt;

    // Drift
    this.pos.add(this.vel);
    if (this.pos.x < -this.radius) this.pos.x = width + this.radius;
    if (this.pos.x > width + this.radius) this.pos.x = -this.radius;
    if (this.pos.y < -this.radius) this.pos.y = height + this.radius;
    if (this.pos.y > height + this.radius) this.pos.y = -this.radius;

    // Very gentle shrink
    this.radius *= 0.998;

    // Slight wobble
    let jitter = p5.Vector.random2D().mult(0.002);
    this.vel.add(jitter).limit(this.maxSpeed);

    // At some point during dying, release the babies
    const releaseTime = this.deathDuration * this.releaseDelayFraction;
    if (!this.releaseDone && this.deathTimer >= releaseTime) {
      this.releaseBabies();
      this.releaseDone = true;
      // After release, we clear daughters so only free colonies exist
      this.daughters = [];
    }

    if (this.deathTimer >= this.deathDuration) {
      this.dead = true;
      this.disableSound();
    }
  }

  updateDaughters(dt) {
    // Don't form daughters before gestationStart or if dying
    if (this.age < this.gestationStart || this.state !== "alive") return;

    // Spawn new daughters gradually while under target count
    if (this.daughters.length < this.targetDaughters &&
        colonies.length + this.daughters.length < MAX_COLONIES) {

      const lambda = 0.25; // daughters / sec → slower gestation
      if (random() < lambda * dt) {
        const angle = random(TWO_PI);
        const distanceFactor = random(0.25, 0.55);   // rel. to parent radius
        const relRadiusMax   = random(0.25, 0.4);    // internal max fraction

        this.daughters.push({
          angle: angle,
          distFactor: distanceFactor,
          relRadiusMax: relRadiusMax,
          age: 0,
          radius: 0,
          rotX: random(TWO_PI),
          rotY: random(TWO_PI),
          rotXSpeed: random(0.25, 0.6) * random([-1, 1]) * 0.4,
          rotYSpeed: random(0.25, 0.6) * random([-1, 1]) * 0.4
        });
      }
    }

    // Grow and revolve daughters inside parent
    for (let d of this.daughters) {
      d.age += dt;

      // Babies slowly orbit inside
      d.angle += 0.15 * dt;

      // Babies rotate (for their own 3D look)
      d.rotX += d.rotXSpeed * dt;
      d.rotY += d.rotYSpeed * dt;

      // INTERNAL GROWTH: limited size inside the parent
      const internalMaxR = this.radius * d.relRadiusMax;
      const growT = this.lifeSpan * 0.4; // how fast they reach that limit
      const dg = constrain(d.age / growT, 0, 1);

      // Babies saturate at internalMaxR and then stop until release
      d.radius = internalMaxR * dg;
    }
  }

  startDying() {
    if (this.state !== "alive") return;
    this.state = "dying";
    this.deathTimer = 0;

    // Small pop when rupture begins
    playPop();
  }

  // Release babies after some fade time
  releaseBabies() {
    for (let d of this.daughters) {
      if (colonies.length >= MAX_COLONIES) break;

      const dir = p5.Vector.fromAngle(d.angle);

      // World position of baby at its current internal offset
      const offsetMag = this.radius * d.distFactor;
      const dx = dir.x * offsetMag;
      const dy = dir.y * offsetMag;

      const newX = this.pos.x + dx;
      const newY = this.pos.y + dy;

      const babyR = max(d.radius, 2); // avoid zero

      // Create a new child colony at the same radius
      const child = new Colony(newX, newY, true);

      // Smooth growth: start from babyR and grow beyond
      child.minRadius = babyR;
      child.radius    = babyR;
      child.maxRadius = babyR + random(12, 22);
      child.age       = 0;
      child.growthDuration = child.lifeSpan * 0.6;

      // Copy baby's rotation for continuity
      child.rotX      = d.rotX;
      child.rotY      = d.rotY;
      child.rotXSpeed = d.rotXSpeed;
      child.rotYSpeed = d.rotYSpeed;

      // *** Slow outward release ***
      // Very small outward velocity + a bit of inherited drift
      const outwardVel = dir.copy().mult(random(0.05, 0.15));
      child.vel = outwardVel.add(this.vel.copy().mult(0.2));

      // Ensure new child also has sound if enabled
      if (soundEnabled) {
        child.enableSound();
      }

      colonies.push(child);
    }
  }

  draw() {
    if (this.dead) return;

    // Base fade from lifecycle
    const lifeRatio = constrain(this.age / this.lifeSpan, 0, 1);
    let lifeFade = map(lifeRatio, 0.85, 1.0, 1.0, 0.4, true);

    // Extra fade during death animation
    if (this.state === "dying") {
      const deathFade = map(this.deathTimer, 0, this.deathDuration, 1.0, 0.0, true);
      lifeFade *= deathFade;
    }

    // Draw main Volvox sphere (mesh of dots)
    const baseR = 60;
    const baseG = 190;
    const baseB = 120;
    const alpha = 200 * lifeFade;

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

    // Draw daughter colonies inside:
    // - while alive
    // - AND while dying, until release happens
    const shouldDrawDaughters =
      this.state === "alive" || (this.state === "dying" && !this.releaseDone);

    if (shouldDrawDaughters) {
      for (let d of this.daughters) {
        if (!d.radius || d.radius <= 0) continue;

        const offsetMag = this.radius * d.distFactor;
        const cx = this.pos.x + cos(d.angle) * offsetMag;
        const cy = this.pos.y + sin(d.angle) * offsetMag;

        const childR = 70;
        const childG = 210;
        const childB = 140;
        const childAlpha = 220 * lifeFade;

        drawSphereAt(
          cx,
          cy,
          d.radius,
          d.rotX,
          d.rotY,
          childR,
          childG,
          childB,
          childAlpha
        );
      }
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

  for (let i = 0; i < unitSpherePoints.length; i++) {
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
