import { useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabasejs';
import Navbar from '../../components/NavBar';
import CapturedPieces from '../../components/CapturedPieces';
import MoveList from '../../components/MoveList';
import Timer from '../../components/Timer';
import Chat from '../../components/Chat';
import PromotionModal from '../../components/PromotionModal';
import GameSkeleton from '../../components/GameSkeleton';
import { useOnlineGame } from '@/hooks/useOnlineGame';

const Chessboard = dynamic(() => import('../../components/LocalChessboard'), { ssr: false });

export default function GamePage() {
    const router = useRouter();
    const { id: gameId } = router.query;

    // Use the extracted hook for the online game logic
    const {
        chess,
        game,
        fen,
        history,
        capturedPieces,
        gameOver,
        whitePlayer,
        blackPlayer,
        user,
        authLoading,
        playerColor,
        whiteTime,
        blackTime,
        isClient,
        pageLoading,
        fenError,
        showPromotionModal,
        awaitingPromotion,
        pendingMove,
        isMyTurn,
        bothPlayersJoined,
        handleMove,
        handlePromotion,
        handleResign,
        fetchGameData
    } = useOnlineGame(gameId);
    

    useEffect(() => { // keep compatibility: fetch when route param available
        if (gameId) fetchGameData();
    }, [gameId]);

    if (pageLoading) return <GameSkeleton />;

    const PlayerInfo = ({ player, color, isTurn }) => {
        const timeLeft = color === 'w' ? whiteTime : blackTime;
        return (
            <div className={`p-3 rounded-lg ${isTurn ? 'bg-blue-600' : 'bg-gray-700'} transition-colors duration-300`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-full"></div>
                    <div>
                        <h3 className="font-bold text-lg">{player?.username || '...'}</h3>
                        <p className="text-sm text-gray-300">Rating: {player?.rating || 'N/A'}</p>
                    </div>
                </div>
                <Timer player={player} timeLeft={timeLeft} isActive={isTurn && !gameOver.over && bothPlayersJoined} waitingForOpponent={!bothPlayersJoined} />
                <CapturedPieces captured={capturedPieces[color === 'w' ? 'b' : 'w']} />
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            <Navbar />
            {fenError && (
                <div className="w-full p-3 bg-red-700 text-white text-center flex items-center justify-between gap-4">
                    <div className="flex-1 text-left">
                        <div className="font-semibold">{fenError}</div>
                        <div className="text-sm opacity-75 mt-1">Debug: playerColor={playerColor || 'null'} | isMyTurn={String(isMyTurn)} | awaitingPromotion={String(awaitingPromotion)}</div>
                    </div>
                </div>
            )}

            <div className="flex-grow flex lg:flex-row flex-col gap-4 p-4">
                <div className="w-full lg:w-64 flex-shrink-0">
                    <PlayerInfo player={whitePlayer} color="w" isTurn={chess?.turn() === 'w'} />
                </div>

                <div className="flex-grow flex justify-center items-start">
                    <div className="w-full max-w-[90vw] md:max-w-[75vh] aspect-square mx-auto">
                        {game?.status === 'waiting' && (
                            <div className="bg-panel p-6 rounded-lg text-center">
                                <h3 className="text-lg font-semibold mb-2">Waiting for opponent...</h3>
                                {game.invite_code ? (
                                    <div>
                                        <p className="text-sm text-gray-300">Share this code with your friend to join:</p>
                                        <div className="font-mono text-2xl p-2 bg-gray-800 rounded inline-block mt-2 cursor-pointer" onClick={() => { navigator.clipboard.writeText(game.invite_code); toast.success('Invite code copied!') }}>{game.invite_code}</div>
                                    </div>
                                ) : (
                                    <p className="text-gray-300">Looking for a random opponent...</p>
                                )}
                                <button className="btn mt-4 bg-red-600" onClick={async () => { await supabase.from('games').delete().eq('id', game.id); router.push('/dashboard'); }}>Cancel</button>
                            </div>
                        )}
                        {isClient && game?.status !== 'waiting' && <Chessboard position={fen} onDrop={handleMove} getLegalMoves={(sq) => chess ? chess.moves({ square: sq, verbose: true }) : []} orientation={playerColor || 'white'} draggable={!gameOver.over && isMyTurn} />}
                    </div>
                </div>

                <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                    <PlayerInfo player={blackPlayer} color="b" isTurn={chess?.turn() === 'b'} />
                    <div className="bg-panel p-4 rounded-lg shadow-lg">
                        <MoveList history={history} />
                        {!gameOver.over && (
                            <button onClick={handleResign} className="mt-4 w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold">Resign</button>
                        )}
                    </div>
                    {game && <Chat gameId={game.id} user={user} />}
                </div>
            </div>

            {showPromotionModal && (
                <PromotionModal onSelectPromotion={handlePromotion} color={playerColor} />
            )}
        </div>
    );
}