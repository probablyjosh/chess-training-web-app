/**
 * Adaptive rating system using Elo calculations.
 * Manages player rating, challenge selection, and localStorage persistence.
 */

const STORAGE_KEY = 'chess-training-adaptive';
const INITIAL_RATING = 400;
const MIN_RATING = 200;
const MAX_RATING = 2500;
const BASE_K = 40;

// ── Elo Math ──

export function expectedScore(playerRating, itemRating) {
  return 1 / (1 + Math.pow(10, (itemRating - playerRating) / 400));
}

/**
 * Dynamic K-factor: accelerates rating changes when on a streak.
 * If last 5 results are the same (all wins or all losses), K increases
 * so rating converges faster to the player's true level.
 */
function getKFactor(history) {
  if (history.length < 5) return BASE_K * 1.5; // New players adapt extra fast
  const last5 = history.slice(-5);
  const wins = last5.filter(h => h.correct).length;
  if (wins >= 5) return BASE_K * 1.8; // Hot streak — push rating up fast
  if (wins >= 4) return BASE_K * 1.3; // Mostly winning — moderate boost
  if (wins <= 1) return BASE_K * 1.3; // Mostly losing — moderate boost down
  if (wins === 0) return BASE_K * 1.8; // Cold streak — push rating down fast
  return BASE_K;
}

export function updateRating(playerRating, itemRating, score, history = []) {
  const K = getKFactor(history);
  const expected = expectedScore(playerRating, itemRating);
  const newRating = playerRating + K * (score - expected);
  return Math.round(Math.max(MIN_RATING, Math.min(MAX_RATING, newRating)));
}

// ── Stockfish ELO Mapping ──

/**
 * Map a player rating to Stockfish UCI_Elo so the engine matches the player's strength.
 * Player rating 200-2500 → Stockfish 1320-3190.
 */
export function playerRatingToStockfishElo(playerRating) {
  const SF_MIN = 1320;
  const SF_MAX = 3190;
  const PLAYER_MIN = 200;
  const PLAYER_MAX = 2500;

  const ratio = (playerRating - PLAYER_MIN) / (PLAYER_MAX - PLAYER_MIN);
  const sfElo = SF_MIN + ratio * (SF_MAX - SF_MIN);
  return Math.round(Math.max(SF_MIN, Math.min(SF_MAX, sfElo)));
}

// ── Challenge Selection ──

/**
 * Get a theme key for diversity tracking.
 * Groups puzzles so we avoid repeating the same pattern.
 */
function getThemeKey(item) {
  if (item.type === 'endgamePlay') return `play:${item.id}`;
  if (item.type === 'endgame') return `eg:${item.category || 'general'}`;
  return item.type; // mateIn1, mateIn2, mateIn3
}

/**
 * Select next challenge targeting ~75% expected success rate.
 * Enforces ~60% endgame / 40% checkmate content mix.
 * Ensures theme diversity so the same puzzle patterns don't repeat.
 */
export function selectNextChallenge(pool, playerRating, history, lastType = null) {
  // Target difficulty where expected success ≈ 70%
  // Elo formula: 0.70 = 1/(1+10^(d/400)) → d ≈ -147
  const targetDifficulty = playerRating - 147;

  // Filter out recently seen items (larger window to avoid repeats)
  const RECENCY_WINDOW = Math.min(30, Math.floor(pool.length * 0.3));
  const recentIds = new Set(history.slice(-RECENCY_WINDOW).map(h => h.id));

  let candidates = pool.filter(item => !recentIds.has(item.id));

  // Relax recency if too few candidates
  if (candidates.length < 10) {
    const smallerWindow = Math.min(5, history.length);
    const smallerRecentIds = new Set(history.slice(-smallerWindow).map(h => h.id));
    candidates = pool.filter(item => !smallerRecentIds.has(item.id));
  }

  // Build recent theme history for diversity scoring
  const recentThemes = history.slice(-8).map(h => h.theme).filter(Boolean);

  // Split into endgame and checkmate pools
  const isEndgameType = t => t === 'endgamePlay' || t === 'endgame';
  const endgameCandidates = candidates.filter(c => isEndgameType(c.type));
  const checkmateCandidates = candidates.filter(c => !isEndgameType(c.type));

  // Decide whether this challenge should be endgame or checkmate (80/20 split)
  let selectedPool;
  const roll = Math.random();
  if (roll < 0.8 && endgameCandidates.length > 0) {
    selectedPool = endgameCandidates;
  } else if (checkmateCandidates.length > 0) {
    selectedPool = checkmateCandidates;
  } else {
    selectedPool = candidates;
  }

  // Score each candidate by closeness to target difficulty + diversity
  const scored = selectedPool.map(item => {
    const distance = Math.abs(item.rating - targetDifficulty);
    let score = 1000 - distance;

    // Type complexity gating: penalize harder puzzle types at low ratings
    const typeThresholds = { mateIn2: 550, mateIn3: 750 };
    const threshold = typeThresholds[item.type];
    if (threshold && playerRating < threshold) {
      score -= (threshold - playerRating) * 3;
    }

    // Theme diversity: penalize items whose theme was recently played
    const theme = getThemeKey(item);
    const themeRecency = recentThemes.lastIndexOf(theme);
    if (themeRecency !== -1) {
      // More recent = bigger penalty. Last played = -200, 8 ago = -25
      const recencyPenalty = (8 - (recentThemes.length - 1 - themeRecency)) * 25;
      score -= recencyPenalty;
    }

    // Diversity bonus: prefer different type than last played
    if (lastType && item.type !== lastType) {
      score += 60;
    }

    // Random jitter for variety
    score += (Math.random() - 0.5) * 80;

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick from top 3 candidates randomly for more variety
  const topN = Math.min(3, scored.length);
  const pick = Math.floor(Math.random() * topN);
  return scored[pick].item;
}

// ── Theme key export for history tracking ──
export { getThemeKey };

// ── localStorage Persistence ──

export function loadAdaptiveState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  // Attempt migration from old puzzle progress
  try {
    const oldRaw = localStorage.getItem('chess-training-puzzle-progress');
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      const m1 = old.mateIn1?.length || 0;
      const m2 = old.mateIn2?.length || 0;
      const m3 = old.mateIn3?.length || 0;
      let startRating = INITIAL_RATING;
      if (m1 >= 50) startRating += 100;
      if (m1 >= 150) startRating += 100;
      if (m2 >= 50) startRating += 150;
      if (m2 >= 200) startRating += 150;
      if (m3 >= 20) startRating += 200;
      return { playerRating: startRating, history: [], totalAttempts: 0, totalCorrect: 0 };
    }
  } catch { /* ignore */ }

  return { playerRating: INITIAL_RATING, history: [], totalAttempts: 0, totalCorrect: 0 };
}

export function saveAdaptiveState(state) {
  try {
    // Keep history trimmed to last 500 entries to avoid bloating localStorage
    const trimmed = {
      ...state,
      history: state.history.slice(-500),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}
