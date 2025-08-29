const initialPieces = {
  p: 8, r: 2, n: 2, b: 2, q: 1, k: 1
};

export function calculateCapturedPieces(fen) {
  const captured = { w: {}, b: {} };
  if (!fen) return captured;

  const piecesOnBoard = {
    w: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
    b: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
  };

  fen.split(' ')[0].split('/').forEach(row => {
    for (const char of row) {
      if (isNaN(parseInt(char))) { // if it is a piece
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const piece = char.toLowerCase();
        if (piecesOnBoard[color][piece] !== undefined) {
          piecesOnBoard[color][piece]++;
        }
      }
    }
  });

  for (const color of ['w', 'b']) {
    for (const piece in initialPieces) {
      const diff = initialPieces[piece] - piecesOnBoard[color][piece];
      if (diff > 0) {
        captured[color][piece] = diff;
      }
    }
  }

  return captured;
}
