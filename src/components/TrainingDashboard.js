import React, { useState } from 'react';
import { useTraining } from '../context/TrainingContext';
import './TrainingDashboard.css';

function TrainingDashboard() {
  const {
    playerRating,
    totalAttempts,
    totalCorrect,
    recentResults,
    engineReady,
    startTraining,
    resetProgress,
  } = useTraining();

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const pct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Chess Training</h1>
        <p className="dashboard-subtitle">
          Adaptive puzzles and endgames from real games.
        </p>
      </header>

      <div className="dashboard-card">
        <div className="rating-display">
          <span className="rating-label">Estimated Elo</span>
          <span className="rating-number">{playerRating}</span>
        </div>

        {recentResults.length > 0 && (
          <div className="recent-section">
            <span className="recent-label">Recent</span>
            <div className="recent-dots">
              {recentResults.map((correct, i) => (
                <span
                  key={i}
                  className={`dot ${correct ? 'dot-correct' : 'dot-incorrect'}`}
                />
              ))}
            </div>
          </div>
        )}

        {totalAttempts > 0 && (
          <div className="stats-line">
            {totalAttempts} challenges — {totalCorrect} correct ({pct}%)
          </div>
        )}

        {!engineReady && (
          <p className="engine-loading">Loading chess engine…</p>
        )}

        <button
          className="start-btn"
          onClick={startTraining}
        >
          {totalAttempts === 0 ? 'Start Training' : 'Continue Training'}
        </button>
      </div>

      <div className="reset-section">
        {!showResetConfirm ? (
          <button className="reset-link" onClick={() => setShowResetConfirm(true)}>
            Reset Progress
          </button>
        ) : (
          <div className="reset-confirm">
            <span>Reset all progress?</span>
            <button className="reset-yes" onClick={() => { resetProgress(); setShowResetConfirm(false); }}>
              Yes, reset
            </button>
            <button className="reset-no" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainingDashboard;
