const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  status: document.querySelector("#status"),
  ammo: document.querySelector("#ammo"),
  alive: document.querySelector("#alive"),
  score: document.querySelector("#score"),
  health: document.querySelector("#health"),
  noise: document.querySelector("#noise"),
  overlay: document.querySelector("#overlay"),
  start: document.querySelector("#start"),
};

const keys = new Set();
const mouse = { x: 0, y: 0, down: false, active: false };

const game = {
  running: false,
  score: 0,
  shake: 0,
  time: 0,
  noise: 0,
  walls: [],
  grass: [],
  bullets: [],
  pings: [],
  sparks: [],
  agents: [],
  decals: [],
};

const player = makeAgent({
  id: "player",
  team: "blue",
  x: 420,
  y: 420,
  color: "#7fd0ff",
  controlled: true,
  weapon: {
    name: "SMG",
    mag: 24,
    ammo: 24,
    rate: 0.115,
    reload: 1.05,
    damage: 19,
    speed: 820,
    spread: 0.055,
    range: 0.82,
    noise: 310,
  },
});

let width = 1;
let height = 1;
let dpr = 1;
let last = performance.now();

function makeAgent(options) {
  return {
    id: options.id,
    team: options.team,
    x: options.x,
    y: options.y,
    vx: 0,
    vy: 0,
    r: 18,
    hp: 100,
    maxHp: 100,
    angle: -Math.PI / 2,
    color: options.color,
    controlled: !!options.controlled,
    weapon: options.weapon || {
      name: "RIFLE",
      mag: 18,
      ammo: 18,
      rate: 0.18,
      reload: 1.25,
      damage: 24,
      speed: 780,
      spread: 0.045,
      range: 0.86,
      noise: 270,
    },
    fireTimer: 0,
    reloadTimer: 0,
    footstep: 0,
    seenTimer: 0,
    lastHeard: null,
    ai: {
      state: "patrol",
      targetX: options.x,
      targetY: options.y,
      think: 0,
    },
  };
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  width = rect.width;
  height = rect.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildMap();
}

function buildMap() {
  const cx = width / 2;
  const cy = height / 2;
  game.walls = [
    rect(cx - 420, cy - 250, 260, 34),
    rect(cx + 160, cy - 250, 260, 34),
    rect(cx - 455, cy + 220, 300, 34),
    rect(cx + 150, cy + 220, 300, 34),
    rect(cx - 44, cy - 160, 88, 320),
    rect(cx - 330, cy - 42, 190, 30),
    rect(cx + 140, cy + 42, 210, 30),
    rect(cx - 590, cy - 120, 36, 310),
    rect(cx + 554, cy - 220, 36, 310),
    rect(cx - 180, cy - 355, 360, 28),
    rect(cx - 180, cy + 345, 360, 28),
  ].filter((w) => w.x > -80 && w.y > -80 && w.x + w.w < width + 80 && w.y + w.h < height + 80);

  game.grass = [
    rect(cx - 610, cy - 310, 160, 92),
    rect(cx + 420, cy + 220, 165, 96),
    rect(cx - 160, cy + 220, 130, 90),
    rect(cx + 58, cy - 332, 150, 92),
  ].filter((g) => g.x > -80 && g.y > -80 && g.x + g.w < width + 80 && g.y + g.h < height + 80);
}

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function start() {
  game.running = true;
  game.score = 0;
  game.time = 0;
  game.noise = 0;
  game.bullets.length = 0;
  game.pings.length = 0;
  game.sparks.length = 0;
  game.decals.length = 0;
  resetAgent(player, width * 0.5, height * 0.62);
  player.weapon.ammo = player.weapon.mag;
  game.agents = [player];

  const spots = [
    [width * 0.2, height * 0.2],
    [width * 0.8, height * 0.2],
    [width * 0.18, height * 0.75],
    [width * 0.82, height * 0.72],
    [width * 0.52, height * 0.22],
  ];
  spots.forEach((spot, index) => {
    game.agents.push(
      makeAgent({
        id: `bot-${index}`,
        team: "red",
        x: spot[0],
        y: spot[1],
        color: index % 2 ? "#ff554e" : "#ff9f43",
        weapon:
          index === 2
            ? {
                name: "SHOT",
                mag: 6,
                ammo: 6,
                rate: 0.55,
                reload: 1.35,
                damage: 12,
                speed: 720,
                spread: 0.22,
                pellets: 5,
                range: 0.72,
                noise: 290,
              }
            : undefined,
      }),
    );
  });

  ui.overlay.hidden = true;
}

