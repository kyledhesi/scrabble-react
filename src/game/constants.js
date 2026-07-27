// Ported directly from the original Java project:
//   - tile.txt                       -> TILE_DISTRIBUTION
//   - view/pvcBoard.java (and the    -> BONUS square predicates
//     identical copies in pvpBoard.java)

export const BOARD_SIZE = 15;
export const CENTER = 7;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50; // bonus for playing all 7 tiles in one turn
export const BLANK_LETTER = '_';

// letter, point value, count in the bag (from tile.txt)
export const TILE_DISTRIBUTION = [
  ['A', 1, 9],
  ['B', 3, 2],
  ['C', 3, 2],
  ['D', 2, 4],
  ['E', 1, 12],
  ['F', 4, 2],
  ['G', 2, 3],
  ['H', 4, 2],
  ['I', 1, 9],
  ['J', 8, 1],
  ['K', 5, 1],
  ['L', 1, 4],
  ['M', 3, 2],
  ['N', 1, 6],
  ['O', 1, 8],
  ['P', 3, 2],
  ['Q', 10, 1],
  ['R', 1, 6],
  ['S', 1, 4],
  ['T', 1, 6],
  ['U', 1, 4],
  ['V', 4, 2],
  ['W', 4, 2],
  ['X', 8, 1],
  ['Y', 4, 2],
  ['Z', 10, 1],
  [BLANK_LETTER, 0, 2],
];

// Square bonus predicates - ported 1:1 from pvcBoard.java / pvpBoard.java.
// NOTE: matching the original exactly, the centre star at (7,7) is its own
// category and is NOT also treated as a double-word square by isDoubleWord()
// (row 7 is deliberately excluded from that check in the source). We keep
// that faithfully rather than "fixing" it, since it's the scoring behaviour
// the original game actually has.

export function isCenter(row, col) {
  return row === CENTER && col === CENTER;
}

export function isDoubleLetter(row, col) {
  if (row === 0 || row === 14) {
    if (col === 3 || col === 11) return true;
  } else if (row === 2 || row === 12) {
    if (col === 6 || col === 8) return true;
  } else if (row === 3 || row === 11) {
    if (col === 0 || col === 7 || col === 14) return true;
  } else if (row === 6 || row === 8) {
    if (col === 2 || col === 6 || col === 8 || col === 12) return true;
  } else if (row === 7) {
    if (col === 3 || col === 11) return true;
  }
  return false;
}

export function isTripleLetter(row, col) {
  if (row === 1 || row === 13) {
    if (col === 5 || col === 9) return true;
  } else if (row === 5 || row === 9) {
    if (col === 1 || col === 5 || col === 9 || col === 13) return true;
  }
  return false;
}

export function isDoubleWord(row, col) {
  if ([1, 2, 3, 4, 10, 11, 12, 13].includes(row)) {
    if (col === BOARD_SIZE - 1 - row || col === row) return true;
  }
  return false;
}

export function isTripleWord(row, col) {
  if (row === 0 || row === 14) {
    if (col === 0 || col === 7 || col === 14) return true;
  } else if (row === 7) {
    if (col === 0 || col === 14) return true;
  }
  return false;
}

// Returns a short label for a square, used by the board UI.
export function squareBonusType(row, col) {
  if (isCenter(row, col)) return 'star';
  if (isTripleWord(row, col)) return 'tw';
  if (isDoubleWord(row, col)) return 'dw';
  if (isTripleLetter(row, col)) return 'tl';
  if (isDoubleLetter(row, col)) return 'dl';
  return null;
}
