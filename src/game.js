export class Pile {
  constructor(i, r, h) {
    this.idx = i;
    this.rabbitNum = r;
    this.hatNum = h;
    this.hasDove = false;
  }
}
export class Game {
  constructor() {
    this.init();
  }
  init() {
    const r = shuffle([...Array(9).keys()].map((n) => n + 1));
    const h = shuffle([...Array(9).keys()].map((n) => n + 1));
    this.piles = [];
    for (let i = 0; i < 9; i++) this.piles.push(new Pile(i, r[i], h[i]));
    this.piles[0].hasDove = true;
    this.piles[8].hasDove = true;
  }
  swapPiles(a, b) {
    if (this.piles[a].hasDove || this.piles[b].hasDove) return;
    [this.piles[a], this.piles[b]] = [this.piles[b], this.piles[a]];
  }
  swapHats(a, b) {
    if (this.piles[a].hasDove || this.piles[b].hasDove) return;
    [this.piles[a].hatNum, this.piles[b].hatNum] = [
      this.piles[b].hatNum,
      this.piles[a].hatNum,
    ];
  }
  moveDove(from, to) {
    if (this.piles[from].hasDove && !this.piles[to].hasDove) {
      this.piles[from].hasDove = false;
      this.piles[to].hasDove = true;
    }
  }
}
export const shuffle = (a) => a.sort(() => Math.random() - 0.5);
