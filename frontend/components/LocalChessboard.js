import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const Chessboard = dynamic(() => import('chessboardjsx'), {
  ssr: false,
  loading: () => <div className="text-center text-gray-400">Loading board...</div>,
});

// If you need SSR fallback, handle it in the parent page/component, not here.

export default function LocalChessboard({ position, onDrop, turn, playerColor, orientation = 'white', draggable = true }) {
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
  const containerRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(400);

  // Compute responsive board width based on container and viewport
  useEffect(() => {
    function updateWidth() {
      try {
        const margin = 32; // padding
        const parentWidth = containerRef.current ? containerRef.current.clientWidth : window.innerWidth - margin;
        // prefer almost-full width on mobile, cap at 720 and also cap by viewport height
        const vw = Math.min(parentWidth, window.innerWidth - margin);
        const vhCap = Math.min(window.innerHeight * 0.9, 720);
        const width = Math.min(vw, vhCap);
        setBoardWidth(Math.max(220, Math.floor(width)));
      } catch (e) {
        setBoardWidth(400);
      }
    }

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

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
    <div ref={containerRef} className="w-full h-full flex items-center justify-center" style={{ minHeight: 220 }}>
      <Chessboard
        position={safeFen}
        onDrop={onDrop}
        onSquareClick={handleSquareClick}
        draggable={draggable}
        orientation={orientation}
        width={boardWidth}
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