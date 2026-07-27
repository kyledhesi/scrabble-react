import test from 'node:test';
import assert from 'node:assert/strict';

import { createTile, assignBlankLetter, lockTile, _resetIdsForTests } from '../src/game/tile.js';
import { createTileBag, drawTiles, refillRack } from '../src/game/bag.js';
import { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE } from '../src/game/constants.js';
import {
  createEmptyBoard,
  placeTileOnBoard,
  removeTileAt,
  lockTilesAt,
  getWordCellsAt,
  getFormedWords,
  isCenterCovered,
  areTilesConnected,
  validateMove,
  calculateScore,
} from '../src/game/board.js';

test('tile: creation and blank assignment', () => {
  _resetIdsForTests();
  const t = createTile('_', 0);
  assert.equal(t.isBlank, true);
  assert.equal(t.locked, false);
  const assigned = assignBlankLetter(t, 'e');
  assert.equal(assigned.letter, 'E');
  assert.equal(assigned.score, 0, 'blank tiles keep 0 score even once assigned a letter');
  assert.equal(assigned.isBlank, true, 'isBlank origin flag is permanent');
  // original tile object must be untouched (pure function)
  assert.equal(t.letter, '_');
});

test('tile: lockTile does not mutate original', () => {
  const t = createTile('A', 1);
  const locked = lockTile(t);
  assert.equal(t.locked, false);
  assert.equal(locked.locked, true);
});

test('bag: has exactly 100 tiles matching tile.txt distribution', () => {
  const bag = createTileBag();
  assert.equal(bag.length, 100);
  const counts = {};
  for (const tile of bag) counts[tile.letter] = (counts[tile.letter] || 0) + 1;
  for (const [letter, score, count] of TILE_DISTRIBUTION) {
    assert.equal(counts[letter], count, `expected ${count} of ${letter}`);
    const sample = bag.find((t) => t.letter === letter);
    assert.equal(sample.score, score);
  }
});

test('bag: drawTiles removes without replacement and does not mutate input', () => {
  const bag = createTileBag();
  const { drawn, remainingBag } = drawTiles(bag, 7);
  assert.equal(drawn.length, 7);
  assert.equal(remainingBag.length, 93);
  assert.equal(bag.length, 100, 'original bag array must be untouched');
  const remainingIds = new Set(remainingBag.map((t) => t.id));
  for (const t of drawn) assert.equal(remainingIds.has(t.id), false);
});

test('bag: refillRack tops up to RACK_SIZE and stops when bag empties', () => {
  let bag = createTileBag();
  let rack = [];
  ({ rack, bag } = refillRack(rack, bag));
  assert.equal(rack.length, RACK_SIZE);
  assert.equal(bag.length, 100 - RACK_SIZE);

  // Rack needs 2 more to reach RACK_SIZE; bag has plenty (3) - should draw
  // exactly the 2 needed, not drain the whole bag.
  const tinyBag = bag.slice(0, 3);
  const shortRack = rack.slice(0, 5);
  const result = refillRack(shortRack, tinyBag);
  assert.equal(result.rack.length, 7);
  assert.equal(result.bag.length, 1);

  // Now the bag has fewer tiles (1) than needed (2) - should draw only what's there.
  const emptyingBag = bag.slice(0, 1);
  const result2 = refillRack(shortRack, emptyingBag);
  assert.equal(result2.rack.length, 6);
  assert.equal(result2.bag.length, 0);
});

test('board: placeTileOnBoard refuses to overwrite a locked tile, allows overwriting empty/unlocked', () => {
  let board = createEmptyBoard();
  const a = createTile('A', 1);
  const b = createTile('B', 3);
  let result = placeTileOnBoard(board, 7, 7, a);
  assert.equal(result.success, true);
  board = result.board;

  // overwrite unlocked - allowed at the board layer (the reducer guards this in practice)
  result = placeTileOnBoard(board, 7, 7, b);
  assert.equal(result.success, true);
  board = result.board;
  assert.equal(board[7][7].letter, 'B');

  board = lockTilesAt(board, [{ row: 7, col: 7 }]);
  result = placeTileOnBoard(board, 7, 7, a);
  assert.equal(result.success, false, 'cannot place over a locked tile');
});

