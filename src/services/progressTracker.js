const STORAGE_KEY = 'chess-training-progress';

function getDefault() {
  return {
    checkmates: {
      mateIn1: { solved: [], currentIndex: 0 },
      mateIn2: { solved: [], currentIndex: 0 },
      mateIn3: { solved: [], currentIndex: 0 },
    },
    endgames: { completed: [] },
    blindfold: { completed: [] },
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults in case new fields were added
      const defaults = getDefault();
      return {
        checkmates: { ...defaults.checkmates, ...parsed.checkmates },
        endgames: { ...defaults.endgames, ...parsed.endgames },
        blindfold: { ...defaults.blindfold, ...parsed.blindfold },
      };
    }
  } catch { /* ignore */ }
  return getDefault();
}

export function saveProgress(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function markCheckmateSolved(progress, level, puzzleId) {
  const levelData = progress.checkmates[level];
  if (!levelData) return progress;
  const solved = levelData.solved.includes(puzzleId)
    ? levelData.solved
    : [...levelData.solved, puzzleId];
  return {
    ...progress,
    checkmates: {
      ...progress.checkmates,
      [level]: { ...levelData, solved, currentIndex: levelData.currentIndex + 1 },
    },
  };
}

export function markEndgameCompleted(progress, positionId) {
  const completed = progress.endgames.completed.includes(positionId)
    ? progress.endgames.completed
    : [...progress.endgames.completed, positionId];
  return {
    ...progress,
    endgames: { ...progress.endgames, completed },
  };
}

export function markBlindfoldCompleted(progress, positionId) {
  const completed = progress.blindfold.completed.includes(positionId)
    ? progress.blindfold.completed
    : [...progress.blindfold.completed, positionId];
  return {
    ...progress,
    blindfold: { ...progress.blindfold, completed },
  };
}

export function getCheckmateProgress(progress, level) {
  const levelData = progress.checkmates[level];
  if (!levelData) return { solved: 0, currentIndex: 0 };
  return { solved: levelData.solved.length, currentIndex: levelData.currentIndex };
}

export function isEndgameCompleted(progress, positionId) {
  return progress.endgames.completed.includes(positionId);
}

export function isBlindfoldCompleted(progress, positionId) {
  return progress.blindfold.completed.includes(positionId);
}

export function getEndgameCategoryProgress(progress, positions) {
  const completedSet = new Set(progress.endgames.completed);
  let completed = 0;
  for (const p of positions) {
    if (completedSet.has(p.id)) completed++;
  }
  return { completed };
}
