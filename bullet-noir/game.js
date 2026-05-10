const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.querySelector("#score"),
  wave: document.querySelector("#wave"),
  time: document.querySelector("#time"),
  focus: document.querySelector("#focus"),
  health: document.querySelector("#health"),
  operative: document.querySelector("#operative"),
  ammo: document.querySelector("#ammo"),
  overlay: document.querySelector("#overlay"),
  status: document.querySelector("#status"),
  restart: document.querySelector("#restart"),
  loadout: [...document.querySelectorAll(".loadout-button")],
};

const WEAPONS = {
  rifle: {
    name: "Rifle",
    damage: 26,
    fireDelay: 0.105,
    magazine: 30,
    reload: 1.25,
    speed: 840,
    spread: 0.035,
    pellets: 1,
    soundRadius: 220,
  },
  autogun: {
    name: "Autogun",
    damage: 17,
    fireDelay: 0.07,
    magazine: 70,
    reload: 2.1,
    speed: 820,
    spread: 0.07,
    pellets: 1,
    soundRadius: 290,
    moveScale: 0.78,
  },
  vindicator: {
    name: "Vindicator",
    damage: 12,
    fireDelay: 0.52,
    magazine: 8,
    reload: 1.55,
    speed: 760,
    spread: 0.19,
    pellets: 6,
    soundRadius: 260,
  },
};

const OPERATIVES = {
  nco: {
    label: "NCO",
    weapon: "rifle",
    maxHealth: 120,
    speed: 280,
    focusRegen: 0.24,
    color: "#f4f0de",
  },
  specialist: {
    label: "Heavy",
    weapon: "autogun",
    maxHealth: 150,
    speed: 252,
    focusRegen: 0.18,
    color: "#d7dee0",
  },
  medic: {
    label: "Medic",
    weapon: "vindicator",
    maxHealth: 105,
    speed: 292,
    focusRegen: 0.3,
    color: "#f4f0de",
  },
};

const ALIENS = {
  drone: { hp: 42, speed: 112, r: 13, damage: 22, score: 100, color: "#141719" },
  ranger: { hp: 58, speed: 82, r: 15, damage: 18, score: 160, color: "#8f1f1f", shoot: true },
  brute: { hp: 140, speed: 66, r: 20, damage: 38, score: 320, color: "#d52828" },
};

const keys = new Set();
const pointer = { x: 0, y: 0, down: false, active: false };
const state = {
  running: false,
  gameOver: false,
  score: 0,
  wave: 1,
  elapsed: 0,
  shake: 0,
  flash: 0,
  spawnTimer: 0,
  enemyBullets: [],
  playerBullets: [],
  enemies: [],
  particles: [],
  rain: [],
  director: {
    intensity: 0,
    hordeTimer: 18,
    horde: 0,
  },
};

const player = {
  x: 0,
  y: 0,
  r: 12,
  speed: 275,
  fireCooldown: 0,
  reloadTimer: 0,
  ammo: 30,
  classId: "nco",
  weaponId: "rifle",
  health: 120,
  maxHealth: 120,
  focus: 1,
  invuln: 0,
};

let last = performance.now();
let dpr = 1;
let width = 0;
let height = 0;

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  width = rect.width;
  height = rect.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildRain();
  if (!state.running) {
    player.x = width * 0.5;
    player.y = height * 0.62;
  }
}

function buildRain() {
  const count = Math.floor((width * height) / 9000);
  state.rain = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    speed: 520 + Math.random() * 380,
    len: 12 + Math.random() * 24,
    alpha: 0.08 + Math.random() * 0.16,
  }));
}

function startGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.wave = 1;
  state.elapsed = 0;
  state.spawnTimer = 0;
  state.enemyBullets.length = 0;
  state.playerBullets.length = 0;
  state.enemies.length = 0;
  state.particles.length = 0;
  state.director.intensity = 0;
  state.director.hordeTimer = 16;
  state.director.horde = 0;
  state.shake = 0;
  state.flash = 0;
  applyOperative(player.classId);
  player.x = width * 0.5;
  player.y = height * 0.62;
  player.focus = 1;
  player.invuln = 1.2;
  player.fireCooldown = 0;
  player.reloadTimer = 0;
  ui.overlay.hidden = true;
  ui.restart.hidden = true;
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  state.flash = 0.6;
  burst(player.x, player.y, "#f4f0de", 38, 420);
  ui.status.textContent = `Score ${state.score}. Click to run it back.`;
  ui.overlay.hidden = false;
  ui.restart.hidden = false;
}

function worldPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  pointer.active = true;
}

