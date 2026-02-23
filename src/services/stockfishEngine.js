class StockfishEngine {
  constructor() {
    this.worker = null;
    this.onBestMove = null;
    this.isReady = false;
  }

  init() {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(process.env.PUBLIC_URL + '/stockfish.js');

        this.worker.onmessage = (event) => {
          const message = event.data;
          if (typeof message !== 'string') return;

          if (message === 'uciok') {
            this.send('isready');
          } else if (message === 'readyok') {
            this.isReady = true;
            resolve();
          } else if (message.startsWith('bestmove')) {
            const parts = message.split(' ');
            const move = parts[1];
            if (this.onBestMove && move && move !== '(none)') {
              this.onBestMove(move);
            }
          }
        };

        this.worker.onerror = (error) => {
          console.error('Stockfish worker error:', error);
          reject(error);
        };

        this.send('uci');
      } catch (error) {
        reject(error);
      }
    });
  }

  send(command) {
    if (this.worker) {
      this.worker.postMessage(command);
    }
  }

  // elo: 1320–3190 (Stockfish UCI_Elo range)
  // playerRating: the app's player rating (200-2500) used to scale think time
  getBestMove(fen, elo, playerRating = 400) {
    if (!this.isReady) return;

    // Scale think time: low ratings = instant, high ratings = brief pause
    // 200 → 50ms, 800 → 150ms, 1500 → 300ms, 2500 → 500ms
    const thinkTime = Math.round(50 + (Math.min(playerRating, 2500) - 200) * (450 / 2300));

    this.send('setoption name UCI_LimitStrength value true');
    this.send('setoption name UCI_Elo value ' + elo);
    this.send('position fen ' + fen);
    this.send('go movetime ' + thinkTime);
  }

  stop() {
    this.send('stop');
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

export default StockfishEngine;
