/* God of War RPG — KOF-style arcade battle.
   Vanilla JS + CSS keyframes + Web Animations API. No dependencies.
   Original 2018 jQuery logic preserved: same stats, same turn-based rules. */

const CHARACTERS = {
  kratos: { name: "Kratos", img: "assets/kratos-pixel.png", hp: 180, attack: 7, counter: 25, weapon: "axe" },
  atreus: { name: "Atreus", img: "assets/atreus-pixel.png", hp: 120, attack: 8, counter: 15, weapon: "bow" },
  baldur: { name: "Baldur", img: "assets/baldur-pixel.png", hp: 150, attack: 8, counter: 20, weapon: "fists" },
  thor:   { name: "Thor",   img: "assets/thor-pixel.png", hp: 100, attack: 14, counter: 5, weapon: "hammer" },
};

// Per-fighter combat flavor, loosely following the actual games.
const WEAPONS = {
  axe:    { icon: "🪓", color: "#a8e0ff", verb: "hurls the Leviathan Axe" },
  hammer: { icon: "🔨", color: "#ffe23e", verb: "throws Mjölnir" },
  bow:    { icon: "🏹", color: "#d8c07a", verb: "fires a volley of arrows" },
  fists:  { icon: "👊", color: "#ff8c4a", verb: "charges in with a furious combo" },
};

const ATTACK_GROWTH = 8; // your attack grows by this much after every swing

const rosterEl = document.getElementById("roster");
const promptEl = document.getElementById("roster-prompt");
const battleEl = document.getElementById("battle-section");
const attackBtn = document.getElementById("attack-btn");
const restartBtn = document.getElementById("restart-btn");
const logEl = document.getElementById("log");

const stageEl = document.getElementById("stage");
const playerSprite = document.getElementById("player-sprite");
const enemySprite = document.getElementById("enemy-sprite");
const playerImg = document.getElementById("player-img");
const enemyImg = document.getElementById("enemy-img");
const announceEl = document.getElementById("announce");
const roundLabel = document.getElementById("round-label");

const hud = {
  player: {
    name: document.getElementById("player-name"),
    fill: document.getElementById("player-hp"),
    ghost: document.getElementById("player-ghost"),
    num: document.getElementById("player-hp-text"),
  },
  enemy: {
    name: document.getElementById("enemy-name"),
    fill: document.getElementById("enemy-hp"),
    ghost: document.getElementById("enemy-ghost"),
    num: document.getElementById("enemy-hp-text"),
  },
};

let player = null;   // { id, ...stats, hp, attack }
let enemy = null;
let defeated = 0;
let gameOver = false;
let animating = false;
const defeatedIds = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cloneFighter(id) {
  return { id, ...CHARACTERS[id], maxHp: CHARACTERS[id].hp };
}

/* ---- Roster (character select) ---- */

function cardHTML(f) {
  return `
    <img src="${f.img}" alt="${f.name}">
    <p class="name">${f.name}</p>
    <p class="stats">HP ${f.maxHp} · ATK ${f.attack} · CNT ${f.counter}</p>`;
}

function isDefeated(id) { return defeatedIds.has(id); }

function renderRoster() {
  rosterEl.innerHTML = "";
  for (const id of Object.keys(CHARACTERS)) {
    if (player && id === player.id) continue;
    const f = cloneFighter(id);
    const card = document.createElement("div");
    card.className = "card" + (isDefeated(id) ? " defeated" : "");
    card.innerHTML = cardHTML(f);
    if (!isDefeated(id)) card.addEventListener("click", () => onPick(id));
    rosterEl.appendChild(card);
  }
}

function onPick(id) {
  if (gameOver) return;
  if (!player) {
    player = cloneFighter(id);
    promptEl.textContent = "Choose your enemy";
    renderRoster();
    showBattle();
    log(`You chose ${player.name}. Now pick an enemy.`, "info");
  } else if (!enemy && !animating) {
    enemy = cloneFighter(id);
    renderBattle();
    log(`${enemy.name} steps into the arena.`, "info");
    roundIntro();
  }
}

/* ---- Stage setup ---- */

// Cancel JS-driven (WAAPI) animations but leave the CSS idle-bob alone.
function cancelJsAnimations(el) {
  el.getAnimations().forEach((a) => { if (!a.animationName) a.cancel(); });
}

