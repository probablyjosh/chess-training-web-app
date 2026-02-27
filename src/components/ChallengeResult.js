import React, { useEffect } from 'react';
import { useTraining } from '../context/TrainingContext';
import './ChallengeResult.css';

const OUTCOME_CONFIG = {
  win:  { icon: '🏆', label: 'Victory', cssClass: 'result-win', positive: true },
  loss: { icon: '💀', label: 'Defeat',  cssClass: 'result-loss', positive: false },
  draw: { icon: '🤝', label: 'Draw',    cssClass: 'result-draw', positive: false },
};

function ChallengeResult() {
  const {
    challengeResult,
    moveCount,
    currentChallenge,
    nextChallenge,
    retryChallenge,
    goBackToCategory,
  } = useTraining();

  const outcome = challengeResult?.outcome;
  const config = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.loss;
  const isCheckmate = currentChallenge?._category === 'checkmates';
  const isEndgameWithPool = currentChallenge?._category === 'endgames' && currentChallenge?._endgamePool;
  const isBlindfoldWithPool = currentChallenge?._category === 'blindfold' && currentChallenge?._blindfoldPool;

  // Auto-advance on win for checkmate puzzles
  useEffect(() => {
    if (!challengeResult || !config.positive || !isCheckmate) return;
    const timer = setTimeout(() => nextChallenge(), 800);
    return () => clearTimeout(timer);
  }, [challengeResult, config.positive, isCheckmate, nextChallenge]);

  if (!challengeResult) return null;

  const { message } = challengeResult;

  // For checkmate wins, show a brief flash then auto-advance
  if (config.positive && isCheckmate) {
    return (
      <div className="result-flash">
        <span className="flash-icon">{config.icon}</span>
        <span className="flash-label">Correct!</span>
      </div>
    );
  }

  return (
    <div className="result-overlay">
      <div className={`result-card ${config.cssClass}`}>
        <div className="result-icon">{config.icon}</div>
        <h2 className="result-label">{config.label}</h2>
        <p className="result-message">{message}</p>

        {config.positive && moveCount > 0 && (
          <p className="result-moves">
            Completed in {moveCount} move{moveCount !== 1 ? 's' : ''}
          </p>
        )}

        <div className="result-actions">
          <button className="btn btn-primary" onClick={retryChallenge}>
            Retry
          </button>
          {isCheckmate ? (
            <button className="btn btn-secondary" onClick={nextChallenge}>
              Next Puzzle
            </button>
          ) : isEndgameWithPool || isBlindfoldWithPool ? (
            <button className="btn btn-secondary" onClick={nextChallenge}>
              Next Position
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={goBackToCategory}>
              Back to List
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChallengeResult;
