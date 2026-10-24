// ============================================================
// Volvox-inspired spores - floaty version (p5.js browser sketch)
// - Fullscreen canvas (fills window)
// - Soft, floating motion in a noise-based flow field
// - Translucent green colonies with internal babies
// - Babies released as spores, spores can become new colonies
// - Population regulation (max colonies & spores)
// - Press 'f' to toggle fullscreen
// ============================================================

let colonies = [];
let spores = [];

// Initial population and global caps
const INITIAL_COLONIES = 18;
const MAX_COLONIES = 30;
const MAX_SPORES   = 120;

// ------------------------------------------------------------
// p5: setup
// ------------------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  background(5, 10, 15);

  for (let i = 0; i < INITIAL_COLONIES; i++) {
    colonies.push(spawnColony(random(width), random(height)));
  }
}

// ------------------------------------------------------------
// p5: draw
// ------------------------------------------------------------
function draw() {
  // No trail: we clear fully each frame
  background(5, 10, 15);

  const dt = deltaTime / 1000.0; // seconds per frame

  // Update colonies
  for (let colony of colonies) {
    colony.update(dt);
    colony.draw();
  }

  // Update spores
  for (let spore of spores) {
    spore.update(dt);
    spore.draw();
  }

  // Clean up dead ones
  colonies = colonies.filter(c => !c.dead);
  spores   = spores.filter(s => !s.dead);

  // HUD
  noStroke();
  fill(180, 255);
  textSize(12);
  text(
    "Colonies: " + colonies.length +
    "  Spores: " + spores.length +
    "  (press 'f' for fullscreen)",
    10, 20
  );
}

// ------------------------------------------------------------
// Keep canvas full-window
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

// ------------------------------------------------------------
// Flow field (turbulence) using Perlin noise
// Floaty = not too strong
// ------------------------------------------------------------
function flowField(x, y) {
  const scale = 0.0015;
  const t = millis() * 0.00003;

  const n = noise(x * scale, y * scale, t);
  const angle = n * TWO_PI * 3.0; // fewer curls than before

  const v = p5.Vector.fromAngle(angle);
  v.mult(0.15); // weaker, more gentle flow
  return v;
}

// ------------------------------------------------------------
// Spawn helper: create a new Colony at (x, y)
// ------------------------------------------------------------
function spawnColony(x, y) {
  return new Colony(x, y);
}

// ------------------------------------------------------------
// Colony class (parent "adult" sphere)
// Adults now about half the size of previous version
// ------------------------------------------------------------
class Colony {
  constructor(x, y) {
    this.pos = createVector(x, y);

    // Small initial velocity
    this.vel = p5.Vector.random2D();
    this.vel.mult(random(0.05, 0.3));

    // Smaller adults
    this.minRadius = random(6, 9);    // was ~12-18
    this.maxRadius = random(14, 20);  // was ~28-40
    this.radius = this.minRadius;

    // Life & timing in seconds
    this.age = 0;
    this.lifeSpan = random(25, 55);

    this.gestationStart = this.lifeSpan * random(0.3, 0.45);
    this.hatchTime      = this.lifeSpan * random(0.8, 0.95);

    this.maxBabies = floor(random(6, 14));
    this.babies = [];

    this.spinSpeed = random(-0.15, 0.15);

    // Much floatier motion: low speed, low jitter
    this.flowInfluence = random(0.4, 0.9);
    this.randomJitter  = 0.01;
    this.maxSpeed      = 0.8;

    this.alpha = 130;
    this.dead = false;
  }

  update(dt) {
    if (this.dead) return;

    this.age += dt;

    // Growth
    const growthDuration = this.lifeSpan * 0.3;
    const g = constrain(this.age / growthDuration, 0, 1);
    this.radius = lerp(this.minRadius, this.maxRadius, g);

    // Flow + very gentle jitter
    const flow = flowField(this.pos.x, this.pos.y).mult(this.flowInfluence);
    const jitter = p5.Vector.random2D().mult(this.randomJitter);

    this.vel.add(flow.mult(dt));
    this.vel.add(jitter);
    this.vel.limit(this.maxSpeed);

    this.pos.add(this.vel);

    this.wrapAround();
    this.updateBabies(dt);

    if (this.age >= this.lifeSpan) {
      this.hatchAndDie();
    }
  }

  wrapAround() {
    if (this.pos.x < -this.radius) this.pos.x = width + this.radius;
    if (this.pos.x > width + this.radius) this.pos.x = -this.radius;
    if (this.pos.y < -this.radius) this.pos.y = height + this.radius;
    if (this.pos.y > height + this.radius) this.pos.y = -this.radius;
  }