function clearFx(sprite) {
  sprite.classList.remove("ko", "struck");
  sprite.querySelectorAll(".dmg-float").forEach((e) => e.remove());
  cancelJsAnimations(sprite);
  cancelJsAnimations(sprite.querySelector("img"));
}

function setBar(side, f) {
  const h = hud[side];
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  h.fill.style.width = pct + "%";
  h.fill.classList.toggle("low", pct <= 30);
  h.num.textContent = `${Math.max(0, f.hp)} / ${f.maxHp}`;
  // white damage trail catches up after a beat — classic fighting-game effect
  clearTimeout(h.ghost._t);
  h.ghost._t = setTimeout(() => { h.ghost.style.width = pct + "%"; }, 250);
}

function resetBar(side, f) {
  const h = hud[side];
  clearTimeout(h.ghost._t);
  h.ghost.style.width = "100%";
  setBar(side, f);
}

function showBattle() {
  battleEl.classList.remove("hidden");
  clearFx(playerSprite);
  clearFx(enemySprite);
  playerImg.src = player.img;
  playerImg.alt = player.name;
  hud.player.name.textContent = player.name;
  hud.enemy.name.textContent = "";
  enemyImg.removeAttribute("src");
  roundLabel.textContent = "ROUND 1";
  resetBar("player", player);
}

function renderBattle() {
  clearFx(enemySprite);
  enemyImg.src = enemy.img;
  enemyImg.alt = enemy.name;
  hud.enemy.name.textContent = enemy.name;
  roundLabel.textContent = `ROUND ${defeated + 1}`;
  resetBar("enemy", enemy);
}

/* ---- Announcements ---- */

function announce(text, ms = 900) {
  return new Promise((resolve) => {
    announceEl.textContent = text;
    announceEl.classList.remove("hidden", "pop");
    void announceEl.offsetWidth; // restart animation
    announceEl.classList.add("pop");
    setTimeout(() => { announceEl.classList.add("hidden"); resolve(); }, ms);
  });
}

async function roundIntro() {
  animating = true;
  attackBtn.disabled = true;
  // both fighters walk in from offstage
  await Promise.all([
    playerSprite.animate(
      [{ transform: "translateX(-160%)" }, { transform: "translateX(0)" }],
      { duration: 450, easing: "ease-out" }
    ).finished,
    enemySprite.animate(
      [{ transform: "translateX(160%)" }, { transform: "translateX(0)" }],
      { duration: 450, easing: "ease-out" }
    ).finished,
  ]);
  await announce(roundLabel.textContent, 800);
  await announce("FIGHT!", 800);
  animating = false;
  attackBtn.disabled = gameOver;
}

/* ---- Combat ---- */

function log(msg, cls = "") {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

/* ---- Weapon effects ---- */

// Center-ish point of a sprite in stage coordinates.
function stagePos(el) {
  const r = el.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.35 };
}

function starBurst(x, y, color) {
  const star = document.createElement("div");
  star.className = "impact";
  star.style.background = `radial-gradient(circle, #fff 0%, ${color} 42%, transparent 72%)`;
  star.style.left = `${x - 45}px`;
  star.style.top = `${y - 45}px`;
  stageEl.appendChild(star);
  setTimeout(() => star.remove(), 420);
}