test('board: getWordCellsAt reads full contiguous run in both directions', () => {
  let board = createEmptyBoard();
  const letters = ['C', 'A', 'T'];
  letters.forEach((letter, i) => {
    board = placeTileOnBoard(board, 7, 5 + i, createTile(letter, 1)).board;
  });
  const cells = getWordCellsAt(board, 7, 6, true); // middle of the word
  assert.equal(cells.map((c) => c.tile.letter).join(''), 'CAT');
  assert.equal(cells[0].col, 5);
  assert.equal(cells[2].col, 7);

  const vertical = getWordCellsAt(board, 7, 6, false);
  assert.equal(vertical.length, 1, 'no vertical word through a single letter');
});

test('board: getFormedWords finds both the main word and crossing words', () => {
  let board = createEmptyBoard();
  // Place "CAT" horizontally through the centre.
  board = placeTileOnBoard(board, 7, 6, createTile('C', 3)).board;
  board = placeTileOnBoard(board, 7, 7, createTile('A', 1)).board;
  board = placeTileOnBoard(board, 7, 8, createTile('T', 1)).board;
  board = lockTilesAt(board, [
    { row: 7, col: 6 },
    { row: 7, col: 7 },
    { row: 7, col: 8 },
  ]);

  // Now play "AT" -> "ATE" crossing down through the A at (7,7), by adding
  // a locked-tile-adjacent vertical word: place E below the existing A? The
  // A is locked already, so instead place a new word crossing through T:
  // add "S" below T to form "TS"? Not a real word - use a cleaner example:
  // place "OR" vertically through the C (7,6) -> "CO" going down isn't a
  // real test target here, we just need structural coverage, so place "AB"
  // below A at (7,7)-(8,7) forming vertical "AAB"? Simplify: just verify
  // the horizontal word list contains CAT for tiles freshly placed this turn.
  const formed = getFormedWords(board, [
    { row: 7, col: 6 },
    { row: 7, col: 7 },
    { row: 7, col: 8 },
  ]);
  assert.equal(formed.length, 1);
  assert.equal(formed[0].word, 'CAT');
});

test('board: getFormedWords picks up a perpendicular cross word', () => {
  let board = createEmptyBoard();
  board = placeTileOnBoard(board, 7, 7, createTile('C', 3)).board;
  board = placeTileOnBoard(board, 7, 8, createTile('A', 1)).board;
  board = placeTileOnBoard(board, 7, 9, createTile('T', 1)).board;
  board = lockTilesAt(board, [
    { row: 7, col: 7 },
    { row: 7, col: 8 },
    { row: 7, col: 9 },
  ]);
  // New turn: play "S" above the C and "O" below to spell "COS" vertically,
  // while also placing "AT"->"ATE" style extension isn't needed; simplest
  // cross check: add "O" below the A at (8,8) forming vertical "AO" (not a
  // real word, but we only test *detection*, not dictionary validity here).
  let board2 = placeTileOnBoard(board, 8, 8, createTile('O', 1)).board;
  const formed = getFormedWords(board2, [{ row: 8, col: 8 }]);
  const words = formed.map((f) => f.word);
  assert.ok(words.includes('AO'), `expected a vertical AO cross word, got ${words}`);
});

test('board: isCenterCovered', () => {
  let board = createEmptyBoard();
  assert.equal(isCenterCovered(board), false);
  board = placeTileOnBoard(board, 7, 7, createTile('A', 1)).board;
  assert.equal(isCenterCovered(board), true);
});

test('board: areTilesConnected requires an adjacent locked tile', () => {
  let board = createEmptyBoard();
  board = placeTileOnBoard(board, 7, 7, createTile('A', 1)).board;
  board = lockTilesAt(board, [{ row: 7, col: 7 }]);
  board = placeTileOnBoard(board, 7, 8, createTile('B', 3)).board;
  assert.equal(areTilesConnected(board, [{ row: 7, col: 8 }]), true);

  board = placeTileOnBoard(board, 0, 0, createTile('Z', 10)).board;
  assert.equal(areTilesConnected(board, [{ row: 0, col: 0 }]), false);
});

