import React, { useEffect } from 'react';
import { useTraining } from '../context/TrainingContext';
import './ChallengeResult.css';

const OUTCOME_CONFIG = {
  win:       { icon: '🏆', label: 'Victory',   cssClass: 'result-win', positive: true },
  loss:      { icon: '💀', label: 'Defeat',    cssClass: 'result-loss', positive: false },
  draw:      { icon: '🤝', label: 'Draw',      cssClass: 'result-draw', positive: false },
  correct:   { icon: '✓',  label: 'Correct!',  cssClass: 'result-correct', positive: true },
  incorrect: { icon: '✗',  label: 'Incorrect', cssClass: 'result-incorrect', positive: false },
};

function ChallengeResult() {
  const {
    challengeResult,
    playerRating,
    moveCount,
    currentChallenge,
    nextChallenge,
    retryChallenge,
    returnToDashboard,
  } = useTraining();

  const outcome = challengeResult?.outcome;
  const config = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.incorrect;

  // Auto-advance on correct/win after a short delay
  useEffect(() => {
    if (!challengeResult || !config.positive) return;
    const timer = setTimeout(() => nextChallenge(), 800);
    return () => clearTimeout(timer);
  }, [challengeResult, config.positive, nextChallenge]);

  if (!challengeResult) return null;

  const { message, ratingChange, previousRating } = challengeResult;
  const isEndgamePlay = currentChallenge?.type === 'endgamePlay';

  // For wins/correct, show a brief flash instead of full overlay
  if (config.positive) {
    return (
      <div className="result-flash">
        <span className="flash-icon">{config.icon}</span>
        <span className="flash-delta delta-positive">+{ratingChange}</span>
      </div>
    );
  }

  return (
    <div className="result-overlay">
      <div className={`result-card ${config.cssClass}`}>
        <div className="result-icon">{config.icon}</div>
        <h2 className="result-label">{config.label}</h2>
        <p className="result-message">{message}</p>

        {isEndgamePlay && outcome === 'win' && moveCount > 0 && (
          <p className="result-moves">
            Completed in {moveCount} move{moveCount !== 1 ? 's' : ''}
          </p>
        )}

        <div className="rating-change-display">
          <span className="prev-rating">{previousRating}</span>
          <span className={`rating-delta ${ratingChange >= 0 ? 'delta-positive' : 'delta-negative'}`}>
            {ratingChange >= 0 ? '+' : ''}{ratingChange}
          </span>
          <span className="new-rating">{playerRating}</span>
        </div>

        <div className="result-actions">
          <button className="btn btn-primary" onClick={retryChallenge}>
            Retry
          </button>
          <button className="btn btn-secondary" onClick={nextChallenge}>
            Next Challenge
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChallengeResult;