// Chunky pixel particles flying out of the impact point.
function spawnParticles(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.background = color;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    stageEl.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 80;
    const a = p.animate(
      [{ transform: "translate(0,0)", opacity: 1 },
       { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 34}px)`, opacity: 0 }],
      { duration: 420 + Math.random() * 320, easing: "cubic-bezier(.1,.7,.3,1)" }
    );
    a.finished.then(() => p.remove()).catch(() => {});
  }
}

function flinch(defenderSprite) {
  defenderSprite.classList.remove("struck");
  void defenderSprite.offsetWidth;
  defenderSprite.classList.add("struck");
}

// Thrown weapon (axe / hammer): spins across the stage, then returns to its owner.
async function throwWeapon(icon, from, to) {
  const w = document.createElement("div");
  w.className = "projectile";
  const span = document.createElement("span");
  span.textContent = icon;
  w.appendChild(span);
  const start = stagePos(from);
  const end = stagePos(to);
  w.style.left = `${start.x - 24}px`;
  w.style.top = `${start.y - 24}px`;
  stageEl.appendChild(w);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fly = w.animate(
    [{ transform: "translate(0,0)" }, { transform: `translate(${dx}px, ${dy}px)` }],
    { duration: 300, easing: "ease-in", fill: "forwards" }
  );
  await fly.finished;
  return { w, dx, dy };
}

async function weaponReturns(proj) {
  const back = proj.w.animate(
    [{ transform: `translate(${proj.dx}px, ${proj.dy}px)` }, { transform: "translate(0,0)" }],
    { duration: 360, easing: "ease-out", fill: "forwards" }
  );
  await back.finished;
  proj.w.remove();
}

// Mjölnir calls down a bolt on the target.
async function lightningStrike(target) {
  const pos = stagePos(target);
  const bolt = document.createElement("div");
  bolt.className = "bolt";
  bolt.style.left = `${pos.x - 28}px`;
  stageEl.appendChild(bolt);
  const flash = document.createElement("div");
  flash.className = "flash";
  stageEl.appendChild(flash);
  await sleep(300);
  bolt.remove();
  flash.remove();
}

// Three quick arrows; only the last one lands for full effect.
async function arrowVolley(from, to, onHit) {
  const start = stagePos(from);
  const end = stagePos(to);
  const leftward = end.x < start.x;
  for (let i = 0; i < 3; i++) {
    const a = document.createElement("div");
    a.className = "arrow" + (leftward ? " left" : "");
    a.style.left = `${start.x}px`;
    a.style.top = `${start.y + (i - 1) * 12}px`;
    stageEl.appendChild(a);
    const fly = a.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(${end.x - start.x}px)` }],
      { duration: 150, easing: "linear", fill: "forwards" }
    );
    await fly.finished;
    a.remove();
    onHit(i === 2);
    await sleep(90);
  }
}

function impactFx(defenderSprite, dmg, color = "#ffd23e") {
  // pushed away from the blow
  const dir = defenderSprite === playerSprite ? -1 : 1;
  flinch(defenderSprite);
  const recoil = defenderSprite.animate(
    [{ transform: "translateX(0)" }, { transform: `translateX(${28 * dir}px)` }, { transform: "translateX(0)" }],
    { duration: 380, easing: "ease-out" }
  );
  recoil.finished.then(() => recoil.cancel()).catch(() => {});

  const pos = stagePos(defenderSprite);
  starBurst(pos.x - 20 * dir, pos.y, color);
  spawnParticles(pos.x, pos.y, color, 12);

  // screen shake
  stageEl.classList.remove("shaking");
  void stageEl.offsetWidth;
  stageEl.classList.add("shaking");

  // floating damage number
  const f = document.createElement("div");
  f.className = "dmg-float";
  f.textContent = "-" + dmg;
  defenderSprite.appendChild(f);
  setTimeout(() => f.remove(), 900);

  updateBars();
}

