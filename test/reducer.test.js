import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, createInitialState, getFinalScore, isGameOver } from '../src/game/reducer.js';
import { createTile } from '../src/game/tile.js';
import { createEmptyBoard } from '../src/game/board.js';

const DICTIONARY = new Set(['CAT', 'CATS', 'AT', 'TA', 'ATE', 'BAT']);

function baseGameState(overrides = {}) {
  const state = {
    ...createInitialState(),
    screen: 'game',
    mode: 'pvp',
    dictionary: DICTIONARY,
    letterTree: null,
    board: createEmptyBoard(),
    bag: [],
    turn: 0,
    players: [
      { name: 'Alice', isAI: false, score: 0, rack: [] },
      { name: 'Bob', isAI: false, score: 0, rack: [] },
    ],
    placedPositions: [],
    savedBoard: null,
  };
  return { ...state, ...overrides };
}

test('reducer: CHOOSE_MODE moves to setup screen with the chosen mode', () => {
  const state = gameReducer(createInitialState(), { type: 'CHOOSE_MODE', mode: 'pvc' });
  assert.equal(state.screen, 'setup');
  assert.equal(state.mode, 'pvc');
});

test('reducer: START_GAME deals 7 tiles to each player from a fresh 100-tile bag', () => {
  let state = createInitialState();
  state = gameReducer(state, { type: 'CHOOSE_MODE', mode: 'pvp' });
  state = gameReducer(state, {
    type: 'START_GAME',
    mode: 'pvp',
    playerOneName: 'Alice',
    playerTwoName: 'Bob',
  });
  assert.equal(state.screen, 'game');
  assert.equal(state.players[0].rack.length, 7);
  assert.equal(state.players[1].rack.length, 7);
  assert.equal(state.bag.length, 100 - 14);
  assert.equal(state.turn, 0);
  // no tile id should appear twice across both racks + bag
  const allIds = [...state.players[0].rack, ...state.players[1].rack, ...state.bag].map((t) => t.id);
  assert.equal(new Set(allIds).size, 100);
});

test('reducer: selecting and placing a tile moves it from rack to board', () => {
  const a = createTile('A', 1);
  let state = baseGameState({ players: [{ name: 'Alice', isAI: false, score: 0, rack: [a] }, { name: 'Bob', isAI: false, score: 0, rack: [] }] });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: a.id });
  assert.equal(state.selectedTileId, a.id);
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  assert.equal(state.board[7][7].letter, 'A');
  assert.equal(state.players[0].rack.length, 0);
  assert.deepEqual(state.placedPositions, [{ row: 7, col: 7 }]);
  assert.equal(state.selectedTileId, null);
});

test('reducer: cannot place over a locked tile', () => {
  const a = createTile('A', 1);
  const locked = { ...createTile('Z', 10), locked: true };
  let board = createEmptyBoard();
  board[7][7] = locked;
  let state = baseGameState({
    board,
    players: [{ name: 'Alice', isAI: false, score: 0, rack: [a] }, { name: 'Bob', isAI: false, score: 0, rack: [] }],
  });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: a.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  assert.equal(state.board[7][7], locked, 'locked tile must remain untouched');
  assert.equal(state.players[0].rack.length, 1, 'tile should not have left the rack');
});

test('reducer: placing a blank tile defers until a letter is confirmed', () => {
  const blank = createTile('_', 0);
  let state = baseGameState({
    players: [{ name: 'Alice', isAI: false, score: 0, rack: [blank] }, { name: 'Bob', isAI: false, score: 0, rack: [] }],
  });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: blank.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  assert.equal(state.board[7][7], null, 'nothing written to the board yet');
  assert.deepEqual(state.pendingBlank, { row: 7, col: 7, tileId: blank.id });
  assert.equal(state.players[0].rack.length, 1, 'blank tile stays in rack until confirmed');

  state = gameReducer(state, { type: 'CONFIRM_BLANK_LETTER', letter: 'e' });
  assert.equal(state.board[7][7].letter, 'E');
  assert.equal(state.board[7][7].score, 0, 'blank tiles always score 0 even once assigned');
  assert.equal(state.players[0].rack.length, 0);
  assert.deepEqual(state.placedPositions, [{ row: 7, col: 7 }]);
  assert.equal(state.pendingBlank, null);
});

test('reducer: cancelling a blank placement leaves no trace', () => {
  const blank = createTile('_', 0);
  let state = baseGameState({
    players: [{ name: 'Alice', isAI: false, score: 0, rack: [blank] }, { name: 'Bob', isAI: false, score: 0, rack: [] }],
  });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: blank.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  state = gameReducer(state, { type: 'CANCEL_BLANK' });
  assert.equal(state.board[7][7], null);
  assert.equal(state.pendingBlank, null);
  assert.equal(state.players[0].rack.length, 1, 'tile returns fully intact to the rack');
  assert.equal(state.placedPositions.length, 0);
});

