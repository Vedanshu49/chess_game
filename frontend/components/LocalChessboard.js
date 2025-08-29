import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';

const Chessboard = dynamic(() => import('chessboardjsx'), {
  ssr: false,
  loading: () => <div className="text-center text-gray-400">Loading board...</div>,
});

export default function LocalChessboard({ fen, onMove }) {
  const boardRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState(null); // New state for click-to-move

  useEffect(() => {
    const handleResize = () => {
      if (boardRef.current) {
        setBoardWidth(boardRef.current.offsetWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial width

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSquareClick = (square) => {
    if (selectedSquare) {
      // Second click: attempt to move
      onMove({ sourceSquare: selectedSquare, targetSquare: square });
      setSelectedSquare(null); // Clear selection
    } else {
      // First click: select the square
      setSelectedSquare(square);
    }
  };

  return (
    <div ref={boardRef} className="w-full h-full">
      {boardWidth > 0 && (
        <Chessboard
          position={fen}
          onDrop={onMove}
          onSquareClick={handleSquareClick} // Add onSquareClick handler
          draggable={true}
          width={boardWidth}
          boardStyle={{
            borderRadius: '5px',
            boxShadow: `0 5px 15px rgba(0, 0, 0, 0.5)`,
          }}
        />
      )}
    </div>
  );
}