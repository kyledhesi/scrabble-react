import React, { useReducer, useEffect, useRef } from 'react';
import { gameReducer, createInitialState, currentPlayerIndex } from './game/reducer.js';
import { loadDictionary } from './game/dictionary.js';
import { buildLetterTree } from './game/letterTree.js';
import { findBestMove } from './game/aiPlayer.js';
import MainMenu from './components/MainMenu.jsx';
import PlayerSetup from './components/PlayerSetup.jsx';
import GameScreen from './components/GameScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';

const AI_TIME_BUDGET_MS = 4000;
const AI_THINK_DELAY_MS = 500; // small pause so the human sees their own move land first

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const aiRequestRef = useRef(null);

  // Load the dictionary + build the AI's search trie once, up front. This
  // mirrors ScrabbleMain reading dictionary.txt at startup, just async and
  // with a loading screen instead of blocking the whole app.
  useEffect(() => {
    let cancelled = false;
    loadDictionary('dictionary.txt')
      .then((dictionary) => {
        if (cancelled) return;
        const letterTree = buildLetterTree(dictionary);
        dispatch({ type: 'DICTIONARY_READY', dictionary, letterTree });
      })
      .catch((error) => {
        if (cancelled) return;
        dispatch({ type: 'DICTIONARY_ERROR', error: String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever it becomes the AI's turn, compute its move off to the side
  // (via setTimeout so the UI paints "thinking" first) and dispatch the
  // result. This replaces the manual "AI Turn" button the Java version
  // required - the computer just plays automatically when it's its go.
  useEffect(() => {
    if (state.screen !== 'game' || state.gameOver) return;
    const playerIndex = currentPlayerIndex(state);
    const player = state.players[playerIndex];
    if (!player || !player.isAI) return;
    if (state.aiThinking) return;
    if (state.placedPositions.length > 0 || state.pendingBlank) return;

    const requestId = {};
    aiRequestRef.current = requestId;
    dispatch({ type: 'AI_THINKING' });

    const timer = setTimeout(() => {
      const { move } = findBestMove(state.board, player.rack, state.dictionary, state.letterTree, AI_TIME_BUDGET_MS);
      if (aiRequestRef.current === requestId) {
        dispatch({ type: 'AI_MOVE_RESULT', move });
      }
    }, AI_THINK_DELAY_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, state.turn, state.gameOver]);

  if (state.dictionaryStatus === 'error') {
    return (
      <div className="app-shell">
        <div className="load-error">
          <h1>Couldn&rsquo;t load the dictionary</h1>
          <p>{state.dictionaryError}</p>
          <p>Check that dictionary.txt is being served alongside the app and reload the page.</p>
        </div>
      </div>
    );
  }

  if (state.dictionaryStatus === 'loading') {
    return (
      <div className="app-shell">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {state.screen === 'menu' && <MainMenu dispatch={dispatch} />}
      {state.screen === 'setup' && <PlayerSetup mode={state.mode} dispatch={dispatch} />}
      {state.screen === 'game' && <GameScreen state={state} dispatch={dispatch} />}
    </div>
  );
}
