import dynamic from 'next/dynamic';
import { useState } from 'react';
import toast from 'react-hot-toast';

const Chessboard = dynamic(() => import('chessboardjsx'), {
  ssr: false,
  loading: () => <div className="text-center text-gray-400">Loading board...</div>,
});

export default function LocalChessboard({ fen, onMove, turn, playerColor }) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);

  // Handle square click for click-to-move
  const handleSquareClick = (square) => {
    try {
      if (!selectedSquare) {
        setSelectedSquare(square);
        // Get legal moves for this piece
        if (window.chess) {
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
          onMove({ sourceSquare: selectedSquare, targetSquare: square });
          setSelectedSquare(null);
          setLegalMoves([]);
        } else if (square === selectedSquare) {
          setSelectedSquare(null);
          setLegalMoves([]);
        } else {
          setSelectedSquare(square);
          if (window.chess) {
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
    <div className="w-full h-full">
      <Chessboard
        position={fen}
        onDrop={onMove}
        onSquareClick={handleSquareClick}
        draggable={true}
        width="100%"
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