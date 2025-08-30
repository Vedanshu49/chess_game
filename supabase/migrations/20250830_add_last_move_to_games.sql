-- Migration: add last_move jsonb column to games
BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS last_move jsonb DEFAULT NULL;

COMMIT;
