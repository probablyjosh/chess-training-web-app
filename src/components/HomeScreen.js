import React from 'react';
import { useTraining } from '../context/TrainingContext';
import './HomeScreen.css';

function HomeScreen() {
  const { goToCategory, engineReady } = useTraining();

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="home-title">Chess Endgame Trainer</h1>
      </header>

      {!engineReady && (
        <p className="engine-loading">Loading chess engine…</p>
      )}

      <div className="category-cards">
        <button className="category-card" onClick={() => goToCategory('checkmates')}>
          <span className="card-icon">♛</span>
          <h2 className="card-title">Checkmates</h2>
          <p className="card-desc">
            Find the checkmate in 1, 2, or 3 moves
          </p>
        </button>

        <button className="category-card" onClick={() => goToCategory('endgames')}>
          <span className="card-icon">♟</span>
          <h2 className="card-title">Endgames</h2>
          <p className="card-desc">
            Play common endgame themes from real positions in history.
          </p>
        </button>

        <button className="category-card" onClick={() => goToCategory('blindfold')}>
          <span className="card-icon">🎙</span>
          <h2 className="card-title">Blindfold Chess Endgames</h2>
          <p className="card-desc">
            Improve visualization by practicing the most simple endgames.
          </p>
        </button>
      </div>
    </div>
  );
}

export default HomeScreen;
