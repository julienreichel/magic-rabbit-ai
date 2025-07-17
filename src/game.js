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
      const rabbits = rArr.slice();
      const hats    = hArr.slice();

      for (let i = 0; i < rabbits.length; i++) {
        moves += 1; // peak the rabbit
        if (rabbits[i] !== i + 1) {
          const j = rabbits[i] - 1;          // where rabbit i is hiding
          [rabbits[i], rabbits[j]] = [rabbits[j], rabbits[i]];
          [hats[i],    hats[j]]    = [hats[j],    hats[i]];
          moves += 1;                        // Move the rabbit
        }
        if (hats[i] !== i + 1) {
          const j = hats.indexOf(i + 1);     // where the right hat is
          [hats[i], hats[j]] = [hats[j], hats[i]];
          moves += 1;                        // Move the hat
        }
      }
      moves -=1; // Last peak is not needed, we can infrer the last rabbit is in place
      return moves;
    }
    this.minTotalMoves = minMoves(r, h);
  }
  // Game state mutation methods
  swapHats(i1, i2) {
    // Swap hats between piles i1 and i2
    const tmp = this.piles[i1].hatNum;
    this.piles[i1].hatNum = this.piles[i2].hatNum;
    this.piles[i2].hatNum = tmp;
  }

  swapPiles(i1, i2) {
    // Swap entire piles (rabbit, hat, dove)
    const tmp = this.piles[i1];
    this.piles[i1] = this.piles[i2];
    this.piles[i2] = tmp;
  }

  moveDove(from, to) {
    // Move dove from pile 'from' to pile 'to'
    if (!this.piles[from].hasDove || this.piles[to].hasDove) return false;
    this.piles[from].hasDove = false;
    this.piles[to].hasDove = true;
    return true;
  }

  peekRabbit(idx) {
    // Return rabbit number for pile idx
    return this.piles[idx].rabbitNum;
  }
}

// Add game state helpers for MVC separation
export function checkWin(game) {
  if (!game || !game.piles) return false;
  return game.piles.every((p, i) => p.rabbitNum === i + 1 && p.hatNum === i + 1);
}

export function isGameOver(game, timerValue) {
  return checkWin(game) || timerValue === 0;
}

// Timer logic for game
export function createGameTimer(duration, onTick, onEnd) {
  let s = duration;
  let timerInt = setInterval(() => {
    s--;
    onTick(s);
    if (s <= 0) {
      clearInterval(timerInt);
      onEnd();
    }
  }, 1000);
  return timerInt;
}

export const shuffle = (a) => a.sort(() => Math.random() - 0.5);
