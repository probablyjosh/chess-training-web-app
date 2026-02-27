import React from 'react';
import { TrainingProvider, useTraining } from './context/TrainingContext';
import HomeScreen from './components/HomeScreen';
import CategoryScreen from './components/CategoryScreen';
import TrainingBoard from './components/TrainingBoard';
import BlindfoldBoard from './components/BlindfoldBoard';
import './App.css';

function AppContentWrapper() {
  const { screen, currentChallenge } = useTraining();

  if (screen === 'home') return <HomeScreen />;
  if (screen === 'category') return <CategoryScreen />;
  if (screen === 'blindfold-playing') return <BlindfoldBoard />;
  if (screen === 'result' && currentChallenge?._category === 'blindfold') return <BlindfoldBoard />;
  if (screen === 'playing' || screen === 'result') return <TrainingBoard />;
  return <HomeScreen />;
}

function App() {
  return (
    <TrainingProvider>
      <main className="app-shell">
        <AppContentWrapper />
      </main>
    </TrainingProvider>
  );
}

export default App;
