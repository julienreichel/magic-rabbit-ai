import { Game, shuffle, checkWin, isGameOver, createGameTimer } from "./game.js";
import { VirtualPlayer } from "./ai.js";
import {
  $, board, timerEl, turnInfo, winEl,
  card, renderBoard, showSetupScreen, hideSetupScreen,
  clearStatsDisplay, updateInstructions, renderStatsTable,
  showWinOverlay, updateTurnInfo, updateTimer, hideWinOverlay
} from "./view.js";

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
  if (waitTimeSelect) {
    WAIT_TIME = parseFloat(waitTimeSelect.value);
  }
  if (aiOnly) {
    hideSetupScreen();
    showMultiRunPrompt();
    return;
  }
  hideSetupScreen();
  init(aiCnt, aiOnly);
};

// === Initialization ===
function setupPlayers(aiCnt, aiOnly) {
  let numPlayers, playerList;
  if (aiOnly) {
    numPlayers = aiCnt === 0 ? 1 : aiCnt;
    playerList = [];
    for (let i = 1; i <= numPlayers; i++) playerList.push(new VirtualPlayer(i));
  } else {
    numPlayers = 1 + aiCnt;
    playerList = ["H"];
    for (let i = 1; i <= aiCnt; i++) playerList.push(new VirtualPlayer(i));
  }
  return { numPlayers, playerList };
}

function resetGameState() {
  hideWinOverlay();
  clearStatsDisplay();
  lock = false;
  selHat = null;
  selRab = null;
  selDove = null;
  doveTimer = null;
  hasPlayed = false;
  statsRecorded = false; // Reset guard at game start
}

// === Initialization ===
function init(aiCnt, aiOnly) {
  resetGameState();
  if (multiRunTarget) multiRunActive = true;
  if (typeof aiCnt !== "number") {
    showSetupScreen();
    return;
  }
  setupNewGame(aiCnt, aiOnly);
}

function setupNewGame(aiCnt, aiOnly) {
  const { numPlayers, playerList } = setupPlayers(aiCnt, aiOnly);
  game = new Game(numPlayers);
  turnHistory = [];
  players = playerList;
  currentTurn = 0;
  renderBoard(game, checkWin(), humanRabbit, humanHat, humanDove, reveal);
  updateTurnInfo(players, currentTurn);
  humanStart = Date.now();
  startTimer();
  showInitialInstructions();
}

function showInitialInstructions() {
  if (players[currentTurn] === "H") {
    updateInstructions("play", players, currentTurn);
  } else {
    updateInstructions("");
    if (!players.includes("H")) {
      setTimeout(aiTurn, WAIT_TIME);
    }
  }
}

// === Rendering ===
function render() {
  renderBoard(game, checkWin(game) || timerEl.textContent === "Time: 0s", humanRabbit, humanHat, humanDove, reveal);
  checkAndHandleWin();
}

function checkAndHandleWin() {
  if (checkWin(game)) {
    handleGameWin();
  }
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
  if (game.piles[idx].hasDove) return;
  if (selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (hasPlayed) return;
  if (selHat === null) {
    highlightHat(idx, dom);
    return;
  }
  if (selHat !== idx) {
    swapHatAction(idx);
  }
  clearHatHighlights();
  selHat = null;
}

function highlightHat(idx, dom) {
  selHat = idx;
  dom.classList.add("highlight");
}

function swapHatAction(idx) {
  game.swapHats(selHat, idx);
  turnHistory.push({ player: "H", action: { type: "swapHat", i1: selHat, i2: idx } });
  hasPlayed = true;
  render();
  lock = true;
  flash([piece(selHat, ".hat"), piece(idx, ".hat")], () => {
    lock = false;
    updateInstructions("dove", players, currentTurn);
    startDoveAutoPass();
  });
}

function clearHatHighlights() {
  document.querySelectorAll(".hat.highlight").forEach((el) => el.classList.remove("highlight"));
}

function humanRabbit(idx, dom) {
  if (lock || players[currentTurn] !== "H") return;
  if (isGameOver()) return;
  if (game.piles[idx].hasDove) return;
  if (selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (hasPlayed) return;
  if (selRab === null) {
    highlightRabbit(idx, dom);
    return;
  }
  if (selRab !== idx) {
    swapRabbitAction(idx);
  }
  clearRabbitHighlights();
  selRab = null;
}

function highlightRabbit(idx, dom) {
  selRab = idx;
  dom.classList.add("highlight");
}

function swapRabbitAction(idx) {
  game.swapPiles(selRab, idx);
  turnHistory.push({ player: "H", action: { type: "swapPile", i1: selRab, i2: idx } });
  hasPlayed = true;
  render();
  lock = true;
  flash([
    piece(selRab, ".hat"),
    piece(selRab, ".rabbit"),
    piece(idx, ".hat"),
    piece(idx, ".rabbit")
  ], () => {
    lock = false;
    updateInstructions("dove", players, currentTurn);
    startDoveAutoPass();
  });
}

function clearRabbitHighlights() {
  document.querySelectorAll(".rabbit.highlight").forEach((el) => el.classList.remove("highlight"));
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
  if (!hasPlayed) return;
  if (selDove === null) {
    highlightDove(idx, dom);
    return;
  }
  if (selDove === idx) {
    cancelDove();
    endTurn();
    return;
  }
  moveDoveTo(idx);
}

function highlightDove(idx, dom) {
  selDove = idx;
  dom.classList.add("highlight");
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
function processAIAction(ai, shortHistory) {
  const res = ai.takeAction(game, shortHistory);
  render();
  if (checkWin(game)) {
    handleGameWin();
    return true;
  }
  const flashes = [];
  if (res.type === "peek") flashes.push(piece(res.i1, ".rabbit"));
  if (res.type === "swapHat") flashes.push(piece(res.i1, ".hat"), piece(res.i2, ".hat"));
  if (res.type === "swapPile") flashes.push(piece(res.i1, ".hat"), piece(res.i1, ".rabbit"), piece(res.i2, ".hat"), piece(res.i2, ".rabbit"));
  if (["peek", "swapHat", "swapPile"].includes(res.type)) {
    turnHistory.push({ player: ai.id, action: res });
  }
  lock = true;
  flash(flashes, () => {
    if (isGameOver()) return;
    const doveAction = ai.moveDove(game, turnHistory);
    if (doveAction?.type === "moveDove") {
      turnHistory.push({ player: ai.id, action: doveAction });
    }
    render();
    if (checkWin(game)) {
      handleGameWin();
      return;
    }
    lock = false;
    endTurn();
  });
}

function aiTurn() {
  if (isGameOver()) return;
  const ai = players[currentTurn];
  const shortHistory = turnHistory.slice(-5);
  processAIAction(ai, shortHistory);
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
  updateTurnInfo(players, currentTurn);
  // Show or hide instructions based on whose turn it is
  if (players[currentTurn] === "H") {
    updateInstructions("play", players, currentTurn);
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
  timerInt = createGameTimer(150, (s) => updateTimer(s), () => {
    alert("Time up!");
    render(); // Ensure board updates to show all rabbits when time is up
  });
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
  hideWinOverlay();
  multiRunActive = false; // Reset before starting new multi-run sequence
  init(multiRunParams.aiCnt, true);
}

document.querySelector("#resetBtn").onclick = () => {
  multiRunTarget = 0;
  multiRunParams = null;
  multiRunActive = false;
  showSetupScreen();
};
document.querySelector("#playAgainBtn").onclick = () => {
  multiRunTarget = 0;
  multiRunParams = null;
  multiRunActive = false;
  showSetupScreen();
};
init();
