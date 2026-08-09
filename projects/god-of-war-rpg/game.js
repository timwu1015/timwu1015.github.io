/* God of War RPG — KOF-style arcade battle.
   Vanilla JS + CSS keyframes + Web Animations API. No dependencies.
   Original 2018 jQuery logic preserved: same stats, same turn-based rules. */

const CHARACTERS = {
  kratos: { name: "Kratos", img: "assets/kratos.jpg", hp: 180, attack: 7, counter: 25 },
  atreus: { name: "Atreus", img: "assets/Atri.jpg", hp: 120, attack: 8, counter: 15 },
  baldur: { name: "Baldur", img: "assets/Baldur.png", hp: 150, attack: 8, counter: 20 },
  thor:   { name: "Thor",   img: "assets/Thor.jpg", hp: 100, attack: 14, counter: 5 },
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

function impactFx(defenderSprite, dmg) {
  // pushed away from the blow
  const dir = defenderSprite === playerSprite ? -1 : 1;
  defenderSprite.classList.remove("struck");
  void defenderSprite.offsetWidth;
  defenderSprite.classList.add("struck");
  const recoil = defenderSprite.animate(
    [{ transform: "translateX(0)" }, { transform: `translateX(${28 * dir}px)` }, { transform: "translateX(0)" }],
    { duration: 380, easing: "ease-out" }
  );
  recoil.finished.then(() => recoil.cancel()).catch(() => {});

  // impact star near the point of contact
  const r = defenderSprite.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
  const star = document.createElement("div");
  star.className = "impact";
  star.style.left = `${r.left - s.left + r.width / 2 - 45 - 34 * dir}px`;
  star.style.top = `${r.top - s.top + r.height * 0.28}px`;
  stageEl.appendChild(star);
  setTimeout(() => star.remove(), 420);

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

// Attacker dashes across the stage, lands the hit, returns home.
async function strike(attackerSprite, defenderSprite, dmg) {
  const dir = attackerSprite === playerSprite ? 1 : -1;
  const distance = stageEl.clientWidth * 0.6 * dir;
  attackerSprite.style.zIndex = 3;

  const dashOut = attackerSprite.animate(
    [{ transform: "translateX(0)" }, { transform: `translateX(${distance}px) rotate(${3 * dir}deg)` }],
    { duration: 210, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }
  );
  await dashOut.finished;

  impactFx(defenderSprite, dmg);
  await sleep(180);

  const dashBack = attackerSprite.animate(
    [{ transform: `translateX(${distance}px) rotate(${3 * dir}deg)` }, { transform: "translateX(0)" }],
    { duration: 260, easing: "ease-in", fill: "forwards" }
  );
  await dashBack.finished;

  // release the held WAAPI frames so the CSS idle-bob resumes
  dashOut.cancel();
  dashBack.cancel();
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
  log(`You hit ${enemy.name} for ${dmg} damage.`, "hit");
  await strike(playerSprite, enemySprite, dmg);

  if (enemy.hp <= 0) {
    log(`${enemy.name} has fallen!`, "win");
    await ko(enemySprite, "enemy");
    finishEnemyDefeat();
    return;
  }

  // --- enemy counter (only if it survived) ---
  await sleep(280);
  player.hp -= enemy.counter;
  log(`${enemy.name} counters for ${enemy.counter} damage.`, "taken");
  await strike(enemySprite, playerSprite, enemy.counter);

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
  logEl.innerHTML = "";
  promptEl.textContent = "Choose your god";
  renderRoster();
}

attackBtn.addEventListener("click", attack);
restartBtn.addEventListener("click", restart);

renderRoster();

// Test hook: open index.html#demo to jump straight into a staged fight.
if (typeof location !== "undefined" && location.hash === "#demo") {
  onPick("kratos");
  onPick("atreus");
}
