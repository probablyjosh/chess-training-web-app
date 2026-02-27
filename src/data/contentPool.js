import ENDGAME_POSITIONS from './endgamePositions';
import MATE_IN_1 from './mateIn1Puzzles';
import MATE_IN_2 from './mateIn2Puzzles';
import MATE_IN_3 from './mateIn3Puzzles';

// Checkmate puzzle pools (sorted by rating, easiest first)
export const MATE_IN_1_POOL = [...MATE_IN_1].sort((a, b) => a.rating - b.rating);
export const MATE_IN_2_POOL = [...MATE_IN_2].sort((a, b) => a.rating - b.rating);
export const MATE_IN_3_POOL = [...MATE_IN_3].sort((a, b) => a.rating - b.rating);

// Endgame positions grouped by category
export const ENDGAME_PAWN = ENDGAME_POSITIONS.filter(p => p.category === 'Pawn Endgames');
export const ENDGAME_ROOK = ENDGAME_POSITIONS.filter(p => p.category === 'Rook Endgames');
export const ENDGAME_QUEEN = ENDGAME_POSITIONS.filter(p => p.category === 'Queen Endgames');
export const ALL_ENDGAME_POSITIONS = ENDGAME_POSITIONS;

// Blindfold positions: simplest pawn endgames, easiest first then shuffled within each group
// Seeded shuffle so order is consistent across reloads
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const blindfoldKP = seededShuffle(
  ENDGAME_POSITIONS.filter(p => p.subcategory === 'kp_vs_k'), 42
);
const blindfoldK2P = seededShuffle(
  ENDGAME_POSITIONS.filter(p => p.subcategory === 'k2p_vs_k'), 77
);
export const BLINDFOLD_POSITIONS = [...blindfoldKP, ...blindfoldK2P];

// Lookup helpers
export function getCheckmatePool(level) {
  if (level === 'mateIn1') return MATE_IN_1_POOL;
  if (level === 'mateIn2') return MATE_IN_2_POOL;
  if (level === 'mateIn3') return MATE_IN_3_POOL;
  return [];
}
