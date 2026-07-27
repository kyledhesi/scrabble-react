import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseDictionary } from '../src/game/dictionary.js';
import { buildLetterTree } from '../src/game/letterTree.js';
import { createTile } from '../src/game/tile.js';
import {
  createEmptyBoard,
  placeTileOnBoard,
  lockTilesAt,
  validateMove,
} from '../src/game/board.js';
import { findBestMove, generatePossibleWords, getLockedTiles } from '../src/game/aiPlayer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dictText = readFileSync(path.join(__dirname, '../public/dictionary.txt'), 'utf-8');

test('parseDictionary: real file parses to exactly 279,496 unique words, all A-Z', () => {
  const dict = parseDictionary(dictText);
  assert.equal(dict.size, 279496);
  assert.equal(dict.has('SCRABBLE'), true);
  assert.equal(dict.has('AAHED'), true);
  assert.equal(dict.has('ZYTHUM'), true);
  assert.equal(dict.has('ZZZS'), true, 'last line (no trailing newline in source file) must still be parsed');
  for (const w of dict) {
    assert.match(w, /^[A-Z]+$/, `word "${w}" should be pure A-Z`);
    break; // spot check is enough; full scan below
  }
  let bad = 0;
  for (const w of dict) if (!/^[A-Z]+$/.test(w)) bad++;
  assert.equal(bad, 0);
});

// Build once and reuse across tests below (trie construction over ~280k
// words - timed so we know it's viable to do on app startup in a browser).
const dictionary = parseDictionary(dictText);
const t0 = Date.now();
const letterTree = buildLetterTree(dictionary);
const buildMs = Date.now() - t0;
console.log(`  (letter tree build time: ${buildMs}ms for ${dictionary.size} words)`);

test('LetterTree: isWord matches the dictionary Set exactly for a sample', () => {
  const sample = ['CAT', 'CATS', 'SCRABBLE', 'ZYTHUM', 'NOTAREALWORD', 'QI', 'ZZZS', ''];
  for (const w of sample) {
    assert.equal(letterTree.isWord(w), dictionary.has(w), `mismatch for "${w}"`);
  }
});

test('LetterTree: wordsContainingLetter finds real words and only real words', () => {
  // Letters available: C, A, T, S, E, R (rack-like set) with anchor 'A'.
  const letters = ['C', 'A', 'T', 'S', 'E', 'R'];
  const found = letterTree.wordsContainingLetter(letters, 'A');
  assert.ok(found.has('CAT'));
  assert.ok(found.has('CATS'));
  assert.ok(found.has('CARTS'), 'CARTS uses C,A,R,T,S - each available once, should be found');
  for (const w of found) {
    assert.equal(dictionary.has(w), true, `"${w}" should be a real dictionary word`);
    assert.ok(w.includes('A'), `"${w}" should contain the anchor letter A`);
    // every letter used at most as many times as available
    const counts = {};
    for (const ch of w) counts[ch] = (counts[ch] || 0) + 1;
    const avail = {};
    for (const ch of letters) avail[ch] = (avail[ch] || 0) + 1;
    for (const ch of Object.keys(counts)) {
      assert.ok(counts[ch] <= (avail[ch] || 0), `"${w}" uses ${ch} more times than available`);
    }
  }
});

test('LetterTree: pruned search matches brute-force permutation search on a small case', () => {
  // Cross-check the optimisation against a direct port of the *original*
  // Java algorithm's semantics (full permutation generation) for a small
  // letter set, to make sure pruning didn't change the result set.
  function bruteForce(letters, lockedLetter) {
    const words = new Set();
    function helper(prefix, remaining) {
      if (prefix && letterTree.isWord(prefix) && prefix.includes(lockedLetter)) {
        words.add(prefix);
      }
      for (let i = 0; i < remaining.length; i++) {
        const rest = remaining.slice(0, i).concat(remaining.slice(i + 1));
        helper(prefix + remaining[i], rest);
      }
    }
    helper('', letters);
    return words;
  }

  const letters = ['C', 'A', 'T', 'S', 'E'];
  const optimized = letterTree.wordsContainingLetter(letters, 'A');
  const brute = bruteForce(letters, 'A');
  assert.deepEqual([...optimized].sort(), [...brute].sort());
});

