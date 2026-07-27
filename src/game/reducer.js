// This is the React-side replacement for the state that used to live as
// mutable static fields split across ScrabbleMain / ScrabbleBoard / pvpBoard
// / pvcBoard. Everywhere the Java code called a static setter or mutated
// the shared board in place, this reducer instead returns a new state
// object - the usual React/Redux-style approach - but the actual rules
// (what a legal move is, how turns advance, how scoring works) are ported
// from that code, not reinvented.

import { RACK_SIZE } from './constants.js';
import { createTileBag, refillRack } from './bag.js';
import {
  createEmptyBoard,
  placeTileOnBoard,
  removeTileAt,
  lockTilesAt,
  validateMove,
  calculateScore,
} from './board.js';
import { assignBlankLetter } from './tile.js';

export function createInitialState() {
  return {
    screen: 'menu', // 'menu' | 'setup' | 'game'
    mode: null, // 'pvp' | 'pvc'
    dictionaryStatus: 'loading', // 'loading' | 'ready' | 'error'
    dictionaryError: null,

    board: createEmptyBoard(),
    bag: [],
    players: [], // [{ name, isAI, rack: Tile[], score: number }]
    turn: 0,

    placedPositions: [], // [{row, col}] placed this turn, not yet locked
    savedBoard: null, // board snapshot taken at the start of the turn, for "Clear"

    selectedTileId: null,
    pendingBlank: null, // { row, col } awaiting a letter choice
    replaceMode: false,
    tilesToReplace: [], // tile ids

    message: 'Place your first word on the centre star to begin.',
    lastWords: [],
    gameOver: false,
    aiThinking: false,
  };
}

function currentPlayerIndex(state) {
  return state.turn % 2;
}

function isFirstMove(state) {
  return state.turn === 0;
}

function isGameOver(state) {
  if (state.gameOver) return true;
  if (state.bag.length === 0) {
    return state.players.some((p) => p.rack.length === 0);
  }
  return false;
}

// Standard end-of-game adjustment: each player's own remaining rack value is
// deducted from their score (mirrors the tile-deduction the Java project's
// declareWinner() computed, but wired up as a derived display value instead
// of a stateful mutation - see game/reducer.js README note in the project docs).
export function getFinalScore(state, player) {
  if (!isGameOver(state)) return player.score;
  const rackValue = player.rack.reduce((sum, t) => sum + t.score, 0);
  return player.score - rackValue;
}

function updatePlayer(players, index, patch) {
  return players.map((p, i) => (i === index ? { ...p, ...patch } : p));
}

function clearTurnState(state) {
  return {
    ...state,
    placedPositions: [],
    savedBoard: null,
    selectedTileId: null,
    pendingBlank: null,
    replaceMode: false,
    tilesToReplace: [],
  };
}

