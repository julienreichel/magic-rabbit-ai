import { Game, shuffle, checkWin, isGameOver, createGameTimer } from "./game.js";
import { VirtualPlayer } from "./ai.js";
import {
  $, board, timerEl, turnInfo, winEl,
  card, renderBoard, showSetupScreen, hideSetupScreen,
  clearStatsDisplay, updateInstructions, renderStatsTable,
  showWinOverlay, updateTurnInfo, updateTimer, hideWinOverlay,
  highlightToken, clearTokenHighlights,
  highlightHat, highlightRabbit, highlightDove,
  clearHatHighlights, clearRabbitHighlights, clearDoveHighlights
} from "./view.js";

// === Globals ===
class GameController {
  constructor() {
    this.game = null;
    this.players = null;
    this.currentTurn = 0;
    this.lock = false;
    this.humanStart = 0;
    this.totalHuman = 0;
    this.humanTurns = 0;
    this.turnHistory = [];
    this.selHat = null;
    this.selRab = null;
    this.selDove = null;
    this.doveTimer = null;
    this.hasPlayed = false;
    this.statsRecorded = false;
    this.multiRunActive = false;
    this.multiRunCount = 0;
    this.multiRunTarget = 0;
    this.multiRunParams = null;
  }
}

const controller = new GameController();
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
  controller.lock = false;
  controller.statsRecorded = false; // Reset guard at game start
  resetTurnState(); // Use central turn state reset
}

// === Initialization ===
function init(aiCnt, aiOnly) {
  resetGameState();
  if (multiRunTarget) controller.multiRunActive = true;
  if (typeof aiCnt !== "number") {
    showSetupScreen();
    return;
  }
  setupNewGame(aiCnt, aiOnly);
}

function setupNewGame(aiCnt, aiOnly) {
  const { numPlayers, playerList } = setupPlayers(aiCnt, aiOnly);
  controller.game = new Game(numPlayers);
  controller.turnHistory = [];
  controller.players = playerList;
  controller.currentTurn = 0;
  renderBoard(controller.game, checkWin(), humanRabbit, humanHat, humanDove, reveal);
  updateTurnInfo(controller.players, controller.currentTurn);
  controller.humanStart = Date.now();
  startTimer();
  showInitialInstructions();
}

function showInitialInstructions() {
  if (controller.players[controller.currentTurn] === "H") {
    updateInstructions("play", controller.players, controller.currentTurn);
  } else {
    updateInstructions("");
    if (!controller.players.includes("H")) {
      setTimeout(aiTurn, WAIT_TIME);
    }
  }
}

// === Rendering ===
function render() {
  renderBoard(controller.game, checkWin(controller.game) || timerEl.textContent === "Time: 0s", humanRabbit, humanHat, humanDove, reveal);
  checkAndHandleWin();
}

function checkAndHandleWin() {
  if (checkWin(controller.game)) {
    handleGameWin();
  }
}

// === Human interaction state ===
// Remove legacy globals: selHat, selRab, selDove, doveTimer, hasPlayed