function spawnEnemy() {
  const type = pickAlienType();
  const edge = Math.floor(Math.random() * 4);
  const margin = 42;
  let x = 0;
  let y = 0;
  if (edge === 0) {
    x = Math.random() * width;
    y = -margin;
  } else if (edge === 1) {
    x = width + margin;
    y = Math.random() * height;
  } else if (edge === 2) {
    x = Math.random() * width;
    y = height + margin;
  } else {
    x = -margin;
    y = Math.random() * height;
  }

  const alien = ALIENS[type];
  state.enemies.push({
    x,
    y,
    r: alien.r,
    hp: alien.hp + state.wave * (type === "brute" ? 12 : 4),
    maxHp: alien.hp + state.wave * (type === "brute" ? 12 : 4),
    type,
    speed: alien.speed + state.wave * 4,
    damage: alien.damage,
    shoot: 0.5 + Math.random() * 1.2,
    angle: 0,
  });
}

function shoot() {
  const weapon = WEAPONS[player.weaponId];
  if (player.reloadTimer > 0) return;
  if (player.ammo <= 0) {
    startReload();
    return;
  }

  const aim = pointer.active ? angleTo(player, pointer) : -Math.PI / 2;
  for (let i = 0; i < weapon.pellets; i++) {
    const pelletAim = aim + (Math.random() - 0.5) * weapon.spread * 2;
    state.playerBullets.push({
      x: player.x + Math.cos(pelletAim) * 18,
      y: player.y + Math.sin(pelletAim) * 18,
      vx: Math.cos(pelletAim) * weapon.speed,
      vy: Math.sin(pelletAim) * weapon.speed,
      life: 0.85,
      r: weapon.pellets > 1 ? 3 : 4,
      damage: weapon.damage,
    });
  }
  player.ammo -= 1;
  player.fireCooldown = weapon.fireDelay;
  state.director.intensity = clamp(state.director.intensity + weapon.soundRadius / 2600, 0, 1);
  state.shake = Math.max(state.shake, 2.2);
  spark(player.x + Math.cos(aim) * 19, player.y + Math.sin(aim) * 19, aim);
}

function enemyShoot(enemy) {
  const aim = angleTo(enemy, player);
  state.enemyBullets.push({
    x: enemy.x + Math.cos(aim) * 18,
    y: enemy.y + Math.sin(aim) * 18,
    vx: Math.cos(aim) * (245 + state.wave * 8),
    vy: Math.sin(aim) * (245 + state.wave * 8),
    life: 4,
    r: 4.5,
    damage: enemy.damage,
  });
  spark(enemy.x, enemy.y, aim);
}

function update(dt) {
  if (!state.running) {
    updateParticles(dt);
    updateRain(dt);
    return;
  }

  const focusMode = keys.has("shift") && player.focus > 0.03;
  const scale = focusMode ? 0.46 : 1;
  const step = dt * scale;
  state.elapsed += dt;
  state.wave = 1 + Math.floor(state.elapsed / 24);
  state.spawnTimer -= dt;
  state.shake = Math.max(0, state.shake - dt * 12);
  state.flash = Math.max(0, state.flash - dt * 1.8);
  player.invuln = Math.max(0, player.invuln - dt);
  player.fireCooldown -= step;
  player.reloadTimer = Math.max(0, player.reloadTimer - dt);
  player.focus = Math.max(0, Math.min(1, player.focus + (focusMode ? -dt * 0.28 : dt * OPERATIVES[player.classId].focusRegen)));
  updateDirector(dt);

  movePlayer(dt, focusMode);
  if ((pointer.down || keys.has(" ")) && player.fireCooldown <= 0) shoot();
  if (keys.has("r")) startReload();

  const spawnRate = Math.max(0.2, 1.12 - state.wave * 0.08 - state.director.intensity * 0.35);
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = spawnRate * (0.72 + Math.random() * 0.5);
  }

  updateBullets(state.playerBullets, step);
  updateBullets(state.enemyBullets, step);
  updateEnemies(step);
  resolveHits();
  updateParticles(dt);
  updateRain(dt);
  updateUi();
}

function movePlayer(dt, focusMode) {
  let mx = 0;
  let my = 0;
  if (keys.has("w") || keys.has("arrowup")) my -= 1;
  if (keys.has("s") || keys.has("arrowdown")) my += 1;
  if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
  if (keys.has("d") || keys.has("arrowright")) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  const weapon = WEAPONS[player.weaponId];
  const firingScale = pointer.down && weapon.moveScale ? weapon.moveScale : 1;
  const speed = player.speed * firingScale * (focusMode ? 0.74 : 1);
  player.x = clamp(player.x + (mx / len) * speed * dt, 24, width - 24);
  player.y = clamp(player.y + (my / len) * speed * dt, 24, height - 24);
}

