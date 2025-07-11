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
const avgHuman = () => {
  // If there is a human, use the average human speed (bounded), else use WAIT_TIME
  if (humanTurns > 0) {
    return Math.max(WAIT_TIME, Math.min(5000, Math.floor(totalHuman / humanTurns)));
  }
  return WAIT_TIME;
};

// === Timing config ===
let WAIT_TIME = 1000; // Default: 1s

// === Setup screen ===
// Use static HTML setup screen instead of creating it in JS
const setupScreen = document.getElementById("setupScreen");
const aiCountInput = document.getElementById("aiCountInput");
const startGameBtn = document.getElementById("startGameBtn");
const aiOnlyCheckbox = document.getElementById("aiOnlyCheckbox");
const waitTimeSelect = document.getElementById("waitTimeSelect");

if (waitTimeSelect) {
  waitTimeSelect.value = "1000";
  waitTimeSelect.onchange = () => {
    WAIT_TIME = parseFloat(waitTimeSelect.value);
  };
}

function showSetupScreen() {
  setupScreen.classList.remove("hidden");
  document.body.classList.add("setup-active");
  // Hide overlays and clear stats display
  winEl.classList.add("hidden");
  clearStatsDisplay();
}
function hideSetupScreen() {
  setupScreen.classList.add("hidden");
  document.body.classList.remove("setup-active");
}

aiCountInput.addEventListener("input", () => {
  const aiCnt = parseInt(aiCountInput.value) || 0;
  if (aiCnt === 4) {
    aiOnlyCheckbox.checked = true;
    aiOnlyCheckbox.disabled = true;
  } else if (aiCnt === 0) {
    aiOnlyCheckbox.checked = false;
    aiOnlyCheckbox.disabled = true;
  } else {
    aiOnlyCheckbox.disabled = false;
  }
});

startGameBtn.onclick = () => {
  const aiCnt = Math.min(4, Math.max(0, parseInt(aiCountInput.value) || 0));
  const aiOnly = aiOnlyCheckbox.checked || aiCnt === 4;
  // Multi-run AI blitz prompt logic moved here
  if (aiOnly) {
    hideSetupScreen();
    showMultiRunPrompt();
    return;
  }
  hideSetupScreen();
  init(aiCnt, aiOnly);
};

// === Initialization ===
function init(aiCnt, aiOnly) {
  winEl.classList.add("hidden");
  document.querySelectorAll(".rabbit .revealed, .card.rabbit.revealed").forEach(el => el.classList.remove("revealed"));
  clearStatsDisplay();
  lock = false;
  if (typeof aiCnt !== "number") {
    showSetupScreen();
    return;
  }
  // Number of players: if aiOnly, all players are AI; otherwise, 1 human + aiCnt AI
  let numPlayers, playerList;
  if (aiOnly) {
    numPlayers = aiCnt === 0 ? 1 : aiCnt; // At least 1 player
    playerList = [];
    for (let i = 1; i <= numPlayers; i++) playerList.push(new VirtualPlayer(i));
  } else {
    numPlayers = 1 + aiCnt;
    playerList = ["H"];
    for (let i = 1; i <= aiCnt; i++) playerList.push(new VirtualPlayer(i));
  }
  game = new Game(numPlayers);
  turnHistory = []; // Reset turn history on new game
  players = playerList;
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
    // If no human player, trigger only the first AI move
    if (!players.includes("H")) {
      setTimeout(aiTurn, WAIT_TIME);
    }
  }
}

// === Rendering ===
function render() {
  board.innerHTML = "";
  const gameOver = checkWin() || timerEl.textContent === "Time: 0s";
  renderBoard(gameOver);
  if (checkWin()) {
    handleGameWin();
  }
}

function renderBoard(gameOver) {
  game.piles.forEach((p, i) => {
    const pile = document.createElement("div");
    pile.className = "pile" + (p.hasDove ? " blocked" : "");
    // Hat
    const hat = card(`🎩<span class=num>${p.hatNum}</span>`, "card hat");$
    hat.onclick = (e) => humanHat(i, hat);
    // Dove (if present) - will be styled to overlay the hat and hide the number
    let dove = null;
    if (p.hasDove) {
      dove = card("🕊️", "card doveToken");
      dove.onclick = (e) => humanDove(i, dove);
      pile.appendChild(hat);
      pile.appendChild(dove); // Add dove after hat so it overlays
      // Hide the hat number
      const numSpan = hat.querySelector('.num');
      if (numSpan) numSpan.classList.add('dove-hidden');
    } else {
      pile.appendChild(hat);
    }
    // Rabbit
    const rabbit = card(
      `🐇<span class=num${gameOver ? " revealed" : ""}>${p.rabbitNum}</span>`,
      "card rabbit" + (gameOver ? " revealed" : "")
    );
    
    rabbit.onclick = (e) => humanRabbit(i, rabbit);
    rabbit.ondblclick = (e) => reveal(rabbit);
    
    pile.appendChild(rabbit);
    board.appendChild(pile);
  });
}

