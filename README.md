# Scrabble (React)

A full browser Scrabble board - play a friend locally (pass-and-play), or
challenge **DAWG**, a built-in word-finding AI. This is a from-scratch React
port of a Java Swing desktop project (`Scrabble-AI`): the UI framework
changed completely, but the rules, board layout, tile distribution,
dictionary, and AI search strategy are all ported from the original code,
not reinvented.

## Running it

This is a standard [Vite](https://vite.dev) + React project.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

Other scripts:

```bash
npm run build      # production build -> dist/
npm run preview    # serve that production build locally
npm test           # run the game-engine test suite (no browser needed)
```

### Alternative build (no Vite)

If you'd rather not pull in the full Vite toolchain, `build.mjs` is a small
standalone build script using [esbuild](https://esbuild.github.io) directly:

```bash
npm install esbuild --no-save   # only esbuild itself, nothing else
node build.mjs
npx serve dist                  # or: python3 -m http.server -d dist
```

Either build produces the same app - `npm run build` and `node build.mjs`
are two paths to the same `dist/` output, pick whichever you'd rather have
installed.

**Note:** whichever way you build it, open the printed `http://localhost`
URL rather than double-clicking `dist/index.html` directly. Like any
bundled JS app (this one included), browsers block module scripts and
`fetch()` from `file://` pages - it needs to be served, even just locally.

## Project structure

```
src/
  game/            Pure game logic - no React here at all.
    constants.js     Board size, tile distribution, bonus-square layout
    tile.js          Tile creation/blank-letter assignment
    bag.js           Tile bag creation, drawing, rack refilling
    board.js         Board state, word-finding, move validation, scoring
    dictionary.js    Loads dictionary.txt into a Set
    letterTree.js    Trie used by the AI to search for playable words
    aiPlayer.js      AI move search
    reducer.js       Combines the above into the app's state machine
  components/      React components (presentational + a bit of local UI state)
  App.jsx          Loads the dictionary, wires up the AI-turn effect
  main.jsx         Entry point
public/
  dictionary.txt   The word list (unchanged from the original project)
test/
  *.test.js        Engine + reducer unit tests (node --test)
  ssr-smoke.mjs    Renders every screen/state via react-dom/server
```

The `game/` folder has no dependency on React and can be read (or reused)
entirely on its own - `reducer.js` is the only file that's shaped
specifically for `useReducer`.

## What's the same as the original

- **Board layout**: exact same 15x15 bonus-square pattern (triple/double
  word, triple/double letter, centre star), ported directly from the
  Swing board-drawing code.
- **Tile distribution**: the same 100-tile set from `tile.txt` (letter
  counts and point values).
- **Dictionary**: the same ~279,500-word list (`dictionary.txt`, unchanged).
- **Scoring**: same letter/word multiplier rules, same first-move doubling,
  same +50 bonus for using all 7 tiles in one turn. This includes one
  quirk carried over faithfully rather than "fixed": the centre star is
  *not* itself a scoring multiplier in this ruleset (only the diagonal
  double-word squares are) - that's how the original board math worked, so
  the port keeps it rather than quietly changing the scoring.
- **Move validation**: first move must cover the centre star, every formed
  word must be a real dictionary word, later moves must connect to a tile
  already on the board.
- **AI strategy**: same overall approach - collect every locked tile on the
  board as an anchor, find every dictionary word the AI's rack (plus that
  anchor's letter) can spell, then try placing each candidate word through
  every anchor tile in both orientations, keeping the highest-scoring legal
  placement. The AI never uses blank tiles (it can't assign them a letter),
  matching the original.

## What changed, and why

**UI framework.** The actual ask - Java Swing views are gone, replaced with
React components and CSS. The AI's move is now applied automatically after
a short "thinking" pause instead of needing a manual "AI Turn" button click
(there's no gameplay difference, just fewer clicks).

**Performance.** The AI's word search now prunes against the dictionary
trie as it goes, instead of generating every letter permutation first and
checking each one afterwards. It finds exactly the same moves - the trie
guarantees that a dead-end prefix can never become a valid word - just
fast enough to not stall a browser tab (tens of milliseconds instead of a
potential many-second brute-force search). Dictionary lookups also moved
from a linear list scan to a hash set.

**A couple of small bugs fixed, not preserved:**
- Placing a tile on a square that already had another unlocked tile from
  the same turn used to silently discard the first tile. It now returns
  to your rack instead.
- Cancelling the letter prompt for a blank tile used to leave a stray,
  invisible tile reference on that square. Blank placement is now deferred
  until you actually pick a letter, so cancelling leaves nothing behind.
- End-of-game scoring now actually deducts each player's remaining rack
  value from their own score. The original Java project had this logic
  written (`ScrabbleMain.declareWinner`) but never called it from either
  game screen, so games always ended on raw scores alone.

**Two small rule inconsistencies unified.** The original had two separate,
slightly different Swing screens for Player-vs-Player and
Player-vs-Computer, and they disagreed on tile exchanges: one blocked
exchanging on the very first turn, the other allowed it but forgot to end
your turn afterwards. There's one ruleset now: exchanging tiles is always
allowed and always ends your turn - including with an empty bag, since
there's no separate "pass" action, so that's the only way to skip a turn
you can't otherwise play.

## Testing

```bash
npm test
```

Runs `test/*.test.js` under Node's built-in test runner - no browser or
extra dependencies required. It covers tile/bag mechanics, board
word-finding and scoring against hand-built positions, the full
~279,500-word dictionary and trie (including a brute-force cross-check
that the optimised AI search finds the identical result set on sample
inputs), and the reducer across a full game flow (placing tiles, blanks,
exchanges, submitting words, the AI's move, and end-of-game scoring).

`test/ssr-smoke.mjs` (run with `npx tsx test/ssr-smoke.mjs`, or any
JSX-capable runner) renders every screen and game state through
`react-dom/server` as a quick check that the component tree itself has no
render-time errors.
