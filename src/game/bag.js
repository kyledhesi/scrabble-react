// Ported from controller/ScrabbleMain.java#createTileBag and the draw logic
// scattered across model/Player.java (generateRack / refillRack / replaceTiles).

import { TILE_DISTRIBUTION, RACK_SIZE } from './constants.js';
import { createTile } from './tile.js';

// Build a full 100-tile bag from the standard distribution (tile.txt).
export function createTileBag() {
  const bag = [];
  for (const [letter, score, count] of TILE_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      bag.push(createTile(letter, score));
    }
  }
  return bag;
}

// Draws `count` tiles at random (without replacement) from the bag.
// Returns { drawn, remainingBag } - does not mutate the input array.
export function drawTiles(bag, count) {
  const remainingBag = bag.slice();
  const drawn = [];
  const n = Math.min(count, remainingBag.length);
  for (let i = 0; i < n; i++) {
    const index = Math.floor(Math.random() * remainingBag.length);
    drawn.push(remainingBag.splice(index, 1)[0]);
  }
  return { drawn, remainingBag };
}

// Fills a rack up to RACK_SIZE (mirrors Player.generateRack/refillRack - both
// just draw until the rack has 7 tiles or the bag runs dry).
export function refillRack(rack, bag) {
  const needed = RACK_SIZE - rack.length;
  if (needed <= 0 || bag.length === 0) {
    return { rack, bag };
  }
  const { drawn, remainingBag } = drawTiles(bag, needed);
  return { rack: rack.concat(drawn), bag: remainingBag };
}
