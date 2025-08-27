import dynamic from 'next/dynamic';
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabasejs'
import { py } from '@/lib/api'
import NavBar from '@/components/NavBar'
import Timer from '@/components/Timer'
import MoveList from '@/components/MoveList'
import CapturedPieces from '@/components/CapturedPieces'
import { useSound } from '@/lib/useSound'
import Chat from '@/components/Chat'
import ThemeCustomizer, { BOARD_THEMES } from '@/components/ThemeCustomizer'
import toast from 'react-hot-toast';
import TagEditor from '@/components/TagEditor';
import GameSkeleton from '@/components/GameSkeleton';

const Chessboard = dynamic(() => import('chessboardjsx'), { ssr: false });

export default function Game(){
  const r = useRouter()
  const { id, spectate } = r.query
  const [user,setUser] = useState(null)
  const [profile,setProfile] = useState(null)
  const [game,setGame] = useState(null)
  const [logs,setLogs] = useState([])
  const [loading,setLoading] = useState(true)
  const [analysis,setAnalysis] = useState(false)
  const [ply,setPly] = useState(0) // for analysis
  const [lastMove, setLastMove] = useState(null)
  const [legalMoves, setLegalMoves] = useState({})
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [premove, setPremove] = useState(null)
  const [gameActions, setGameActions] = useState([])
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [preferences, setPreferences] = useState(null)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [openingName, setOpeningName] = useState('Unknown');
  const [presence, setPresence] = useState({})
  const { playMove, playCapture, playCheck } = useSound()
  const resignTimer = useRef(null);
  const [Chess, setChess] = useState(null);

  // VCR controls state
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1000); // milliseconds per move

  // Dynamically load Chess.js
  useEffect(() => {
    import('chess.js').then(module => {
      setChess(() => module.Chess);
    });
  }, []);

  // local derived
  const orientation = 'white' // could switch based on who is white
  const lastEpoch = useMemo(()=> (game ? new Date(game.last_move_at).getTime()/1000 : Date.now()/1000), [game])

  // Load auth and game
  useEffect(()=>{
    (async ()=>{
      const { data:auth } = await supabase.auth.getUser()
      if(!auth.user && !spectate){ r.replace('/login'); return }
      setUser(auth.user)
      if (auth.user) {
        const { data:prof } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single()
        setProfile(prof)
      }
    })()
  },[])

  async function loadAll(gid){
    const { data:g, error } = await supabase.from('games').select('*').eq('id', gid).single()
    if(error){ toast.error(error.message); r.push('/dashboard'); return }
    setGame(g)
    const { data:ml } = await supabase.from('move_logs').select('*').eq('game_id', gid).order('move_number', { ascending: true })
    setLogs(ml || [])
    setLoading(false)
  }

  useEffect(()=>{ if(id) loadAll(id) }, [id])

  // realtime: games + move_logs
  useEffect(()=>{
    if(!id || !user) return
    const ch = supabase.channel('realtime:game:'+id, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'games', filter:`id=eq.${id}` }, payload=>{
        const oldGame = game;
        const newGame = payload.new;
        setGame(newGame)

        if (oldGame && newGame.turn !== oldGame.turn && isMyTurn(newGame)) {
          toast.success("It's your turn!");
        }

        if (oldGame && newGame.status !== oldGame.status) {
          if (newGame.status === 'checkmate') toast.error('Checkmate!');
          if (newGame.status === 'stalemate') toast.warn('Stalemate!');
          if (newGame.status === 'draw') toast.info('Draw!');
          if (newGame.status === 'resigned') toast.info('Resigned!');
          if (newGame.status === 'timeout') toast.error('Timeout!');
        }
      })
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'move_logs', filter:`game_id=eq.${id}` }, payload=>{
        setLogs(prev => [...prev, payload.new])
      })
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'move_logs', filter:`game_id=eq.${id}` }, payload=>{
        setLogs(prev => prev.slice(0, -1))
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = ch.presenceState();
        setPresence(presenceState);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ online_at: new Date().toISOString() });
        }
      })
    return ()=>{ supabase.removeChannel(ch) }
  },[id, game, user])

  // Auto-resign on disconnect
  useEffect(() => {
    if (!game || !user || game.status !== 'in_progress' || !game.opponent) return;

    const opponentId = game.creator === user.id ? game.opponent : game.creator;
    const opponentIsPresent = Object.keys(presence).some(p => p === opponentId);

    if (!opponentIsPresent) {
      if (!resignTimer.current) {
        console.log('Opponent disconnected, starting 30s timer...');
        resignTimer.current = setTimeout(() => {
          const iAmWhite = game.creator === user.id;
          supabase.from('games').update({
            status: 'timeout',
            result: iAmWhite ? '1-0' : '0-1'
          }).eq('id', game.id).then(() => {
            toast.success('Opponent disconnected. You win by timeout!');
          });
        }, 30000); // 30 seconds
      }
    } else {
      if (resignTimer.current) {
        console.log('Opponent reconnected, clearing timer.');
        clearTimeout(resignTimer.current);
        resignTimer.current = null;
      }
    }

    return () => {
      if (resignTimer.current) {
        clearTimeout(resignTimer.current);
      }
    };
  }, [presence, game, user]);

  // Load preferences
  useEffect(() => {
    if (!user?.id) return
    supabase.from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setPreferences(data)
      })
  }, [user?.id])

  // Helpers
  function isMyTurn(g = null){
    const currentGame = g || game;
    if(!currentGame || !user) return false
    const iAmWhite = currentGame.creator === user.id
    return (currentGame.turn === 'white' && iAmWhite) || (currentGame.turn === 'black' && !iAmWhite)
  }

  // Move handler (on drop)
  async function onPieceDrop(fromSquare, toSquare, isPremove = false){
    if(!game || !Chess) return false
    if(game.status !== 'in_progress' && game.status !== 'waiting') return false

    if (!isMyTurn() && !isPremove) {
      // Queue premove if not your turn
      const chess = new Chess(game.fen);
      const moves = chess.moves({ square: fromSquare, verbose: true });
      const isLegal = moves.some(m => m.to === toSquare);
      if(isLegal) {
        setPremove({ from: fromSquare, to: toSquare });
        toast('Premove set!');
      }
      return;
    }

    const uci = fromSquare + toSquare
    try{
      const res = await py('/move', {
        method: 'POST',
        body: JSON.stringify({
          fen: game.fen,
          move: uci,
          white_time_left: game.white_time_left,
          black_time_left: game.black_time_left,
          last_move_epoch: new Date(game.last_move_at).getTime()/1000,
          increment_seconds: game.increment_seconds
        })
      })

      // Play appropriate sound
      const isCapture = res.san.includes('x');
      if (res.status === 'checkmate') {
        playCheck();
      } else if (res.san.includes('+')) {
        playCheck();
        toast.info('Check!');
      } else if (isCapture) {
        playCapture();
      } else {
        playMove();
      }

  // Set last move for highlighting
  setLastMove({ from: fromSquare, to: toSquare })
  setLegalMoves({})
  // Clear premove if this was a premove
  if (isPremove) setPremove(null);

      // Update DB: game row
      const update = {
        fen: res.fen,
        moves: [...(game.moves||[]), res.applied],
        status: res.status === 'in_progress' && game.status==='waiting' ? 'in_progress' : res.status,
        turn: res.turn,
        white_time_left: res.white_time_left,
        black_time_left: res.black_time_left,
        last_move_at: new Date(res.last_move_epoch*1000).toISOString(),
        result: res.result || game.result
      }
      const { error:ge } = await supabase.from('games').update(update).eq('id', game.id)
      if(ge) throw ge

      // Log move
      const move_number = (logs?.length || 0) + 1
      await supabase.from('move_logs').insert({
        game_id: game.id,
        move_number,
        uci: res.applied,
        san: res.san,
        played_by: user.id,
        time_taken_seconds: res.time_taken
      })

      // If ended, update ELOs (simple)
      if(res.status === 'checkmate' || res.status === 'stalemate' || res.status === 'draw' || res.status === 'timeout'){
        await updateElos(res.status, res.result)
      }

      return true
    }catch(e){
      toast.error(e.message)
      return false
    }
  }

  function onSquareClick(square) {
    if (!isMyTurn() || !Chess) return;

    // if a square is selected and a move is made, drop the piece
    if (selectedSquare && legalMoves[square]) {
        onPieceDrop(selectedSquare, square);
        setSelectedSquare(null);
        setLegalMoves({});
        return;
    }

    const chess = new Chess(game.fen);
    const moves = chess.moves({ square, verbose: true });

    const legalMovesForSquare = moves.reduce((acc, move) => {
      acc[move.to] = {
        background:
          chess.get(move.to) &&
          chess.get(move.to).color !== chess.get(square).color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
      return acc;
    }, {});

    setSelectedSquare(square);
    setLegalMoves(legalMovesForSquare);
  }

  async function updateElos(status, result){
    // very simple ELO update (K=32)
    const K = 32
    // load both players
    const { data:white } = await supabase.from('profiles').select('id,rating,wins,losses,draws').eq('id', game.creator).single()
    const { data:black } = await supabase.from('profiles').select('id,rating,wins,losses,draws').eq('id', game.opponent).single()
    if(!white || !black) return
    const Ra = white.rating, Rb = black.rating
    const Ea = 1/(1+Math.pow(10, (Rb-Ra)/400))
    const Eb = 1/(1+Math.pow(10, (Ra-Rb)/400))
    let Sa, Sb
    if(result === '1-0'){ Sa=1; Sb=0 }
    else if(result === '0-1'){ Sa=0; Sb=1 }
    else { Sa=0.5; Sb=0.5 }
    const newA = Math.round(Ra + K*(Sa-Ea))
    const newB = Math.round(Rb + K*(Sb-Eb))

    // Update ratings and stats
    await supabase.from('profiles').update({ 
      rating: newA, 
      wins: white.wins + (result === '1-0' ? 1 : 0),
      losses: white.losses + (result === '0-1' ? 1 : 0),
      draws: white.draws + (result === '1/2-1/2' ? 1 : 0)
    }).eq('id', white.id)

    await supabase.from('profiles').update({ 
      rating: newB, 
      wins: black.wins + (result === '0-1' ? 1 : 0),
      losses: black.losses + (result === '1-0' ? 1 : 0),
      draws: black.draws + (result === '1/2-1/2' ? 1 : 0)
    }).eq('id', black.id)

    // Log rating history
    await supabase.from('rating_history').insert([
      { user_id: white.id, game_id: game.id, rating_after_game: newA },
      { user_id: black.id, game_id: game.id, rating_after_game: newB }
    ])
  }

  async function undoLast(){
    if(!logs.length){ toast.error("No moves to undo."); return }
    // Only participants can undo
    if(!(user && (user.id===game.creator || user.id===game.opponent))){ return }
    // Only undo when game in progress
    if(!['in_progress','waiting'].includes(game.status)){ return }

    const res = await py('/undo', { method:'POST', body: JSON.stringify({
      moves: game.moves
    })})
    // delete last move log
    const last = logs[logs.length-1]
    await supabase.from('move_logs').delete().eq('id', last.id)
    // update game row with popped move
    const newMoves = game.moves.slice(0,-1)
    await supabase.from('games').update({
      fen: res.fen,
      moves: newMoves,
      status: 'in_progress',
      turn: res.turn
    }).eq('id', game.id)
  }

  async function exportPGN(){
    // Build player names
    const white = game.creator === user?.id ? profile?.username : 'White'
    const black = game.creator === user?.id ? 'Black' : 'Black'
    const res = await py('/pgn', { method:'POST', body: JSON.stringify({
      moves: game.moves,
      white: white,
      black: black,
      result: game.result || '*'
    })})
    const blob = new Blob([res.pgn], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `game_${game.id}.pgn`
    a.click()
    URL.revokeObjectURL(url)
    // store in DB
    await supabase.from('games').update({ pgn: res.pgn }).eq('id', game.id)
  }

  // Game action handlers
  async function createGameAction(actionType) {
    if (!game || !user) return
    const opponent = game.creator === user.id ? game.opponent : game.creator
    
    const { data, error } = await supabase.from('game_actions').insert({
      game_id: game.id,
      action_type: actionType,
      from_user: user.id,
      to_user: opponent
    })

    if (error) {
      toast.error(error.message)
      return
    }
    setPendingAction(data[0])
  }

  async function respondToAction(action, accept) {
    if (!action || !user) return
    
    const { error } = await supabase.from('game_actions')
      .update({ 
        status: accept ? 'accepted' : 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', action.id)

    if (error) {
      toast.error(error.message)
      return
    }

    if (accept) {
      switch (action.action_type) {
        case 'draw_offer':
          await supabase.from('games').update({
            status: 'draw',
            result: '1/2-1/2'
          }).eq('id', game.id)
          break
        
        case 'abort_request':
          if (game.moves.length <= 2) { // Allow abort only in first 2 moves
            await supabase.from('games').update({
              status: 'aborted'
            }).eq('id', game.id)
          }
          break
        
        case 'rematch_offer':
          // Create new game with reversed colors
          const { data } = await supabase.from('games').insert({
            creator: action.to_user, // Reversed roles
            opponent: action.from_user,
            initial_time_seconds: game.initial_time_seconds,
            increment_seconds: game.increment_seconds,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          }).select()
          if (data?.[0]) {
            r.push('/game/' + data[0].id)
          }
          break
      }
    }
  }

  // Handle resignation
  async function resign() {
    if (!game || !user) return
    const iAmWhite = game.creator === user.id
    await supabase.from('games').update({
      status: 'resigned',
      result: iAmWhite ? '0-1' : '1-0'
    }).eq('id', game.id)
  }

  // Check and execute premove
  useEffect(() => {
    if (isMyTurn() && premove && premove.from && premove.to) {
      onPieceDrop(premove.from, premove.to, true);
    }
  }, [game?.turn, premove]);

  // Load and subscribe to game actions
  useEffect(() => {
    if (!id || !user) return
    
    // Load existing actions
    supabase.from('game_actions')
      .select('*')
      .eq('game_id', id)
      .eq('status', 'pending')
      .then(({ data }) => {
        setGameActions(data || [])
      })

    // Subscribe to new actions
    const ch = supabase.channel('game_actions:'+id)
      .on('postgres_changes', { 
        event: '*',
        schema: 'public',
        table: 'game_actions',
        filter: `game_id=eq.${id}`
      }, payload => {
        if (payload.eventType === 'INSERT') {
          setGameActions(prev => [...prev, payload.new])
          if (payload.new.to_user === user.id) {
            if (payload.new.action_type === 'draw_offer') toast.info('Your opponent offered a draw.');
            if (payload.new.action_type === 'rematch_offer') toast.info('Your opponent offered a rematch.');
          }
        } else if (payload.eventType === 'UPDATE') {
          setGameActions(prev => prev.filter(a => a.id !== payload.new.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [id, user])

  if(loading) return <GameSkeleton />;

  if (game && game.status === 'waiting' && (!game.opponent || game.opponent === game.creator)) {
    return (
      <>
        <NavBar user={user} />
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0e141b] text-white">
          <div className="bg-[#1a2233] p-8 rounded-lg shadow-lg w-full max-w-md text-center">
            <h2 className="text-2xl font-bold mb-6">Waiting for opponent...</h2>
            <div className="p-4 rounded-full border-4 border-blue-500 border-t-transparent animate-spin w-12 h-12 mx-auto" />
            {game.invite_code && (
              <div className="mb-4 mt-4">
                <p className="text-gray-400">Share this code with your friend to join:</p>
                <div
                  className="font-mono text-2xl p-2 bg-gray-800 rounded inline-block mt-2 cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(game.invite_code);
                    toast.success('Invite code copied to clipboard!');
                  }}
                >
                  {game.invite_code}
                </div>
              </div>
            )}
            {!game.invite_code && (
              <p className="text-gray-400 mt-4">Searching for a random opponent...</p>
            )}
            <button
              className="btn w-full mt-6 bg-red-600 hover:bg-red-700"
              onClick={async () => {
                toast('Cancelling game...');
                await supabase.from('games').delete().eq('id', game.id);
                r.push('/dashboard');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    );
  }

  const isSpectator = !!spectate;
  const runningWhite = game.turn==='white' && game.status==='in_progress'
  const runningBlack = game.turn==='black' && game.status==='in_progress'

  async function handleAnnotate(logId, annotation) {
    const { error } = await supabase
      .from('move_logs')
      .update({ annotation })
      .eq('id', logId)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Annotation saved!')
      // Refresh logs
      const { data:ml } = await supabase.from('move_logs').select('*').eq('game_id', id).order('move_number', { ascending: true })
      setLogs(ml || [])
    }
  }

  async function handleSavePosition() {
    if (!game || !user || !Chess) return;

    const chess = new Chess();
    for (let i = 0; i < ply; i++) {
      chess.move(logs[i].uci);
    }
    const fen = chess.fen();

    const { error } = await supabase.from('saved_positions').insert({
      user_id: user.id,
      fen: fen,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Position saved!');
    }
  }

  const [moveInput, setMoveInput] = useState('');

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Enter') {
        if (moveInput.length === 4) {
          onPieceDrop(moveInput.slice(0, 2), moveInput.slice(2, 4));
          setMoveInput('');
        }
      } else if (event.key.length === 1 && /[a-h1-8]/.test(event.key)) {
        setMoveInput(prev => prev + event.key);
      } else if (event.key === 'Backspace') {
        setMoveInput(prev => prev.slice(0, -1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveInput]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!selectedSquare) {
        setSelectedSquare('e4'); // Start at the center
        return;
      }

      const file = selectedSquare.charCodeAt(0);
      const rank = parseInt(selectedSquare.charAt(1));

      let newFile = file;
      let newRank = rank;

      switch (event.key) {
        case 'ArrowUp':
          newRank = Math.min(8, rank + 1);
          break;
        case 'ArrowDown':
          newRank = Math.max(1, rank - 1);
          break;
        case 'ArrowLeft':
          newFile = Math.max('a'.charCodeAt(0), file - 1);
          break;
        case 'ArrowRight':
          newFile = Math.min('h'.charCodeAt(0), file + 1);
          break;
        case 'Enter':
          if (legalMoves[selectedSquare]) {
            onPieceDrop(selectedSquare, selectedSquare);
            setSelectedSquare(null);
            setLegalMoves({});
          } else {
            onSquareClick(selectedSquare);
          }
          return; // Don't update selectedSquare
        default:
          return; // Ignore other keys
      }

      setSelectedSquare(String.fromCharCode(newFile) + newRank);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSquare, legalMoves]);

  // Analysis mode: board position by ply (client-side naive)
  const positionMoves = analysis ? game.moves.slice(0,ply) : game.moves

  useEffect(() => {
    if (logs.length > 0 && Chess) {
      const chess = new Chess();
      let pgn = '';
      for (const log of logs) {
        chess.move(log.uci);
        pgn += `${log.san} `;
      }
      // This part needs a library like 'eco-pgn' which is not in dependencies.
      // I will comment it out to avoid errors.
      // const opening = eco.find(pgn.trim());
      // if (opening) {
      //   setOpeningName(`${opening.name} (${opening.eco_code})`);
      // } else {
      //   setOpeningName('Unknown');
      // }
    }
  }, [logs, Chess]);

  // VCR playback
  useEffect(() => {
    let interval;
    if (isPlaying && analysis && ply < logs.length) {
      interval = setInterval(() => {
        setPly(prevPly => prevPly + 1);
      }, replaySpeed);
    } else if (ply >= logs.length) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, analysis, ply, logs.length, replaySpeed]);

  return (
    <>
      <NavBar user={user}/>
      {isSpectator && <div className="text-center p-2 bg-blue-900 text-white">Spectator Mode: You are viewing this game as a spectator. You cannot make moves.</div>}
      <div className="container grid md:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-muted">Game</div>
                <div className="font-bold">{id}</div>
              </div>
              <div className="flex gap-2 items-center">
                <Timer base={game.white_time_left} running={runningWhite} lastEpoch={lastEpoch}/>
                <Timer base={game.black_time_left} running={runningBlack} lastEpoch={lastEpoch}/>
              </div>
            </div>

            <div className="w-full max-w-screen-md mx-auto">
              <div className="rounded-xl overflow-hidden border border-[#233041]">
                <Chessboard
                  position={game.fen}
                  width={400}
                  orientation={orientation}
                  lightSquareStyle={{ backgroundColor: BOARD_THEMES[preferences?.board_theme || 'default'].light }}
                  darkSquareStyle={{ backgroundColor: BOARD_THEMES[preferences?.board_theme || 'default'].dark }}
                  onDrop={({ sourceSquare, targetSquare }) => !isSpectator && onPieceDrop(sourceSquare, targetSquare)}
                  draggable={!isSpectator && game.status!=='timeout' && game.status!=='checkmate' && game.status!=='stalemate' && game.status!=='draw'}
                  squareStyles={{
                    ...legalMoves,
                    ...(lastMove ? {
                      [lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.2)' },
                      [lastMove.to]: { backgroundColor: 'rgba(255, 255, 0, 0.2)' }
                    } : {}),
                    ...({
                      [selectedSquare]: { backgroundColor: 'rgba(0, 255, 0, 0.2)' }
                    }),
                    ...(premove ? {
                      [premove.from]: { backgroundColor: 'rgba(0, 0, 255, 0.2)' },
                      [premove.to]: { backgroundColor: 'rgba(0, 0, 255, 0.2)' }
                    } : {}),
                  }}
                />
              </div>
            </div>

            <div className="mt-3">
              <p className="text-center text-muted">Keyboard input: {moveInput}</p>
              {premove && <p className="text-center text-blue-400">Premove: {premove.from} → {premove.to}</p>}
            </div>

            <div className="mt-3">
              <CapturedPieces fen={game.fen} moves={game.moves} />
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn" onClick={()=>loadAll(id)}>Refresh</button>
              <button className="btn" onClick={undoLast}>Undo</button>
              <button className="btn" onClick={exportPGN}>Export PGN</button>
              <button className="btn" onClick={() => {
                navigator.clipboard.writeText(game.fen);
                toast.success('FEN copied to clipboard!');
              }}>Copy FEN</button>
              <button className="btn" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Game URL copied to clipboard!');
              }}>Share Game</button>
              <button className="btn" onClick={() => {
                const sanMoves = logs.map(log => log.san).join(' ');
                navigator.clipboard.writeText(sanMoves);
                toast.success('Moves (SAN) copied to clipboard!');
              }}>Copy SAN</button>
              <button className="btn" onClick={()=>setAnalysis(a=>!a)}>{analysis?'Exit Analysis':'Analysis Mode'}</button>
              <button className="btn" onClick={()=>setShowCustomizer(s=>!s)}>
                {showCustomizer ? 'Hide Settings' : 'Settings'}
              </button>
              
              {/* Game action buttons */}
              {game.status === 'in_progress' && (
                <>
                  <button 
                    className="btn bg-yellow-600 hover:bg-yellow-700" 
                    onClick={() => createGameAction('draw_offer')}
                  >
                    Offer Draw
                  </button>
                  <button 
                    className="btn bg-red-600 hover:bg-red-700" 
                    onClick={resign}
                  >
                    Resign
                  </button>
                  {game.moves.length <= 2 && (
                    <button 
                      className="btn bg-orange-600 hover:bg-orange-700"
                      onClick={() => createGameAction('abort_request')}
                    >
                      Abort Game
                    </button>
                  )}
                </>
              )}
              
              {game.status !== 'in_progress' && game.status !== 'waiting' && (
                <button 
                  className="btn bg-green-600 hover:bg-green-700"
                  onClick={() => createGameAction('rematch_offer')}
                >
                  Offer Rematch
                </button>
              )}
            </div>

            {game && <TagEditor game={game} />}

            {showCustomizer && (
              <div className="mt-3">
                <ThemeCustomizer userId={user?.id} />
              </div>
            )}

            {/* Game action notifications */}
            {gameActions.filter(a => a.to_user === user?.id).map(action => (
              <div key={action.id} className="mt-3 p-3 rounded-lg bg-[#233041] flex items-center justify-between">
                <div>
                  {action.action_type === 'draw_offer' && 'Draw offered'}
                  {action.action_type === 'abort_request' && 'Abort requested'}
                  {action.action_type === 'rematch_offer' && 'Rematch offered'}
                </div>
                <div className="flex gap-2">
                  <button 
                    className="btn bg-green-600 hover:bg-green-700"
                    onClick={() => respondToAction(action, true)}
                  >
                    Accept
                  </button>
                  <button 
                    className="btn bg-red-600 hover:bg-red-700"
                    onClick={() => respondToAction(action, false)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}

            {analysis && (
              <div className="mt-3 flex gap-2 items-center">
                <button className="btn" onClick={()=>setPly(p=>Math.max(0,p-1))}>Prev</button>
                <div className="px-3 py-2 rounded-xl bg-[#0e141b] border border-[#233041]">{ply}/{game.moves.length}</div>
                <button className="btn" onClick={()=>setPly(p=>Math.min(game.moves.length,p+1))}>Next</button>
                <button className="btn" onClick={() => setIsPlaying(true)} disabled={isPlaying || ply >= logs.length}>Play</button>
                <button className="btn" onClick={() => setIsPlaying(false)} disabled={!isPlaying}>Pause</button>
                <select 
                  className="input w-auto"
                  value={replaySpeed}
                  onChange={(e) => setReplaySpeed(Number(e.target.value))}
                >
                  <option value={2000}>0.5x</option>
                  <option value={1000}>1x</option>
                  <option value={500}>2x</option>
                  <option value={250}>4x</option>
                </select>
                <button className="btn" onClick={handleSavePosition}>Save Position</button>
              </div>
            )}

            <div className="mt-3 text-muted">
              Turn: <b className="text-text">{game.turn}</b> | Status: <b className="text-text">{game.status}</b> {game.result ? `| Result: ${game.result}`:''}
              {openingName && <p className="text-sm text-muted">Opening: {openingName}</p>}
            </div>
          </div>

          <div className="card">
            <Chat
              gameId={id}
              user={user}
              disabled={![`in_progress`, `waiting`].includes(game.status)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xl font-bold mb-2">Moves</h3>
            <MoveList logs={logs} onAnnotate={handleAnnotate} />
          </div>
        </div>
      </div>
    </>
  )
}