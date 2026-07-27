// Ported from model/ScrabbleBoard.java. The original kept the board as
// mutable static state and used save/revert snapshots; here everything is a
// pure function over a plain (BOARD_SIZE x BOARD_SIZE) array of Tile|null,
// which is friendlier to React state and to the AI's search (see aiPlayer.js).

import {
  BOARD_SIZE,
  CENTER,
  BINGO_BONUS,
  isDoubleLetter,
  isTripleLetter,
  isDoubleWord,
  isTripleWord,
} from './constants.js';
import { lockTile } from './tile.js';

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function getTileAt(board, row, col) {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return board[row][col];
}

// Mirrors ScrabbleBoard.placeTile: refuses to place over a locked tile.
// Returns { board, success }. Does not mutate the input board.
export function placeTileOnBoard(board, row, col, tile) {
  const existing = board[row][col];
  if (existing && existing.locked) {
    return { board, success: false };
  }
  const next = cloneBoard(board);
  next[row][col] = tile;
  return { board: next, success: true };
}

// Removes whatever tile is at (row, col) - used when a player picks a
// just-placed tile back up, or when "Clear" reverts a turn in progress.
// Refuses (no-op) if the tile there is locked, mirroring
// ScrabbleBoard.removeTileFromBoard's locked-tile guard.
export function removeTileAt(board, row, col) {
  const existing = board[row][col];
  if (!existing || existing.locked) return board;
  const next = cloneBoard(board);
  next[row][col] = null;
  return next;
}

export function lockTilesAt(board, positions) {
  const next = cloneBoard(board);
  for (const { row, col } of positions) {
    const tile = next[row][col];
    if (tile) next[row][col] = lockTile(tile);
  }
  return next;
}

export function isCenterCovered(board) {
  return board[CENTER][CENTER] != null;
}

// Walks outward from (row, col) in both directions along the given
// orientation and returns the full contiguous run of cells as
// [{row, col, tile}], in reading order. Mirrors ScrabbleBoard.getWordAt, but
// returns the cells (not just the letters) so scoring can look up bonus
// squares directly instead of re-searching the board for a matching letter.
export function getWordCellsAt(board, row, col, isHorizontal) {
  const dr = isHorizontal ? 0 : 1;
  const dc = isHorizontal ? 1 : 0;
  let r = row;
  let c = col;
  while (getTileAt(board, r, c)) {
    r -= dr;
    c -= dc;
  }
  r += dr;
  c += dc;
  const cells = [];
  while (getTileAt(board, r, c)) {
    cells.push({ row: r, col: c, tile: board[r][c] });
    r += dr;
    c += dc;
  }
  return cells;
}

function cellsToWord(cells) {
  return cells.map((cell) => cell.tile.letter).join('');
}

// Returns every word (length > 1) formed through the given set of newly
// placed positions, as [{ word, cells }]. Mirrors
// ScrabbleBoard.getFormedWords, but dedupes structurally (by orientation +
// start cell) instead of by word text, so two different placements that
// happen to spell the same word are never conflated.
export function getFormedWords(board, placedPositions) {
  const seen = new Set();
  const words = [];
  for (const { row, col } of placedPositions) {
    for (const isHorizontal of [true, false]) {
      const cells = getWordCellsAt(board, row, col, isHorizontal);
      if (cells.length <= 1) continue;
      const key = `${isHorizontal ? 'H' : 'V'}:${cells[0].row}:${cells[0].col}:${cells.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({ word: cellsToWord(cells), cells });
    }
  }
  return words;
}

export function areTilesConnected(board, placedPositions) {
  if (placedPositions.length === 0) return false;
  const deltas = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const { row, col } of placedPositions) {
    for (const [dr, dc] of deltas) {
      const neighbor = getTileAt(board, row + dr, col + dc);
      if (neighbor && neighbor.locked) return true;
    }
  }
  return false;
}

// Mirrors ScrabbleBoard.areWordsValid. `dictionary` is a Set<string> of
// valid uppercase words. Returns { valid, reason, words } where `words` is
// the getFormedWords() result (handy for the "Last word played" message).
export function validateMove(board, placedPositions, isFirstMove, dictionary) {
  const words = getFormedWords(board, placedPositions);

  if (words.length === 0) {
    return { valid: false, reason: 'No words formed by the placed tiles.', words };
  }
  if (isFirstMove && !isCenterCovered(board)) {
    return { valid: false, reason: 'The first word must cover the centre star.', words };
  }
  for (const { word } of words) {
    if (!dictionary.has(word)) {
      return { valid: false, reason: `"${word}" is not a valid word.`, words };
    }
  }
  if (!isFirstMove && !areTilesConnected(board, placedPositions)) {
    return { valid: false, reason: 'Your word must connect to a tile already on the board.', words };
  }
  return { valid: true, reason: null, words };
}

// Mirrors ScrabbleBoard.calculateTotalScore / calculateTotalScoreAI (the two
// were identical apart from which view class's bonus-square functions they
// called, which were themselves identical - so there is only one version
// here). Bonus multipliers only apply to cells that were placed this turn,
// and a given square's multiplier is only ever applied once even if it
// appears in more than one formed word.
export function calculateScore(board, placedPositions, isFirstMove) {
  const placedKeys = new Set(placedPositions.map((p) => `${p.row}:${p.col}`));
  const words = getFormedWords(board, placedPositions);
  const usedSpecialSquares = new Set();
  let total = 0;

  for (const { cells } of words) {
    let wordScore = 0;
    let wordMultiplier = 1;
    for (const { row, col, tile } of cells) {
      let letterMultiplier = 1;
      const key = `${row}:${col}`;
      const isNewlyPlaced = placedKeys.has(key);

      if (isNewlyPlaced && !usedSpecialSquares.has(key)) {
        if (isDoubleLetter(row, col)) letterMultiplier = 2;
        else if (isTripleLetter(row, col)) letterMultiplier = 3;
        if (letterMultiplier > 1) usedSpecialSquares.add(key);
      }
      wordScore += tile.score * letterMultiplier;

      if (isNewlyPlaced && !usedSpecialSquares.has(key)) {
        if (isDoubleWord(row, col)) wordMultiplier *= 2;
        else if (isTripleWord(row, col)) wordMultiplier *= 3;
        if (isDoubleWord(row, col) || isTripleWord(row, col)) usedSpecialSquares.add(key);
      }
    }
    total += wordScore * wordMultiplier;
  }

  if (isFirstMove) total *= 2;
  if (placedPositions.length === 7) total += BINGO_BONUS;

  return total;
}

export function printBoard(board) {
  return board
    .map((row) => row.map((tile) => (tile ? tile.letter : '_')).join(' '))
    .join('\n');
}
