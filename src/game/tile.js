// Ported from model/Tile.java, as a plain immutable-ish data object instead
// of a class with a paired Swing TileGUI (the React components render tiles
// directly from this data).

import { BLANK_LETTER } from './constants.js';

let nextId = 0;

// Create a brand new tile. `letter` starts as '_' for blank tiles until the
// player assigns it a real letter (see assignBlankLetter below).
export function createTile(letter, score) {
  return {
    id: nextId++,
    letter,
    score,
    isBlank: letter === BLANK_LETTER, // fixed at creation time, never changes
    locked: false,
  };
}

// Reset the id counter - used only by tests so ids are deterministic run to run.
export function _resetIdsForTests() {
  nextId = 0;
}

export function isBlankTile(tile) {
  return tile.isBlank;
}

// Assigning a letter to a blank tile never changes its score (always 0),
// matching Tile.java's setLetter (score is untouched).
export function assignBlankLetter(tile, letter) {
  return { ...tile, letter: letter.toUpperCase() };
}

export function lockTile(tile) {
  return tile.locked ? tile : { ...tile, locked: true };
}