function resetAgent(agent, x, y) {
  agent.x = x;
  agent.y = y;
  agent.vx = 0;
  agent.vy = 0;
  agent.hp = agent.maxHp;
  agent.fireTimer = 0;
  agent.reloadTimer = 0;
  agent.seenTimer = 0;
  agent.lastHeard = null;
}

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 14);
  game.noise = Math.max(0, game.noise - dt * 0.35);
  updateEffects(dt);

  if (!game.running) {
    updateUi();
    return;
  }

  for (const agent of game.agents) {
    if (agent.hp <= 0) continue;
    agent.fireTimer = Math.max(0, agent.fireTimer - dt);
    agent.reloadTimer = Math.max(0, agent.reloadTimer - dt);
    if (agent.reloadTimer === 0 && agent.weapon.ammo <= 0) agent.weapon.ammo = agent.weapon.mag;
    if (agent.controlled) updatePlayer(agent, dt);
    else updateBot(agent, dt);
    agent.footstep -= dt;
    if (Math.hypot(agent.vx, agent.vy) > 80 && agent.footstep <= 0) {
      emitPing(agent.x, agent.y, 94, agent.team === "blue" ? "#7fd0ff" : "#ff554e", 0.42);
      notifyNoise(agent, 210);
      agent.footstep = 0.38;
    }
  }

  updateBullets(dt);
  updateUi();

  if (player.hp <= 0) {
    game.running = false;
    ui.status.textContent = "DOWN";
    ui.overlay.hidden = false;
    ui.start.textContent = "Redeploy";
  }
}

function updatePlayer(agent, dt) {
  let mx = 0;
  let my = 0;
  if (keys.has("w") || keys.has("arrowup")) my -= 1;
  if (keys.has("s") || keys.has("arrowdown")) my += 1;
  if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
  if (keys.has("d") || keys.has("arrowright")) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  agent.vx = (mx / len) * 255;
  agent.vy = (my / len) * 255;
  moveAgent(agent, agent.vx * dt, agent.vy * dt);
  if (mouse.active) agent.angle = angleTo(agent, mouse);

  const autoTarget = nearestVisibleEnemy(agent);
  if (!mouse.down && autoTarget) agent.angle = angleTo(agent, autoTarget);
  if ((mouse.down || autoTarget) && agent.fireTimer <= 0) fire(agent);
  if (keys.has("r")) reload(agent);
}

function updateBot(agent, dt) {
  const seesPlayer = canSee(agent, player);
  if (seesPlayer) {
    agent.seenTimer = 1.2;
    agent.lastHeard = { x: player.x, y: player.y };
  } else {
    agent.seenTimer = Math.max(0, agent.seenTimer - dt);
  }

  agent.ai.think -= dt;
  if (agent.ai.think <= 0) {
    agent.ai.think = 0.25 + Math.random() * 0.25;
    if (seesPlayer || agent.seenTimer > 0) {
      agent.ai.state = "attack";
      agent.ai.targetX = player.x;
      agent.ai.targetY = player.y;
    } else if (agent.lastHeard) {
      agent.ai.state = "investigate";
      agent.ai.targetX = agent.lastHeard.x;
      agent.ai.targetY = agent.lastHeard.y;
    } else if (dist(agent, { x: agent.ai.targetX, y: agent.ai.targetY }) < 30) {
      agent.ai.state = "patrol";
      agent.ai.targetX = 80 + Math.random() * (width - 160);
      agent.ai.targetY = 80 + Math.random() * (height - 160);
    }
  }

  const target = { x: agent.ai.targetX, y: agent.ai.targetY };
  agent.angle = seesPlayer ? angleTo(agent, player) : angleTo(agent, target);
  const speed = agent.ai.state === "attack" ? 210 : 155;
  const close = dist(agent, target) < (agent.ai.state === "attack" ? 210 : 24);
  agent.vx = close ? 0 : Math.cos(agent.angle) * speed;
  agent.vy = close ? 0 : Math.sin(agent.angle) * speed;
  moveAgent(agent, agent.vx * dt, agent.vy * dt);

  if (seesPlayer && agent.fireTimer <= 0) fire(agent);
  if (agent.weapon.ammo <= 0) reload(agent);
}