function handleGameWin() {
  clearInterval(timerInt);
  // Count turns and dove moves
  let mainMoves = 0, doveMoves = 0;
  for (const t of turnHistory) {
    if (t.action.type === "moveDove") doveMoves++;
    else mainMoves++;
  }
  // Record stats
  const numPlayers = players.length;
  const delta = mainMoves - game.minTotalMoves;
  recordGameStats(numPlayers, delta, doveMoves);

  // Multi-run logic: if in multi-run mode, auto-restart until done
  if (multiRunTarget) {
    multiRunCount++;
    if (multiRunCount < multiRunTarget) {
      setTimeout(() => {
        init(multiRunParams.aiCnt, true);
      }, multiRunParams.waitTime * 5);
      return; // Don't show win panel yet
    }
  }
  winEl.classList.remove("hidden");

  // Update stats in win overlay
  const turnsStat = document.getElementById("turnsStat");
  const doveStat = document.getElementById("doveStat");
  if (turnsStat) turnsStat.textContent = mainMoves;
  if (doveStat) doveStat.textContent = doveMoves;
  // Display ideal move stats
  const idealStats = document.getElementById("idealStats");
  if (idealStats) {
    idealStats.innerHTML = `<b>Ideal moves:</b> <span>${game.minTotalMoves}</span>`;
    idealStats.style.marginTop = "10px";
    // Add stats table
    idealStats.innerHTML += renderStatsTable();
  }
}

function clearStatsDisplay() {
  const turnsStat = document.getElementById("turnsStat");
  const doveStat = document.getElementById("doveStat");
  if (turnsStat) turnsStat.textContent = "";
  if (doveStat) doveStat.textContent = "";
  const idealStats = document.getElementById("idealStats");
  if (idealStats) idealStats.innerHTML = "";
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
  if (isGameOver()) return;
  // Prevent selecting a hat under a dove
  if (game.piles[idx].hasDove) return;
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
  if (isGameOver()) return;
  // Prevent selecting a rabbit under a dove
  if (game.piles[idx].hasDove) return;
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
  if (isGameOver()) return;
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
  if (isGameOver()) return;
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
  if (isGameOver()) return;
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
  if (isGameOver()) return; // Stop if game is over
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
    if (isGameOver()) return; // Stop if game is over after flash
    const doveAction = ai.moveDove(game, turnHistory);
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
  }, WAIT_TIME);
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
      setTimeout(aiTurn, WAIT_TIME);
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
      render(); // Ensure board updates to show all rabbits when time is up
    }
  }, 1000);
}
function checkWin() {
  return game.piles.every(
    (p, i) => p.rabbitNum === i + 1 && p.hatNum === i + 1
  );
}
function isGameOver() {
  return checkWin() || timerEl.textContent === "Time: 0s";
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

// === Persistent stats storage ===
const STATS_KEY = "magicRabbitStats";
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordGameStats(numPlayers, delta, doveMoves) {
  const stats = loadStats();
  if (!stats[numPlayers]) stats[numPlayers] = {};
  if (!stats[numPlayers][delta]) stats[numPlayers][delta] = { count: 0, dove: 0 };
  stats[numPlayers][delta].count++;
  stats[numPlayers][delta].dove += doveMoves;
  saveStats(stats);
}

function renderStatsTable() {
  const stats = loadStats();
  let html = '<table class="stats-table"><thead><tr><th>Players</th>';
  // Find all deltas used, but group all >20 into one column
  const allDeltas = new Set();
  let hasOver20 = false;
  for (const n of [1,2,3,4]) {
    if (stats[n]) for (const d in stats[n]) {
      const numD = Number(d);
      if (numD > 20) hasOver20 = true;
      else allDeltas.add(numD);
    }
  }
  const deltas = Array.from(allDeltas).sort((a,b)=>a-b);
  for (const d of deltas) html += `<th>Δ${d}</th>`;
  if (hasOver20) html += `<th>Δ&gt;20</th>`;
  html += '</tr></thead><tbody>';
  for (const n of [1,2,3,4]) {
    html += `<tr><td>${n}</td>`;
    for (const d of deltas) {
      let cell = stats[n]?.[d]?.count || 0;
      html += `<td>${cell}</td>`;
    }
    // Sum all deltas > 20
    if (hasOver20) {
      let over20 = 0;
      for (const d in stats[n]) {
        if (Number(d) > 20) over20 += stats[n][d].count;
      }
      html += `<td>${over20}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// === Multi-run AI blitz ===
let multiRunCount = 0;
let multiRunTarget = 0;
let multiRunParams = null;

function showMultiRunPrompt() {
  const overlay = document.getElementById('multiRunOverlay');
  overlay.classList.remove('hidden');
  overlay.querySelectorAll('.multi-run-btn').forEach(btn => {
    btn.onclick = () => {
      multiRunTarget = parseInt(btn.dataset.n);
      multiRunCount = 0;
      multiRunParams = {
        aiCnt: parseInt(aiCountInput.value),
        aiOnly: true,
        waitTime: parseFloat(waitTimeSelect.value)
      };
      overlay.classList.add('hidden');
      startMultiRun();
    };
  });
  overlay.querySelector('#multiRunCancelBtn').onclick = () => {
    overlay.classList.add('hidden');
  };
}

function startMultiRun() {
  winEl.classList.add('hidden');
  init(multiRunParams.aiCnt, true);
}

document.querySelector("#resetBtn").onclick = () => {
  multiRunTarget = 0;
  multiRunParams = null;
  showSetupScreen();
};
document.querySelector("#playAgainBtn").onclick = () => {
  multiRunTarget = 0;
  multiRunParams = null;
  showSetupScreen();
};
init();
