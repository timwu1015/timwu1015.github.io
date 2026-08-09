/* God of War RPG — vanilla JS rewrite of the 2018 jQuery original.
   Fixes from the original: no eval(), dead enemies no longer counter-attack,
   restart button instead of "refresh the page", animated HP bars. */

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

let player = null;   // { id, ...stats, hp, attack }
let enemy = null;
let defeated = 0;
let gameOver = false;

function cloneFighter(id) {
  return { id, ...CHARACTERS[id], maxHp: CHARACTERS[id].hp };
}

function cardHTML(f) {
  return `
    <img src="${f.img}" alt="${f.name}">
    <p class="name">${f.name}</p>
    <p class="stats">HP ${f.maxHp} · ATK ${f.attack} · CNT ${f.counter}</p>`;
}

function renderRoster() {
  rosterEl.innerHTML = "";
  for (const id of Object.keys(CHARACTERS)) {
    if (player && id === player.id) continue;
    const f = cloneFighter(id);
    const card = document.createElement("div");
    card.className = "card" + (f.id !== player?.id && isDefeated(id) ? " defeated" : "");
    card.innerHTML = cardHTML(f);
    if (!card.classList.contains("defeated")) {
      card.addEventListener("click", () => onPick(id));
    }
    rosterEl.appendChild(card);
  }
}

const defeatedIds = new Set();
function isDefeated(id) { return defeatedIds.has(id); }

function onPick(id) {
  if (gameOver) return;
  if (!player) {
    player = cloneFighter(id);
    promptEl.textContent = "Choose your enemy";
    renderRoster();
    showBattle();
    log(`You chose ${player.name}. Now pick an enemy.`, "info");
  } else if (!enemy) {
    enemy = cloneFighter(id);
    renderBattle();
    log(`${enemy.name} steps into the arena. Attack!`, "info");
  }
}

function showBattle() {
  battleEl.classList.remove("hidden");
  document.getElementById("player-card").innerHTML = cardHTML(player);
  updateBars();
}

function renderBattle() {
  document.getElementById("enemy-card").innerHTML = enemy ? cardHTML(enemy) : "<p>Awaiting challenger…</p>";
  updateBars();
}

function setBar(fillEl, textEl, f) {
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  fillEl.style.width = pct + "%";
  fillEl.classList.toggle("low", pct <= 30);
  textEl.textContent = `${Math.max(0, f.hp)} / ${f.maxHp} HP`;
}

function updateBars() {
  setBar(document.getElementById("player-hp"), document.getElementById("player-hp-text"), player);
  const enemyHp = document.getElementById("enemy-hp");
  const enemyText = document.getElementById("enemy-hp-text");
  if (enemy) {
    setBar(enemyHp, enemyText, enemy);
  } else {
    enemyHp.style.width = "0%";
    enemyText.textContent = "";
  }
}

function log(msg, cls = "") {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

/* ---- Combat animation helpers ---- */

let animating = false;

// Attacker lunges toward the defender; on impact the defender shakes/flashes
// and a floating damage number pops. onImpact fires at the hit moment.
function strike(attackerCard, defenderCard, lungeCls, dmg, onImpact) {
  attackerCard.classList.remove(lungeCls);
  void attackerCard.offsetWidth; // restart the animation
  attackerCard.classList.add(lungeCls);
  setTimeout(() => {
    defenderCard.classList.remove("struck");
    void defenderCard.offsetWidth;
    defenderCard.classList.add("struck");
    spawnDmg(defenderCard, dmg);
    onImpact();
  }, 180);
}

function spawnDmg(card, amount) {
  const el = document.createElement("div");
  el.className = "dmg-float";
  el.textContent = "-" + amount;
  card.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function attack() {
  if (!player || !enemy || gameOver || animating) return;
  animating = true;
  attackBtn.disabled = true;

  const playerCard = document.getElementById("player-card");
  const enemyCard = document.getElementById("enemy-card");

  // --- your swing ---
  const dmg = player.attack;
  player.attack += ATTACK_GROWTH;
  enemy.hp -= dmg;
  log(`You hit ${enemy.name} for ${dmg} damage.`, "hit");
  strike(playerCard, enemyCard, "lunge-right", dmg, updateBars);

  if (enemy.hp <= 0) {
    setTimeout(() => {
      enemyCard.classList.add("fallen");
      log(`${enemy.name} has fallen!`, "win");
      setTimeout(finishEnemyDefeat, 700);
    }, 250);
    return;
  }

  // --- enemy counter (only if it survived) ---
  setTimeout(() => {
    player.hp -= enemy.counter;
    log(`${enemy.name} counters for ${enemy.counter} damage.`, "taken");
    strike(enemyCard, playerCard, "lunge-left", enemy.counter, updateBars);
    setTimeout(() => {
      if (player.hp <= 0) {
        playerCard.classList.add("fallen");
        updateBars();
        endGame(false);
      }
      animating = false;
      attackBtn.disabled = gameOver;
    }, 600);
  }, 650);
}

function finishEnemyDefeat() {
  defeatedIds.add(enemy.id);
  defeated++;
  enemy = null;
  updateBars();

  if (defeated === Object.keys(CHARACTERS).length - 1) {
    endGame(true);
  } else {
    promptEl.textContent = "Choose your next enemy";
    renderRoster();
    renderBattle();
  }
  animating = false;
  attackBtn.disabled = gameOver;
}

function endGame(won) {
  gameOver = true;
  attackBtn.disabled = true;
  restartBtn.classList.remove("hidden");
  if (won) {
    log("You have defeated every god. A true God of War!", "win");
    promptEl.textContent = "Victory";
  } else {
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
  logEl.innerHTML = "";
  promptEl.textContent = "Choose your god";
  renderRoster();
}

attackBtn.addEventListener("click", attack);
restartBtn.addEventListener("click", restart);

renderRoster();
