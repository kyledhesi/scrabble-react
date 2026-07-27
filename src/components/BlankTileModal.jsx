import React from 'react';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function BlankTileModal({ onChoose, onCancel }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose a letter for the blank tile">
      <div className="modal blank-modal">
        <h2>Choose a letter</h2>
        <p>This blank tile will score 0 points no matter which letter you pick.</p>
        <div className="letter-grid">
          {LETTERS.map((letter) => (
            <button key={letter} type="button" className="letter-grid-button" onClick={() => onChoose(letter)}>
              {letter}
            </button>
          ))}
        </div>
        <button type="button" className="menu-button-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