function advanceTurn(state) {
  const over = isGameOver(state);
  return {
    ...clearTurnState(state),
    board: lockTilesAt(state.board, state.placedPositions),
    turn: state.turn + 1,
    gameOver: over,
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'DICTIONARY_READY':
      return { ...state, dictionaryStatus: 'ready', dictionary: action.dictionary, letterTree: action.letterTree };

    case 'DICTIONARY_ERROR':
      return { ...state, dictionaryStatus: 'error', dictionaryError: action.error };

    case 'CHOOSE_MODE':
      return { ...state, screen: 'setup', mode: action.mode };

    case 'BACK_TO_MENU':
      return { ...createInitialState(), dictionaryStatus: state.dictionaryStatus, dictionary: state.dictionary, letterTree: state.letterTree };

    case 'START_GAME': {
      const bag = createTileBag();
      // Players draw from the same shrinking bag in sequence, mirroring
      // Player.generateRack being called once per player at setup time.
      const rackDraw1 = refillRack([], bag);
      const rackDraw2 = refillRack([], rackDraw1.bag);
      return {
        ...state,
        screen: 'game',
        board: createEmptyBoard(),
        bag: rackDraw2.bag,
        turn: 0,
        placedPositions: [],
        savedBoard: null,
        message: 'Place your first word on the centre star to begin.',
        lastWords: [],
        gameOver: false,
        players: [
          { name: action.playerOneName, isAI: false, rack: rackDraw1.rack, score: 0 },
          { name: action.playerTwoName, isAI: action.mode === 'pvc', rack: rackDraw2.rack, score: 0 },
        ],
      };
    }

    case 'SELECT_TILE': {
      if (state.replaceMode) return state;
      const isSame = state.selectedTileId === action.tileId;
      return { ...state, selectedTileId: isSame ? null : action.tileId };
    }

    case 'PLACE_TILE': {
      const { row, col } = action;
      if (state.replaceMode || state.selectedTileId == null) return state;
      const playerIndex = currentPlayerIndex(state);
      const player = state.players[playerIndex];
      const tile = player.rack.find((t) => t.id === state.selectedTileId);
      if (!tile) return state;

      const existing = state.board[row][col];
      if (existing && existing.locked) return state; // can't place over a locked tile

      const savedBoard = state.savedBoard ?? state.board;

      // If the target cell already holds a tile placed earlier this same
      // turn, return that tile to the rack first rather than silently
      // losing it (the original Java could silently orphan a tile here).
      let board = state.board;
      let rack = player.rack;
      let placedPositions = state.placedPositions;
      if (existing && !existing.locked) {
        board = removeTileAt(board, row, col);
        rack = [...rack, existing];
        placedPositions = placedPositions.filter((p) => !(p.row === row && p.col === col));
      }

      if (tile.isBlank && tile.letter === '_') {
        // Defer the actual placement until a letter is chosen - nothing is
        // written to the board yet, so cancelling leaves no trace.
        return {
          ...state,
          board,
          savedBoard,
          placedPositions,
          players: updatePlayer(state.players, playerIndex, { rack }),
          pendingBlank: { row, col, tileId: tile.id },
        };
      }

      const placed = placeTileOnBoard(board, row, col, tile);
      if (!placed.success) return state;
      rack = rack.filter((t) => t.id !== tile.id);

      return {
        ...state,
        board: placed.board,
        savedBoard,
        placedPositions: [...placedPositions, { row, col }],
        selectedTileId: null,
        players: updatePlayer(state.players, playerIndex, { rack }),
      };
    }

    case 'CONFIRM_BLANK_LETTER': {
      if (!state.pendingBlank) return state;
      const { row, col, tileId } = state.pendingBlank;
      const playerIndex = currentPlayerIndex(state);
      const player = state.players[playerIndex];
      const tile = player.rack.find((t) => t.id === tileId);
      if (!tile) return { ...state, pendingBlank: null };

      const assigned = assignBlankLetter(tile, action.letter);
      const placed = placeTileOnBoard(state.board, row, col, assigned);
      if (!placed.success) return { ...state, pendingBlank: null };

      return {
        ...state,
        board: placed.board,
        placedPositions: [...state.placedPositions, { row, col }],
        selectedTileId: null,
        pendingBlank: null,
        players: updatePlayer(state.players, playerIndex, {
          rack: player.rack.filter((t) => t.id !== tileId),
        }),
      };
    }

    case 'CANCEL_BLANK':
      return { ...state, pendingBlank: null, selectedTileId: null };

    case 'PICK_UP_TILE': {
      const { row, col } = action;
      const existing = state.board[row][col];
      if (!existing || existing.locked) return state;
      const playerIndex = currentPlayerIndex(state);
      const board = removeTileAt(state.board, row, col);
      return {
        ...state,
        board,
        placedPositions: state.placedPositions.filter((p) => !(p.row === row && p.col === col)),
        players: updatePlayer(state.players, playerIndex, {
          rack: [...state.players[playerIndex].rack, existing],
        }),
      };
    }

    case 'CLEAR_PLACEMENT': {
      if (state.placedPositions.length === 0 && !state.replaceMode) return state;
      const playerIndex = currentPlayerIndex(state);
      const player = state.players[playerIndex];
      const board = state.savedBoard ?? state.board;

      // Collect the actual tile objects sitting at each placed position
      // before we discard the board, so they go back to the rack.
      const returned = state.placedPositions
        .map(({ row, col }) => state.board[row][col])
        .filter(Boolean);

      return {
        ...clearTurnState(state),
        board,
        message: 'Submit a word: ',
        players: updatePlayer(state.players, playerIndex, {
          rack: [...player.rack, ...returned],
        }),
      };
    }

    case 'TOGGLE_REPLACE_MODE': {
      if (state.placedPositions.length > 0) return state; // must clear placement first
      return {
        ...state,
        replaceMode: !state.replaceMode,
        tilesToReplace: [],
        message: state.replaceMode ? 'Submit a word: ' : 'Select the tiles you want to exchange.',
      };
    }

    case 'TOGGLE_TILE_FOR_REPLACE': {
      const has = state.tilesToReplace.includes(action.tileId);
      return {
        ...state,
        tilesToReplace: has
          ? state.tilesToReplace.filter((id) => id !== action.tileId)
          : [...state.tilesToReplace, action.tileId],
      };
    }

    case 'CONFIRM_REPLACE': {
      // Note: this is allowed even when the bag is empty - with nothing to
      // draw, it just reshuffles the same tiles back, but it still ends
      // the turn. There's no dedicated "pass" action (matching the
      // original), so this doubles as the only way to skip a turn when no
      // word can be formed.
      if (state.tilesToReplace.length === 0) return state;
      const playerIndex = currentPlayerIndex(state);
      const player = state.players[playerIndex];
      const toReplace = player.rack.filter((t) => state.tilesToReplace.includes(t.id));
      const kept = player.rack.filter((t) => !state.tilesToReplace.includes(t.id));
      const bagWithReturns = [...state.bag, ...toReplace];
      const { rack: newRack, bag: newBag } = refillRack(kept, bagWithReturns);

      const withNewRack = {
        ...state,
        bag: newBag,
        players: updatePlayer(state.players, playerIndex, { rack: newRack }),
        message: `${player.name} exchanged ${toReplace.length} tile${toReplace.length === 1 ? '' : 's'}.`,
      };
      return advanceTurn(withNewRack);
    }

    case 'SUBMIT_WORD': {
      const playerIndex = currentPlayerIndex(state);
      const player = state.players[playerIndex];
      const firstMove = isFirstMove(state);
      const result = validateMove(state.board, state.placedPositions, firstMove, state.dictionary);

      if (!result.valid) {
        return { ...state, message: `Invalid move - ${result.reason}` };
      }

      const score = calculateScore(state.board, state.placedPositions, firstMove);
      const { rack: refilledRack, bag: newBag } = refillRack(
        player.rack,
        state.bag
      );
      const wordList = result.words.map((w) => w.word).join(', ');

      const withScore = {
        ...state,
        bag: newBag,
        message: `${player.name} played ${wordList} for ${score} points.`,
        lastWords: result.words.map((w) => w.word),
        players: updatePlayer(state.players, playerIndex, {
          score: player.score + score,
          rack: refilledRack,
        }),
      };
      return advanceTurn(withScore);
    }

    case 'AI_THINKING':
      return { ...state, aiThinking: true };

    case 'AI_MOVE_RESULT': {
      const playerIndex = currentPlayerIndex(state);
      const player = state.players[playerIndex];
      const { move } = action;

      if (!move) {
        return advanceTurn({
          ...state,
          aiThinking: false,
          message: `${player.name} couldn't find a move and passed.`,
        });
      }

      const usedTileLetters = move.placedPositions.map(({ row, col }) => move.board[row][col].letter);
      // Remove one rack tile per newly-placed letter (matches original:
      // the AI consumes exactly the rack tiles it used).
      let rack = player.rack.slice();
      for (const letter of usedTileLetters) {
        const idx = rack.findIndex((t) => t.letter === letter);
        if (idx !== -1) rack.splice(idx, 1);
      }
      const { rack: refilledRack, bag: newBag } = refillRack(rack, state.bag);

      const withScore = {
        ...state,
        aiThinking: false,
        board: move.board,
        placedPositions: move.placedPositions,
        bag: newBag,
        message: `${player.name} played ${move.word} for ${move.score} points.`,
        lastWords: [move.word],
        players: updatePlayer(state.players, playerIndex, {
          score: player.score + move.score,
          rack: refilledRack,
        }),
      };
      return advanceTurn(withScore);
    }

    case 'END_GAME_MANUAL':
      return { ...state, gameOver: true, message: 'Game ended.' };

    default:
      return state;
  }
}

export { currentPlayerIndex, isFirstMove, isGameOver };
