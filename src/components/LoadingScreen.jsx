import React from 'react';
export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-tile">
        <span className="loading-tile-letter">?</span>
      </div>
      <p>Shuffling the dictionary&hellip;</p>
    </div>
  );
}
