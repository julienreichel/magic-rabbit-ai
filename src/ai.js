export class VirtualPlayer {
  constructor(id, total) {
    this.id = id;
    this.total = total;
    this.memIdx = -1;
    this.memVal = null;
    this.lastPeek = null; // {idx, val}
    this.history = [];
    this.round = 0; // Track number of turns taken by this AI
  }
  clear() {
    this.memIdx = -1;
    this.memVal = null;
  }

  _findLastPeek(turnHistory) {
    let lastPeek = null;
    for (let i = turnHistory.length - 1; i >= 0; i--) {
      const h = turnHistory[i];
      if (h.player !== this.id && h.action.type === "peek") {
        lastPeek = h.action.i1;
        break;
      }
    }
    if (lastPeek === null && this.lastPeek !== null) {
      lastPeek = this.lastPeek.idx;
    }
    return lastPeek;
  }

  _findRememberedAction(game, ignoreDove = false) {
    if (this.memIdx === -1) return null;
    const val = this.memVal;
    let idx = this.memIdx;
    if (game.piles[idx].rabbitNum !== val) {
      idx = game.piles.findIndex((p) => p.rabbitNum === val);
    }
    if (!ignoreDove && game.piles[idx].hasDove) {
      return null;
    }
    const dest = val - 1;
    if (
      idx !== dest &&
      (!game.piles[dest].hasDove || ignoreDove)
    ) {
      return { type: "swapPile", i1: idx, i2: dest };
    }
    if (idx === dest && game.piles[dest].hatNum !== val) {
      const j = game.piles.findIndex((p, i) => p.hatNum === val && !p.hasDove);
      if (j !== -1) {
        return { type: "swapHat", i1: dest, i2: j };
      } else if (ignoreDove) {
        // If j == -1, it means the hat is hidden under a dove. Pick any dove at random.
        const allDoves = game.piles.map((p, i) => p.hasDove ? i : -1).filter(i => i !== -1);
        const randomDoveIdx = allDoves[Math.floor(Math.random() * allDoves.length)];
        return { type: "swapHat", i1: dest, i2: randomDoveIdx };
      }
    }
    return null;
  }

  _applyRememberedAction(game, action) {
    if (!action) return;
    if (action.type === "swapPile") {
      game.swapPiles(action.i1, action.i2);
      this.memIdx = action.i2;
    } else if (action.type === "swapHat") {
      game.swapHats(action.i1, action.i2);
    }
    // If after applying, the card is in the right place with the right hat, clear memory
    const idx = this.memIdx;
    if (
      idx !== -1 &&
      game.piles[idx].hatNum === this.memVal
    ) {
      this.clear();
    }
  }

  _findNextPeekIdx(game, lastPeek, skipCorrectHat = false) {
    for (let offset = 1; offset <= 9; offset++) {
      const tryIdx = (lastPeek + offset) % 9;
      if (
        !game.piles[tryIdx].hasDove &&
        tryIdx !== this.memIdx &&
        (!skipCorrectHat || game.piles[tryIdx].hatNum !== tryIdx + 1)
      ) {
        return tryIdx;
      }
    }
    return null;
  }

  _choosePeek(game, lastPeek) {
    if (this.round === 1) {
      for (let i = 0; i < 9; i++) {
        if (!game.piles[i].hasDove && game.piles[i].hatNum === i + 1) {
          return i;
        }
      }
    }
    const skipCorrectHat = this.round > 3 && !game.piles.every((p, i) => p.hatNum === i + 1 || p.hasDove);
    return this._findNextPeekIdx(game, lastPeek ?? 0, skipCorrectHat);
  }

  takeAction(game, turnHistory) {
    this.round++;
    const remembered = this._findRememberedAction(game);
    if (remembered) {
      this._applyRememberedAction(game, remembered);
      return remembered;
    }
    const lastPeek = this._findLastPeek(turnHistory);
    const peekIdx = this._choosePeek(game, lastPeek);
    if (peekIdx !== null) {
      this.memIdx = peekIdx;
      this.memVal = game.piles[peekIdx].rabbitNum;
      this.lastPeek = { idx: peekIdx, val: this.memVal };
      return { type: "peek", i1: peekIdx };
    }
    return { type: "pass" };
  }
  _moveToNext(game, fromIdx, onlyCorrectHat = false) {
    for (let offset = 1; offset < 9; offset++) {
      let i = (fromIdx - offset + 9) % 9;
      if (!game.piles[i].hasDove && (!onlyCorrectHat || game.piles[i].hatNum === i + 1)) {
        game.moveDove(fromIdx, i);
        return { type: "moveDove", from: fromIdx, to: i };
      }
    }
    return null;
  }
  // Helper: pick a dove to move, prefer one on a pile with a visible hat that is not at its right position
  _pickDoveIdx(game) {
    // 1. Find all visible hats (no dove on top) that are not at their correct position
    const visibleWrongHatNums = [];
    for (let i = 0; i < game.piles.length; i++) {
      const p = game.piles[i];
      if (!p.hasDove && p.hatNum !== i + 1) {
        visibleWrongHatNums.push(p.hatNum);
      }
    }
    // 2. For each visible wrong hat, check if there is a dove on the pile where this hatNum should be
    for (const hatNum of visibleWrongHatNums) {
      const doveIdx = hatNum - 1;
      if (game.piles[doveIdx]?.hasDove) {
        // The dove at doveIdx is sitting on a wrong hat (inferred from visible hat)
        return doveIdx;
      }
    }
    // 3. Otherwise, pick any dove at random
    const allDoves = game.piles.map((p, i) => p.hasDove ? i : -1).filter(i => i !== -1);
    return allDoves[Math.floor(Math.random() * allDoves.length)];
  }

  moveDove(game, turnHistory = []) {
    // 1. Check for remembered action (needed piles for next move), ignore dove presence
    const remembered = this._findRememberedAction(game, true);
    let doveIdx = null, targetIdx = null;
    if (remembered) {
      // If dove is on a pile needed for the next move
      if (game.piles[remembered.i1]?.hasDove) {
        doveIdx = remembered.i1;
      } else if (game.piles[remembered.i2]?.hasDove) {
        doveIdx = remembered.i2;
      }
      if (doveIdx !== null) {
        let action = this._moveToNext(game, doveIdx, true);
        if (action) return action;
        action = this._moveToNext(game, doveIdx, false);
        if (action) return action;
      }
    }
    // 2. Check if the AI just made a switch or peek that put the right rabbit under the right hat in the right column
    const last = turnHistory[turnHistory.length - 1];
    if (last?.action.type === "swapPile" || last?.action.type === "swapHat") {
      const dest = last.action.i2;
      if (game.piles[dest]?.hatNum === dest + 1) {
        targetIdx = dest;
      }
    } else if (last?.action.type === "peek") {
      const idx = last.action.i1;
      if (game.piles[idx]?.hatNum === idx + 1) {
        targetIdx = idx;
      }
    }
    if (targetIdx !== null) {
      doveIdx = this._pickDoveIdx(game);
      game.moveDove(doveIdx, targetIdx);
      return { type: "moveDove", from: doveIdx, to: targetIdx };
    }
    // No move possible
    return { type: "pass" };
  }
}
