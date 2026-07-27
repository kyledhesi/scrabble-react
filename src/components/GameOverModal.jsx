import React from 'react';
import { getFinalScore } from '../game/reducer.js';

export default function GameOverModal({ state, dispatch }) {
  const finalScores = state.players.map((p) => ({ name: p.name, score: getFinalScore(state, p) }));
  const highest = Math.max(...finalScores.map((p) => p.score));
  const winners = finalScores.filter((p) => p.score === highest);
  const isTie = winners.length > 1;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Game over">
      <div className="modal game-over-modal">
        <h2>Game over</h2>
        <p className="winner-line">
          {isTie ? `It's a tie between ${winners.map((w) => w.name).join(' and ')}!` : `${winners[0].name} wins!`}
        </p>
        <ul className="final-scores">
          {finalScores.map((p) => (
            <li key={p.name}>
              <span>{p.name}</span>
              <span>{p.score}</span>
            </li>
          ))}
        </ul>
        <p className="final-scores-note">
          Final scores subtract the value of any tiles still left in each player&rsquo;s rack.
        </p>
        <button type="button" className="menu-button-primary" onClick={() => dispatch({ type: 'BACK_TO_MENU' })}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
