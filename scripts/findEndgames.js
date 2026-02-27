#!/usr/bin/env node

/**
 * Downloads PGN files from pgnmentor.com for famous players,
 * parses games with chess.js, and finds endgame positions
 * matching our 12 endgame categories.
 *
 * Usage: node scripts/findEndgames.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Chess } = require('chess.js');

const TEMP_DIR = path.join(__dirname, 'temp_pgn');
const BASE_URL = 'https://www.pgnmentor.com/players';

// Players to download — focus on endgame masters
const PLAYERS = [
  'Capablanca',
  'Fischer',
  'Carlsen',
  'Karpov',
  'Kramnik',
  'Smyslov',
  'Rubinstein',
  'Kasparov',
  'Anand',
  'Botvinnik',
];

// Famous players list for prioritizing games between them
const FAMOUS_PLAYERS = new Set([
  'Carlsen', 'Anand', 'Caruana', 'Capablanca', 'Kasparov',
  'Fischer', 'Kramnik', 'Karpov', 'Nakamura', 'Petrosian',
  'Botvinnik', 'Smyslov', 'Keres', 'Rubinstein', 'Reshevsky',
  'Alekhine', 'Tal', 'Spassky', 'Lasker', 'Euwe',
  'Tartakower', 'Nimzowitsch', 'Bronstein', 'Geller', 'Korchnoi',
]);

// ── Download helpers ──

function download(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'ChessTrainingApp/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadPlayer(name) {
  const zipPath = path.join(TEMP_DIR, `${name}.zip`);
  const pgnPath = path.join(TEMP_DIR, `${name}.pgn`);

  if (fs.existsSync(pgnPath)) {
    console.log(`  [cached] ${name}.pgn`);
    return fs.readFileSync(pgnPath, 'utf8');
  }

  console.log(`  Downloading ${name}.zip...`);
  try {
    const data = await download(`${BASE_URL}/${name}.zip`);
    fs.writeFileSync(zipPath, data);
    execSync(`cd "${TEMP_DIR}" && unzip -o "${name}.zip"`, { stdio: 'pipe' });

    // Find the extracted PGN file
    const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.pgn') && f.toLowerCase().includes(name.toLowerCase()));
    if (files.length > 0) {
      const extracted = fs.readFileSync(path.join(TEMP_DIR, files[0]), 'utf8');
      fs.writeFileSync(pgnPath, extracted);
      return extracted;
    }

    // Try any new PGN file
    const allPgn = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.pgn'));
    if (allPgn.length > 0) {
      const extracted = fs.readFileSync(path.join(TEMP_DIR, allPgn[allPgn.length - 1]), 'utf8');
      fs.writeFileSync(pgnPath, extracted);
      return extracted;
    }

    console.log(`  [warn] No PGN found in ${name}.zip`);
    return '';
  } catch (err) {
    console.log(`  [error] ${name}: ${err.message}`);
    return '';
  }
}

// ── PGN Parsing ──

function splitPgnGames(pgnText) {
  // Normalize line endings
  const text = pgnText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const games = [];
  const lines = text.split('\n');
  let current = [];

  for (const line of lines) {
    if (line.startsWith('[Event ')) {
      if (current.length > 0) {
        games.push(current.join('\n'));
      }
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    games.push(current.join('\n'));
  }
  return games;
}

function extractHeader(pgn, tag) {
  const match = pgn.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`));
  return match ? match[1] : '';
}

function isPlayerFamous(name) {
  for (const famous of FAMOUS_PLAYERS) {
    if (name.includes(famous)) return true;
  }
  return false;
}

// ── Piece counting ──

function countMaterial(fen) {
  const board = fen.split(' ')[0];
  const counts = { w: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 } };
  for (const ch of board) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') continue;
    const color = ch === ch.toUpperCase() ? 'w' : 'b';
    const piece = ch.toLowerCase();
    if (counts[color][piece] !== undefined) counts[color][piece]++;
  }
  return counts;
}

function totalPieces(side) {
  return side.q + side.r + side.b + side.n + side.p;
}

// ── Endgame classification ──

function classifyPosition(fen) {
  const m = countMaterial(fen);
  const wPieces = totalPieces(m.w);
  const bPieces = totalPieces(m.b);
  const categories = [];

  // K+P vs K
  if (wPieces === 1 && m.w.p === 1 && bPieces === 0) {
    categories.push('kp_vs_k_white');
  }
  if (bPieces === 1 && m.b.p === 1 && wPieces === 0) {
    categories.push('kp_vs_k_black');
  }

  // K+2P vs K
  if (wPieces === 2 && m.w.p === 2 && bPieces === 0) {
    categories.push('k2p_vs_k_white');
  }
  if (bPieces === 2 && m.b.p === 2 && wPieces === 0) {
    categories.push('k2p_vs_k_black');
  }

  // Pure pawn ending (at least 2 pawns each, no pieces)
  if (m.w.q === 0 && m.w.r === 0 && m.w.b === 0 && m.w.n === 0 &&
      m.b.q === 0 && m.b.r === 0 && m.b.b === 0 && m.b.n === 0 &&
      m.w.p >= 2 && m.b.p >= 2) {
    categories.push('pawn_ending');
  }

  // Rook ending: K+R+pawns vs K+R+pawns
  if (m.w.r === 1 && m.b.r === 1 &&
      m.w.q === 0 && m.b.q === 0 &&
      m.w.b === 0 && m.w.n === 0 && m.b.b === 0 && m.b.n === 0 &&
      m.w.p >= 1 && m.b.p >= 0) {
    categories.push('rook_ending');
  }

  // K+R+P vs K+R (Lucena/Philidor candidate)
  if (m.w.r === 1 && m.b.r === 1 &&
      m.w.q === 0 && m.b.q === 0 &&
      m.w.b === 0 && m.w.n === 0 && m.b.b === 0 && m.b.n === 0) {
    if (m.w.p === 1 && m.b.p === 0) categories.push('krp_vs_kr_white');
    if (m.b.p === 1 && m.w.p === 0) categories.push('krp_vs_kr_black');
  }

  // Queen vs pawn(s)
  if (m.w.q === 1 && m.w.r === 0 && m.w.b === 0 && m.w.n === 0 && m.w.p === 0 &&
      m.b.q === 0 && m.b.r === 0 && m.b.b === 0 && m.b.n === 0 && m.b.p >= 1 && m.b.p <= 2) {
    categories.push('queen_vs_pawn_white');
  }
  if (m.b.q === 1 && m.b.r === 0 && m.b.b === 0 && m.b.n === 0 && m.b.p === 0 &&
      m.w.q === 0 && m.w.r === 0 && m.w.b === 0 && m.w.n === 0 && m.w.p >= 1 && m.w.p <= 2) {
    categories.push('queen_vs_pawn_black');
  }

  // Queen vs minor + pawn(s)
  if (m.w.q === 1 && m.w.r === 0 && m.w.p === 0 &&
      m.b.q === 0 && m.b.r === 0 && (m.b.b + m.b.n) >= 1 && m.b.p >= 1) {
    categories.push('queen_vs_minor_pawn_white');
  }
  if (m.b.q === 1 && m.b.r === 0 && m.b.p === 0 &&
      m.w.q === 0 && m.w.r === 0 && (m.w.b + m.w.n) >= 1 && m.w.p >= 1) {
    categories.push('queen_vs_minor_pawn_black');
  }

  return categories;
}

// ── Main ──

async function main() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  console.log('Downloading PGN files...\n');

  const results = {
    kp_vs_k: [],
    k2p_vs_k: [],
    pawn_ending: [],
    rook_ending: [],
    krp_vs_kr: [],
    queen_vs_pawn: [],
    queen_vs_minor_pawn: [],
  };

  for (const player of PLAYERS) {
    const pgnText = await downloadPlayer(player);
    if (!pgnText) continue;

    const games = splitPgnGames(pgnText);
    console.log(`  Parsing ${games.length} games for ${player}...`);

    let found = 0;
    for (const gamePgn of games) {
      const white = extractHeader(gamePgn, 'White');
      const black = extractHeader(gamePgn, 'Black');
      const event = extractHeader(gamePgn, 'Event');
      const date = extractHeader(gamePgn, 'Date');
      const result = extractHeader(gamePgn, 'Result');
      const year = date ? date.split('.')[0] : '';

      // Only decisive games
      if (result !== '1-0' && result !== '0-1') continue;

      // Bonus score if both players are famous
      const bothFamous = isPlayerFamous(white) && isPlayerFamous(black);

      const chess = new Chess();
      // Extract moves text (everything after the blank line separating headers from moves)
      const movesMatch = gamePgn.match(/\n\s*\n([\s\S]*)/);
      if (!movesMatch) continue;
      const movesText = movesMatch[1].replace(/\{[^}]*\}/g, '').replace(/\([^)]*\)/g, '').replace(/\r/g, '');

      // Parse move tokens — handle "29.Kxe4" and "29..." formats
      const rawTokens = movesText.split(/\s+/).filter(t => t);
      const tokens = [];
      for (const t of rawTokens) {
        if (t === '1-0' || t === '0-1' || t === '1/2-1/2' || t === '*') continue;
        // Strip move number prefix: "29.Kxe4" → "Kxe4", "29..." → skip
        const stripped = t.replace(/^\d+\.+\s*/, '');
        if (stripped && stripped !== '..') tokens.push(stripped);
      }

      let moveNum = 0;
      for (const token of tokens) {
        try {
          chess.move(token);
        } catch {
          break;
        }
        moveNum++;

        // Only check after move 30 (endgame territory)
        if (moveNum < 30) continue;

        const fen = chess.fen();
        const cats = classifyPosition(fen);

        for (const cat of cats) {
          const key = cat.replace(/_white$|_black$/, '').replace('krp_vs_kr', 'krp_vs_kr');
          const baseKey = key === 'kp_vs_k' ? 'kp_vs_k'
            : key === 'k2p_vs_k' ? 'k2p_vs_k'
            : key === 'krp_vs_kr' ? 'krp_vs_kr'
            : key;

          if (!results[baseKey]) continue;

          // Determine which color is the "winner" side
          const winnerIsWhite = result === '1-0';
          let playerColor;
          if (cat.endsWith('_white')) playerColor = winnerIsWhite ? 'white' : 'black';
          else if (cat.endsWith('_black')) playerColor = winnerIsWhite ? 'black' : 'white';
          else playerColor = winnerIsWhite ? 'white' : 'black';

          // For specific categories: player should be the winning side
          // For KP vs K: player is the side with the pawn
          if (cat === 'kp_vs_k_white' || cat === 'k2p_vs_k_white') playerColor = 'white';
          if (cat === 'kp_vs_k_black' || cat === 'k2p_vs_k_black') playerColor = 'black';
          if (cat === 'queen_vs_pawn_white' || cat === 'queen_vs_minor_pawn_white') playerColor = 'white';
          if (cat === 'queen_vs_pawn_black' || cat === 'queen_vs_minor_pawn_black') playerColor = 'black';
          // For KRP vs KR: player is the side with the pawn (attacking)
          if (cat === 'krp_vs_kr_white') playerColor = 'white';
          if (cat === 'krp_vs_kr_black') playerColor = 'black';

          results[baseKey].push({
            fen,
            white,
            black,
            event,
            year,
            result,
            moveNum,
            playerColor,
            bothFamous,
            category: cat,
          });
        }
      }
      found++;
    }
    console.log(`  → Processed ${found} decisive games\n`);
  }

  // Deduplicate: keep only the first (earliest) position per game
  for (const key of Object.keys(results)) {
    const seen = new Set();
    results[key] = results[key].filter(p => {
      const gameKey = `${p.white}|${p.black}|${p.event}`;
      if (seen.has(gameKey)) return false;
      seen.add(gameKey);
      return true;
    });
  }

  // Sort: prefer games between famous players, then by move number (earlier = more instructive)
  for (const key of Object.keys(results)) {
    results[key].sort((a, b) => {
      if (a.bothFamous !== b.bothFamous) return b.bothFamous - a.bothFamous;
      return a.moveNum - b.moveNum;
    });
  }

  // Map internal categories to display categories
  const CATEGORY_MAP = {
    kp_vs_k: 'Pawn Endgames',
    k2p_vs_k: 'Pawn Endgames',
    pawn_ending: 'Pawn Endgames',
    rook_ending: 'Rook Endgames',
    krp_vs_kr: 'Rook Endgames',
    queen_vs_pawn: 'Queen Endgames',
    queen_vs_minor_pawn: 'Queen Endgames',
  };

  // Build flat array of all positions with display categories
  const allPositions = [];
  const counters = { pawn: 0, rook: 0, queen: 0 };

  for (const [key, positions] of Object.entries(results)) {
    const displayCategory = CATEGORY_MAP[key];
    const prefix = displayCategory === 'Pawn Endgames' ? 'pawn'
      : displayCategory === 'Rook Endgames' ? 'rook' : 'queen';

    for (const p of positions) {
      counters[prefix]++;
      const id = `${prefix}-${String(counters[prefix]).padStart(3, '0')}`;
      const source = `${p.white} vs ${p.black}, ${p.event} ${p.year}`.replace(/\s+/g, ' ').trim();

      allPositions.push({
        id,
        fen: p.fen,
        playerColor: p.playerColor,
        category: displayCategory,
        subcategory: key,
        source,
        bothFamous: p.bothFamous,
      });
    }
  }

  // Print summary
  console.log('\n=== RESULTS ===\n');
  for (const [key, positions] of Object.entries(results)) {
    console.log(`  ${key}: ${positions.length} positions`);
  }
  console.log(`\n  Total: ${allPositions.length} positions`);
  console.log(`  Pawn: ${counters.pawn}, Rook: ${counters.rook}, Queen: ${counters.queen}`);

  // Write JS file directly importable by the app
  const jsPath = path.join(__dirname, '..', 'src', 'data', 'endgamePositions.js');
  const jsLines = ['const ENDGAME_POSITIONS = ['];
  for (const p of allPositions) {
    jsLines.push(`  ${JSON.stringify(p)},`);
  }
  jsLines.push('];');
  jsLines.push('');
  jsLines.push('export default ENDGAME_POSITIONS;');
  jsLines.push('');
  fs.writeFileSync(jsPath, jsLines.join('\n'));
  console.log(`\nWrote ${jsPath} (${allPositions.length} positions)`);
}

main().catch(console.error);
