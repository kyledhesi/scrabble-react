import React from 'react';
import TileView from './TileView.jsx';

export default function Rack({ rack, selectedTileId, replaceMode, tilesToReplace, onTileClick }) {
  return (
    <div className="rack">
      {rack.map((tile) => (
        <TileView
          key={tile.id}
          letter={tile.letter}
          score={tile.score}
          isBlank={tile.isBlank}
          selected={replaceMode ? tilesToReplace.includes(tile.id) : selectedTileId === tile.id}
          onClick={() => onTileClick(tile.id)}
        />
      ))}
      {rack.length === 0 && <p className="rack-empty">Your rack is empty.</p>}
    </div>
  );
}
