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

  _findRememberedAction(game) {
    if (this.memIdx === -1) return null;
    const val = this.memVal;
    let idx = this.memIdx;
    if (game.piles[idx].rabbitNum !== val) {
      idx = game.piles.findIndex((p) => p.rabbitNum === val);
    }
    if (game.piles[idx].hasDove) {
      return null;
    }
    const dest = val - 1;
    if (
      idx !== dest &&
      !game.piles[dest].hasDove
    ) {
      return { type: "swapPile", i1: idx, i2: dest };
    }
    if (idx === dest && game.piles[dest].hatNum !== val) {
      const j = game.piles.findIndex((p, i) => !p.hasDove && p.hatNum === val);
      if (j !== -1) {
        return { type: "swapHat", i1: dest, i2: j };
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
    const skipCorrectHat = this.round > 3 && !game.piles.every((p, i) => p.hatNum === i + 1);
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
  moveDove(game) {
    // Find the lowest-index pile with a dove
    let doveIdx = game.piles.findIndex((p) => p.hasDove);
    // Find the AI's next intended move (swapPile or swapHat) WITHOUT mutating game
    const remembered = this._findRememberedAction(game);
    let blockIdxs = [];
    if (remembered?.type === "swapPile" || remembered?.type === "swapHat") {
      blockIdxs = [remembered.i1, remembered.i2].filter(i => i !== undefined);
    }
    // If dove is blocking a needed move, try to move it
    if (blockIdxs.includes(doveIdx)) {
      let action = this._moveToNext(game, doveIdx, true);
      if (action) return action;
      action = this._moveToNext(game, doveIdx, false);
      if (action) return action;
    } else {
      // Default: move dove to highest-index pile where hatNum is correct and no dove
      let action = this._moveToNext(game, doveIdx, true);
      if (action) return action;
    }
    return { type: "pass" };
  }
}
