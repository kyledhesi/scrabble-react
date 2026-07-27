// Renders every major screen/state combination through react-dom/server to
// catch runtime errors (undefined props, bad conditionals, missing keys,
// etc.) that a pure bundler check can't - there's no browser available in
// this environment, so this is the strongest pre-delivery check available
// for the component tree itself. It won't catch click-handler wiring bugs
// (there's no DOM/event system here), but it exercises every render branch.
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { createInitialState, gameReducer } from '../src/game/reducer.js';
import { createTile } from '../src/game/tile.js';
import { createEmptyBoard, placeTileOnBoard, lockTilesAt } from '../src/game/board.js';

import MainMenu from '../src/components/MainMenu.jsx';
import PlayerSetup from '../src/components/PlayerSetup.jsx';
import LoadingScreen from '../src/components/LoadingScreen.jsx';
import GameScreen from '../src/components/GameScreen.jsx';
import BlankTileModal from '../src/components/BlankTileModal.jsx';
import ConfirmModal from '../src/components/ConfirmModal.jsx';
import GameOverModal from '../src/components/GameOverModal.jsx';

const noop = () => {};
let failures = 0;

function check(label, element) {
  try {
    const html = renderToStaticMarkup(element);
    if (!html || html.length < 10) throw new Error('rendered output looks empty');
    console.log(`OK   ${label} (${html.length} chars)`);
  } catch (err) {
    failures++;
    console.log(`FAIL ${label}`);
    console.error(err);
  }
}

check('MainMenu', React.createElement(MainMenu, { dispatch: noop }));
check('PlayerSetup (pvp)', React.createElement(PlayerSetup, { mode: 'pvp', dispatch: noop }));
check('PlayerSetup (pvc)', React.createElement(PlayerSetup, { mode: 'pvc', dispatch: noop }));
check('LoadingScreen', React.createElement(LoadingScreen));

// Build a realistic mid-game state.
let board = createEmptyBoard();
board = placeTileOnBoard(board, 7, 6, createTile('C', 3)).board;
board = placeTileOnBoard(board, 7, 7, createTile('A', 1)).board;
board = placeTileOnBoard(board, 7, 8, createTile('T', 1)).board;
board = lockTilesAt(board, [
  { row: 7, col: 6 },
  { row: 7, col: 7 },
  { row: 7, col: 8 },
]);
const midGameState = {
  ...createInitialState(),
  screen: 'game',
  mode: 'pvc',
  dictionaryStatus: 'ready',
  dictionary: new Set(['CAT']),
  board,
  bag: [createTile('Q', 10)],
  turn: 1,
  players: [
    { name: 'Alice', isAI: false, score: 10, rack: ['D', 'O', 'G', 'S', 'E', 'R', 'N'].map((l) => createTile(l, 1)) },
    { name: 'DAWG', isAI: true, score: 0, rack: ['X', 'Y', 'Z', 'W', 'V', 'U', 'I'].map((l) => createTile(l, 1)) },
  ],
  placedPositions: [],
};
check('GameScreen (mid-game, human turn)', React.createElement(GameScreen, { state: midGameState, dispatch: noop }));

const aiTurnState = { ...midGameState, turn: 0, aiThinking: true };
check('GameScreen (AI thinking)', React.createElement(GameScreen, { state: aiTurnState, dispatch: noop }));

const withPlacedTiles = {
  ...midGameState,
  placedPositions: [{ row: 6, col: 7 }],
  board: placeTileOnBoard(midGameState.board, 6, 7, createTile('S', 1)).board,
};
check('GameScreen (tile placed, pending submit)', React.createElement(GameScreen, { state: withPlacedTiles, dispatch: noop }));

const replaceModeState = { ...midGameState, replaceMode: true, tilesToReplace: [midGameState.players[0].rack[0].id] };
check('GameScreen (replace mode)', React.createElement(GameScreen, { state: replaceModeState, dispatch: noop }));

const pendingBlankState = { ...midGameState, pendingBlank: { row: 6, col: 7, tileId: 999 } };
check('GameScreen (blank modal open)', React.createElement(GameScreen, { state: pendingBlankState, dispatch: noop }));

const gameOverState = {
  ...midGameState,
  gameOver: true,
  bag: [],
  players: [
    { name: 'Alice', isAI: false, score: 40, rack: [] },
    { name: 'DAWG', isAI: true, score: 35, rack: [createTile('Q', 10)] },
  ],
};
check('GameScreen (game over)', React.createElement(GameScreen, { state: gameOverState, dispatch: noop }));

check('BlankTileModal', React.createElement(BlankTileModal, { onChoose: noop, onCancel: noop }));
check('ConfirmModal', React.createElement(ConfirmModal, { title: 'Test', message: 'Test message', onConfirm: noop, onCancel: noop }));
check(
  'GameOverModal (tie)',
  React.createElement(GameOverModal, {
    state: { ...gameOverState, players: [{ name: 'A', isAI: false, score: 10, rack: [] }, { name: 'B', isAI: false, score: 10, rack: [] }] },
    dispatch: noop,
  })
);

// Exercise the reducer through a realistic dispatch sequence too, using the
// real (already-tested) reducer directly, to make sure App.jsx's usage
// pattern (useReducer + createInitialState) is wired correctly.
let state = createInitialState();
state = gameReducer(state, { type: 'CHOOSE_MODE', mode: 'pvc' });
state = gameReducer(state, { type: 'START_GAME', mode: 'pvc', playerOneName: 'Alice', playerTwoName: 'DAWG' });
check('GameScreen (freshly started real game state)', React.createElement(GameScreen, { state, dispatch: noop }));

console.log(failures === 0 ? '\nAll component renders succeeded.' : `\n${failures} component(s) failed to render.`);
process.exit(failures === 0 ? 0 : 1);
