import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import StockfishEngine from '../services/stockfishEngine';
import CONTENT_POOL from '../data/contentPool';
import {
  updateRating,
  playerRatingToStockfishElo,
  selectNextChallenge,
  getThemeKey,
  loadAdaptiveState,
  saveAdaptiveState,
} from '../services/adaptiveRating';

const TrainingContext = createContext();

export function TrainingProvider({ children }) {
  // Adaptive state (persisted)
  const [playerRating, setPlayerRating] = useState(() => loadAdaptiveState().playerRating);
  const [history, setHistory] = useState(() => loadAdaptiveState().history);
  const [totalAttempts, setTotalAttempts] = useState(() => loadAdaptiveState().totalAttempts);
  const [totalCorrect, setTotalCorrect] = useState(() => loadAdaptiveState().totalCorrect);

  // Training status: 'dashboard' | 'playing' | 'result'
  const [status, setStatus] = useState('dashboard');

  // Current challenge
  const [currentChallenge, setCurrentChallenge] = useState(null);

  // Challenge result (shown in result overlay)
  const [challengeResult, setChallengeResult] = useState(null);

  // Chess state
  const [fen, setFen] = useState('start');
  const [moveCount, setMoveCount] = useState(0);

  // Engine state
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  // Refs
  const chessRef = useRef(null);
  const engineRef = useRef(null);
  const challengeRef = useRef(null);
  const stockfishEloRef = useRef(1500);
  const playerRatingRef = useRef(playerRating);
  playerRatingRef.current = playerRating;

  // Derived: recent results (last 10)
  const recentResults = history.slice(-10).map(h => h.correct ?? h.score > 0);

  // Initialize Stockfish on mount
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;

    engine.init()
      .then(() => setEngineReady(true))
      .catch((err) => console.error('Failed to initialize Stockfish:', err));

    return () => engine.terminate();
  }, []);

  // Persist adaptive state
  useEffect(() => {
    saveAdaptiveState({ playerRating, history, totalAttempts, totalCorrect });
  }, [playerRating, history, totalAttempts, totalCorrect]);

  // ── Game Over Handler ──

  const handleGameOver = useCallback((chess, challenge) => {
    let outcome, message, score;
    const playerColor = challenge.playerColor;

    if (chess.isCheckmate()) {
      const loserColor = chess.turn() === 'w' ? 'white' : 'black';
      if (loserColor !== playerColor) {
        outcome = 'win'; message = 'Checkmate! You won!'; score = 1.0;
      } else {
        outcome = 'loss'; message = 'Checkmate! You were checkmated.'; score = 0.0;
      }
    } else if (chess.isStalemate()) {
      outcome = 'draw'; message = 'Draw by stalemate.'; score = 0.3;
    } else if (chess.isThreefoldRepetition()) {
      outcome = 'draw'; message = 'Draw by threefold repetition.'; score = 0.3;
    } else if (chess.isInsufficientMaterial()) {
      outcome = 'draw'; message = 'Draw — insufficient material.'; score = 0.3;
    } else {
      outcome = 'draw'; message = 'Draw!'; score = 0.3;
    }

    completeChallengeWithResult(outcome, message, score, challenge);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        setIsEngineThinking(false);

        if (chess.isGameOver()) {
          handleGameOver(chess, challenge);
        }
      } else {
        setIsEngineThinking(false);
      }
    };

    engineRef.current.getBestMove(chess.fen(), stockfishEloRef.current, playerRatingRef.current);
  }, [handleGameOver]);

  // ── Core Functions ──

  function completeChallengeWithResult(outcome, message, score, challenge) {
    const prevRating = playerRating;
    const itemRating = challenge?.rating || 400;
    const newRating = updateRating(prevRating, itemRating, score, history);
    const ratingChange = newRating - prevRating;

    const historyEntry = {
      id: challenge?.id,
      type: challenge?.type,
      theme: challenge ? getThemeKey(challenge) : null,
      correct: score >= 1,
      score,
      timestamp: Date.now(),
    };

    setPlayerRating(newRating);
    setHistory(prev => [...prev, historyEntry]);
    setTotalAttempts(prev => prev + 1);
    if (score >= 1) setTotalCorrect(prev => prev + 1);

    setChallengeResult({
      outcome,
      message,
      ratingChange,
      previousRating: prevRating,
    });
    setStatus('result');
    setIsEngineThinking(false);
  }

  function startTraining() {
    const lastType = history.length > 0 ? history[history.length - 1].type : null;
    const challenge = selectNextChallenge(CONTENT_POOL, playerRating, history, lastType);
    beginChallenge(challenge);
  }

  function nextChallenge() {
    const lastType = currentChallenge?.type || null;
    const challenge = selectNextChallenge(CONTENT_POOL, playerRating, history, lastType);
    beginChallenge(challenge);
  }

  function retryChallenge() {
    if (!currentChallenge) return;
    beginChallenge(currentChallenge);
  }

  function beginChallenge(challenge) {
    const chess = new Chess(challenge.fen);
    chessRef.current = chess;
    challengeRef.current = challenge;

    // Stockfish plays at the player's strength level
    const sfElo = playerRatingToStockfishElo(playerRating);
    stockfishEloRef.current = sfElo;

    setCurrentChallenge(challenge);
    setFen(challenge.fen);
    setStatus('playing');
    setChallengeResult(null);
    setIsEngineThinking(false);
    setMoveCount(0);

    // If it's not the player's turn, engine moves first
    const playerTurn = challenge.playerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== playerTurn) {
      setIsEngineThinking(true);
      triggerEngineMove(chess, challenge);
    }
  }

  // ── Player Move (unified for all challenge types) ──

  function makeMove(move) {
    if (status !== 'playing' || isEngineThinking) return false;

    const chess = chessRef.current;
    const challenge = challengeRef.current;
    const playerTurn = challenge.playerColor === 'white' ? 'w' : 'b';
    if (chess.turn() !== playerTurn) return false;

    let result;
    try { result = chess.move(move); } catch { return false; }
    if (!result) return false;

    setMoveCount(prev => prev + 1);
    setFen(chess.fen());

    if (chess.isGameOver()) {
      handleGameOver(chess, challenge);
      return true;
    }

    // Engine responds
    setIsEngineThinking(true);
    triggerEngineMove(chess, challenge);
    return true;
  }

  function resign() {
    if (status !== 'playing') return;
    const challenge = challengeRef.current;
    if (engineRef.current) engineRef.current.stop();
    completeChallengeWithResult('loss', 'You resigned.', 0.0, challenge);
  }

  function returnToDashboard() {
    if (engineRef.current) engineRef.current.stop();
    setStatus('dashboard');
    setCurrentChallenge(null);
    setChallengeResult(null);
    setIsEngineThinking(false);
  }

  function resetProgress() {
    setPlayerRating(400);
    setHistory([]);
    setTotalAttempts(0);
    setTotalCorrect(0);
    setStatus('dashboard');
    setCurrentChallenge(null);
    setChallengeResult(null);
  }

  return (
    <TrainingContext.Provider value={{
      status,
      playerRating,
      totalAttempts,
      totalCorrect,
      recentResults,
      currentChallenge,
      fen,
      challengeResult,
      isEngineThinking,
      engineReady,
      moveCount,
      startTraining,
      makeMove,
      nextChallenge,
      retryChallenge,
      resign,
      returnToDashboard,
      resetProgress,
    }}>
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  return useContext(TrainingContext);
}