function updateBullets(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -80 || b.x > width + 80 || b.y < -80 || b.y > height + 80) {
      list.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    const aim = angleTo(enemy, player);
    enemy.angle = aim;
    const keepDistance = ALIENS[enemy.type].shoot && dist(enemy, player) < 250;
    const dir = keepDistance ? -1 : 1;
    enemy.x += Math.cos(aim) * enemy.speed * dir * dt;
    enemy.y += Math.sin(aim) * enemy.speed * dir * dt;
    enemy.shoot -= dt;
    if (ALIENS[enemy.type].shoot && enemy.shoot <= 0) {
      enemyShoot(enemy);
      enemy.shoot = Math.max(0.8, 1.8 - state.wave * 0.07) + Math.random() * 0.8;
    }
  }
}

function resolveHits() {
  for (let i = state.playerBullets.length - 1; i >= 0; i--) {
    const bullet = state.playerBullets[i];
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const enemy = state.enemies[j];
      if (dist(bullet, enemy) < bullet.r + enemy.r) {
        state.playerBullets.splice(i, 1);
        enemy.hp -= bullet.damage;
        burst(bullet.x, bullet.y, enemy.type === "ranger" ? "#d52828" : "#f4f0de", 10, 220);
        state.shake = Math.max(state.shake, 4);
        if (enemy.hp <= 0) {
          state.enemies.splice(j, 1);
          state.score += ALIENS[enemy.type].score;
          state.director.intensity = clamp(state.director.intensity + (enemy.type === "brute" ? 0.16 : 0.06), 0, 1);
          burst(enemy.x, enemy.y, "#d52828", 22, 300);
        }
        break;
      }
    }
  }

  if (player.invuln > 0) return;
  for (const enemy of state.enemies) {
    if (dist(enemy, player) < enemy.r + player.r) {
      damagePlayer(enemy.damage);
      enemy.x -= Math.cos(enemy.angle) * 28;
      enemy.y -= Math.sin(enemy.angle) * 28;
    }
  }
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const bullet = state.enemyBullets[i];
    if (dist(bullet, player) < bullet.r + player.r) {
      state.enemyBullets.splice(i, 1);
      damagePlayer(bullet.damage);
    }
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function updateRain(dt) {
  for (const drop of state.rain) {
    drop.x -= drop.speed * 0.16 * dt;
    drop.y += drop.speed * dt;
    if (drop.y > height + drop.len) {
      drop.y = -drop.len;
      drop.x = Math.random() * width;
    }
  }
}

