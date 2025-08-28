import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';

const Chessboard = dynamic(() => import('chessboardjsx'), {
  ssr: false,
  loading: () => <div className="text-center text-gray-400">Loading board...</div>,
});

export default function LocalChessboard({ fen, onMove }) {
  const boardRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(0);

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

  return (
    <div ref={boardRef} className="w-full h-full">
      {boardWidth > 0 && (
        <Chessboard
          position={fen}
          onDrop={onMove}
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