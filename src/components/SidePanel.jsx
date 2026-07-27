import React from 'react';
export default function SidePanel({
  state,
  currentIndex,
  onSubmit,
  onClear,
  onToggleReplace,
  onConfirmReplace,
  onEndGame,
}) {
  const { players, bag, message, replaceMode, tilesToReplace, placedPositions, aiThinking } = state;
  const currentPlayer = players[currentIndex];
  const isHumanTurn = currentPlayer && !currentPlayer.isAI;

  return (
    <aside className="side-panel">
      <div className="player-cards">
        {players.map((player, i) => (
          <div key={player.name} className={`player-card${i === currentIndex ? ' player-card--active' : ''}`}>
            <span className="player-card-name">{player.name}</span>
            <span className="player-card-score">{player.score}</span>
            {i === currentIndex && <span className="player-card-turn">Turn</span>}
          </div>
        ))}
      </div>

      <div className="message-box">
        {aiThinking ? <p className="thinking">{currentPlayer.name} is thinking&hellip;</p> : <p>{message}</p>}
      </div>

      <div className="bag-count">
        <span>{bag.length}</span> tile{bag.length === 1 ? '' : 's'} left in the bag
      </div>

      {isHumanTurn && (
        <div className="turn-actions">
          {!replaceMode ? (
            <>
              <button type="button" className="menu-button-primary" onClick={onSubmit} disabled={placedPositions.length === 0}>
                Submit word
              </button>
              <button type="button" className="menu-button-ghost" onClick={onClear} disabled={placedPositions.length === 0}>
                Clear
              </button>
              <button
                type="button"
                className="menu-button-ghost"
                onClick={onToggleReplace}
                disabled={placedPositions.length > 0 || bag.length === 0}
                title={bag.length === 0 ? 'No tiles left in the bag to draw' : undefined}
              >
                Exchange tiles
              </button>
            </>
          ) : (
            <>
              <p className="exchange-hint">Select tiles above, then confirm ({tilesToReplace.length} selected).</p>
              <button type="button" className="menu-button-primary" onClick={onConfirmReplace} disabled={tilesToReplace.length === 0}>
                Confirm exchange
              </button>
              <button type="button" className="menu-button-ghost" onClick={onToggleReplace}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      <button type="button" className="end-game-link" onClick={onEndGame} disabled={bag.length > 0}>
        End game
      </button>
    </aside>
  );
}