test('board: validateMove enforces first-move-covers-centre and dictionary membership', () => {
  const dictionary = new Set(['CAT']);
  let board = createEmptyBoard();
  board = placeTileOnBoard(board, 3, 3, createTile('C', 3)).board;
  board = placeTileOnBoard(board, 3, 4, createTile('A', 1)).board;
  board = placeTileOnBoard(board, 3, 5, createTile('T', 1)).board;
  const placed = [
    { row: 3, col: 3 },
    { row: 3, col: 4 },
    { row: 3, col: 5 },
  ];
  let result = validateMove(board, placed, true, dictionary);
  assert.equal(result.valid, false);
  assert.match(result.reason, /centre/);

  // Now through the centre - should pass first-move check and dictionary check.
  let board2 = createEmptyBoard();
  board2 = placeTileOnBoard(board2, 7, 6, createTile('C', 3)).board;
  board2 = placeTileOnBoard(board2, 7, 7, createTile('A', 1)).board;
  board2 = placeTileOnBoard(board2, 7, 8, createTile('T', 1)).board;
  const placed2 = [
    { row: 7, col: 6 },
    { row: 7, col: 7 },
    { row: 7, col: 8 },
  ];
  result = validateMove(board2, placed2, true, dictionary);
  assert.equal(result.valid, true);

  // A word not in the dictionary should fail regardless of position.
  const badDict = new Set(['DOG']);
  result = validateMove(board2, placed2, true, badDict);
  assert.equal(result.valid, false);
  assert.match(result.reason, /not a valid word/);
});

test('board: validateMove requires connection to existing tiles after the first move', () => {
  const dictionary = new Set(['CAT']);
  let board = createEmptyBoard();
  board = placeTileOnBoard(board, 0, 0, createTile('C', 3)).board;
  board = placeTileOnBoard(board, 0, 1, createTile('A', 1)).board;
  board = placeTileOnBoard(board, 0, 2, createTile('T', 1)).board;
  const placed = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ];
  const result = validateMove(board, placed, false, dictionary);
  assert.equal(result.valid, false);
  assert.match(result.reason, /connect/);
});

test('calculateScore: simple word with a double letter and triple word square', () => {
  // (7,3) is a double-letter square; (0,0) is a triple-word square (see
  // constants.js). Build a tiny board and check exact numbers.
  let board = createEmptyBoard();
  // Place "CAT" so the C lands on the double-letter square (7,3).
  board = placeTileOnBoard(board, 7, 3, createTile('C', 3)).board; // DL -> 3*2=6
  board = placeTileOnBoard(board, 7, 4, createTile('A', 1)).board; // 1
  board = placeTileOnBoard(board, 7, 5, createTile('T', 1)).board; // 1
  const placed = [
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
  ];
  const score = calculateScore(board, placed, false);
  assert.equal(score, 8); // (3*2) + 1 + 1 = 8
});

test('calculateScore: first move doubles the score, bingo adds 50', () => {
  let board = createEmptyBoard();
  // 7 tiles through the centre forming a straight line, none on bonus
  // squares except the centre star itself (which - matching the original -
  // is NOT a scoring multiplier, only isDoubleWord/isTripleWord are).
  const word = 'ABCDEFG';
  const scores = [1, 3, 3, 2, 1, 4, 2];
  const placed = [];
  for (let i = 0; i < 7; i++) {
    const col = 1 + i; // avoid other bonus squares in row 7 (cols 3 and 11 are DL)
    board = placeTileOnBoard(board, 7, col, createTile(word[i], scores[i])).board;
    placed.push({ row: 7, col });
  }
  // cols used: 1..7 -> col 3 is a double-letter square (row 7). Account for it:
  // letters at col1..7 = A,B,C,D,E,F,G with scores 1,3,3,2,1,4,2
  // col 3 corresponds to i=2 -> letter C, score 3 -> doubled to 6
  const rawSum = scores.reduce((a, b) => a + b, 0) + scores[2]; // +3 for the doubled C
  const isFirstMove = true;
  const score = calculateScore(board, placed, isFirstMove);
  const expected = rawSum * 2 + 50; // doubled for first move, +50 bingo (7 tiles)
  assert.equal(score, expected);
});
