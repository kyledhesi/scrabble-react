import React from 'react';
const TITLE_TILES = [
  ['S', 1],
  ['C', 3],
  ['R', 1],
  ['A', 1],
  ['B', 3],
  ['B', 3],
  ['L', 1],
  ['E', 1],
];

export default function MainMenu({ dispatch }) {
  return (
    <div className="menu-screen">
      <div className="menu-card">
        <div className="title-tiles" aria-label="Scrabble">
          {TITLE_TILES.map(([letter, score], i) => (
            <span className="title-tile" key={i} style={{ '--i': i }}>
              <span className="title-tile-letter">{letter}</span>
              <span className="title-tile-score">{score}</span>
            </span>
          ))}
        </div>
        <p className="menu-tagline">A word game of crosses, counters, and the occasional triple-word gamble.</p>

        <div className="menu-actions">
          <button className="menu-button" onClick={() => dispatch({ type: 'CHOOSE_MODE', mode: 'pvp' })}>
            <span className="menu-button-title">Player vs Player</span>
            <span className="menu-button-sub">Pass the board, take turns</span>
          </button>
          <button className="menu-button" onClick={() => dispatch({ type: 'CHOOSE_MODE', mode: 'pvc' })}>
            <span className="menu-button-title">Player vs DAWG</span>
            <span className="menu-button-sub">Challenge the built-in AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}
