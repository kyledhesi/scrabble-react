// Ported from model/aiPlayer.java. Same overall search strategy:
//   1. Collect every locked tile on the board as an "anchor".
//   2. For each anchor, ask the trie for every dictionary word spellable
//      from the rack (plus that anchor's own letter) that contains the
//      anchor's letter - these are the candidate words.
//   3. For each candidate word, try aligning it through *every* locked tile
//      on the board (any matching letter, any occurrence in the word),
//      in both orientations, and keep whichever legal placement scores
//      highest.
//
// Differences from the Java version (behaviourally equivalent, just cleaner
// given a pure/immutable board - see board.js and letterTree.js for the
// same note):
//   - No save/mutate/revert dance: candidates are simulated on throwaway
//     board clones, so there's nothing to revert.
//   - Validity-checking and scoring happen in a single simulation pass per
//     candidate instead of two (the original calls areWordsValid/score
//     once inside getPossiblePositions and then again inside makeMove).
//   - isFirstMove is always passed as `false` for the AI's own search. The
//     Java version actually hardcodes `true` at one call site
//     (ScrabbleBoard.areWordsValid(true) inside makeMove's scoring pass)
//     while passing `false` at another (inside getPossiblePositions) - but
//     since the AI in this game never plays turn 0 (player one always goes
//     first), the centre square is always already covered by the time the
//     AI searches, so isFirstMove's only behavioural effect (requiring the
//     centre square) can never actually trigger either way. `false` is the
//     semantically correct value and produces identical results.
//   - Duplicate (word, position, orientation) candidates - which can arise
//     because the same placement may be reachable through more than one
//     anchor tile - are skipped instead of re-simulated.

import { BOARD_SIZE } from './constants.js';
import { placeTileOnBoard, validateMove, calculateScore } from './board.js';

export function getLockedTiles(board) {
  const locked = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const tile = board[row][col];
      if (tile && tile.locked) locked.push({ row, col, tile });
    }
  }
  return locked;
}

export function generatePossibleWords(board, rack, letterTree) {
  const possibleWords = new Set();
  const lockedTiles = getLockedTiles(board);

  for (const { tile: lockedTile } of lockedTiles) {
    const lockedLetter = lockedTile.letter;
    const letters = rack.map((t) => t.letter);
    if (!letters.includes(lockedLetter)) {
      letters.push(lockedLetter);
    }
    for (const word of letterTree.wordsContainingLetter(letters, lockedLetter)) {
      possibleWords.add(word);
    }
  }
  return possibleWords;
}

// Attempts to lay `word` onto `board` starting at (row, col) in the given
// orientation, drawing missing letters from `rack` and reusing matching
// locked tiles already on the board. Returns null if the word can't be
// placed there (out of bounds, a rack shortfall, or a mismatched locked
// tile), otherwise { board, placedPositions } - a fresh board and the list
// of cells that were newly filled (i.e. this turn's placedTiles).
function tryPlaceWord(board, rack, word, row, col, isHorizontal) {
  let workingBoard = board;
  const remainingRack = rack.slice();
  const placedPositions = [];

  for (let i = 0; i < word.length; i++) {
    const letter = word[i];
    const cellRow = isHorizontal ? row : row + i;
    const cellCol = isHorizontal ? col + i : col;
    if (cellRow < 0 || cellRow >= BOARD_SIZE || cellCol < 0 || cellCol >= BOARD_SIZE) {
      return null;
    }
    const existing = workingBoard[cellRow][cellCol];

    if (existing == null) {
      const tileIndex = remainingRack.findIndex((t) => t.letter === letter);
      if (tileIndex === -1) return null;
      const [tile] = remainingRack.splice(tileIndex, 1);
      const placed = placeTileOnBoard(workingBoard, cellRow, cellCol, tile);
      if (!placed.success) return null;
      workingBoard = placed.board;
      placedPositions.push({ row: cellRow, col: cellCol });
    } else if (existing.locked) {
      if (existing.letter !== letter) return null;
      // Reusing an existing locked tile - not part of this turn's placement.
    } else {
      // Occupied by an unlocked tile. Can't happen against a real board
      // (unlocked tiles only exist mid-turn on the human's own board, and
      // the AI always searches from a freshly-locked state), but guard.
      return null;
    }
  }

  return { board: workingBoard, placedPositions };
}

// Searches for the AI's best move. Returns
// { word, board, placedPositions, score } for the best legal placement
// found, or null if no legal move exists. `timeBudgetMs` bounds total
// search time (the Java original allowed itself a full 60 seconds; that's
// far too long to block a browser tab, so this defaults to a few seconds -
// see useScrabbleGame.js).
export function findBestMove(board, rack, dictionary, letterTree, timeBudgetMs = 4000) {
  const startTime = Date.now();
  const candidateWords = generatePossibleWords(board, rack, letterTree);
  const lockedTiles = getLockedTiles(board);
  const tried = new Set();

  let best = null;
  let timeUp = false;

  outer: for (const word of candidateWords) {
    for (const anchor of lockedTiles) {
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== anchor.tile.letter) continue;

        const candidates = [
          { row: anchor.row, col: anchor.col - i, isHorizontal: true },
          { row: anchor.row - i, col: anchor.col, isHorizontal: false },
        ];

        for (const { row, col, isHorizontal } of candidates) {
          if (isHorizontal) {
            if (col < 0 || col + word.length > BOARD_SIZE) continue;
          } else {
            if (row < 0 || row + word.length > BOARD_SIZE) continue;
          }

          const key = `${word}:${row}:${col}:${isHorizontal ? 'H' : 'V'}`;
          if (tried.has(key)) continue;
          tried.add(key);

          const placement = tryPlaceWord(board, rack, word, row, col, isHorizontal);
          if (placement) {
            const { board: candidateBoard, placedPositions } = placement;
            const result = validateMove(candidateBoard, placedPositions, false, dictionary);
            if (result.valid) {
              const score = calculateScore(candidateBoard, placedPositions, false);
              if (!best || score > best.score) {
                best = { word, board: candidateBoard, placedPositions, score };
              }
            }
          }

          if (Date.now() - startTime >= timeBudgetMs) {
            timeUp = true;
            break outer;
          }
        }
      }
    }
  }

  return { move: best, timeUp };
}
