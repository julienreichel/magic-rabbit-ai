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

    // --- Compute minimum number of moves for this combination ---
    function minMoves(rArr, hArr) {
      let moves = 0;
      let rabbits = rArr.slice();
      let hats = hArr.slice();
      let skippedPeaks = 0;
      for (let i = 0; i < rabbits.length; i++) {
        while (rabbits[i] !== i + 1) {
          skippedPeaks = 0; // Reset skipped peaks count
          const correctIdx = rabbits[i] - 1;
          // Swap rabbits
          [rabbits[i], rabbits[correctIdx]] = [rabbits[correctIdx], rabbits[i]];
          [hats[i], hats[correctIdx]] = [hats[correctIdx], hats[i]];
          // Sort hats if needed
          if (hats[correctIdx] !== i + 1) {
            const correctHatIdx = hats.indexOf(i + 1);
            [hats[correctHatIdx], hats[i]] = [hats[i], hats[correctHatIdx]];
            moves += 1;
          }
          moves += 2;
        }
        // this will not be counted if everything is already sorted
        skippedPeaks += 1;
        moves += 1;
      }

      moves -= skippedPeaks; // Last peak is not needed
      return { moves, sortedHats: hats };
    }
    const { moves: minAllAtOnce } = minMoves(r, h);
    this.minAllAtOnce = minAllAtOnce;
    this.minTotalMoves = minAllAtOnce;
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