  updateBabies(dt) {
    if (this.age < this.gestationStart || this.age > this.hatchTime) return;

    // Only produce babies if we haven't hit spore cap
    if (this.babies.length < this.maxBabies && spores.length < MAX_SPORES) {
      const chance = 0.04;
      if (random() < chance) {
        const angle = random(TWO_PI);
        const innerR = this.radius * random(0.2, 0.7);
        this.babies.push({
          angle: angle,
          r: innerR,
          radialSpeed: random(-0.01, 0.01)
        });
      }
    }

    for (let b of this.babies) {
      b.angle += this.spinSpeed * dt;
      b.r += b.radialSpeed;
      b.r = constrain(b.r, this.radius * 0.15, this.radius * 0.8);
    }
  }

  hatchAndDie() {
    // Release babies as spores, but respect global spore cap
    for (let b of this.babies) {
      if (spores.length >= MAX_SPORES) break;

      const dir = p5.Vector.fromAngle(b.angle);
      const babyPos = p5.Vector.add(this.pos, p5.Vector.mult(dir, b.r));

      // Very gentle outward push + some inherited motion
      const outward = dir.copy().mult(random(0.05, 0.2));
      const v = p5.Vector.add(this.vel.copy().mult(0.4), outward);

      spores.push(new Spore(babyPos.x, babyPos.y, v));
    }

    this.dead = true;
  }

  draw() {
    if (this.dead) return;

    push();
    translate(this.pos.x, this.pos.y);

    const lifeRatio = constrain(this.age / this.lifeSpan, 0, 1);
    const fadeFactor = map(lifeRatio, 0.7, 1.0, 1.0, 0.3, true);
    const alphaBody = this.alpha * fadeFactor;

    noStroke();
    fill(80, 220, 120, alphaBody);
    ellipse(0, 0, this.radius * 2, this.radius * 2);

    stroke(120, 255, 160, alphaBody + 40);
    strokeWeight(1);
    noFill();
    ellipse(0, 0, this.radius * 2.1, this.radius * 2.1);

    noStroke();
    for (let b of this.babies) {
      const bx = cos(b.angle) * b.r;
      const by = sin(b.angle) * b.r;
      fill(140, 255, 170, 220);
      ellipse(bx, by, 3.5, 3.5);
    }

    pop();
  }
}

// ------------------------------------------------------------
// Spore class (released babies)
// Smaller, floaty particles
// ------------------------------------------------------------
class Spore {
  constructor(x, y, vel) {
    this.pos = createVector(x, y);
    this.vel = vel.copy();

    this.age = 0;
    this.dead = false;

    this.juvenileDuration = random(6, 16);
    this.maxAge = this.juvenileDuration + random(6, 14);

    // Slightly smaller spores as well
    this.radius = random(1.5, 3);

    this.flowInfluence = random(0.4, 0.9);
    this.randomJitter  = 0.01;
    this.maxSpeed      = 0.9;
  }

  update(dt) {
    if (this.dead) return;

    this.age += dt;

    const flow = flowField(this.pos.x, this.pos.y).mult(this.flowInfluence);
    const jitter = p5.Vector.random2D().mult(this.randomJitter);

    this.vel.add(flow.mult(dt));
    this.vel.add(jitter);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);

    this.wrapAround();

    // Population regulation: only seed new colony if below cap
    if (this.age > this.juvenileDuration && this.age < this.maxAge) {
      if (colonies.length < MAX_COLONIES) {
        const chance = 0.0025;
        if (random() < chance) {
          colonies.push(spawnColony(this.pos.x, this.pos.y));
          this.dead = true;
        }
      }
    }

    if (this.age >= this.maxAge) {
      this.dead = true;
    }
  }

  wrapAround() {
    if (this.pos.x < -this.radius) this.pos.x = width + this.radius;
    if (this.pos.x > width + this.radius) this.pos.x = -this.radius;
    if (this.pos.y < -this.radius) this.pos.y = height + this.radius;
    if (this.pos.y > height + this.radius) this.pos.y = -this.radius;
  }

  draw() {
    if (this.dead) return;

    const lifeRatio = constrain(this.age / this.maxAge, 0, 1);
    const alpha = map(lifeRatio, 0, 1, 220, 80);

    noStroke();
    fill(140, 255, 180, alpha);
    ellipse(this.pos.x, this.pos.y, this.radius * 2, this.radius * 2);
  }
}