test('AI: findBestMove plays a valid, scoring first-response move on an opening board', () => {
  // Board with just "CAT" locked through the centre (as if player one had
  // just played it), AI to move next with a hand-picked rack.
  let board = createEmptyBoard();
  board = placeTileOnBoard(board, 7, 6, createTile('C', 3)).board;
  board = placeTileOnBoard(board, 7, 7, createTile('A', 1)).board;
  board = placeTileOnBoard(board, 7, 8, createTile('T', 1)).board;
  board = lockTilesAt(board, [
    { row: 7, col: 6 },
    { row: 7, col: 7 },
    { row: 7, col: 8 },
  ]);

  const rack = ['S', 'E', 'R', 'O', 'N', 'D', 'L'].map((l) => createTile(l, 1));
  assert.equal(getLockedTiles(board).length, 3);
  const words = generatePossibleWords(board, rack, letterTree);
  assert.ok(words.size > 0, 'should find at least one candidate word touching a locked letter');

  const { move, timeUp } = findBestMove(board, rack, dictionary, letterTree, 4000);
  assert.ok(move, 'AI should find a legal move from a rich rack against CAT');
  assert.ok(move.score > 0);
  // Re-validate independently to make sure findBestMove's internal
  // validation isn't rubber-stamping something illegal.
  const check = validateMove(move.board, move.placedPositions, false, dictionary);
  assert.equal(check.valid, true, `AI-chosen move should independently validate: ${check.reason}`);
  console.log(`  (AI chose "${move.word}" for ${move.score} points, timeUp=${timeUp})`);
});

test('AI: findBestMove returns no move when no legal word can be formed', () => {
  // Use a tiny closed-world dictionary (just CAT and DOG) so "no legal
  // move" is guaranteed, rather than assuming a huge real Scrabble
  // dictionary has no obscure word for a given letter set - it turns out
  // e.g. Collins Scrabble Words does have a play for Q/X/Z/W/V/J/K against
  // "CAT" (ZAX, crossing through the shared A), so that's not a safe
  // real-dictionary assumption to test against.
  const miniDict = new Set(['CAT', 'DOG']);
  const miniTree = buildLetterTree(miniDict);

  let board = createEmptyBoard();
  board = placeTileOnBoard(board, 7, 6, createTile('C', 3)).board;
  board = placeTileOnBoard(board, 7, 7, createTile('A', 1)).board;
  board = placeTileOnBoard(board, 7, 8, createTile('T', 1)).board;
  board = lockTilesAt(board, [
    { row: 7, col: 6 },
    { row: 7, col: 7 },
    { row: 7, col: 8 },
  ]);
  const rack = ['Q', 'X', 'Z', 'W', 'V', 'J', 'K'].map((l) => createTile(l, 1));
  const { move } = findBestMove(board, rack, miniDict, miniTree, 2000);
  assert.equal(move, null, 'DOG cannot connect to CAT and no other word exists in the mini dictionary');
});

test('AI: findBestMove performs within a reasonable time on a fuller mid-game board', () => {
  // Build a denser board (several locked words) to stress-test search time.
  let board = createEmptyBoard();
  const placements = [
    ['C', 7, 6], ['A', 7, 7], ['T', 7, 8],
    ['S', 6, 7], ['O', 5, 7], ['R', 4, 7],
    ['B', 7, 5], ['E', 8, 6], ['D', 9, 6],
  ];
  const locked = [];
  for (const [letter, row, col] of placements) {
    board = placeTileOnBoard(board, row, col, createTile(letter, 1)).board;
    locked.push({ row, col });
  }
  board = lockTilesAt(board, locked);

  const rack = ['N', 'G', 'I', 'L', 'P', 'U', 'M'].map((l) => createTile(l, 1));
  const start = Date.now();
  const { move, timeUp } = findBestMove(board, rack, dictionary, letterTree, 4000);
  const elapsed = Date.now() - start;
  console.log(`  (mid-game search took ${elapsed}ms, found=${!!move}, timeUp=${timeUp})`);
  assert.ok(elapsed < 5000, 'search should respect its time budget');
  if (move) {
    const check = validateMove(move.board, move.placedPositions, false, dictionary);
    assert.equal(check.valid, true);
  }
});
