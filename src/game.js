export class Pile {
  constructor(i, r, h) {
    this.idx = i;
    this.rabbitNum = r;
    this.hatNum = h;
    this.hasDove = false;
  }
}
export class Game {
  constructor(numPlayers = 4) {
    this.init(numPlayers);
  }
  init(numPlayers = 4) {
    const r = shuffle([...Array(9).keys()].map((n) => n + 1));
    const h = shuffle([...Array(9).keys()].map((n) => n + 1));
    this.piles = [];
    for (let i = 0; i < 9; i++) this.piles.push(new Pile(i, r[i], h[i]));
    // Place doves according to player count (default: 4 players)
    // 4 players: 2 doves (positions 0, 8)
    // 3 players: 3 doves (positions 0, 4, 8)
    // 2 players: 4 doves (positions 0, 2, 6, 8)
    // 1 player: 5 doves (positions 0, 2, 4, 6, 8)
    const dovePositions = {
      4: [0, 8],
      3: [0, 4, 8],
      2: [0, 2, 6, 8],
      1: [0, 2, 4, 6, 8],
    };
    (dovePositions[numPlayers] || dovePositions[4]).forEach(
      (idx) => {
        this.piles[idx].hasDove = true;
      }
    );
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
