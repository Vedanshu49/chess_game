import time
from flask import Flask, jsonify, request
from flask_cors import CORS
import chess
import chess.pgn
from io import StringIO

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

def board_to_grid(board: chess.Board):
    grid = []
    for rank in range(7, -1, -1):
        row = []
        for file in range(8):
            sq = chess.square(file, rank)
            piece = board.piece_at(sq)
            row.append(piece.symbol() if piece else ".")
        grid.append(row)
    return grid

def status_from_board(board: chess.Board):
    if board.is_checkmate():
        return "checkmate"
    if board.is_stalemate():
        return "stalemate"
    if board.can_claim_fifty_moves() or board.can_claim_threefold_repetition() or board.is_insufficient_material():
        return "draw"
    return "in_progress"

@app.get("/py/health")
def health():
    return jsonify({"ok": True, "ts": time.time()})

@app.get("/py/newgame")
def newgame():
    board = chess.Board()
    return jsonify({
        "ok": True,
        "fen": board.fen(),
        "grid": board_to_grid(board),
        "turn": "white" if board.turn else "black",
        "legal_moves": [m.uci() for m in board.legal_moves],
        "status": status_from_board(board),
        "now_epoch": time.time()
    })

@app.post("/py/status")
def status():
    data = request.get_json(force=True) or {}
    fen = data.get("fen")
    if not fen:
        return jsonify({"ok": False, "error": "fen required"}), 400
    try:
        board = chess.Board(fen)
    except Exception:
        return jsonify({"ok": False, "error": "invalid FEN"}), 400
    return jsonify({
        "ok": True,
        "grid": board_to_grid(board),
        "turn": "white" if board.turn else "black",
        "legal_moves": [m.uci() for m in board.legal_moves],
        "status": status_from_board(board)
    })

@app.post("/py/move")
def move():
    """
    Request JSON:
    {
      "fen": "...",
      "move": "e2e4",
      "white_time_left": 600,  // seconds
      "black_time_left": 600,
      "last_move_epoch": 1710000000.0, // seconds epoch of last move
      "increment_seconds": 0
    }
    """
    data = request.get_json(force=True) or {}
    fen = data.get("fen")
    move_uci = data.get("move")
    wleft = int(data.get("white_time_left", 600))
    bleft = int(data.get("black_time_left", 600))
    last_epoch = float(data.get("last_move_epoch", time.time()))
    inc = int(data.get("increment_seconds", 0))

    if not fen or not move_uci:
        return jsonify({"ok": False, "error": "fen and move required"}), 400

    try:
        board = chess.Board(fen)
    except Exception:
        return jsonify({"ok": False, "error": "invalid FEN"}), 400

    try:
        mv = chess.Move.from_uci(move_uci)
    except Exception:
        return jsonify({"ok": False, "error": "invalid move format"}), 400

    if mv not in board.legal_moves:
        return jsonify({"ok": False, "error": "illegal move"}), 400

    # Time accounting
    now = time.time()
    elapsed = max(0, now - last_epoch)
    mover_is_white = board.turn  # before push
    try:
        san = board.san(mv)
    except Exception:
        san = move_uci
    board.push(mv)

    if mover_is_white:
        wleft = max(0, wleft - int(round(elapsed)) + inc)
    else:
        bleft = max(0, bleft - int(round(elapsed)) + inc)

    # Determine status, including timeout
    status = status_from_board(board)
    result = None
    if (mover_is_white and wleft <= 0) or ((not mover_is_white) and bleft <= 0):
        status = "timeout"
        result = "0-1" if mover_is_white else "1-0"
    elif status == "checkmate":
        # side to move after push is loser
        result = "1-0" if not board.turn else "0-1"
    elif status == "stalemate" or status == "draw":
        result = "1/2-1/2"

    return jsonify({
        "ok": True,
        "fen": board.fen(),
        "grid": board_to_grid(board),
        "turn": "white" if board.turn else "black",
        "legal_moves": [m.uci() for m in board.legal_moves],
        "status": status,
        "applied": move_uci,
        "san": san,
        "white_time_left": wleft,
        "black_time_left": bleft,
        "last_move_epoch": now,
        "result": result,
        "time_taken": int(round(elapsed))
    })

@app.post("/py/undo")
def undo():
    """
    Rewind one ply.
    Request: { "moves": ["e2e4","e7e5",...], "start_fen": "optional" }
    """
    data = request.get_json(force=True) or {}
    moves = data.get("moves", [])
    start_fen = data.get("start_fen")

    board = chess.Board(start_fen) if start_fen else chess.Board()
    if not moves:
        return jsonify({"ok": False, "error": "no moves to undo"}), 400

    # Play all except last
    for u in moves[:-1]:
        board.push(chess.Move.from_uci(u))

    return jsonify({
        "ok": True,
        "fen": board.fen(),
        "grid": board_to_grid(board),
        "turn": "white" if board.turn else "black",
        "legal_moves": [m.uci() for m in board.legal_moves],
        "undone": moves[-1]
    })

@app.post("/py/pgn")
def pgn():
    """
    Build PGN from moves and optional headers
    Request: { "moves": ["e2e4",...], "white": "Alice", "black": "Bob", "result":"1-0" }
    """
    data = request.get_json(force=True) or {}
    moves = data.get("moves", [])
    white = data.get("white", "White")
    black = data.get("black", "Black")
    result = data.get("result", "*")

    game = chess.pgn.Game()
    game.headers["Event"] = "Casual Game"
    game.headers["White"] = white
    game.headers["Black"] = black
    game.headers["Result"] = result

    node = game
    board = chess.Board()
    for u in moves:
        mv = chess.Move.from_uci(u)
        if mv in board.legal_moves:
            node = node.add_variation(mv)
            board.push(mv)
        else:
            break

    game.headers["Result"] = result
    exporter = StringIO()
    print(game, file=exporter, end="\n")
    return jsonify({ "ok": True, "pgn": exporter.getvalue() })

# Friend endpoints
# Note: These would typically interact with a database, but for this example
# we are keeping it simple. We'll assume the frontend handles the Supabase
# interactions directly for friends. This is just a placeholder.

@app.post("/py/friends/add")
def add_friend():
    data = request.get_json(force=True) or {}
    # In a real app, you'd get user_id from a session/token
    # and friend_id from the request body.
    # Then you'd insert into the `friends` table.
    return jsonify({"ok": True, "message": "Friend request sent"})

@app.post("/py/friends/accept")
def accept_friend():
    data = request.get_json(force=True) or {}
    # Here you'd update the `friends` table to set status='accepted'
    return jsonify({"ok": True, "message": "Friend request accepted"})

@app.post("/py/friends/reject")
def reject_friend():
    data = request.get_json(force=True) or {}
    # Here you'd update the `friends` table to set status='rejected'
    # or delete the row.
    return jsonify({"ok": True, "message": "Friend request rejected"})

@app.get("/py/friends")
def get_friends():
    # Here you'd query the `friends` table for the user's friends.
    # This would involve a join with the `profiles` table to get friend details.
    return jsonify({"ok": True, "friends": []})

@app.post("/py/challenges/create")
def create_challenge():
    data = request.get_json(force=True) or {}
    # In a real app, you'd get the challenger's ID from a session/token
    # and the opponent's ID from the request body.
    # Then you'd create a new game in the `games` table.
    return jsonify({"ok": True, "message": "Challenge created"})



from flask import Flask
app = Flask(__name__)

@app.route("/")
def home():
    return "Hello, Flask is running!"

if __name__ == "__main__":
    app.run(debug=True)