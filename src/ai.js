import { shuffle } from "./game.js";
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

  _tryRememberedCard(game) {
    if (this.memIdx === -1) return null;
    const val = this.memVal;
    let idx = this.memIdx;
    if (game.piles[idx].rabbitNum !== val) {
      // We allow looking for the rabbitNum here, as this is equivalent
      // to track moves done by other players on the AI picked card.
      idx = game.piles.findIndex((p) => p.rabbitNum === val);
      this.memIdx = idx;
    }
    const dest = val - 1;
    if (
      idx !== dest &&
      !game.piles[idx].hasDove &&
      !game.piles[dest].hasDove
    ) {
      game.swapPiles(idx, dest);
      this.memIdx = dest;
      return { type: "swapPile", i1: idx, i2: dest };
    }
    if (idx === dest && game.piles[dest].hatNum !== val) {
      for (let j = 0; j < 9; j++)
        if (
          j !== dest &&
          !game.piles[j].hasDove &&
          game.piles[j].hatNum === val
        ) {
          game.swapHats(dest, j);
          if (game.piles[dest].hatNum === val) this.clear();
          return { type: "swapHat", i1: dest, i2: j };
        }
    }
    if (idx === dest && game.piles[dest].hatNum === val) this.clear();
    return null;
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
    const lastPeek = this._findLastPeek(turnHistory);
    const remembered = this._tryRememberedCard(game);
    if (remembered) return remembered;
    const peekIdx = this._choosePeek(game, lastPeek);
    if (peekIdx !== null) {
      this.memIdx = peekIdx;
      this.memVal = game.piles[peekIdx].rabbitNum;
      this.lastPeek = { idx: peekIdx, val: this.memVal };
      return { type: "peek", i1: peekIdx };
    }
    return { type: "pass" };
  }
  moveDove(game) {
    // Find the lowest-index pile with a dove
    let doveIdx = game.piles.findIndex((p) => p.hasDove);
    // Find the AI's next intended move (swapPile or swapHat)
    const remembered = this._tryRememberedCard(game);
    let blockIdxs = [];
    if (remembered) {
      if (remembered.type === "swapPile") {
        blockIdxs = [remembered.i1, remembered.i2];
      } else if (remembered.type === "swapHat") {
        blockIdxs = [remembered.i1, remembered.i2];
      }
    }
    // Helper to move dove to next spot (reverse rotating search), with flag for correct hat
    const moveToNext = (fromIdx, onlyCorrectHat = false) => {
      for (let offset = 1; offset < 9; offset++) {
        let i = (fromIdx - offset + 9) % 9;
        if (!game.piles[i].hasDove && (!onlyCorrectHat || game.piles[i].hatNum === i + 1)) {
          game.moveDove(fromIdx, i);
          return { type: "moveDove", from: fromIdx, to: i };
        }
      }
      return null;
    };
    // If dove is blocking a needed move, try to move it
    if (blockIdxs.includes(doveIdx)) {
      let action = moveToNext(doveIdx, true);
      if (action) return action;
      action = moveToNext(doveIdx, false);
      if (action) return action;
    } else {
      // Default: move dove to highest-index pile where hatNum is correct and no dove
      let action = moveToNext(doveIdx, true);
      if (action) return action;
    }
    return { type: "pass" };
  }
}
