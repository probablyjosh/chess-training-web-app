import ENDGAME_POSITIONS from './endgamePositions';
import MATE_IN_1 from './mateIn1Puzzles';
import MATE_IN_2 from './mateIn2Puzzles';
import MATE_IN_3 from './mateIn3Puzzles';
import ENDGAME_PUZZLES from './endgamePuzzles';

function normalizeEndgamePlay(pos) {
  return {
    id: pos.id,
    type: 'endgamePlay',
    fen: pos.fen,
    playerColor: pos.playerColor,
    rating: pos.rating,
    name: pos.name,
    description: pos.description,
  };
}

function normalizeEndgamePuzzle(puzzle) {
  return {
    id: puzzle.id,
    type: 'endgame',
    fen: puzzle.fen,
    playerColor: puzzle.playerColor,
    rating: puzzle.rating,
    solution: puzzle.solution,
    category: puzzle.category || 'General Endgame',
  };
}

function normalizeMatePuzzle(puzzle, type) {
  return {
    id: puzzle.id,
    type,
    fen: puzzle.fen,
    playerColor: puzzle.playerColor,
    rating: puzzle.rating,
    solution: puzzle.solution,
  };
}

const CONTENT_POOL = [
  ...ENDGAME_POSITIONS.map(p => normalizeEndgamePlay(p)),
  ...ENDGAME_PUZZLES.map(p => normalizeEndgamePuzzle(p)),
  ...MATE_IN_1.map(p => normalizeMatePuzzle(p, 'mateIn1')),
  ...MATE_IN_2.map(p => normalizeMatePuzzle(p, 'mateIn2')),
  ...MATE_IN_3.map(p => normalizeMatePuzzle(p, 'mateIn3')),
];

export default CONTENT_POOL;
