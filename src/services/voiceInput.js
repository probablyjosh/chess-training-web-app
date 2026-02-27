const PIECE_NAMES = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
};

const FILE_WORDS = {
  a: 'a', alpha: 'a', ay: 'a',
  b: 'b', bravo: 'b', bee: 'b',
  c: 'c', charlie: 'c', see: 'c', sea: 'c',
  d: 'd', delta: 'd', dee: 'd',
  e: 'e', echo: 'e',
  f: 'f', foxtrot: 'f',
  g: 'g', golf: 'g', gee: 'g',
  h: 'h', hotel: 'h',
};

const RANK_WORDS = {
  '1': '1', one: '1', won: '1',
  '2': '2', two: '2', to: '2', too: '2',
  '3': '3', three: '3',
  '4': '4', four: '4', for: '4', fore: '4',
  '5': '5', five: '5',
  '6': '6', six: '6',
  '7': '7', seven: '7',
  '8': '8', eight: '8', ate: '8',
};

/**
 * Parse spoken text into a chess move string (SAN-like).
 * Examples:
 *   "king d5" → "Kd5"
 *   "e4" / "pawn e4" / "pawn to e4" → "e4"
 *   "queen takes d7" → "Qxd7"
 *   "knight f3" → "Nf3"
 *   "e8 queen" / "e8 promote queen" → "e8=Q"
 *   "castle kingside" → "O-O"
 *   "castle queenside" → "O-O-O"
 */
export function parseVoiceMove(text) {
  if (!text) return null;
  const raw = text.toLowerCase().trim();

  // Castling
  if (/castle\s*(king\s*side|short)/.test(raw) || raw === 'short castle') return 'O-O';
  if (/castle\s*(queen\s*side|long)/.test(raw) || raw === 'long castle') return 'O-O-O';

  const words = raw.replace(/[^a-z0-9\s]/g, '').split(/\s+/);

  // Remove filler words
  const filtered = words.filter(w => w !== 'to' && w !== 'on' && w !== 'at' && w !== 'the');

  let piece = '';
  let takes = false;
  let file = '';
  let rank = '';
  let promotion = '';

  for (let i = 0; i < filtered.length; i++) {
    const w = filtered[i];

    if (w === 'pawn') continue; // pawn is implicit
    if (w === 'takes' || w === 'captures' || w === 'take' || w === 'capture') {
      takes = true;
      continue;
    }
    if (w === 'promote' || w === 'promotes' || w === 'promotion') continue;

    if (PIECE_NAMES[w] && !file) {
      // Check if this is a piece name or a promotion piece
      // If we already have a square, it's promotion
      if (file && rank) {
        promotion = PIECE_NAMES[w];
      } else {
        piece = PIECE_NAMES[w];
      }
      continue;
    }

    // Try to parse as a square (e.g., "e4" as one word)
    if (w.length === 2 && FILE_WORDS[w[0]] && RANK_WORDS[w[1]]) {
      file = FILE_WORDS[w[0]];
      rank = RANK_WORDS[w[1]];
      continue;
    }

    // Single file letter
    if (FILE_WORDS[w] && !file) {
      file = FILE_WORDS[w];
      continue;
    }

    // Single rank number
    if (RANK_WORDS[w] && file && !rank) {
      rank = RANK_WORDS[w];
      continue;
    }

    // Promotion piece after square
    if (PIECE_NAMES[w] && file && rank) {
      promotion = PIECE_NAMES[w];
      continue;
    }
  }

  if (!file || !rank) return null;

  let move = piece + (takes ? 'x' : '') + file + rank;
  if (promotion) move += '=' + promotion;

  return move;
}

/**
 * Create a voice recognition instance.
 * Returns null if not supported.
 */
export function createVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  return recognition;
}

/**
 * Speak text using the browser's speech synthesis.
 */
export function speak(text) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

/**
 * Convert a chess.js move object to spoken English.
 * e.g., { from: 'e2', to: 'e4', piece: 'p' } → "pawn to e4"
 */
export function moveToSpeech(move) {
  if (!move) return '';

  const pieceNames = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  const pieceName = pieceNames[move.piece] || 'piece';
  const target = move.to;
  const fileSpoken = target[0];
  const rankSpoken = target[1];

  let text = `${pieceName} ${fileSpoken} ${rankSpoken}`;
  if (move.captured) {
    const capturedName = pieceNames[move.captured] || 'piece';
    text = `${pieceName} takes ${capturedName} on ${fileSpoken} ${rankSpoken}`;
  }
  if (move.flags && move.flags.includes('k')) text = 'castles kingside';
  if (move.flags && move.flags.includes('q')) text = 'castles queenside';
  if (move.promotion) {
    const promoName = pieceNames[move.promotion] || 'queen';
    text += `, promotes to ${promoName}`;
  }

  return text;
}