function render() {
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(sx, sy);
  drawWorld();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawRain();
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(213, 40, 40, ${state.flash * 0.22})`;
    ctx.fillRect(-10, -10, width + 20, height + 20);
  }
  ctx.restore();
}

function drawWorld() {
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(244, 240, 222, 0.035)";
  ctx.lineWidth = 1;
  const grid = 56;
  for (let x = ((state.elapsed * 12) % grid) - grid; x < width + grid; x += grid) {
    line(x, 0, x, height);
  }
  for (let y = ((state.elapsed * 9) % grid) - grid; y < height + grid; y += grid) {
    line(0, y, width, y);
  }

  const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, 80, width * 0.5, height * 0.5, Math.max(width, height) * 0.74);
  grad.addColorStop(0, "rgba(255,255,255,0.03)");
  grad.addColorStop(0.52, "rgba(0,0,0,0.1)");
  grad.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawPlayer() {
  const aim = pointer.active ? angleTo(player, pointer) : -Math.PI / 2;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(aim);
  ctx.globalAlpha = player.invuln > 0 ? 0.45 + Math.sin(state.elapsed * 22) * 0.25 : 1;
  ctx.fillStyle = "#f4f0de";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#050607";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);
    ctx.fillStyle = ALIENS[enemy.type].color;
    ctx.strokeStyle = enemy.type === "drone" ? "#d52828" : "#f4f0de";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(enemy.r + 4, 0);
    ctx.lineTo(-enemy.r, -enemy.r * 0.75);
    ctx.lineTo(-enemy.r * 0.6, 0);
    ctx.lineTo(-enemy.r, enemy.r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullets() {
  ctx.lineCap = "round";
  for (const b of state.playerBullets) {
    ctx.strokeStyle = "rgba(244, 240, 222, 0.62)";
    ctx.lineWidth = 2;
    line(b.x - b.vx * 0.018, b.y - b.vy * 0.018, b.x, b.y);
    ctx.fillStyle = "#f4f0de";
    circle(b.x, b.y, b.r);
  }
  for (const b of state.enemyBullets) {
    ctx.strokeStyle = "rgba(213, 40, 40, 0.72)";
    ctx.lineWidth = 2;
    line(b.x - b.vx * 0.032, b.y - b.vy * 0.032, b.x, b.y);
    ctx.fillStyle = "#d52828";
    circle(b.x, b.y, b.r);
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    circle(p.x, p.y, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawRain() {
  ctx.lineCap = "round";
  for (const drop of state.rain) {
    ctx.strokeStyle = `rgba(174, 194, 200, ${drop.alpha})`;
    ctx.lineWidth = 1;
    line(drop.x, drop.y, drop.x - drop.len * 0.18, drop.y + drop.len);
  }
}

function burst(x, y, color, count, power) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * power;
    const life = 0.28 + Math.random() * 0.5;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      color,
      size: 1.5 + Math.random() * 3.2,
    });
  }
}

function spark(x, y, aim) {
  for (let i = 0; i < 5; i++) {
    const a = aim + Math.PI + (Math.random() - 0.5) * 0.8;
    const s = 50 + Math.random() * 130;
    const life = 0.1 + Math.random() * 0.16;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      color: "#f4f0de",
      size: 1 + Math.random() * 2,
    });
  }
}

function updateUi() {
  ui.score.textContent = state.score;
  ui.wave.textContent = state.wave;
  const minutes = Math.floor(state.elapsed / 60).toString().padStart(2, "0");
  const seconds = Math.floor(state.elapsed % 60).toString().padStart(2, "0");
  ui.time.textContent = `${minutes}:${seconds}`;
  ui.focus.style.transform = `scaleX(${player.focus})`;
  ui.health.style.transform = `scaleX(${Math.max(0, player.health / player.maxHealth)})`;
  ui.operative.textContent = OPERATIVES[player.classId].label;
  ui.ammo.textContent = player.reloadTimer > 0 ? "..." : `${player.ammo}/${WEAPONS[player.weaponId].magazine}`;
}

function applyOperative(classId) {
  const operative = OPERATIVES[classId];
  player.classId = classId;
  player.weaponId = operative.weapon;
  player.maxHealth = operative.maxHealth;
  player.health = operative.maxHealth;
  player.speed = operative.speed;
  player.ammo = WEAPONS[player.weaponId].magazine;
}

function startReload() {
  const weapon = WEAPONS[player.weaponId];
  if (player.reloadTimer > 0 || player.ammo === weapon.magazine) return;
  player.reloadTimer = weapon.reload;
  player.fireCooldown = Math.max(player.fireCooldown, weapon.reload);
  window.setTimeout(() => {
    if (player.reloadTimer <= 0 && state.running) {
      player.ammo = weapon.magazine;
      updateUi();
    }
  }, weapon.reload * 1000);
}

function damagePlayer(amount) {
  if (player.invuln > 0) return;
  player.health -= amount;
  player.invuln = 0.35;
  state.flash = 0.35;
  state.shake = Math.max(state.shake, 8);
  state.director.intensity = clamp(state.director.intensity + amount / player.maxHealth, 0, 1);
  burst(player.x, player.y, "#f4f0de", 14, 250);
  if (player.health <= 0) endGame();
}

function updateDirector(dt) {
  state.director.intensity = clamp(state.director.intensity - dt * 0.025, 0, 1);
  state.director.hordeTimer -= dt;
  if (state.director.hordeTimer <= 0) {
    state.director.horde += 5 + Math.floor(state.wave * 1.5);
    state.director.hordeTimer = Math.max(7, 18 - state.wave * 1.2);
  }
  if (state.director.horde > 0 && state.spawnTimer <= 0.05) {
    spawnEnemy();
    state.director.horde -= 1;
  }
}

function pickAlienType() {
  if (state.director.horde > 0) return Math.random() < 0.82 ? "drone" : "ranger";
  const roll = Math.random();
  if (state.wave >= 4 && roll < 0.12 + state.director.intensity * 0.12) return "brute";
  if (roll < 0.25 + state.wave * 0.025) return "ranger";
  return "drone";
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key === " " || event.key === "Shift") event.preventDefault();
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
ui.loadout.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    ui.loadout.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    applyOperative(button.dataset.class);
    updateUi();
  });
});
canvas.addEventListener("pointermove", worldPointer);
canvas.addEventListener("pointerdown", (event) => {
  worldPointer(event);
  pointer.down = true;
  canvas.setPointerCapture(event.pointerId);
  if (!state.running) startGame();
});
canvas.addEventListener("pointerup", () => {
  pointer.down = false;
});
ui.overlay.addEventListener("pointerdown", startGame);
ui.restart.addEventListener("click", startGame);

resize();
updateUi();
requestAnimationFrame(loop);
