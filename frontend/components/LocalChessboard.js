import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Chessboard = dynamic(() => import('chessboardjsx'), {
  ssr: false,
  loading: () => <div className="text-center text-gray-400">Loading board...</div>,
});

export default function LocalChessboard() {
  const [game, setGame] = useState(null);
  const [fen, setFen] = useState('start');

  useEffect(() => {
    const loadChess = async () => {
      // Use dynamic import to load chess.js
      const { Chess } = await import('chess.js');
      const chessGame = new Chess();
      setGame(chessGame);
    };

    loadChess();
  }, []); // The empty dependency array ensures this effect runs only once

  function onDrop({ sourceSquare, targetSquare }) {
    if (!game) return;

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to a queen for simplicity
      });

      // if the move is illegal, game.move returns null
      if (move === null) {
        return;
      }

      setFen(game.fen());
    } catch (error) {
      console.log('Invalid move:', error);
      // you might want to provide feedback to the user here
    }
  }

  if (!game) {
    return <div className="text-center text-gray-400">Loading game engine...</div>;
  }

  return (
    <div className="flex flex-col items-center">
      <Chessboard
        position={fen}
        width={400}
        onDrop={onDrop}
        draggable={true}
      />
    </div>
  );
}