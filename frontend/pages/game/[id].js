import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabasejs";
import { useAuth } from "@/lib/AuthProvider";
import dynamic from 'next/dynamic';
import toast, { Toaster } from 'react-hot-toast';
import { Chess } from 'chess.js';
import Navbar from "../../components/NavBar";
import CapturedPieces from "../../components/CapturedPieces";
import MoveList from "../../components/MoveList";
import Timer from "../../components/Timer";
import Chat from "../../components/Chat";
import PromotionModal from "../../components/PromotionModal";
import GameSkeleton from "../../components/GameSkeleton";
import { calculateCapturedPieces } from "../../lib/utils";

const Chessboard = dynamic(() => import('../../components/LocalChessboard'), { ssr: false });



export default function GamePage() {
    const router = useRouter();
    const { id: gameId } = router.query;
    const { user, loading: authLoading } = useAuth();

    const [game, setGame] = useState(null);
    const [chess, setChess] = useState(null);
    const [fen, setFen] = useState('start');
    const [history, setHistory] = useState([]);
    const [capturedPieces, setCapturedPieces] = useState({ w: {}, b: {} });
    const [playerColor, setPlayerColor] = useState(null);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [gameOver, setGameOver] = useState({ over: false, reason: '', winner: null });

    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [pendingMove, setPendingMove] = useState(null);

    const [whitePlayer, setWhitePlayer] = useState(null);
    const [blackPlayer, setBlackPlayer] = useState(null);

    const [pageLoading, setPageLoading] = useState(true);

    // Initialize chess.js
    useEffect(() => {
        setChess(new Chess());
    }, []);

    // Fetch game and player data
    const fetchGameData = useCallback(async () => {
        if (!gameId || !user || !chess) return;

        try {
            const { data: gameData, error } = await supabase
                .from('games')
                .select('*, creator_profile:profiles!creator(username, rating), opponent_profile:profiles!opponent(username, rating)')
                .eq('id', gameId)
                .single();

            if (error || !gameData) {
                toast.error('Game not found.');
                router.replace('/dashboard');
                return;
            }

            setGame(gameData);
            setFen(gameData.fen);
            chess.load(gameData.fen);
            setHistory(chess.history({ verbose: true }));
            setCapturedPieces(calculateCapturedPieces(gameData.fen));

            const userIsCreator = gameData.creator === user.id;
            const userIsOpponent = gameData.opponent === user.id;
            const color = userIsCreator ? 'w' : (userIsOpponent ? 'b' : null);
            setPlayerColor(color);

            setWhitePlayer(gameData.creator_profile || { username: 'Player 1' });
            setBlackPlayer(gameData.opponent_profile || { username: 'Waiting...' });

            if (gameData.status === 'finished') {
                setGameOver({ over: true, reason: gameData.winner_reason, winner: gameData.winner });
            }

        } catch (err) {
            console.error("Error fetching game data:", err);
            toast.error("Failed to load game.");
        } finally {
            setPageLoading(false);
        }
    }, [gameId, user, chess, router]);

    useEffect(() => {
        if (!authLoading) fetchGameData();
    }, [authLoading, fetchGameData]);

    // Real-time subscription
    useEffect(() => {
        if (!gameId || !chess) return;

        const channel = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, 
            async (payload) => {
                const newGame = payload.new;
                setGame(newGame);
                setFen(newGame.fen);
                chess.load(newGame.fen);
                setHistory(chess.history({ verbose: true }));
                setCapturedPieces(calculateCapturedPieces(newGame.fen));

                // Fetch opponent profile if they just joined
                if (payload.old.opponent === null && newGame.opponent !== null) {
                    const { data: opponentProfile } = await supabase.from('profiles').select('username, rating').eq('id', newGame.opponent).single();
                    setBlackPlayer(opponentProfile || { username: 'Player 2' });
                }

                if (newGame.status === 'finished') {
                    setGameOver({ over: true, reason: newGame.winner_reason, winner: newGame.winner });
                    const winnerUsername = newGame.winner === newGame.creator ? whitePlayer.username : blackPlayer.username;
                    let message = `Game over! ${winnerUsername} wins by ${newGame.winner_reason}.`;
                    if (newGame.winner === user?.id) {
                        toast.success(message);
                    } else {
                        toast.error(message);
                    }
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId, chess, user, whitePlayer, blackPlayer]);

    // Update whose turn it is
    useEffect(() => {
        if (!chess || !playerColor) return;
        setIsMyTurn(chess.turn() === playerColor);
    }, [fen, playerColor, chess]);


    const handleMove = useCallback(({ sourceSquare, targetSquare }) => {
        if (!chess || !isMyTurn || gameOver.over) return;

        const moves = chess.moves({ square: sourceSquare, verbose: true });
        const move = moves.find(m => m.to === targetSquare);

        if (!move) {
            toast.error("Invalid Move!");
            return;
        }

        // Is it a promotion?
        if (move.flags.includes('p')) {
            setPendingMove({ from: sourceSquare, to: targetSquare });
            setShowPromotionModal(true);
            return;
        }

        // Make the move
        const result = chess.move({ from: sourceSquare, to: targetSquare });
        if (result) updateBackendWithMove(result);

    }, [chess, isMyTurn, gameOver.over]);

    const handlePromotion = (promotionPiece) => {
        if (!chess || !pendingMove) return;
        const result = chess.move({ ...pendingMove, promotion: promotionPiece });
        if (result) updateBackendWithMove(result);
        setShowPromotionModal(false);
        setPendingMove(null);
    };

    const updateBackendWithMove = async (move) => {
        const newFen = chess.fen();
        let newStatus = game.status;
        let winner = null;
        let winner_reason = null;

        if (chess.isGameOver()) {
            newStatus = 'finished';
            if (chess.isCheckmate()) winner_reason = 'checkmate';
            else if (chess.isStalemate()) winner_reason = 'stalemate';
            else if (chess.isDraw()) winner_reason = 'draw';
            else if (chess.isThreefoldRepetition()) winner_reason = 'repetition';
            else if (chess.isInsufficientMaterial()) winner_reason = 'insufficient material';
            
            if (winner_reason !== 'draw' && winner_reason !== 'stalemate') {
                winner = move.color === 'w' ? game.creator : game.opponent;
            }
        }

        const { error } = await supabase
            .from('games')
            .update({ fen: newFen, last_move_at: new Date().toISOString(), status: newStatus, winner, winner_reason })
            .eq('id', gameId);

        if (error) {
            toast.error('Failed to save move. Reverting.');
            chess.undo();
            setFen(chess.fen());
        }
    };

    const handleResign = async () => {
        if (gameOver.over || !window.confirm('Are you sure you want to resign?')) return;

        const winner = playerColor === 'w' ? game.opponent : game.creator;
        const { error } = await supabase
            .from('games')
            .update({ status: 'finished', winner: winner, winner_reason: 'resignation' })
            .eq('id', gameId);

        if (error) toast.error('Error resigning: ' + error.message);
    };

    if (pageLoading || authLoading) {
        return <GameSkeleton />;
    }

    const PlayerInfo = ({ player, color, isTurn }) => (
        <div className={`p-3 rounded-lg ${isTurn ? 'bg-blue-600' : 'bg-gray-700'} transition-colors duration-300`}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full"></div> {/* Placeholder for Avatar */}
                <div>
                    <h3 className="font-bold text-lg">{player?.username || '...'}</h3>
                    <p className="text-sm text-gray-300">Rating: {player?.rating || 'N/A'}</p>
                </div>
            </div>
            <Timer initialTime={color === 'w' ? game.white_time_left : game.black_time_left} isRunning={!gameOver.over && isTurn} />
            <CapturedPieces captured={capturedPieces[color === 'w' ? 'b' : 'w']} />
        </div>
    );

    return (
        <>
            <Navbar />
            <Toaster position="bottom-center" />
            <div className="min-h-screen bg-gray-900 text-white flex flex-col lg:flex-row justify-center items-start p-4 gap-6">
                
                {/* Left Panel (Player Info) */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
                    <PlayerInfo player={blackPlayer} color="b" isTurn={chess?.turn() === 'b'} />
                </div>

                {/* Center Panel (Chessboard) */}
                <div className="flex-grow flex flex-col items-center">
                    <div className="w-full max-w-[75vh] aspect-square shadow-lg rounded-lg overflow-hidden">
                        <Chessboard 
                            fen={fen} 
                            onMove={handleMove} 
                            turn={chess?.turn()} 
                            playerColor={playerColor} 
                        />
                    </div>
                    {gameOver.over && (
                        <div className="mt-4 text-center p-4 bg-gray-800 rounded-lg">
                            <h2 className="text-2xl font-bold text-yellow-400">Game Over</h2>
                            <p>{gameOver.winner ? `${(gameOver.winner === game.creator ? whitePlayer.username : blackPlayer.username)} wins by ${gameOver.reason}!` : `Draw by ${gameOver.reason}!`}</p>
                        </div>
                    )}
                </div>

                {/* Right Panel (Game Controls & Info) */}
                <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                    <PlayerInfo player={whitePlayer} color="w" isTurn={chess?.turn() === 'w'} />
                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold mb-2">Moves</h2>
                        <MoveList history={history} />
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold mb-2">Chat</h2>
                        {user && <Chat gameId={gameId} user={user} />} 
                    </div>
                    {!gameOver.over && isMyTurn && (
                        <button className="btn btn-danger w-full" onClick={handleResign}>Resign</button>
                    )}
                </div>

            </div>
            {showPromotionModal && (
                <PromotionModal 
                    onSelect={handlePromotion} 
                    color={playerColor} 
                />
            )}
        </>
    );
}