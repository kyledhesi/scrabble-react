import React from 'react';
export default function TileView({ letter, score, isBlank, pending, selected, onClick }) {
  const classes = ['tile'];
  if (isBlank) classes.push('tile--blank');
  if (pending) classes.push('tile--pending');
  if (selected) classes.push('tile--selected');
  if (onClick) classes.push('tile--interactive');

  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      className={classes.join(' ')}
      onClick={onClick}
    >
      <span className="tile-letter">{letter === '_' ? '' : letter}</span>
      <span className="tile-score">{score}</span>
    </Element>
  );
}
