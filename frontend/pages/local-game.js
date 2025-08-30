import { useState } from "react";
import Navbar from "@/components/NavBar";
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';
import { useLocalGame } from '@/hooks/useLocalGame';
import CapturedPieces from "@/components/CapturedPieces";
import MoveList from "@/components/MoveList";
import Timer from "@/components/Timer";
import PromotionModal from "@/components/PromotionModal";
import { calculateCapturedPieces } from "@/lib/utils";

const LocalChessboard = dynamic(() => import('@/components/LocalChessboard'), { ssr: false });



export default function LocalGamePage() {
  
  // Use the extracted logic hook for local (pass-and-play) games
  const {
    chess,
    fen,
    history,
    capturedPieces,
    gameStatus,
    whiteTime,
    blackTime,
    showPromotionModal,
    handleMove,
    handlePromotion,
    handleNewGame,
    handleResign
  } = useLocalGame();

  const getLegalMoves = (square) => {
    try {
      if (!chess) return [];
      return chess.moves({ square, verbose: true }) || [];
    } catch (e) { return []; }
  };

  const [whitePlayer] = useState({ username: 'White' });
  const [blackPlayer] = useState({ username: 'Black' });

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-bg text-text flex flex-col lg:flex-row lg:justify-center lg:items-start p-4 gap-4">
        <Toaster position="bottom-center" />
        <div className="flex-grow flex justify-center items-center">
          <div className="w-[90vh] max-w-[90vw] aspect-square shadow-lg rounded-lg overflow-hidden">
            {chess && <LocalChessboard position={fen} onDrop={handleMove} turn={chess.turn()} getLegalMoves={getLegalMoves} />}
          </div>
        </div>

        <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-4">
          <div className="bg-panel p-4 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Local Game</h2>
            <div className="flex flex-col sm:flex-row sm:justify-around mb-2 gap-2">
                <div className={`p-2 rounded ${chess && chess.turn() === 'w' ? 'bg-accent text-white' : ''}`}>
          <Timer 
            player={{ username: 'White' }}
            timeLeft={whiteTime}
            isActive={gameStatus === 'in_progress' && chess?.turn() === 'w'}
          />
                </div>
                <div className={`p-2 rounded ${chess && chess.turn() === 'b' ? 'bg-accent text-white' : ''}`}>
          <Timer 
            player={{ username: 'Black' }}
            timeLeft={blackTime}
            isActive={gameStatus === 'in_progress' && chess?.turn() === 'b'}
          />
                </div>
            </div>
            <div className="flex justify-between">
              <CapturedPieces captured={capturedPieces.b} color="white" />
              <CapturedPieces captured={capturedPieces.w} color="black" />
            </div>
            <div className="mt-4">
              <h3 className="font-bold">Status: <span className="font-normal">{gameStatus}</span></h3>
              <h3 className="font-bold">Turn: <span className="font-normal">{chess ? (chess.turn() === 'w' ? 'White' : 'Black') : 'N/A'}</span></h3>
            </div>
            <div className="flex gap-2 mt-4">
        <button className="btn flex-1 bg-green-600 hover:bg-green-700" onClick={handleNewGame}>New Game</button>
              {gameStatus === 'in_progress' && (
                <>
          <button className="btn flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleResign('white')}>White Resigns</button>
          <button className="btn flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleResign('black')}>Black Resigns</button>
                </>
              )}
            </div>
          </div>
          <MoveList history={history} />
        </div>
      </div>
      {showPromotionModal && (
        <PromotionModal 
          onSelect={handlePromotion} 
          color={chess.turn() === 'w' ? 'w' : 'b'} 
        />
      )}
    </>
  );
}
