import { shuffle } from "./game.js";
export class VirtualPlayer {
  constructor(id, total) {
    this.id = id;
    this.total = total;
    this.memIdx = -1;
    this.memVal = null;
    const span = Math.floor(9 / total);
    this.zoneStart = (id - 1) * span;
    this.zoneEnd = id === total ? 8 : this.zoneStart + span - 1;
  }
  clear() {
    this.memIdx = -1;
    this.memVal = null;
  }
  takeAction(game) {
    if (this.memIdx !== -1) {
      const val = this.memVal;
      let idx = this.memIdx;
      if (game.piles[idx].rabbitNum !== val) {
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
    }
    for (let i = this.zoneStart; i <= this.zoneEnd; i++) {
      if (game.piles[i].hasDove) continue;
      if (game.piles[i].rabbitNum === i + 1) continue;
      if (i === this.memIdx) continue;
      this.memIdx = i;
      this.memVal = game.piles[i].rabbitNum;
      return { type: "peek", i1: i };
    }
    // Try to peek, prioritizing hats not in correct position
    for (let i = 0; i < 9; i++) {
      if (game.piles[i].hasDove) continue;
      if (game.piles[i].rabbitNum === i + 1) continue;
      if (i === this.memIdx) continue;
      if (game.piles[i].hatNum !== i + 1) {
        this.memIdx = i;
        this.memVal = game.piles[i].rabbitNum;
        return { type: "peek", i1: i };
      }
    }
    // If still nothing, peek any valid card outside zone
    for (let i = 0; i < 9; i++) {
      if (game.piles[i].hasDove) continue;
      if (i === this.memIdx) continue;
      this.memIdx = i;
      this.memVal = game.piles[i].rabbitNum;
      return { type: "peek", i1: i };
    }
    return { type: "pass" };
  }
  moveDove(game) {
    let from = game.piles.findIndex((p) => p.hasDove);
    for (let i = this.zoneStart; i <= this.zoneEnd; i++) {
      const p = game.piles[i];
      if (!p.hasDove && p.rabbitNum === i + 1 && p.hatNum === i + 1) {
        game.moveDove(from, i);
        return;
      }
    }
  }
}
