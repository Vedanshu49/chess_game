import dynamic from 'next/dynamic';
import { useState } from 'react';
import toast from 'react-hot-toast';

const Chessboard = dynamic(() => import('chessboardjsx'), {
  ssr: false,
  loading: () => <div className="text-center text-gray-400">Loading board...</div>,
});

// If you need SSR fallback, handle it in the parent page/component, not here.

export default function LocalChessboard({ position, onDrop, turn, playerColor }) {
  // Standard starting FEN
  const standardFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // FEN validation for 8x8 board
  function isValidFen(f) {
    if (!f) return false;
    const rows = f.split(' ')[0].split('/');
    if (rows.length !== 8) return false;
    for (const row of rows) {
      let count = 0;
      for (const char of row) {
        if (/[1-8]/.test(char)) count += parseInt(char, 10);
        else count += 1;
      }
      if (count !== 8) return false;
    }
    return true;
  }

  // Use fallback FEN if invalid
  const safeFen = isValidFen(position) ? position : standardFEN;

  // If incoming position was invalid, warn but render fallback board
  if (!isValidFen(position)) {
    // don't block render; show fallback board and log for debugging
    // console.warn('Invalid FEN provided to LocalChessboard, using standard starting position.');
  }
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);

  // Handle square click for click-to-move
  const handleSquareClick = (square) => {
    try {
      if (!selectedSquare) {
        setSelectedSquare(square);
        // Get legal moves for this piece
        if (typeof window !== 'undefined' && window.chess) {
          const moves = window.chess.moves({ square, verbose: true });
          if (moves.length === 0) {
            toast.error('No legal moves for this piece.');
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }
          setLegalMoves(moves.map(m => m.to));
        }
      } else {
        if (legalMoves.includes(square)) {
          if (typeof onDrop === 'function') onDrop({ sourceSquare: selectedSquare, targetSquare: square });
          setSelectedSquare(null);
          setLegalMoves([]);
        } else if (square === selectedSquare) {
          setSelectedSquare(null);
          setLegalMoves([]);
        } else {
          setSelectedSquare(square);
          if (typeof window !== 'undefined' && window.chess) {
            const moves = window.chess.moves({ square, verbose: true });
            if (moves.length === 0) {
              toast.error('No legal moves for this piece.');
              setSelectedSquare(null);
              setLegalMoves([]);
              return;
            }
            setLegalMoves(moves.map(m => m.to));
          }
        }
      }
    } catch (err) {
      toast.error('Unexpected error during move selection.');
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  // Highlight legal moves
  const customSquareStyles = {};
  legalMoves.forEach(sq => {
    customSquareStyles[sq] = { background: 'rgba(80, 200, 120, 0.5)' };
  });
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { background: 'rgba(80, 120, 200, 0.5)' };
  }

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ minHeight: 400 }}>
      <Chessboard
        position={safeFen}
        onDrop={onDrop}
        onSquareClick={handleSquareClick}
        draggable={true}
        width={400}
        boardStyle={{
          borderRadius: '5px',
          boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`,
        }}
        squareStyles={customSquareStyles}
        transitionDuration={300}
      />
    </div>
  );
}