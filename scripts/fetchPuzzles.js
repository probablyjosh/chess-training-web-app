#!/usr/bin/env node

/**
 * Fetches checkmate and endgame puzzles from the Lichess puzzle database (CC0 licensed).
 * Every puzzle comes from a real game played on Lichess.
 *
 * Usage: node --max-old-space-size=4096 scripts/fetchPuzzles.js
 *
 * Downloads https://database.lichess.org/lichess_db_puzzle.csv.zst,
 * decompresses, filters for mate and endgame themes,
 * and writes static JS data files.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const PUZZLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const TEMP_FILE = path.join(__dirname, 'puzzles.csv.zst');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data');

// Checkmate puzzle targets
const MATE_TARGETS = {
  mateIn1: { theme: 'mateIn1', count: 200, filename: 'mateIn1Puzzles.js', varName: 'MATE_IN_1_PUZZLES' },
  mateIn2: { theme: 'mateIn2', count: 400, filename: 'mateIn2Puzzles.js', varName: 'MATE_IN_2_PUZZLES' },
  mateIn3: { theme: 'mateIn3', count: 100, filename: 'mateIn3Puzzles.js', varName: 'MATE_IN_3_PUZZLES' },
};

// Endgame puzzle sub-category targets (processed in priority order)
const ENDGAME_CATEGORIES = [
  { key: 'pawnEndgame',   label: 'Pawn Endgames',            filter: t => t.includes('pawnEndgame'),   count: 250 },
  { key: 'rookEndgame',   label: 'Rook Endgames',            filter: t => t.includes('rookEndgame'),   count: 300 },
  { key: 'minorPiece',    label: 'Minor Piece Endgames',     filter: t => t.includes('bishopEndgame') || t.includes('knightEndgame'), count: 150 },
  { key: 'passedPawn',    label: 'Passed Pawn & Conversion', filter: t => t.includes('endgame') && (t.includes('advancedPawn') || t.includes('promotion')), count: 150 },
  { key: 'universal',     label: 'Core Universal Themes',    filter: t => t.includes('endgame') && (t.includes('zugzwang') || t.includes('stalemate') || t.includes('defensiveMove')), count: 100 },
  { key: 'general',       label: 'General Endgame',          filter: t => t.includes('endgame'), count: 100 },
];

function followRedirects(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(followRedirects(res.headers.location));
      } else {
        resolve(res);
      }
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise(async (resolve, reject) => {
    const res = await followRedirects(url);
    const total = parseInt(res.headers['content-length'], 10) || 0;
    let downloaded = 0;
    let lastPct = 0;

    const file = fs.createWriteStream(dest);

    res.on('data', (chunk) => {
      downloaded += chunk.length;
      const pct = total ? Math.floor((downloaded / total) * 100) : 0;
      if (pct >= lastPct + 5) {
        lastPct = pct;
        const mb = (downloaded / 1024 / 1024).toFixed(1);
        const totalMb = total ? (total / 1024 / 1024).toFixed(1) : '?';
        process.stdout.write(`\rDownloading: ${mb}MB / ${totalMb}MB (${pct}%)`);
      }
    });

    res.pipe(file);
    file.on('finish', () => {
      console.log('\nDownload complete.');
      file.close(resolve);
    });
    file.on('error', reject);
    res.on('error', reject);
  });
}

function transformPuzzle(cols) {
  // CSV: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const [puzzleId, fenBefore, movesStr, rating, , popularity, nbPlays, themes] = cols;

  if (!puzzleId || !fenBefore || !movesStr) return null;

  // Quality filters
  if (Number(popularity) <= 0 || Number(nbPlays) < 500) return null;

  const moves = movesStr.split(' ');
  if (moves.length < 2) return null;

  // Apply setup move to get the actual puzzle position
  let chess;
  try {
    chess = new Chess(fenBefore);
  } catch {
    return null;
  }

  const setupMove = moves[0];
  try {
    chess.move({
      from: setupMove.slice(0, 2),
      to: setupMove.slice(2, 4),
      promotion: setupMove.length > 4 ? setupMove[4] : undefined,
    });
  } catch {
    return null;
  }

  const puzzleFen = chess.fen();
  const playerColor = chess.turn() === 'w' ? 'white' : 'black';
  const solution = moves.slice(1); // Player's solution + opponent responses

  return {
    id: `lichess-${puzzleId}`,
    fen: puzzleFen,
    solution,
    playerColor,
    rating: Number(rating),
  };
}

function processCsv(csvPath) {
  const readline = require('readline');

  return new Promise((resolve) => {
    console.log('Streaming CSV line by line...');

    // Mate results
    const mateResults = { mateIn1: [], mateIn2: [], mateIn3: [] };
    const mateNeeded = { mateIn1: 200, mateIn2: 400, mateIn3: 100 };

    // Endgame results (keyed by category key)
    const endgameResults = {};
    const endgameNeeded = {};
    for (const cat of ENDGAME_CATEGORIES) {
      endgameResults[cat.key] = [];
      endgameNeeded[cat.key] = cat.count;
    }

    let processed = 0;
    let isFirstLine = true;

    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (isFirstLine) { isFirstLine = false; return; }
      if (!line) return;

      const cols = line.split(',');
      if (cols.length < 8) return;

      const themes = cols[7];

      // Check mate puzzles
      if (themes.includes('mateIn')) {
        for (const [key, config] of Object.entries(MATE_TARGETS)) {
          if (mateResults[key].length >= mateNeeded[key]) continue;
          if (!themes.includes(config.theme)) continue;

          if (key === 'mateIn2' && themes.includes('mateIn1')) continue;
          if (key === 'mateIn3' && (themes.includes('mateIn1') || themes.includes('mateIn2'))) continue;

          const puzzle = transformPuzzle(cols);
          if (puzzle) {
            mateResults[key].push(puzzle);
          }
        }
      }

      // Check endgame puzzles (skip if it's a mate puzzle to avoid overlap)
      if (themes.includes('endgame') || themes.includes('pawnEndgame') || themes.includes('rookEndgame') ||
          themes.includes('bishopEndgame') || themes.includes('knightEndgame')) {
        // Skip mate puzzles
        if (themes.includes('mateIn1') || themes.includes('mateIn2') || themes.includes('mateIn3')) {
          // allow through — endgame mates are fine
        }

        // Try each category in priority order
        for (const cat of ENDGAME_CATEGORIES) {
          if (endgameResults[cat.key].length >= endgameNeeded[cat.key]) continue;
          if (!cat.filter(themes)) continue;

          const puzzle = transformPuzzle(cols);
          if (puzzle) {
            puzzle.category = cat.label;
            endgameResults[cat.key].push(puzzle);
          }
          break; // Only assign to first matching category
        }
      }

      processed++;
      if (processed % 100000 === 0) {
        const mStr = `m1:${mateResults.mateIn1.length} m2:${mateResults.mateIn2.length} m3:${mateResults.mateIn3.length}`;
        const eStr = ENDGAME_CATEGORIES.map(c => `${c.key}:${endgameResults[c.key].length}`).join(' ');
        console.log(`Processed ${processed} lines... ${mStr} | ${eStr}`);
      }

      // Check if all targets met
      const allMatesDone = Object.keys(mateNeeded).every(k => mateResults[k].length >= mateNeeded[k]);
      const allEndgamesDone = ENDGAME_CATEGORIES.every(c => endgameResults[c.key].length >= endgameNeeded[c.key]);
      if (allMatesDone && allEndgamesDone) {
        console.log('Collected enough puzzles!');
        rl.close();
      }
    });

    rl.on('close', () => resolve({ mateResults, endgameResults }));
  });
}

function writeDataFile(puzzles, { filename, varName, count, includeCategory }) {
  // Sort by rating ascending (easiest first), take first `count`
  const selected = puzzles
    .sort((a, b) => a.rating - b.rating)
    .slice(0, count)
    .map(p => {
      const obj = { id: p.id, fen: p.fen, solution: p.solution, playerColor: p.playerColor, rating: p.rating };
      if (includeCategory && p.category) obj.category = p.category;
      return obj;
    });

  const content = `const ${varName} = ${JSON.stringify(selected, null, 2)};\n\nexport default ${varName};\n`;
  const outPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outPath, content);
  console.log(`Wrote ${selected.length} puzzles to ${filename}`);
}

async function main() {
  // Step 1: Download
  if (!fs.existsSync(TEMP_FILE)) {
    console.log('Downloading Lichess puzzle database...');
    console.log('(This is ~250MB and may take several minutes)');
    await downloadFile(PUZZLE_URL, TEMP_FILE);
  } else {
    console.log('Using cached download:', TEMP_FILE);
  }

  // Step 2: Decompress
  const csvPath = TEMP_FILE.replace('.zst', '');
  if (!fs.existsSync(csvPath)) {
    console.log('Decompressing with fzstd...');
    const fzstd = require('fzstd');
    const compressed = fs.readFileSync(TEMP_FILE);
    const decompressed = fzstd.decompress(new Uint8Array(compressed));
    fs.writeFileSync(csvPath, Buffer.from(decompressed));
    console.log(`Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(1)}MB`);
  } else {
    console.log('Using cached CSV:', csvPath);
  }

  // Step 3: Parse and filter
  const { mateResults, endgameResults } = await processCsv(csvPath);

  console.log(`\nMate Results:`);
  console.log(`  mateIn1: ${mateResults.mateIn1.length} puzzles`);
  console.log(`  mateIn2: ${mateResults.mateIn2.length} puzzles`);
  console.log(`  mateIn3: ${mateResults.mateIn3.length} puzzles`);

  console.log(`\nEndgame Results:`);
  for (const cat of ENDGAME_CATEGORIES) {
    console.log(`  ${cat.key}: ${endgameResults[cat.key].length} puzzles`);
  }

  // Step 4: Write mate data files
  for (const [key, config] of Object.entries(MATE_TARGETS)) {
    writeDataFile(mateResults[key], { ...config, includeCategory: false });
  }

  // Step 5: Write endgame data file (combine all sub-categories)
  const allEndgame = [];
  for (const cat of ENDGAME_CATEGORIES) {
    allEndgame.push(...endgameResults[cat.key]);
  }
  writeDataFile(allEndgame, {
    filename: 'endgamePuzzles.js',
    varName: 'ENDGAME_PUZZLES',
    count: 1050,
    includeCategory: true,
  });

  // Cleanup temp files
  console.log('\nCleaning up temp files...');
  try { fs.unlinkSync(TEMP_FILE); } catch {}
  try { fs.unlinkSync(csvPath); } catch {}

  console.log('Done! Puzzle data files generated successfully.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
