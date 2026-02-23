import React from 'react';
import { TrainingProvider, useTraining } from './context/TrainingContext';
import TrainingDashboard from './components/TrainingDashboard';
import TrainingBoard from './components/TrainingBoard';
import './App.css';

function AppContent() {
  const { status } = useTraining();

  if (status === 'dashboard') {
    return <TrainingDashboard />;
  }
  return <TrainingBoard />;
}

function App() {
  return (
    <TrainingProvider>
      <main className="app-shell">
        <AppContent />
      </main>
    </TrainingProvider>
  );
}

export default App;
