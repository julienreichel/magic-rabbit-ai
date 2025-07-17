// View layer for Magic Rabbit AI game
// Handles all DOM manipulation and rendering

// === DOM helpers ===
export const $ = (q) => document.querySelector(q);
export const board = $("#board");
export const timerEl = $("#timer");
export const turnInfo = $("#turnInfo");
export const winEl = $("#winOverlay");

export function card(html, cls) {
  const div = document.createElement("div");
  div.className = cls;
  div.innerHTML = html;
  return div;
}

export function renderBoard(game, gameOver, humanRabbit, humanHat, humanDove, reveal) {
  board.innerHTML = "";
  game.piles.forEach((p, i) => {
    const pile = document.createElement("div");
    pile.className = "pile" + (p.hasDove ? " blocked" : "");
    // Hat
    const hat = card(`🎩<span class=num>${p.hatNum}</span>`, "card hat");
    hat.onclick = (e) => humanHat(i, hat);
    // Dove (if present)
    let dove = null;
    if (p.hasDove) {
      dove = card("🕊️", "card doveToken");
      dove.onclick = (e) => humanDove(i, dove);
      pile.appendChild(hat);
      pile.appendChild(dove);
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

export function showSetupScreen() {
  const setupScreen = $("#setupScreen");
  setupScreen.classList.remove("hidden");
  document.body.classList.add("setup-active");
  winEl.classList.add("hidden");
  clearStatsDisplay();
}
export function hideSetupScreen() {
  const setupScreen = $("#setupScreen");
  setupScreen.classList.add("hidden");
  document.body.classList.remove("setup-active");
}

export function clearStatsDisplay() {
  const turnsStat = $("#turnsStat");
  const doveStat = $("#doveStat");
  if (turnsStat) turnsStat.textContent = "";
  if (doveStat) doveStat.textContent = "";
  const idealStats = $("#idealStats");
  if (idealStats) idealStats.innerHTML = "";
}

export function updateInstructions(state, players, currentTurn) {
  const instructionsBox = $("#instructionsBox");
  const instructionsContent = $("#instructionsContent");
  if (!instructionsBox || !instructionsContent) return;
  if (!players || typeof currentTurn !== "number" || !players[currentTurn]) {
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

export function renderStatsTable(stats) {
  let html = '<table class="stats-table"><thead><tr><th>Players</th>';
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

export function showWinOverlay(mainMoves, doveMoves, minTotalMoves, statsTableHtml) {
  winEl.classList.remove("hidden");
  const turnsStat = $("#turnsStat");
  const doveStat = $("#doveStat");
  if (turnsStat) turnsStat.textContent = mainMoves;
  if (doveStat) doveStat.textContent = doveMoves;
  const idealStats = $("#idealStats");
  if (idealStats) {
    idealStats.innerHTML = `<b>Ideal moves:</b> <span>${minTotalMoves}</span>`;
    idealStats.style.marginTop = "10px";
    idealStats.innerHTML += statsTableHtml;
  }
}

export function hideWinOverlay() {
  winEl.classList.add("hidden");
}

export function updateTurnInfo(players, currentTurn) {
  if (players[currentTurn] === "H") {
    turnInfo.textContent = "Your turn";
  } else {
    turnInfo.textContent = `AI ${players[currentTurn].id}`;
  }
}

export function updateTimer(s) {
  timerEl.textContent = `Time: ${s}s`;
}

export function highlightToken(idx, dom, type) {
  dom.classList.add("highlight");
}

export function clearTokenHighlights(type) {
  // Remove highlights for all relevant selectors
  if (type === "Hat") {
    document.querySelectorAll(".hat.highlight").forEach((el) => el.classList.remove("highlight"));
  } else if (type === "Rab") {
    document.querySelectorAll(".rabbit.highlight").forEach((el) => el.classList.remove("highlight"));
  } else if (type === "Dove" || type === "DoveToken") {
    document.querySelectorAll(".doveToken.highlight").forEach((el) => el.classList.remove("highlight"));
  }
}

export function highlightHat(idx, dom) { highlightToken(idx, dom, "Hat"); }
export function highlightRabbit(idx, dom) { highlightToken(idx, dom, "Rab"); }
export function highlightDove(idx, dom) { highlightToken(idx, dom, "Dove"); }

export function clearHatHighlights() { clearTokenHighlights("Hat"); }
export function clearRabbitHighlights() { clearTokenHighlights("Rab"); }
export function clearDoveHighlights() { clearTokenHighlights("DoveToken"); }

// ...other view helpers as needed...
