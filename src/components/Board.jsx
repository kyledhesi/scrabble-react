import React from 'react';
import { BOARD_SIZE, squareBonusType } from '../game/constants.js';
import TileView from './TileView.jsx';

const BONUS_LABELS = {
  star: '★',
  tw: 'TW',
  dw: 'DW',
  tl: 'TL',
  dl: 'DL',
};

export default function Board({ board, placedPositions, onSquareClick, disabled }) {
  const placedSet = new Set(placedPositions.map((p) => `${p.row}:${p.col}`));

  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const tile = board[row][col];
      const bonus = squareBonusType(row, col);
      const isPlacedThisTurn = placedSet.has(`${row}:${col}`);
      cells.push(
        <button
          key={`${row}:${col}`}
          type="button"
          className={`square${bonus ? ` square--${bonus}` : ''}${isPlacedThisTurn ? ' square--pending' : ''}`}
          onClick={() => onSquareClick(row, col)}
          disabled={disabled}
          aria-label={tile ? `${tile.letter}, row ${row + 1} column ${col + 1}` : `row ${row + 1} column ${col + 1}`}
        >
          {tile ? (
            <TileView letter={tile.letter} score={tile.score} isBlank={tile.isBlank} pending={isPlacedThisTurn} />
          ) : (
            bonus && <span className="square-label">{BONUS_LABELS[bonus]}</span>
          )}
        </button>
      );
    }
  }

  return <div className="board">{cells}</div>;
}
