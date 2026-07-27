import React, { useState } from 'react';
import { currentPlayerIndex, isGameOver } from '../game/reducer.js';
import Board from './Board.jsx';
import Rack from './Rack.jsx';
import SidePanel from './SidePanel.jsx';
import BlankTileModal from './BlankTileModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import GameOverModal from './GameOverModal.jsx';

export default function GameScreen({ state, dispatch }) {
  const [confirmBack, setConfirmBack] = useState(false);
  const [confirmEndGame, setConfirmEndGame] = useState(false);

  const currentIndex = currentPlayerIndex(state);
  const currentPlayer = state.players[currentIndex];
  const boardDisabled = !currentPlayer || currentPlayer.isAI || state.aiThinking;
  const gameOver = isGameOver(state);

  function handleSquareClick(row, col) {
    if (boardDisabled || state.pendingBlank) return;
    const tile = state.board[row][col];
    if (state.selectedTileId != null) {
      dispatch({ type: 'PLACE_TILE', row, col });
    } else if (tile && !tile.locked) {
      dispatch({ type: 'PICK_UP_TILE', row, col });
    }
  }

  function handleRackTileClick(tileId) {
    if (state.replaceMode) {
      dispatch({ type: 'TOGGLE_TILE_FOR_REPLACE', tileId });
    } else {
      dispatch({ type: 'SELECT_TILE', tileId });
    }
  }

  return (
    <div className="game-screen">
      <header className="game-header">
        <button type="button" className="back-link" onClick={() => setConfirmBack(true)}>
          &larr; Menu
        </button>
        <h1 className="game-title">Scrabble</h1>
        <div className="game-header-spacer" />
      </header>

      <div className="game-layout">
        <Board
          board={state.board}
          placedPositions={state.placedPositions}
          onSquareClick={handleSquareClick}
          disabled={boardDisabled}
        />
        <SidePanel
          state={state}
          currentIndex={currentIndex}
          onSubmit={() => dispatch({ type: 'SUBMIT_WORD' })}
          onClear={() => dispatch({ type: 'CLEAR_PLACEMENT' })}
          onToggleReplace={() => dispatch({ type: 'TOGGLE_REPLACE_MODE' })}
          onConfirmReplace={() => dispatch({ type: 'CONFIRM_REPLACE' })}
          onEndGame={() => setConfirmEndGame(true)}
        />
      </div>

      {currentPlayer && !currentPlayer.isAI && (
        <Rack
          rack={currentPlayer.rack}
          selectedTileId={state.selectedTileId}
          replaceMode={state.replaceMode}
          tilesToReplace={state.tilesToReplace}
          onTileClick={handleRackTileClick}
        />
      )}

      {state.pendingBlank && (
        <BlankTileModal
          onChoose={(letter) => dispatch({ type: 'CONFIRM_BLANK_LETTER', letter })}
          onCancel={() => dispatch({ type: 'CANCEL_BLANK' })}
        />
      )}

      {confirmBack && (
        <ConfirmModal
          title="Leave this game?"
          message="Returning to the menu will end the current game. This can't be undone."
          confirmLabel="Leave"
          onConfirm={() => dispatch({ type: 'BACK_TO_MENU' })}
          onCancel={() => setConfirmBack(false)}
        />
      )}

      {confirmEndGame && !gameOver && (
        <ConfirmModal
          title="End the game now?"
          message="Both players' final scores will be tallied, tile bag is empty so no one can draw further."
          confirmLabel="End game"
          onConfirm={() => {
            setConfirmEndGame(false);
            dispatch({ type: 'END_GAME_MANUAL' });
          }}
          onCancel={() => setConfirmEndGame(false)}
        />
      )}

      {gameOver && <GameOverModal state={state} dispatch={dispatch} />}
    </div>
  );
}
