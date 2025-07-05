import { Game, shuffle } from "./game.js";
import { VirtualPlayer } from "./ai.js";

// === DOM helpers ===
const $ = (q) => document.querySelector(q);
const board = $("#board");
const timerEl = $("#timer");
const turnInfo = $("#turnInfo");
const winEl = $("#winOverlay");

// === Globals ===
let game,
  players,
  currentTurn,
  lock = false;
let humanStart = 0,
  totalHuman = 0,
  humanTurns = 0;
const avgHuman = () =>
  humanTurns
    ? Math.max(400, Math.min(5000, Math.floor(totalHuman / humanTurns)))
    : 800;

// === Initialization ===
function init() {
  winEl.classList.add("hidden");
  game = new Game();
  const aiCnt = Math.min(
    3,
    Math.max(1, parseInt(prompt("AI players (1-3)", "2")) || 1)
  );
  players = ["H"];
  for (let i = 1; i <= aiCnt; i++) players.push(new VirtualPlayer(i, aiCnt));
  currentTurn = 0;
  render();
  updateTurn();
  humanStart = Date.now();
  startTimer();
}

// === Rendering ===
function render() {
  board.innerHTML = "";
  game.piles.forEach((p, i) => {
    const pile = document.createElement("div");
    pile.className = "pile" + (p.hasDove ? " blocked" : "");
    if (p.hasDove) {
      const d = card("🕊️", "card small doveToken");
      d.onclick = (e) => humanDove(i, d);
      pile.appendChild(d);
    }
    const hat = card(`🎩<span class=num>${p.hatNum}</span>`, "card hat");
    hat.onclick = (e) => humanHat(i, hat);
    const rabbit = card(
      `🐇<span class=num>${p.rabbitNum}</span>`,
      "card rabbit"
    );
    rabbit.onclick = (e) => humanRabbit(i, rabbit);
    rabbit.ondblclick = (e) => reveal(rabbit);
    pile.append(hat, rabbit);
    board.appendChild(pile);
  });
  if (checkWin()) {
    clearInterval(timerInt);
    winEl.classList.remove("hidden");
  }
}
function card(html, cls) {
  const div = document.createElement("div");
  div.className = cls;
  div.innerHTML = html;
  return div;
}

// === Human interaction state ===
let selHat = null,
  selRab = null,
  selDove = null,
  doveTimer;

function humanHat(idx, dom) {
  if (lock || players[currentTurn] !== "H") return;
  if (selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (selHat === null) {
    selHat = idx;
    dom.classList.add("highlight");
    return;
  }
  if (selHat !== idx) {
    game.swapHats(selHat, idx);
    render();
    lock = true;
    flash([piece(selHat, ".hat"), piece(idx, ".hat")], () => {
      lock = false;
      endTurn();
    });
  }
  document
    .querySelectorAll(".hat.highlight")
    .forEach((el) => el.classList.remove("highlight"));
  selHat = null;
}

function humanRabbit(idx, dom) {
  if (lock || players[currentTurn] !== "H") return;
  if (selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (selRab === null) {
    selRab = idx;
    dom.classList.add("highlight");
    return;
  }
  if (selRab !== idx) {
    game.swapPiles(selRab, idx);
    render();
    lock = true;
    flash(
      [
        piece(selRab, ".hat"),
        piece(selRab, ".rabbit"),
        piece(idx, ".hat"),
        piece(idx, ".rabbit"),
      ],
      () => {
        lock = false;
        endTurn();
      }
    );
  }
  document
    .querySelectorAll(".rabbit.highlight")
    .forEach((el) => el.classList.remove("highlight"));
  selRab = null;
}

function reveal(el) {
  el.classList.add("revealed");
  setTimeout(() => el.classList.remove("revealed"), 1000);
}

function humanDove(idx, dom) {
  if (lock || players[currentTurn] !== "H") return;
  if (selDove === null) {
    selDove = idx;
    dom.classList.add("highlight");
    doveTimer = setTimeout(() => {
      cancelDove();
      endTurn();
    }, 5000);
  } else if (selDove === idx) {
    cancelDove();
    endTurn();
  }
}

function moveDoveTo(target) {
  if (game.piles[target].hasDove) return;
  game.moveDove(selDove, target);
  cancelDove();
  render();
  endTurn();
}

function cancelDove() {
  clearTimeout(doveTimer);
  doveTimer = null;
  document
    .querySelectorAll(".doveToken.highlight")
    .forEach((el) => el.classList.remove("highlight"));
  selDove = null;
}

// === AI turn ===
function aiTurn() {
  const ai = players[currentTurn];
  const res = ai.takeAction(game);
  render();
  const flashes = [];
  if (res.type === "peek") flashes.push(piece(res.i1, ".rabbit"));
  if (res.type === "swapHat")
    flashes.push(piece(res.i1, ".hat"), piece(res.i2, ".hat"));
  if (res.type === "swapPile")
    flashes.push(
      piece(res.i1, ".hat"),
      piece(res.i1, ".rabbit"),
      piece(res.i2, ".hat"),
      piece(res.i2, ".rabbit")
    );
  lock = true;
  flash(flashes, () => {
    ai.moveDove(game);
    render();
    lock = false;
    endTurn();
  });
}

// === Turn helpers ===
function piece(idx, sel) {
  return board.children[idx]?.querySelector(sel);
}

function flash(elems, cb) {
  elems.forEach((el) => el && el.classList.add("flash"));
  setTimeout(() => {
    elems.forEach((el) => el && el.classList.remove("flash"));
    cb && cb();
  }, 1000);
}

function endTurn() {
  if (players[currentTurn] === "H") {
    totalHuman += Date.now() - humanStart;
    humanTurns++;
  }
  selHat = selRab = null;
  cancelDove();
  currentTurn = (currentTurn + 1) % players.length;
  updateTurn();
  if (players[currentTurn] === "H") {
    humanStart = Date.now();
  } else {
    setTimeout(aiTurn, avgHuman());
  }
}

function updateTurn() {
  turnInfo.textContent =
    players[currentTurn] === "H"
      ? "Your turn"
      : `AI ${players[currentTurn].id}`;
}

// === Timer & win ===
let timerInt;
function startTimer() {
  let s = 150;
  timerEl.textContent = `Time: ${s}s`;
  clearInterval(timerInt);
  timerInt = setInterval(() => {
    s--;
    timerEl.textContent = `Time: ${s}s`;
    if (s <= 0) {
      clearInterval(timerInt);
      alert("Time up!");
    }
  }, 1000);
}
function checkWin() {
  return game.piles.every(
    (p, i) => p.rabbitNum === i + 1 && p.hatNum === i + 1
  );
}
// === Event bindings ===
document.querySelector("#resetBtn").onclick = init;
document.querySelector("#playAgainBtn").onclick = init;
init();
