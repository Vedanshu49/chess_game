import { useState, useEffect } from 'react';

const PIECE_VALUES = {
  'p': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9
};

export default function CapturedPieces({ fen, moves }) {
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [materialDiff, setMaterialDiff] = useState(0);

  useEffect(() => {
    const standardPieces = {
      'p': 8, 'n': 2, 'b': 2, 'r': 2, 'q': 1, 'k': 1,
      'P': 8, 'N': 2, 'B': 2, 'R': 2, 'Q': 1, 'K': 1
    };
    
    // Count current pieces from FEN
    const currentPieces = {};
    const piecesSection = fen.split(' ')[0];
    [...piecesSection].forEach(char => {
      if (/[pnbrqkPNBRQK]/.test(char)) {
        currentPieces[char] = (currentPieces[char] || 0) + 1;
      }
    });

    // Calculate captured pieces
    const captured = {
      white: [], // pieces captured by white
      black: []  // pieces captured by black
    };

    let diff = 0;

    Object.entries(standardPieces).forEach(([piece, count]) => {
      const current = currentPieces[piece] || 0;
      const captured_count = count - current;
      
      if (captured_count > 0) {
        const isWhitePiece = piece === piece.toUpperCase();
        const array = isWhitePiece ? captured.black : captured.white;
        for (let i = 0; i < captured_count; i++) {
          array.push(piece);
          // Update material difference
          if (isWhitePiece) {
            diff -= PIECE_VALUES[piece.toLowerCase()] || 0;
          } else {
            diff += PIECE_VALUES[piece.toLowerCase()] || 0;
          }
        }
      }
    });

    setCapturedPieces(captured);
    setMaterialDiff(diff);
  }, [fen]);

  const renderPiece = (piece) => {
    return (
      <span key={`${piece}-${Math.random()}`} className="inline-block w-6 h-6">
        {piece.toLowerCase() === 'p' && (piece === 'p' ? '♟' : '♙')}
        {piece.toLowerCase() === 'n' && (piece === 'n' ? '♞' : '♘')}
        {piece.toLowerCase() === 'b' && (piece === 'b' ? '♝' : '♗')}
        {piece.toLowerCase() === 'r' && (piece === 'r' ? '♜' : '♖')}
        {piece.toLowerCase() === 'q' && (piece === 'q' ? '♛' : '♕')}
        {piece.toLowerCase() === 'k' && (piece === 'k' ? '♚' : '♔')}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-2 p-2 rounded-lg bg-[#0e141b] border border-[#233041]">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {capturedPieces.white.map(renderPiece)}
        </div>
        {materialDiff !== 0 && (
          <span className={`text-sm ${materialDiff > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {materialDiff > 0 ? '+' : ''}{materialDiff}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {capturedPieces.black.map(renderPiece)}
        </div>
      </div>
    </div>
  );
}
