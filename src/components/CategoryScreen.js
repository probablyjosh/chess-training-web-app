import React from 'react';
import { useTraining } from '../context/TrainingContext';
import { getCheckmatePool, ENDGAME_PAWN, ENDGAME_ROOK, ENDGAME_QUEEN } from '../data/contentPool';
import { getCheckmateProgress, isBlindfoldCompleted, getEndgameCategoryProgress } from '../services/progressTracker';
import './CategoryScreen.css';

function CategoryScreen() {
  const {
    activeCategory,
    progress,
    goHome,
    startCheckmateChallenge,
    startEndgameCategory,
    startBlindfoldChallenge,
    blindfoldPositions,
  } = useTraining();

  if (activeCategory === 'checkmates') return <CheckmatesView />;
  if (activeCategory === 'endgames') return <EndgamesView />;
  if (activeCategory === 'blindfold') return <BlindfoldView />;

  return (
    <div className="cat-container">
      <button className="cat-back" onClick={goHome}>← Home</button>
      <p className="cat-empty">Unknown category.</p>
    </div>
  );

  function CheckmatesView() {
    const levels = [
      { key: 'mateIn1', label: 'Mate in 1' },
      { key: 'mateIn2', label: 'Mate in 2' },
      { key: 'mateIn3', label: 'Mate in 3' },
    ];

    return (
      <div className="cat-container">
        <button className="cat-back" onClick={goHome}>← Home</button>
        <h1 className="cat-title">Checkmates</h1>
        <p className="cat-subtitle">Find the checkmate in 1, 2, or 3 moves</p>

        <div className="cat-list">
          {levels.map(({ key, label }) => {
            const pool = getCheckmatePool(key);
            const prog = getCheckmateProgress(progress, key);
            return (
              <button
                key={key}
                className="cat-item"
                onClick={() => startCheckmateChallenge(key)}
              >
                <span className="cat-item-name">{label}</span>
                <span className="cat-item-progress">
                  {prog.solved} / {pool.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function EndgamesView() {
    const categories = [
      { key: 'Pawn Endgames', label: 'Pawn Endgames', positions: ENDGAME_PAWN },
      { key: 'Rook Endgames', label: 'Rook Endgames', positions: ENDGAME_ROOK },
      { key: 'Queen Endgames', label: 'Queen Endgames', positions: ENDGAME_QUEEN },
    ];

    return (
      <div className="cat-container">
        <button className="cat-back" onClick={goHome}>← Home</button>
        <h1 className="cat-title">Endgames</h1>
        <p className="cat-subtitle">Play common endgame themes from real positions in history.</p>

        <div className="cat-list">
          {categories.map(({ key, label, positions }) => {
            const prog = getEndgameCategoryProgress(progress, positions);
            return (
              <button
                key={key}
                className="cat-item"
                onClick={() => startEndgameCategory(key, positions)}
              >
                <span className="cat-item-name">{label}</span>
                <span className="cat-item-progress">
                  {prog.completed} / {positions.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function BlindfoldView() {
    return (
      <div className="cat-container">
        <button className="cat-back" onClick={goHome}>← Home</button>
        <h1 className="cat-title">Blindfold Chess Endgames</h1>
        <p className="cat-subtitle">
          Improve visualization by practicing the most simple endgames
        </p>
        <div className="cat-instructions">
          <p>Say moves like: <strong>"king d5"</strong>, <strong>"pawn e4"</strong>, or <strong>"e4"</strong></p>
        </div>

        <div className="cat-list">
          {blindfoldPositions.map(pos => {
            const completed = isBlindfoldCompleted(progress, pos.id);
            return (
              <button
                key={pos.id}
                className={`cat-item ${completed ? 'cat-item-done' : ''}`}
                onClick={() => startBlindfoldChallenge(pos)}
              >
                <div className="cat-item-info">
                  <span className="cat-item-name">{pos.source || pos.name}</span>
                  <span className="cat-item-desc">
                    {pos.subcategory === 'kp_vs_k' ? 'King & Pawn vs King' : 'King & Two Pawns vs King'}
                  </span>
                </div>
                {completed && <span className="cat-item-check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}

export default CategoryScreen;
