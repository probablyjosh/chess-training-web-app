import React, { useState, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { useTraining } from '../context/TrainingContext';
import ChallengeResult from './ChallengeResult';
import './TrainingBoard.css';

const PROMOTION_PIECES = [
  { piece: 'q', label: 'Queen', symbol: '♕' },
  { piece: 'r', label: 'Rook', symbol: '♖' },
  { piece: 'b', label: 'Bishop', symbol: '♗' },
  { piece: 'n', label: 'Knight', symbol: '♘' },
];

function TrainingBoard() {
  const {
    status,
    currentChallenge,
    fen,
    isEngineThinking,
    playerRating,
    recentResults,
    makeMove,
    resign,
    returnToDashboard,
  } = useTraining();

  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [pendingPromotion, setPendingPromotion] = useState(null);

  const boardOrientation = currentChallenge?.playerColor || 'white';
  const isSolved = status === 'result';
  const disabled = isEngineThinking || isSolved;

  function isPromotionMove(from, to) {
    const fromRank = from[1];
    const toRank = to[1];
    if (boardOrientation === 'white') {
      return fromRank === '7' && toRank === '8';
    }
    return fromRank === '2' && toRank === '1';
  }

  function completePromotion(piece) {
    if (!pendingPromotion) return;
    makeMove({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion: piece,
    });
    setPendingPromotion(null);
    setSelectedSquare(null);
    setOptionSquares({});
  }

  function onPieceDrop({ piece, sourceSquare, targetSquare }) {
    if (!targetSquare || disabled) return false;
    const pieceType = piece?.pieceType || '';
    const isPawn = pieceType[1] === 'P';

    if (isPawn && isPromotionMove(sourceSquare, targetSquare)) {
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      setSelectedSquare(null);
      setOptionSquares({});
      return false;
    }

    const success = makeMove({ from: sourceSquare, to: targetSquare });
    setSelectedSquare(null);
    setOptionSquares({});
    return success;
  }

  const onSquareClick = useCallback(
    ({ square }) => {
      if (disabled || pendingPromotion) return;

      if (selectedSquare) {
        if (isPromotionMove(selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setOptionSquares({});
          return;
        }

        const success = makeMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setOptionSquares({});
        if (success) return;
      }

      setSelectedSquare(square);
      setOptionSquares({ [square]: { background: 'rgba(139, 125, 107, 0.45)' } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSquare, disabled, makeMove, pendingPromotion, boardOrientation]
  );

  return (
    <div className="training-container">
      {/* Top bar */}
      <div className="training-topbar">
        <button className="back-btn" onClick={returnToDashboard}>
          ← Dashboard
        </button>
        <div className="training-info">
          <span className="challenge-label">
            {boardOrientation === 'white' ? 'White to move' : 'Black to move'}
          </span>
        </div>
        <div className="topbar-right">
          <span className="topbar-rating">{playerRating}</span>
          {recentResults.length > 0 && (
            <div className="recent-dots-small">
              {recentResults.map((correct, i) => (
                <span key={i} className={`dot-sm ${correct ? 'dot-sm-correct' : 'dot-sm-incorrect'}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="training-layout">
        {/* Board */}
        <div className="board-wrapper">
          <Chessboard
            options={{
              id: 'training-board',
              position: fen,
              boardOrientation: boardOrientation,
              allowDragging: !disabled && !pendingPromotion,
              squareStyles: optionSquares,
              animationDurationInMs: 150,
              boardStyle: {
                borderRadius: '6px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              },
              darkSquareStyle: { backgroundColor: '#7a8b6e' },
              lightSquareStyle: { backgroundColor: '#d4ccb8' },
              onPieceDrop: onPieceDrop,
              onSquareClick: onSquareClick,
            }}
          />

          {isEngineThinking && (
            <div className="thinking-bar">Computer is thinking…</div>
          )}
          {pendingPromotion && (
            <div className="promotion-overlay">
              <div className="promotion-dialog">
                <span className="promotion-title">Promote to:</span>
                <div className="promotion-options">
                  {PROMOTION_PIECES.map(({ piece, label, symbol }) => (
                    <button
                      key={piece}
                      className="promotion-btn"
                      onClick={() => completePromotion(piece)}
                      title={label}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="side-panel">
          <div className="instruction-box">
            <p className="instruction-text">
              {boardOrientation === 'white' ? 'White' : 'Black'} to move.
            </p>
          </div>
          <button
            className="ctrl-btn resign-btn"
            onClick={resign}
            disabled={status !== 'playing'}
          >
            Resign
          </button>
        </div>
      </div>

      {/* Result overlay */}
      {status === 'result' && <ChallengeResult />}
    </div>
  );
}

export default TrainingBoard;
