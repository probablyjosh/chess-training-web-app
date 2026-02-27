import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTraining } from '../context/TrainingContext';
import { parseVoiceMove, createVoiceRecognition, speak, moveToSpeech } from '../services/voiceInput';
import ChallengeResult from './ChallengeResult';
import './BlindfoldBoard.css';

function BlindfoldBoard() {
  const {
    screen,
    currentChallenge,
    moveHistory,
    isEngineThinking,
    goHome,
    makeMoveSAN,
    resign,
    skipChallenge,
  } = useTraining();

  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [feedback, setFeedback] = useState('');
  const recognitionRef = useRef(null);
  const prevMoveCountRef = useRef(0);

  const boardOrientation = currentChallenge?.playerColor || 'white';
  const isSolved = screen === 'result';

  // Announce opponent's moves via speech
  useEffect(() => {
    if (moveHistory.length > prevMoveCountRef.current) {
      const lastMove = moveHistory[moveHistory.length - 1];
      // If this was the opponent's move, announce it
      const playerPiece = boardOrientation === 'white' ? 'w' : 'b';
      if (lastMove.color !== playerPiece) {
        const text = moveToSpeech(lastMove);
        speak(`Opponent plays ${text}`);
      }
    }
    prevMoveCountRef.current = moveHistory.length;
  }, [moveHistory, boardOrientation]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const handleVoiceResult = useCallback((event) => {
    const last = event.results[event.results.length - 1];
    if (!last.isFinal) return;

    const text = last[0].transcript.trim();
    setLastHeard(text);

    const san = parseVoiceMove(text);
    if (!san) {
      setFeedback(`Could not parse: "${text}"`);
      speak('Invalid move');
      return;
    }

    const result = makeMoveSAN(san);
    if (result) {
      setFeedback(`Played: ${result.san}`);
    } else {
      setFeedback(`Illegal move: ${san}`);
      speak('Illegal move');
    }
  }, [makeMoveSAN]);

  function toggleListening() {
    if (listening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setListening(false);
      return;
    }

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = createVoiceRecognition();
      if (!recognition) {
        setFeedback('Voice recognition not supported in this browser.');
        return;
      }
      recognitionRef.current = recognition;
    }

    recognition.onresult = handleVoiceResult;
    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        setFeedback(`Voice error: ${e.error}`);
      }
    };
    recognition.onend = () => {
      // Restart if still supposed to be listening
      if (listening) {
        try { recognition.start(); } catch {}
      }
    };

    try {
      recognition.start();
      setListening(true);
      setFeedback('Listening...');
    } catch {
      setFeedback('Failed to start voice recognition.');
    }
  }

  // Keep listening state in sync with ref for onend handler
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onend = () => {
        if (listening && !isSolved) {
          try { recognition.start(); } catch {}
        } else {
          setListening(false);
        }
      };
    }
  }, [listening, isSolved]);

  // Stop listening when game ends
  useEffect(() => {
    if (isSolved && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    }
  }, [isSolved]);

  return (
    <div className="bf-container">
      {/* Top bar */}
      <div className="bf-topbar">
        <button className="bf-back" onClick={goHome}>
          ← Home
        </button>
        <span className="bf-title">{currentChallenge?.source || currentChallenge?.name || 'Blindfold Chess'}</span>
      </div>

      {/* Main content */}
      <div className="bf-content">
        <div className="bf-status">
          <p className="bf-orientation">
            You play as <strong>{boardOrientation}</strong>
          </p>
          {isEngineThinking && <p className="bf-thinking">Opponent is thinking…</p>}
        </div>

        {/* Move history */}
        <div className="bf-history">
          <h3 className="bf-history-title">Move History</h3>
          {moveHistory.length === 0 ? (
            <p className="bf-history-empty">No moves yet. Speak your move.</p>
          ) : (
            <div className="bf-moves">
              {moveHistory.map((move, i) => (
                <span key={i} className={`bf-move ${move.color === 'w' ? 'bf-move-white' : 'bf-move-black'}`}>
                  {i % 2 === 0 && <span className="bf-move-num">{Math.floor(i / 2) + 1}.</span>}
                  {move.san}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Voice controls */}
        <div className="bf-voice">
          <button
            className={`bf-mic-btn ${listening ? 'bf-mic-active' : ''}`}
            onClick={toggleListening}
            disabled={isSolved || isEngineThinking}
          >
            {listening ? '⏹ Stop Listening' : '🎤 Start Listening'}
          </button>

          {lastHeard && (
            <p className="bf-heard">Heard: "{lastHeard}"</p>
          )}
          {feedback && (
            <p className="bf-feedback">{feedback}</p>
          )}
        </div>

        {/* Resign / Skip */}
        {!isSolved && (
          <div className="bf-controls">
            <button className="bf-resign" onClick={resign}>
              Resign
            </button>
            <button className="bf-skip" onClick={skipChallenge}>
              Skip →
            </button>
          </div>
        )}
      </div>

      {/* Result overlay */}
      {screen === 'result' && <ChallengeResult />}
    </div>
  );
}

export default BlindfoldBoard;