test('reducer: picking a placed tile back up returns it to the rack', () => {
  const a = createTile('A', 1);
  let state = baseGameState({ players: [{ name: 'Alice', isAI: false, score: 0, rack: [a] }, { name: 'Bob', isAI: false, score: 0, rack: [] }] });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: a.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  state = gameReducer(state, { type: 'PICK_UP_TILE', row: 7, col: 7 });
  assert.equal(state.board[7][7], null);
  assert.equal(state.players[0].rack.length, 1);
  assert.equal(state.placedPositions.length, 0);
});

test('reducer: placing a second tile on an already-filled unlocked cell returns the first tile instead of losing it', () => {
  const a = createTile('A', 1);
  const b = createTile('B', 3);
  let state = baseGameState({ players: [{ name: 'Alice', isAI: false, score: 0, rack: [a, b] }, { name: 'Bob', isAI: false, score: 0, rack: [] }] });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: a.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: b.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  assert.equal(state.board[7][7].letter, 'B');
  const rackLetters = state.players[0].rack.map((t) => t.letter);
  assert.deepEqual(rackLetters, ['A'], 'tile A should have bounced back to the rack, not vanished');
});

test('reducer: CLEAR_PLACEMENT reverts the board and returns tiles to the rack', () => {
  const a = createTile('A', 1);
  const t = createTile('T', 1);
  let state = baseGameState({ players: [{ name: 'Alice', isAI: false, score: 0, rack: [a, t] }, { name: 'Bob', isAI: false, score: 0, rack: [] }] });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: a.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: t.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 8 });
  state = gameReducer(state, { type: 'CLEAR_PLACEMENT' });
  assert.equal(state.board[7][7], null);
  assert.equal(state.board[7][8], null);
  assert.equal(state.players[0].rack.length, 2);
  assert.equal(state.placedPositions.length, 0);
});

test('reducer: SUBMIT_WORD rejects an invalid move without changing the turn', () => {
  const z = createTile('Z', 10);
  let state = baseGameState({ players: [{ name: 'Alice', isAI: false, score: 0, rack: [z] }, { name: 'Bob', isAI: false, score: 0, rack: [] }] });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: z.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  state = gameReducer(state, { type: 'SUBMIT_WORD' });
  assert.equal(state.turn, 0, 'turn should not advance on an invalid word');
  assert.match(state.message, /Invalid move/);
  assert.equal(state.board[7][7].letter, 'Z', 'the attempted tile should remain on the board for another try');
});

test('reducer: SUBMIT_WORD accepts a valid first move, scores it, doubles it, refills the rack, advances the turn', () => {
  const c = createTile('C', 3);
  const a = createTile('A', 1);
  const t = createTile('T', 1);
  const spare = ['E', 'R', 'S', 'N'].map((l) => createTile(l, 1));
  const bag = [createTile('X', 8), createTile('Y', 4)];
  let state = baseGameState({
    bag,
    players: [
      { name: 'Alice', isAI: false, score: 0, rack: [c, a, t, ...spare] },
      { name: 'Bob', isAI: false, score: 0, rack: [] },
    ],
  });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: c.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 6 });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: a.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 7 });
  state = gameReducer(state, { type: 'SELECT_TILE', tileId: t.id });
  state = gameReducer(state, { type: 'PLACE_TILE', row: 7, col: 8 });

  state = gameReducer(state, { type: 'SUBMIT_WORD' });
  assert.equal(state.turn, 1, 'turn should advance to player two');
  // C(3)+A(1)+T(1) = 5, doubled for first move = 10
  assert.equal(state.players[0].score, 10);
  assert.equal(state.board[7][6].locked, true, 'placed tiles should now be locked');
  // rack had 4 left (E,R,S,N) after playing C,A,T; needs 3 to reach 7 but
  // the bag only has 2, so it tops up to 6, not a full 7.
  assert.equal(state.players[0].rack.length, 6, 'rack refills as far as the bag allows (only 2 tiles left in it)');
  assert.match(state.message, /CAT/);
});

test('reducer: exchanging tiles returns them to the bag, draws replacements, and passes the turn', () => {
  // A realistic full 7-tile rack, exchanging 2 of them.
  const oldTiles = ['Q', 'X', 'Z', 'F', 'H', 'V', 'W'].map((l) => createTile(l, 1));
  const bag = ['A', 'B', 'C', 'D', 'I', 'O'].map((l) => createTile(l, 1));
  let state = baseGameState({
    bag,
    players: [{ name: 'Alice', isAI: false, score: 0, rack: oldTiles }, { name: 'Bob', isAI: false, score: 0, rack: [] }],
  });
  state = gameReducer(state, { type: 'TOGGLE_REPLACE_MODE' });
  assert.equal(state.replaceMode, true);
  state = gameReducer(state, { type: 'TOGGLE_TILE_FOR_REPLACE', tileId: oldTiles[0].id }); // Q
  state = gameReducer(state, { type: 'TOGGLE_TILE_FOR_REPLACE', tileId: oldTiles[1].id }); // X
  state = gameReducer(state, { type: 'CONFIRM_REPLACE' });
  assert.equal(state.turn, 1, 'exchanging tiles should pass the turn');
  assert.equal(state.replaceMode, false);
  assert.equal(state.players[0].rack.length, 7, 'kept 5 + drew 2 replacements, back to a full rack');
  assert.ok(state.players[0].rack.some((t) => t.letter === 'Z'), 'the un-exchanged tiles should still be in the rack');
  assert.equal(state.bag.length, 6, 'started with 6, removed 2 drawn, added back the 2 exchanged');
});