function moveAgent(agent, dx, dy) {
  const ox = agent.x;
  const oy = agent.y;
  agent.x = clamp(agent.x + dx, agent.r + 8, width - agent.r - 8);
  if (hitsWall(agent)) agent.x = ox;
  agent.y = clamp(agent.y + dy, agent.r + 8, height - agent.r - 8);
  if (hitsWall(agent)) agent.y = oy;
}

function fire(agent) {
  if (agent.reloadTimer > 0 || agent.weapon.ammo <= 0) {
    reload(agent);
    return;
  }
  const pellets = agent.weapon.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = agent.angle + (Math.random() - 0.5) * agent.weapon.spread;
    game.bullets.push({
      owner: agent.id,
      team: agent.team,
      x: agent.x + Math.cos(a) * 25,
      y: agent.y + Math.sin(a) * 25,
      vx: Math.cos(a) * agent.weapon.speed,
      vy: Math.sin(a) * agent.weapon.speed,
      r: pellets > 1 ? 3 : 4,
      damage: agent.weapon.damage,
      life: agent.weapon.range,
    });
  }
  agent.weapon.ammo -= 1;
  agent.fireTimer = agent.weapon.rate;
  game.shake = Math.max(game.shake, agent.controlled ? 3 : 1.4);
  if (agent.controlled) game.noise = clamp(game.noise + 0.28, 0, 1);
  emitPing(agent.x, agent.y, agent.weapon.noise, agent.team === "blue" ? "#7fd0ff" : "#ff554e", 0.75);
  notifyNoise(agent, agent.weapon.noise);
  muzzle(agent);
}

function reload(agent) {
  if (agent.reloadTimer > 0 || agent.weapon.ammo === agent.weapon.mag) return;
  agent.reloadTimer = agent.weapon.reload;
}

function notifyNoise(source, radius) {
  for (const agent of game.agents) {
    if (agent === source || agent.hp <= 0 || agent.controlled) continue;
    if (dist(agent, source) < radius) agent.lastHeard = { x: source.x, y: source.y };
  }
}

function updateBullets(dt) {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || pointInWall(b.x, b.y)) {
      impact(b.x, b.y, "#eff2ea");
      game.bullets.splice(i, 1);
      continue;
    }
    for (const agent of game.agents) {
      if (agent.hp <= 0 || agent.team === b.team || agent.id === b.owner) continue;
      if (Math.hypot(agent.x - b.x, agent.y - b.y) < agent.r + b.r) {
        agent.hp -= b.damage;
        impact(b.x, b.y, agent.team === "red" ? "#ff554e" : "#7fd0ff");
        game.bullets.splice(i, 1);
        if (agent.hp <= 0) {
          game.score += agent.controlled ? 0 : 100;
          game.decals.push({ x: agent.x, y: agent.y, color: agent.color, life: 12 });
          emitPing(agent.x, agent.y, 180, agent.color, 0.9);
        }
        break;
      }
    }
  }
}

function updateEffects(dt) {
  for (let i = game.pings.length - 1; i >= 0; i--) {
    game.pings[i].age += dt;
    if (game.pings[i].age >= game.pings[i].life) game.pings.splice(i, 1);
  }
  for (let i = game.sparks.length - 1; i >= 0; i--) {
    const p = game.sparks[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) game.sparks.splice(i, 1);
  }
  for (let i = game.decals.length - 1; i >= 0; i--) {
    game.decals[i].life -= dt;
    if (game.decals[i].life <= 0) game.decals.splice(i, 1);
  }
}

function render() {
  const sx = (Math.random() - 0.5) * game.shake;
  const sy = (Math.random() - 0.5) * game.shake;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(sx, sy);
  drawArena();
  drawPings();
  drawBullets();
  drawAgents();
  drawSparks();
  drawFog();
  drawMinimap();
  ctx.restore();
}

function drawArena() {
  ctx.fillStyle = "#090d10";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(239,242,234,0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 56) line(x, 0, x, height);
  for (let y = 0; y < height; y += 56) line(0, y, width, y);

  for (const g of game.grass) {
    ctx.fillStyle = "rgba(31, 83, 64, 0.45)";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = "rgba(128, 255, 198, 0.12)";
    ctx.strokeRect(g.x + 3, g.y + 3, g.w - 6, g.h - 6);
  }

  for (const d of game.decals) {
    ctx.fillStyle = hexAlpha(d.color, Math.min(0.35, d.life / 12));
    circle(d.x, d.y, 34);
  }

  for (const w of game.walls) {
    ctx.fillStyle = "#171d20";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = "#242d31";
    ctx.fillRect(w.x, w.y, w.w, 5);
    ctx.strokeStyle = "rgba(239,242,234,0.12)";
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }
}

