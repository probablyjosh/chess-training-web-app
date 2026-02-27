import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import StockfishEngine from '../services/stockfishEngine';
import { getCheckmatePool, ALL_ENDGAME_POSITIONS, BLINDFOLD_POSITIONS } from '../data/contentPool';
import {
  loadProgress,
  saveProgress,
  markCheckmateSolved,
  markEndgameCompleted,
  markBlindfoldCompleted,
  getCheckmateProgress,
} from '../services/progressTracker';

const TrainingContext = createContext();

// Adaptive endgame difficulty (1500–1800), persisted in localStorage
const ENDGAME_ELO_MIN = 1500;
const ENDGAME_ELO_MAX = 1800;
const ENDGAME_ELO_STEP = 50;
const ENDGAME_ELO_DEFAULT = 1650;

function loadEndgameElo() {
  try {
    const val = parseInt(localStorage.getItem('endgameElo'), 10);
    if (val >= ENDGAME_ELO_MIN && val <= ENDGAME_ELO_MAX) return val;
  } catch {}
  return ENDGAME_ELO_DEFAULT;
}

export function TrainingProvider({ children }) {
  // Progress (persisted)
  const [progress, setProgress] = useState(() => loadProgress());

  // Adaptive endgame ELO (persisted)
  const endgameEloRef = useRef(loadEndgameElo());

  function getStockfishElo(category) {
    if (category === 'checkmates') return 1500;
    if (category === 'blindfold') return 1400;
    return endgameEloRef.current; // adaptive 1500–1800
  }

  function adjustEndgameElo(won) {
    const current = endgameEloRef.current;
    const next = won
      ? Math.min(current + ENDGAME_ELO_STEP, ENDGAME_ELO_MAX)
      : Math.max(current - ENDGAME_ELO_STEP, ENDGAME_ELO_MIN);
    endgameEloRef.current = next;
    try { localStorage.setItem('endgameElo', String(next)); } catch {}
  }

  // Navigation: 'home' | 'category' | 'playing' | 'blindfold-playing' | 'result'
  const [screen, setScreen] = useState('home');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeSubcategory, setActiveSubcategory] = useState(null);

  // Current challenge
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeResult, setChallengeResult] = useState(null);

  // Chess state
  const [fen, setFen] = useState('start');
  const [moveCount, setMoveCount] = useState(0);
  const [moveHistory, setMoveHistory] = useState([]);

  // Engine state
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  // Refs
  const chessRef = useRef(null);
  const engineRef = useRef(null);
  const challengeRef = useRef(null);

  // Persist progress
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Initialize Stockfish
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine.init()
      .then(() => setEngineReady(true))
      .catch((err) => console.error('Failed to initialize Stockfish:', err));
    return () => engine.terminate();
  }, []);

  // ── Game Over Handler ──

  const handleGameOver = useCallback((chess, challenge) => {
    let outcome, message, won;
    const playerColor = challenge.playerColor;

    if (chess.isCheckmate()) {
      const loserColor = chess.turn() === 'w' ? 'white' : 'black';
      if (loserColor !== playerColor) {
        outcome = 'win'; message = 'Checkmate! You won!'; won = true;
      } else {
        outcome = 'loss'; message = 'Checkmate! You were checkmated.'; won = false;
      }
    } else if (chess.isStalemate()) {
      outcome = 'draw'; message = 'Draw by stalemate.'; won = false;
    } else if (chess.isThreefoldRepetition()) {
      outcome = 'draw'; message = 'Draw by threefold repetition.'; won = false;
    } else if (chess.isInsufficientMaterial()) {
      outcome = 'draw'; message = 'Draw — insufficient material.'; won = false;
    } else {
      outcome = 'draw'; message = 'Draw!'; won = false;
    }

    // Update progress if won
    if (won) {
      setProgress(prev => {
        if (challenge._category === 'checkmates' && challenge._subcategory) {
          return markCheckmateSolved(prev, challenge._subcategory, challenge.id);
        }
        if (challenge._category === 'endgames') {
          return markEndgameCompleted(prev, challenge.id);
        }
        if (challenge._category === 'blindfold') {
          return markBlindfoldCompleted(prev, challenge.id);
        }
        return prev;
      });
    }

    // Adjust adaptive endgame difficulty
    if (challenge._category === 'endgames') {
      adjustEndgameElo(won);
    }

    setChallengeResult({ outcome, message, won });
    setScreen('result');
    setIsEngineThinking(false);
  }, []);

  // ── Stockfish Engine Move ──

  const triggerEngineMove = useCallback((chess, challenge) => {
    if (!engineRef.current || !engineRef.current.isReady) return;

    engineRef.current.onBestMove = (uciMove) => {
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

      let result;
      try {
        result = chess.move(promotion ? { from, to, promotion } : { from, to });
      } catch {
        setIsEngineThinking(false);
        return;
      }

      if (result) {
        setFen(chess.fen());
        setMoveHistory(prev => [...prev, result]);
        setIsEngineThinking(false);

        if (chess.isGameOver()) {
          handleGameOver(chess, challenge);
        }
      } else {
        setIsEngineThinking(false);
      }
    };

    const sfElo = getStockfishElo(challenge._category);
    engineRef.current.getBestMove(chess.fen(), sfElo, 800);
  }, [handleGameOver]);

  // ── Navigation ──

  function goHome() {
    if (engineRef.current) engineRef.current.stop();
    setScreen('home');
    setActiveCategory(null);
    setActiveSubcategory(null);
    setCurrentChallenge(null);
    setChallengeResult(null);
    setIsEngineThinking(false);
  }

  function goToCategory(category) {
    if (category === 'blindfold') {
      // Skip category screen — shuffle and start immediately
      setActiveCategory('blindfold');
      startBlindfoldSession();
      return;
    }
    setActiveCategory(category);
    setActiveSubcategory(null);
    setScreen('category');
  }

  function goBackToCategory() {
    if (engineRef.current) engineRef.current.stop();
    setScreen('category');
    setCurrentChallenge(null);
    setChallengeResult(null);
    setIsEngineThinking(false);
  }

  // ── Start Challenge ──

  function startCheckmateChallenge(subcategory) {
    setActiveSubcategory(subcategory);
    const pool = getCheckmatePool(subcategory);
    const progressData = getCheckmateProgress(progress, subcategory);
    const index = Math.min(progressData.currentIndex, pool.length - 1);
    const puzzle = pool[index];
    if (!puzzle) return;

    const challenge = { ...puzzle, _category: 'checkmates', _subcategory: subcategory, _index: index };
    beginChallenge(challenge, 'playing');
  }

  function startEndgameChallenge(position) {
    const challenge = { ...position, _category: 'endgames' };
    beginChallenge(challenge, 'playing');
  }

  function startEndgameCategory(categoryName, positions) {
    if (!positions || positions.length === 0) return;
    // Shuffle positions randomly each time
    const shuffled = [...positions].sort(() => Math.random() - 0.5);

    const pos = shuffled[0];
    const challenge = {
      ...pos,
      _category: 'endgames',
      _endgameCategory: categoryName,
      _endgamePool: shuffled,
      _endgameIndex: 0,
      _endgameTotal: shuffled.length,
    };
    beginChallenge(challenge, 'playing');
  }

  function startBlindfoldSession() {
    // Shuffle positions randomly each time the section is entered
    const shuffled = [...BLINDFOLD_POSITIONS].sort(() => Math.random() - 0.5);
    const pos = shuffled[0];
    if (!pos) return;
    const challenge = {
      ...pos,
      _category: 'blindfold',
      _blindfoldPool: shuffled,
      _blindfoldIndex: 0,
      _blindfoldTotal: shuffled.length,
    };
    beginChallenge(challenge, 'blindfold-playing');
  }

  function startBlindfoldChallenge(position) {
    const challenge = { ...position, _category: 'blindfold' };
    beginChallenge(challenge, 'blindfold-playing');
  }

  function beginChallenge(challenge, screenType) {
    const chess = new Chess(challenge.fen);
    chessRef.current = chess;
    challengeRef.current = challenge;

    setCurrentChallenge(challenge);
    setFen(challenge.fen);
    setScreen(screenType);
    setChallengeResult(null);
    setIsEngineThinking(false);
    setMoveCount(0);
    setMoveHistory([]);

    const playerTurn = challenge.playerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== playerTurn) {
      setIsEngineThinking(true);
      triggerEngineMove(chess, challenge);
    }
  }

  // ── Player Move ──

  function makeMove(move) {
    if (screen !== 'playing' && screen !== 'blindfold-playing') return false;
    if (isEngineThinking) return false;

    const chess = chessRef.current;
    const challenge = challengeRef.current;
    const playerTurn = challenge.playerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== playerTurn) return false;

    let result;
    try { result = chess.move(move); } catch { return false; }
    if (!result) return false;

    setMoveCount(prev => prev + 1);
    setFen(chess.fen());
    setMoveHistory(prev => [...prev, result]);

    if (chess.isGameOver()) {
      handleGameOver(chess, challenge);
      return true;
    }

    setIsEngineThinking(true);
    triggerEngineMove(chess, challenge);
    return true;
  }

  function makeMoveSAN(san) {
    if (screen !== 'blindfold-playing') return null;
    if (isEngineThinking) return null;

    const chess = chessRef.current;
    const challenge = challengeRef.current;
    const playerTurn = challenge.playerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== playerTurn) return null;

    let result;
    try { result = chess.move(san); } catch { return null; }
    if (!result) return null;

    setMoveCount(prev => prev + 1);
    setFen(chess.fen());
    setMoveHistory(prev => [...prev, result]);

    if (chess.isGameOver()) {
      handleGameOver(chess, challenge);
      return result;
    }

    setIsEngineThinking(true);
    triggerEngineMove(chess, challenge);
    return result;
  }

  function resign() {
    if (screen !== 'playing' && screen !== 'blindfold-playing') return;
    if (engineRef.current) engineRef.current.stop();
    setChallengeResult({ outcome: 'loss', message: 'You resigned.', won: false });
    setScreen('result');
    setIsEngineThinking(false);
  }

  function skipChallenge() {
    if (screen !== 'playing' && screen !== 'blindfold-playing') return;
    if (engineRef.current) engineRef.current.stop();
    setIsEngineThinking(false);
    nextChallenge();
  }

  function nextChallenge() {
    const challenge = challengeRef.current;
    if (!challenge) return;

    if (challenge._category === 'checkmates' && challenge._subcategory) {
      const pool = getCheckmatePool(challenge._subcategory);
      const nextIndex = (challenge._index || 0) + 1;
      if (nextIndex < pool.length) {
        const puzzle = pool[nextIndex];
        const next = { ...puzzle, _category: 'checkmates', _subcategory: challenge._subcategory, _index: nextIndex };
        beginChallenge(next, 'playing');
        return;
      }
    }

    if (challenge._category === 'endgames' && challenge._endgamePool) {
      const pool = challenge._endgamePool;
      const nextIndex = (challenge._endgameIndex || 0) + 1;
      if (nextIndex < pool.length) {
        const pos = pool[nextIndex];
        const next = {
          ...pos,
          _category: 'endgames',
          _endgameCategory: challenge._endgameCategory,
          _endgamePool: pool,
          _endgameIndex: nextIndex,
          _endgameTotal: pool.length,
        };
        beginChallenge(next, 'playing');
        return;
      }
    }

    if (challenge._category === 'blindfold' && challenge._blindfoldPool) {
      const pool = challenge._blindfoldPool;
      const nextIndex = (challenge._blindfoldIndex || 0) + 1;
      if (nextIndex < pool.length) {
        const pos = pool[nextIndex];
        const next = {
          ...pos,
          _category: 'blindfold',
          _blindfoldPool: pool,
          _blindfoldIndex: nextIndex,
          _blindfoldTotal: pool.length,
        };
        beginChallenge(next, 'blindfold-playing');
        return;
      }
    }

    goBackToCategory();
  }

  function retryChallenge() {
    const challenge = challengeRef.current;
    if (!challenge) return;
    const screenType = challenge._category === 'blindfold' ? 'blindfold-playing' : 'playing';
    beginChallenge(challenge, screenType);
  }

  function resetProgress() {
    setProgress({
      checkmates: {
        mateIn1: { solved: [], currentIndex: 0 },
        mateIn2: { solved: [], currentIndex: 0 },
        mateIn3: { solved: [], currentIndex: 0 },
      },
      endgames: { completed: [] },
      blindfold: { completed: [] },
    });
  }

  return (
    <TrainingContext.Provider value={{
      screen,
      activeCategory,
      activeSubcategory,
      progress,
      currentChallenge,
      challengeResult,
      fen,
      moveCount,
      moveHistory,
      isEngineThinking,
      engineReady,
      goHome,
      goToCategory,
      goBackToCategory,
      startCheckmateChallenge,
      startEndgameChallenge,
      startEndgameCategory,
      startBlindfoldChallenge,
      makeMove,
      makeMoveSAN,
      resign,
      skipChallenge,
      nextChallenge,
      retryChallenge,
      resetProgress,
      endgamePositions: ALL_ENDGAME_POSITIONS,
      blindfoldPositions: BLINDFOLD_POSITIONS,
    }}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  return useContext(TrainingContext);
}