test('reducer: exchanging tiles even with an empty bag still passes the turn (the only way to pass)', () => {
  const oldTiles = ['Q', 'X', 'Z', 'F', 'H', 'V', 'W'].map((l) => createTile(l, 1));
  let state = baseGameState({
    bag: [],
    players: [{ name: 'Alice', isAI: false, score: 0, rack: oldTiles }, { name: 'Bob', isAI: false, score: 0, rack: [] }],
  });
  state = gameReducer(state, { type: 'TOGGLE_REPLACE_MODE' });
  state = gameReducer(state, { type: 'TOGGLE_TILE_FOR_REPLACE', tileId: oldTiles[0].id });
  state = gameReducer(state, { type: 'CONFIRM_REPLACE' });
  assert.equal(state.turn, 1, 'still passes the turn even though the bag is empty');
  assert.equal(state.players[0].rack.length, 7, 'gets the same tile(s) straight back with nothing else to draw');
});

test('reducer: AI_MOVE_RESULT applies a found move, consumes matching rack tiles, and advances the turn', () => {
  let board = createEmptyBoard();
  board[7][6] = { ...createTile('C', 3), locked: true };
  board[7][7] = { ...createTile('A', 1), locked: true };
  board[7][8] = { ...createTile('T', 1), locked: true };
  const rack = ['S', 'E', 'R', 'O', 'N'].map((l) => createTile(l, 1));
  let state = baseGameState({
    board,
    turn: 1,
    bag: [createTile('L', 1)],
    players: [
      { name: 'Alice', isAI: false, score: 0, rack: [] },
      { name: 'DAWG', isAI: true, score: 0, rack },
    ],
  });

  // Simulate a move the AI "found": plays "RATS" vertically through the A,
  // reusing the locked A and placing R, T, S as new tiles (T isn't in the
  // rack here, so use letters actually available: build a small resultant
  // board using only rack letters plus the reused A).
  const moveBoard = { ...board, }; // will build manually below
  let mb = board.map((r) => r.slice());
  mb[6][7] = createTile('S', 1);
  mb[8][7] = createTile('O', 1);
  mb[9][7] = createTile('R', 1);
  const move = {
    word: 'SAOR',
    board: mb,
    placedPositions: [
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 9, col: 7 },
    ],
    score: 12,
  };

  state = gameReducer(state, { type: 'AI_MOVE_RESULT', move });
  assert.equal(state.turn, 2);
  assert.equal(state.players[1].score, 12);
  assert.equal(state.board[6][7].letter, 'S');
  assert.equal(state.board[6][7].locked, true);
  const remainingLetters = state.players[1].rack.map((t) => t.letter).sort();
  // started with S,E,R,O,N; used S, O, R; drew 1 replacement (L) since bag had 1
  assert.deepEqual(remainingLetters, ['E', 'L', 'N'].sort());
});

test('reducer: AI_MOVE_RESULT with no move passes the turn without scoring', () => {
  let state = baseGameState({ turn: 1, players: [{ name: 'Alice', isAI: false, score: 5, rack: [] }, { name: 'DAWG', isAI: true, score: 3, rack: [] }] });
  state = gameReducer(state, { type: 'AI_MOVE_RESULT', move: null });
  assert.equal(state.turn, 2);
  assert.equal(state.players[1].score, 3, 'score unchanged when no move is found');
  assert.match(state.message, /couldn't find a move/);
});

test('game over: bag empty + a player out of tiles ends the game; final score deducts remaining rack value', () => {
  const state = baseGameState({
    bag: [],
    players: [
      { name: 'Alice', isAI: false, score: 20, rack: [] },
      { name: 'Bob', isAI: false, score: 15, rack: [createTile('Q', 10), createTile('Z', 10)] },
    ],
  });
  assert.equal(isGameOver(state), true);
  assert.equal(getFinalScore(state, state.players[0]), 20);
  assert.equal(getFinalScore(state, state.players[1]), 15 - 20);
});

test('game not over: bag empty but both players still hold tiles', () => {
  const state = baseGameState({
    bag: [],
    players: [
      { name: 'Alice', isAI: false, score: 20, rack: [createTile('A', 1)] },
      { name: 'Bob', isAI: false, score: 15, rack: [createTile('Q', 10)] },
    ],
  });
  assert.equal(isGameOver(state), false);
  assert.equal(getFinalScore(state, state.players[0]), 20, 'no deduction while the game is still live');
});

test('reducer: BACK_TO_MENU resets to a fresh initial state but keeps the loaded dictionary', () => {
  const dict = new Set(['CAT']);
  let state = baseGameState({ dictionary: dict });
  state = gameReducer(state, { type: 'BACK_TO_MENU' });
  assert.equal(state.screen, 'menu');
  assert.equal(state.players.length, 0);
  assert.equal(state.dictionary, dict, 'dictionary should not need reloading after returning to menu');
});