function drawPings() {
  for (const p of game.pings) {
    const t = p.age / p.life;
    ctx.strokeStyle = hexAlpha(p.color, (1 - t) * 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * t, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets() {
  ctx.lineCap = "round";
  for (const b of game.bullets) {
    ctx.strokeStyle = b.team === "blue" ? "rgba(127,208,255,0.82)" : "rgba(255,85,78,0.82)";
    ctx.lineWidth = 2;
    line(b.x - b.vx * 0.025, b.y - b.vy * 0.025, b.x, b.y);
  }
}

function drawAgents() {
  for (const agent of game.agents) {
    if (agent.hp <= 0) continue;
    const visible = agent.controlled || canSee(player, agent) || agent.seenTimer > 0;
    if (!agent.controlled && !visible) continue;

    ctx.save();
    ctx.translate(agent.x, agent.y);
    ctx.rotate(agent.angle);
    ctx.globalAlpha = agent.controlled || canSee(player, agent) ? 1 : 0.35;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 5, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = agent.color;
    ctx.beginPath();
    ctx.roundRect(-14, -12, 28, 24, 8);
    ctx.fill();

    ctx.fillStyle = "#101417";
    ctx.fillRect(8, -4, agent.weapon.pellets ? 24 : 31, 8);
    ctx.fillStyle = agent.team === "blue" ? "#d8f5ff" : "#ffd8d4";
    ctx.fillRect(28, -2, 8, 4);

    ctx.strokeStyle = "#050608";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, -4, agent.weapon.pellets ? 24 : 31, 8);
    ctx.restore();

    const hp = Math.max(0, agent.hp / agent.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(agent.x - 18, agent.y - 31, 36, 4);
    ctx.fillStyle = agent.team === "blue" ? "#7fd0ff" : "#ff554e";
    ctx.fillRect(agent.x - 18, agent.y - 31, 36 * hp, 4);

    if (!agent.controlled && agent.lastHeard && !canSee(player, agent)) {
      ctx.strokeStyle = "rgba(255,85,78,0.28)";
      ctx.lineWidth = 2;
      circleStroke(agent.lastHeard.x, agent.lastHeard.y, 18 + Math.sin(game.time * 7) * 4);
    }
  }
}

function drawSparks() {
  for (const p of game.sparks) {
    ctx.fillStyle = hexAlpha(p.color, p.life / p.maxLife);
    circle(p.x, p.y, p.size);
  }
}

function drawFog() {
  const poly = visionPolygon(player, 430, Math.PI * 0.72, 96);
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
  ctx.fillRect(-20, -20, width + 40, height + 40);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  for (const p of poly) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x, player.y, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(127,208,255,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  for (const p of poly) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.stroke();
}

function drawMinimap() {
  const w = 156;
  const h = 104;
  const x = width - w - 18;
  const y = 16;
  ctx.fillStyle = "rgba(4,6,8,0.72)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(239,242,234,0.18)";
  ctx.strokeRect(x, y, w, h);
  for (const wall of game.walls) {
    ctx.fillStyle = "rgba(239,242,234,0.12)";
    ctx.fillRect(x + (wall.x / width) * w, y + (wall.y / height) * h, (wall.w / width) * w, (wall.h / height) * h);
  }
  for (const agent of game.agents) {
    if (agent.hp <= 0) continue;
    if (!agent.controlled && !canSee(player, agent)) continue;
    ctx.fillStyle = agent.team === "blue" ? "#7fd0ff" : "#ff554e";
    circle(x + (agent.x / width) * w, y + (agent.y / height) * h, 3);
  }
}

function visionPolygon(agent, range, fov, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const a = agent.angle - fov / 2 + (fov * i) / steps;
    points.push(rayPoint(agent.x, agent.y, a, range));
  }
  return points;
}

function rayPoint(x, y, a, range) {
  let best = { x: x + Math.cos(a) * range, y: y + Math.sin(a) * range, d: range };
  for (const wall of game.walls) {
    for (const hit of rayRectHits(x, y, a, wall)) {
      if (hit.d > 0 && hit.d < best.d) best = hit;
    }
  }
  return best;
}

function rayRectHits(x, y, a, r) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const sides = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ];
  return sides.map(([x1, y1, x2, y2]) => raySegment(x, y, dx, dy, x1, y1, x2, y2)).filter(Boolean);
}

function raySegment(px, py, rdx, rdy, x1, y1, x2, y2) {
  const sdx = x2 - x1;
  const sdy = y2 - y1;
  const den = rdx * sdy - rdy * sdx;
  if (Math.abs(den) < 0.00001) return null;
  const t = ((x1 - px) * sdy - (y1 - py) * sdx) / den;
  const u = ((x1 - px) * rdy - (y1 - py) * rdx) / den;
  if (t >= 0 && u >= 0 && u <= 1) return { x: px + rdx * t, y: py + rdy * t, d: t };
  return null;
}

function canSee(from, target) {
  if (!from || !target || target.hp <= 0) return false;
  const d = dist(from, target);
  if (d > 430) return false;
  const a = angleTo(from, target);
  if (Math.abs(angleDelta(from.angle, a)) > Math.PI * 0.39 && d > 105) return false;
  return !lineBlocked(from.x, from.y, target.x, target.y);
}

function nearestVisibleEnemy(agent) {
  let best = null;
  let bestD = Infinity;
  for (const other of game.agents) {
    if (other.hp <= 0 || other.team === agent.team) continue;
    if (!canSee(agent, other)) continue;
    const d = dist(agent, other);
    if (d < bestD) {
      best = other;
      bestD = d;
    }
  }
  return best;
}

function lineBlocked(x1, y1, x2, y2) {
  return game.walls.some((w) => segmentRect(x1, y1, x2, y2, w));
}

function segmentRect(x1, y1, x2, y2, r) {
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  return (
    segmentsIntersect(x1, y1, x2, y2, r.x, r.y, r.x + r.w, r.y) ||
    segmentsIntersect(x1, y1, x2, y2, r.x + r.w, r.y, r.x + r.w, r.y + r.h) ||
    segmentsIntersect(x1, y1, x2, y2, r.x + r.w, r.y + r.h, r.x, r.y + r.h) ||
    segmentsIntersect(x1, y1, x2, y2, r.x, r.y + r.h, r.x, r.y)
  );
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const det = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(det) < 0.00001) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / det;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / det;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function hitsWall(agent) {
  return game.walls.some((w) => {
    const x = clamp(agent.x, w.x, w.x + w.w);
    const y = clamp(agent.y, w.y, w.y + w.h);
    return Math.hypot(agent.x - x, agent.y - y) < agent.r;
  });
}

function pointInWall(x, y) {
  return game.walls.some((w) => pointInRect(x, y, w));
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function inGrass(agent) {
  return game.grass.some((g) => pointInRect(agent.x, agent.y, g));
}

function emitPing(x, y, radius, color, life) {
  game.pings.push({ x, y, radius, color, age: 0, life });
}

function muzzle(agent) {
  for (let i = 0; i < 7; i++) {
    const a = agent.angle + Math.PI + (Math.random() - 0.5) * 0.8;
    const s = 50 + Math.random() * 160;
    game.sparks.push({
      x: agent.x + Math.cos(agent.angle) * 34,
      y: agent.y + Math.sin(agent.angle) * 34,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      size: 1.5 + Math.random() * 2.5,
      color: agent.team === "blue" ? "#7fd0ff" : "#ff554e",
      life: 0.18,
      maxLife: 0.18,
    });
  }
}

function impact(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 180;
    game.sparks.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      size: 1.5 + Math.random() * 3,
      color,
      life: 0.28,
      maxLife: 0.28,
    });
  }
}

function updateUi() {
  const living = game.agents.filter((a) => a.hp > 0).length;
  ui.status.textContent = game.running ? (player.reloadTimer > 0 ? "RELOAD" : "HUNT") : "READY";
  ui.ammo.textContent = player.reloadTimer > 0 ? "..." : `${player.weapon.ammo}/${player.weapon.mag}`;
  ui.alive.textContent = living;
  ui.score.textContent = game.score;
  ui.health.style.transform = `scaleX(${clamp(player.hp / player.maxHp, 0, 1)})`;
  ui.noise.style.transform = `scaleX(${game.noise})`;
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
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

function circleStroke(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function hexAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key === " " || event.key === "Shift") event.preventDefault();
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
  mouse.active = true;
});
canvas.addEventListener("pointerdown", () => {
  mouse.down = true;
  if (!game.running) start();
});
canvas.addEventListener("pointerup", () => {
  mouse.down = false;
});
ui.start.addEventListener("click", start);

if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

resize();
updateUi();
requestAnimationFrame(loop);