function humanHat(idx, dom) {
  if (controller.lock || controller.players[controller.currentTurn] !== "H") return;
  if (isGameOver()) return;
  if (controller.game.piles[idx].hasDove) return;
  if (controller.selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (controller.hasPlayed) return;
  if (controller.selHat === null) {
    controller.selHat = idx;
    highlightHat(idx, dom);
    return;
  }
  if (controller.selHat !== idx) {
    swapHatAction(idx);
    clearAllHighlights();
    controller.selHat = null;
    return;
  }
  // If clicked same hat, just clear selection
  clearAllHighlights();
  controller.selHat = null;
}

function swapHatAction(idx) {
  controller.game.swapHats(controller.selHat, idx);
  controller.turnHistory.push({ player: "H", action: { type: "swapHat", i1: controller.selHat, i2: idx } });
  controller.hasPlayed = true;
  render();
  controller.lock = true;
  flash([piece(controller.selHat, ".hat"), piece(idx, ".hat")], () => {
    controller.lock = false;
    updateInstructions("dove", controller.players, controller.currentTurn);
    startDoveAutoPass();
  });
}

function humanRabbit(idx, dom) {
  if (controller.lock || controller.players[controller.currentTurn] !== "H") return;
  if (isGameOver()) return;
  if (controller.game.piles[idx].hasDove) return;
  if (controller.selDove !== null) {
    moveDoveTo(idx);
    return;
  }
  if (controller.hasPlayed) return;
  if (controller.selRab === null) {
    controller.selRab = idx;
    highlightRabbit(idx, dom);
    return;
  }
  if (controller.selRab !== idx) {
    swapRabbitAction(idx);
    clearAllHighlights();
    controller.selRab = null;
    return;
  }
  // If clicked same rabbit, just clear selection
  clearAllHighlights();
  controller.selRab = null;
}

function swapRabbitAction(idx) {
  controller.game.swapPiles(controller.selRab, idx);
  controller.turnHistory.push({ player: "H", action: { type: "swapPile", i1: controller.selRab, i2: idx } });
  controller.hasPlayed = true;
  render();
  controller.lock = true;
  flash([
    piece(controller.selRab, ".hat"),
    piece(controller.selRab, ".rabbit"),
    piece(idx, ".hat"),
    piece(idx, ".rabbit")
  ], () => {
    controller.lock = false;
    updateInstructions("dove", controller.players, controller.currentTurn);
    startDoveAutoPass();
  });
}

function reveal(el) {
  if (controller.lock || controller.players[controller.currentTurn] !== "H") return;
  if (controller.selDove !== null) return;
  if (controller.hasPlayed) return;
  if (isGameOver()) return;
  el.classList.add("revealed");
  controller.turnHistory.push({ player: "H", action: { type: "peek", i1: Array.from(board.children).findIndex(pile => pile.querySelector(".rabbit") === el) } });
  controller.hasPlayed = true;
  updateInstructions("dove", controller.players, controller.currentTurn);
  startDoveAutoPass();
  setTimeout(() => {
    el.classList.remove("revealed");
    // Wait for dove
  }, 1000);
}

function humanDove(idx, dom) {
  if (controller.lock || controller.players[controller.currentTurn] !== "H") return;
  if (isGameOver()) return;
  if (!controller.hasPlayed) return;
  if (controller.selDove === null) {
    controller.selDove = idx;
    highlightDove(idx, dom);
    return;
  }
  if (controller.selDove === idx) {
    cancelDove();
    endTurn();
    return;
  }
  moveDoveTo(idx);
}

function moveDoveTo(target) {
  if (isGameOver()) return;
  if (controller.game.piles[target].hasDove) return;
  if (!controller.hasPlayed) return;
  controller.game.moveDove(controller.selDove, target);
  controller.turnHistory.push({ player: "H", action: { type: "moveDove", from: controller.selDove, to: target } });
  cancelDove();
  render();
  endTurn();
}

function startDoveAutoPass() {
  clearTimeout(controller.doveTimer);
  controller.doveTimer = setTimeout(() => {
    if (controller.players[controller.currentTurn] === "H" && controller.selDove === null) {
      endTurn();
    }
  }, 3000);
}

function cancelDove() {
  clearTimeout(controller.doveTimer);
  controller.doveTimer = null;
  clearAllHighlights();
  controller.selDove = null;
}

// === AI turn ===
function processAIAction(ai, shortHistory) {
  if (!(ai instanceof VirtualPlayer)) return; // Guard: only process AI players
  const res = ai.takeAction(controller.game, shortHistory);
  render();
  if (checkWin(controller.game)) {
    handleGameWin();
    return true;
  }
  const flashes = [];
  if (res.type === "peek") flashes.push(piece(res.i1, ".rabbit"));
  if (res.type === "swapHat") flashes.push(piece(res.i1, ".hat"), piece(res.i2, ".hat"));
  if (res.type === "swapPile") flashes.push(piece(res.i1, ".hat"), piece(res.i1, ".rabbit"), piece(res.i2, ".hat"), piece(res.i2, ".rabbit"));
  if (["peek", "swapHat", "swapPile"].includes(res.type)) {
    controller.turnHistory.push({ player: ai.id, action: res });
  }
  controller.lock = true;
  flash(flashes, () => {
    if (isGameOver()) return;
    const doveAction = ai.moveDove(controller.game, controller.turnHistory);
    if (doveAction?.type === "moveDove") {
      controller.turnHistory.push({ player: ai.id, action: doveAction });
    }
    render();
    if (checkWin(controller.game)) {
      handleGameWin();
      return;
    }
    controller.lock = false;
    endTurn();
  });
}

function aiTurn() {
  if (isGameOver()) return;
  const ai = controller.players[controller.currentTurn];
  if (!(ai instanceof VirtualPlayer)) return; // Guard: only process AI players
  const shortHistory = controller.turnHistory.slice(-5);
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
  if (controller.players[controller.currentTurn] === "H") {
    updateHumanStats();
  }
  resetTurnState();
  updateTurnInfo(controller.players, controller.currentTurn);
  handleNextPlayerInstructions();
}

function updateHumanStats() {
  controller.totalHuman += Date.now() - controller.humanStart;
  controller.humanTurns++;
}

function resetTurnState() {
  controller.selHat = null;
  controller.selRab = null;
  controller.selDove = null;
  controller.hasPlayed = false;
  controller.doveTimer = null;
  if (Array.isArray(controller.players) && controller.players.length > 0) {
    controller.currentTurn = (controller.currentTurn + 1) % controller.players.length;
  } else {
    controller.currentTurn = 0;
  }
  clearAllHighlights();
}

function handleNextPlayerInstructions() {
  if (controller.players[controller.currentTurn] === "H") {
    updateInstructions("play", controller.players, controller.currentTurn);
    controller.humanStart = Date.now();
  } else {
    updateInstructions("");
    if (!checkWin()) {
      setTimeout(aiTurn, controller.players.includes("H") ? avgHuman() : WAIT_TIME);
    }
  }
}

function handleGameWin() {
  if (controller.statsRecorded) return;
  controller.statsRecorded = true;
  gameTimer?.stop();
  const { mainMoves, doveMoves } = countMoves(controller.turnHistory);
  const numPlayers = controller.players.length;
  const delta = mainMoves - controller.game.minTotalMoves;
  recordGameStats(numPlayers, delta, doveMoves);
  if (controller.multiRunTarget) {
    handleMultiRun(mainMoves, doveMoves);
    return;
  }
  showWinOverlay(mainMoves, doveMoves, controller.game.minTotalMoves, renderStatsTable(loadStats()));
}

function countMoves(turnHistory) {
  let mainMoves = 0, doveMoves = 0;
  for (const t of turnHistory) {
    if (t.action.type === "moveDove") doveMoves++;
    else mainMoves++;
  }
  return { mainMoves, doveMoves };
}

function handleMultiRun(mainMoves, doveMoves) {
  controller.multiRunCount++;
  if (controller.multiRunCount < controller.multiRunTarget) {
    setTimeout(() => {
      controller.statsRecorded = false;
      init(controller.multiRunParams.aiCnt, true);
    }, WAIT_TIME * 5);
  } else {
    controller.multiRunActive = false;
    controller.multiRunTarget = 0;
    controller.multiRunParams = null;
    showWinOverlay(mainMoves, doveMoves, controller.game.minTotalMoves, renderStatsTable(loadStats()));
  }
}

// === Timer & win ===
class GameTimer {
  constructor(duration, onTick, onEnd) {
    this.duration = duration;
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.remaining = duration;
    this.interval = null;
  }

  start() {
    this.stop();
    this.remaining = this.duration;
    this.interval = setInterval(() => {
      this.remaining--;
      this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onEnd();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

let gameTimer = null;

function startTimer() {
  if (gameTimer) gameTimer.stop();
  gameTimer = new GameTimer(150, (s) => updateTimer(s), () => {
    alert("Time up!");
    render();
  });
  gameTimer.start();
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
      controller.multiRunTarget = parseInt(btn.dataset.n);
      controller.multiRunCount = 0;
      controller.multiRunParams = {
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
  controller.multiRunActive = false; // Reset before starting new multi-run sequence
  init(controller.multiRunParams.aiCnt, true);
}

document.querySelector("#resetBtn").onclick = () => {
  resetMultiRunState();
  showSetupScreen();
};
document.querySelector("#playAgainBtn").onclick = () => {
  resetMultiRunState();
  showSetupScreen();
};

// === Helper functions ===
function avgHuman() {
  // If there is a human, use the average human speed (bounded), else use WAIT_TIME
  if (controller.humanTurns > 0) {
    return Math.max(WAIT_TIME, Math.min(5000, Math.floor(controller.totalHuman / controller.humanTurns)));
  }
  return WAIT_TIME;
}

function resetMultiRunState() {
  controller.multiRunTarget = 0;
  controller.multiRunParams = null;
  controller.multiRunActive = false;
  controller.multiRunCount = 0;
}

function clearAllHighlights() {
  clearHatHighlights();
  clearRabbitHighlights();
  clearDoveHighlights();
}
