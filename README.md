# Chess Web App (Next.js + Flask + Supabase)
Features:
- Tailwind UI + react-chessboard
- Supabase Auth (login/register)
- Invite/join by code
- Timers (initial + increment), timeout detection
- Move logs (SAN + UCI) with realtime updates
- Undo (takeback)
- PGN export
- Analysis mode (replay)
- ELO updates after game end
- Vercel-ready (frontend + Python serverless at /py/*)

## Local Quick Start
1) Create a FREE Supabase project and copy:
   - Project URL
   - ANON KEY

2) In Supabase SQL Editor, run `supabase/schema.sql`.
   - Enable Realtime on tables: `games` and `move_logs`.

3) Create `frontend/.env.local` with:
   NEXT_PUBLIC_SUPABASE_URL=YOUR_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

4) Install & run:
   - Python deps:  pip install -r backend/requirements.txt
   - Backend:      python backend/app.py  (http://localhost:8000)
   - Node deps:    cd frontend && npm install
   - Frontend:     npm run dev            (http://localhost:3000)

## Deploy to Vercel
- Set env vars in Vercel: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- Import GitHub repo or use `vercel` CLI from repo root.
"# chess_game" 
