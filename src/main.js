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
let turnHistory = []; // Track all actions for AI
const avgHuman = () =>
  humanTurns
    ? Math.max(400, Math.min(5000, Math.floor(totalHuman / humanTurns)))
    : 800;

// === Initialization ===
function init() {
  winEl.classList.add("hidden");
  const aiCnt = Math.min(
    3,
    Math.max(1, parseInt(prompt("AI players (1-3)", "2")) || 1)
  );
  // Number of players = 1 human + aiCnt
  const numPlayers = 1 + aiCnt;
  game = new Game(numPlayers);
  turnHistory = []; // Reset turn history on new game
  players = ["H"];
  for (let i = 1; i <= aiCnt; i++) players.push(new VirtualPlayer(i, aiCnt));
  currentTurn = 0;
  render();
  updateTurn();
  humanStart = Date.now();
  startTimer();
  // Show or hide instructions based on whose turn it is at game start
  if (players[currentTurn] === "H") {
    updateInstructions("play");
  } else {
    updateInstructions("");
  }
}

// === Rendering ===
function render() {
  board.innerHTML = "";
  const gameOver = checkWin() || timerEl.textContent === "Time: 0s";
  game.piles.forEach((p, i) => {
    const pile = document.createElement("div");
    pile.className = "pile" + (p.hasDove ? " blocked" : "");
    if (p.hasDove) {
      const d = card("🕊️", "card small doveToken");
      // Only allow dove click if not game over
      if (!gameOver) d.onclick = (e) => humanDove(i, d);
      pile.appendChild(d);
    }
    const hat = card(`🎩<span class=num>${p.hatNum}</span>`, "card hat");
    // Only allow hat click if not game over
    if (!gameOver) hat.onclick = (e) => humanHat(i, hat);
    const rabbit = card(
      `🐇<span class=num${gameOver ? " revealed" : ""}>${p.rabbitNum}</span>`,
      "card rabbit" + (gameOver ? " revealed" : "")
    );
    // Only allow rabbit click if not game over
    if (!gameOver) {
      rabbit.onclick = (e) => humanRabbit(i, rabbit);
      rabbit.ondblclick = (e) => reveal(rabbit);
    }
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
let hasPlayed = false;


function humanHat(idx, dom) {
  if (lock || players[currentTurn] !== "H") return;
  if (checkWin() || timerEl.textContent === "Time: 0s") return;
  if (selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (hasPlayed) return; // Prevent more than one move
  if (selHat === null) {
    selHat = idx;
    dom.classList.add("highlight");
    return;
  }
  if (selHat !== idx) {
    game.swapHats(selHat, idx);
    turnHistory.push({ player: "H", action: { type: "swapHat", i1: selHat, i2: idx } });
    hasPlayed = true;
    render();
    lock = true;
    flash([piece(selHat, ".hat"), piece(idx, ".hat")], () => {
      lock = false;
      updateInstructions("dove");
      startDoveAutoPass();
      // Don't end turn here, wait for dove
    });
  }
  document
    .querySelectorAll(".hat.highlight")
    .forEach((el) => el.classList.remove("highlight"));
  selHat = null;
}

function humanRabbit(idx, dom) {
  if (lock || players[currentTurn] !== "H") return;
  if (checkWin() || timerEl.textContent === "Time: 0s") return;
  if (selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (hasPlayed) return; // Prevent more than one move
  if (selRab === null) {
    selRab = idx;
    dom.classList.add("highlight");
    return;
  }
  if (selRab !== idx) {
    game.swapPiles(selRab, idx);
    turnHistory.push({ player: "H", action: { type: "swapPile", i1: selRab, i2: idx } });
    hasPlayed = true;
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
        updateInstructions("dove");
        startDoveAutoPass();
        // Don't end turn here, wait for dove
      }
    );
  }
  document
    .querySelectorAll(".rabbit.highlight")
    .forEach((el) => el.classList.remove("highlight"));
  selRab = null;
}

function reveal(el) {
  if (lock || players[currentTurn] !== "H") return;
  if (selDove !== null) return;
  if (hasPlayed) return;
  // Prevent reveal if game is over
  if (checkWin() || timerEl.textContent === "Time: 0s") return;
  el.classList.add("revealed");
  turnHistory.push({ player: "H", action: { type: "peek", i1: Array.from(board.children).findIndex(pile => pile.querySelector(".rabbit") === el) } });
  hasPlayed = true;
  updateInstructions("dove");
  startDoveAutoPass();
  setTimeout(() => {
    el.classList.remove("revealed");
    // Wait for dove
  }, 1000);
}
function humanDove(idx, dom) {
  if (lock || players[currentTurn] !== "H") return;
  if (checkWin() || timerEl.textContent === "Time: 0s") return;
  if (!hasPlayed) return; // Only allow dove after a move
  if (selDove === null) {
    selDove = idx;
    dom.classList.add("highlight");
    return;
  }
  // If clicking the same dove again, pass
  if (selDove === idx) {
    cancelDove();
    endTurn();
    return;
  }
  // If clicking a rabbit or hat after dove is selected, move the dove
  moveDoveTo(idx);
}


function moveDoveTo(target) {
  if (checkWin() || timerEl.textContent === "Time: 0s") return;
  if (game.piles[target].hasDove) return;
  if (!hasPlayed) return;
  game.moveDove(selDove, target);
  turnHistory.push({ player: "H", action: { type: "moveDove", from: selDove, to: target } });
  cancelDove();
  render();
  endTurn();
}

function startDoveAutoPass() {
  clearTimeout(doveTimer);
  doveTimer = setTimeout(() => {
    if (players[currentTurn] === "H" && selDove === null) {
      endTurn();
    }
  }, 3000);
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
  // Only give AI the last 5 moves for memory
  const shortHistory = turnHistory.slice(-5);
  const res = ai.takeAction(game, shortHistory); // Pass shortHistory to AI
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
  // Record AI action in turnHistory
  if (res.type === "peek" || res.type === "swapHat" || res.type === "swapPile") {
    turnHistory.push({ player: ai.id, action: res });
  }
  lock = true;
  flash(flashes, () => {
    const doveAction = ai.moveDove(game);
    // Record dove move if any
    if (doveAction?.type === "moveDove") {
      turnHistory.push({ player: ai.id, action: doveAction });
    }
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
  hasPlayed = false;
  currentTurn = (currentTurn + 1) % players.length;
  updateTurn();
  // Show or hide instructions based on whose turn it is
  if (players[currentTurn] === "H") {
    updateInstructions("play");
    humanStart = Date.now();
  } else {
    updateInstructions("");
    // Only let AI play if the game is not over
    if (!checkWin()) {
      setTimeout(aiTurn, avgHuman());
    }
  }
}

function updateTurn() {
  if (players[currentTurn] === "H") {
    turnInfo.textContent = "Your turn";
  } else {
    turnInfo.textContent = `AI ${players[currentTurn].id}`;
  }
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

// === Instructions box ===
const instructionsBox = $("#instructionsBox");
const hideBtn = $("#hideInstructionsBtn");
const instructionsContent = $("#instructionsContent");
let instructionsPermanentlyHidden = false;
hideBtn.onclick = () => {
  instructionsBox.style.display = "none";
  instructionsPermanentlyHidden = true;
};

function updateInstructions(state) {
  if (instructionsPermanentlyHidden) {
    instructionsBox.style.display = "none";
    return;
  }
  if (players[currentTurn] !== "H") {
    instructionsBox.style.display = "none";
    return;
  }
  instructionsBox.style.display = "block";
  if (state === "play") {
    instructionsContent.innerHTML = `<b>Your turn!</b><br>
      <ul class="instructions-list">
        <li>To <b>peek</b> at a rabbit, click it <b>twice</b> quickly.</li>
        <li>To <b>swap columns</b>, click a rabbit, then another rabbit in a different column.</li>
        <li>To <b>swap hats</b>, click a hat, then another hat.</li>
      </ul>`;
  } else if (state === "dove") {
    instructionsContent.innerHTML = `<b>Dove phase</b><br>
      <ul class="instructions-list">
        <li>Either <b>click the dove twice</b> to indicate no move, or <b>move the dove</b> by clicking it and then the target column.</li>
      </ul>`;
  } else {
    instructionsContent.innerHTML = "";
  }
}

// === Event bindings ===
document.querySelector("#resetBtn").onclick = init;
document.querySelector("#playAgainBtn").onclick = init;
init();
