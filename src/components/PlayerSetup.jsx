import React, { useState } from 'react';

export default function PlayerSetup({ mode, dispatch }) {
  const [playerOneName, setPlayerOneName] = useState('');
  const [playerTwoName, setPlayerTwoName] = useState('');
  const [error, setError] = useState(null);
  const isPvC = mode === 'pvc';

  function handleSubmit(e) {
    e.preventDefault();
    const p1 = playerOneName.trim();
    const p2 = isPvC ? 'DAWG' : playerTwoName.trim();

    if (!p1 || (!isPvC && !p2)) {
      setError('Please enter a name for every player.');
      return;
    }
    dispatch({ type: 'START_GAME', mode, playerOneName: p1, playerTwoName: p2 });
  }

  return (
    <div className="menu-screen">
      <form className="menu-card setup-card" onSubmit={handleSubmit}>
        <h1 className="setup-title">Who&rsquo;s playing?</h1>

        <label className="setup-field">
          <span>Player 1 name</span>
          <input
            autoFocus
            value={playerOneName}
            onChange={(e) => setPlayerOneName(e.target.value)}
            placeholder="Your name"
            maxLength={20}
          />
        </label>

        {!isPvC && (
          <label className="setup-field">
            <span>Player 2 name</span>
            <input
              value={playerTwoName}
              onChange={(e) => setPlayerTwoName(e.target.value)}
              placeholder="Their name"
              maxLength={20}
            />
          </label>
        )}

        {isPvC && (
          <p className="setup-ai-note">
            You&rsquo;ll be playing against <strong>DAWG</strong>, the built-in word-finding AI.
          </p>
        )}

        {error && <p className="setup-error">{error}</p>}

        <div className="setup-actions">
          <button type="button" className="menu-button-ghost" onClick={() => dispatch({ type: 'BACK_TO_MENU' })}>
            Back
          </button>
          <button type="submit" className="menu-button-primary">
            Start game
          </button>
        </div>
      </form>
    </div>
  );
}