// Full per-weapon attack sequence.
async function performAttack(attackerSprite, defenderSprite, fighter, dmg) {
  const w = WEAPONS[fighter.weapon];
  attackerSprite.style.zIndex = 3;

  if (fighter.weapon === "fists") {
    // melee: dash in, two-hit combo, dash back
    const dir = attackerSprite === playerSprite ? 1 : -1;
    const distance = stageEl.clientWidth * 0.6 * dir;
    const out = attackerSprite.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(${distance}px) rotate(${3 * dir}deg)` }],
      { duration: 200, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }
    );
    await out.finished;
    impactFx(defenderSprite, dmg, w.color);
    await sleep(170);
    flinch(defenderSprite);
    starBurst(stagePos(defenderSprite).x, stagePos(defenderSprite).y - 20, w.color);
    spawnParticles(stagePos(defenderSprite).x, stagePos(defenderSprite).y - 20, w.color, 7);
    await sleep(230);
    const back = attackerSprite.animate(
      [{ transform: `translateX(${distance}px) rotate(${3 * dir}deg)` }, { transform: "translateX(0)" }],
      { duration: 240, easing: "ease-in", fill: "forwards" }
    );
    await back.finished;
    out.cancel();
    back.cancel();
  } else if (fighter.weapon === "bow") {
    await arrowVolley(attackerSprite, defenderSprite, (last) => {
      if (last) impactFx(defenderSprite, dmg, w.color);
      else flinch(defenderSprite);
    });
  } else {
    // axe or hammer: thrown, elemental hit, boomerang return
    const proj = await throwWeapon(w.icon, attackerSprite, defenderSprite);
    if (fighter.weapon === "hammer") await lightningStrike(defenderSprite);
    impactFx(defenderSprite, dmg, w.color);
    await sleep(180);
    await weaponReturns(proj);
  }

  attackerSprite.style.zIndex = 2;
}

async function ko(sprite, who) {
  sprite.classList.add("ko");
  stageEl.classList.remove("shaking");
  void stageEl.offsetWidth;
  stageEl.classList.add("shaking");
  await announce("K.O.!", 1100);
  await sleep(400);
}

async function attack() {
  if (!player || !enemy || gameOver || animating) return;
  animating = true;
  attackBtn.disabled = true;

  // --- your swing ---
  const dmg = player.attack;
  player.attack += ATTACK_GROWTH;
  enemy.hp -= dmg;
  log(`${player.name} ${WEAPONS[player.weapon].verb} — ${dmg} damage!`, "hit");
  await performAttack(playerSprite, enemySprite, player, dmg);

  if (enemy.hp <= 0) {
    log(`${enemy.name} has fallen!`, "win");
    await ko(enemySprite, "enemy");
    finishEnemyDefeat();
    return;
  }

  // --- enemy counter (only if it survived) ---
  await sleep(300);
  player.hp -= enemy.counter;
  log(`${enemy.name} ${WEAPONS[enemy.weapon].verb} — ${enemy.counter} damage!`, "taken");
  await performAttack(enemySprite, playerSprite, enemy, enemy.counter);

  if (player.hp <= 0) {
    await ko(playerSprite, "player");
    updateBars();
    endGame(false);
  }

  animating = false;
  attackBtn.disabled = gameOver;
}

function finishEnemyDefeat() {
  defeatedIds.add(enemy.id);
  defeated++;
  enemy = null;

  if (defeated === Object.keys(CHARACTERS).length - 1) {
    endGame(true);
  } else {
    promptEl.textContent = "Choose your next enemy";
    renderRoster();
    hud.enemy.name.textContent = "";
    enemyImg.removeAttribute("src");
    clearFx(enemySprite);
  }
  animating = false;
  attackBtn.disabled = gameOver;
}

function updateBars() {
  if (player) setBar("player", player);
  if (enemy) setBar("enemy", enemy);
}

function endGame(won) {
  gameOver = true;
  attackBtn.disabled = true;
  restartBtn.classList.remove("hidden");
  if (won) {
    announce("VICTORY!", 1600);
    log("You have defeated every god. A true God of War!", "win");
    promptEl.textContent = "Victory";
  } else {
    announce("GAME OVER", 1600);
    log(`${player.name} has been defeated. The Norns weep.`, "lose");
    promptEl.textContent = "Defeat";
  }
}

function restart() {
  player = null;
  enemy = null;
  defeated = 0;
  gameOver = false;
  animating = false;
  defeatedIds.clear();
  attackBtn.disabled = false;
  restartBtn.classList.add("hidden");
  battleEl.classList.add("hidden");
  announceEl.classList.add("hidden");
  clearFx(playerSprite);
  clearFx(enemySprite);
  // sweep any in-flight weapon effects
  stageEl.querySelectorAll(".projectile, .arrow, .bolt, .flash, .particle, .impact").forEach((e) => e.remove());
  logEl.innerHTML = "";
  promptEl.textContent = "Choose your god";
  renderRoster();
}

attackBtn.addEventListener("click", attack);
restartBtn.addEventListener("click", restart);

renderRoster();

// Test hook: #demo jumps into a staged fight; #demo-fight also auto-attacks.
if (typeof location !== "undefined" && location.hash.startsWith("#demo")) {
  onPick("kratos");
  onPick("baldur");
  if (location.hash === "#demo-fight") {
    const timer = setInterval(() => { if (!attackBtn.disabled) attackBtn.click(); }, 400);
    setTimeout(() => clearInterval(timer), 30000);
  }
}
